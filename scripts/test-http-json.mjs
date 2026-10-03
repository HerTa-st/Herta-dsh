/**
 * `http-json.js` 的接口测试。
 *
 * ## 为什么值得单独一条（2026-10-03 架构审查 candidate #7）
 *
 * 这个模块只有两个导出，却承担两条自带端点的**全部边界行为**：按上限收体、
 * 把坏 JSON 变成 400、超限回 413 而不是断连。它此前**零直接测试** —— 只有
 * `test-minimax-pipeline` / `test-minimax-voice-route` 间接走到其中一部分。
 *
 * ## 它测的是 interface，不是实现
 *
 * `sendJson(res, status, value)` 与 `readJsonBody(req, res, max) => Promise<value|undefined>`
 * 就是全部 interface：这里给假 req/res，断言**写出去的响应**与**返回的值**。
 * 于是「已经回过响应就返回 undefined（调用方不要重复 writeHead）」这条契约
 * 变成可断言的事实 —— 它之前只写在注释里。
 *
 * 用法：node scripts/test-http-json.mjs
 */
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { readJsonBody, sendJson } = await import(
  pathToFileURL(join(here, "..", "src", "host", "http-json.js")).href
);

let passed = 0;
let failed = 0;
function check(ok, label, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
  }
}

/** 假响应：记录每次 writeHead / end。 */
function fakeRes() {
  const writes = [];
  return {
    writes,
    writeHead(status, headers) {
      writes.push({ kind: "head", status, headers });
    },
    end(body) {
      writes.push({ kind: "end", body });
    },
    /** 最后一次响应的 { status, headers, json }；没响应过则 null。 */
    last() {
      const head = [...writes].reverse().find((w) => w.kind === "head");
      const end = [...writes].reverse().find((w) => w.kind === "end");
      if (head === undefined) return null;
      return {
        status: head.status,
        headers: head.headers,
        json: end === undefined ? null : JSON.parse(end.body),
      };
    },
  };
}

/** 假请求：把若干块按顺序 emit 出去（可选在之后 emit error）。 */
function fakeReq(chunks, { errorAfter = false, destroyLog = [] } = {}) {
  const req = new EventEmitter();
  req.destroy = () => {
    destroyLog.push("destroy");
  };
  // 下一个 tick 再 emit：让调用方先挂上监听器（真实流也是这样）。
  setImmediate(() => {
    for (const c of chunks) req.emit("data", Buffer.from(c));
    if (errorAfter) {
      req.emit("error", new Error("socket gone"));
      return;
    }
    req.emit("end");
  });
  return req;
}

console.log("=== sendJson：状态、头、JSON 体 ===");
{
  const res = fakeRes();
  sendJson(res, 200, { ok: true, n: 1 });
  const got = res.last();
  check(got?.status === 200, "状态码原样传出");
  check(
    got?.headers?.["Content-Type"] === "application/json; charset=utf-8",
    "Content-Type 带 charset（中文值不会乱码）",
  );
  check(got?.headers?.["Cache-Control"] === "no-store", "Cache-Control: no-store（实时状态不许缓存）");
  check(got?.json?.ok === true && got?.json?.n === 1, "体是 JSON 序列化的值");
}

console.log("\n=== readJsonBody：正常路径 ===");
{
  const res = fakeRes();
  const value = await readJsonBody(fakeReq(['{"action":"adopt"}']), res, 4096);
  check(value?.action === "adopt", "解析出对象");
  check(res.writes.length === 0, "正常情况下不自己回响应");
}
{
  const res = fakeRes();
  const value = await readJsonBody(fakeReq([]), res, 4096);
  check(
    typeof value === "object" && value !== null && Object.keys(value).length === 0,
    "空体是 {}（不是 undefined、也不是 null）",
  );
  check(res.writes.length === 0, "空体也不算错误");
}

console.log("\n=== readJsonBody：坏 JSON → 400，且返回 undefined ===");
{
  const res = fakeRes();
  const value = await readJsonBody(fakeReq(["{not json"]), res, 4096);
  check(value === undefined, "返回值是 undefined（调用方据此收手）");
  check(res.last()?.status === 400, "回了 400");
  check(String(res.last()?.json?.error).startsWith("bad json"), "错误信息说明是坏 JSON");
  check(res.writes.filter((w) => w.kind === "head").length === 1, "只 writeHead 一次（不重复回）");
}

console.log("\n=== readJsonBody：超限 → 413，且返回 undefined ===");
{
  const res = fakeRes();
  const value = await readJsonBody(fakeReq(["x".repeat(100), "y".repeat(100)]), res, 120);
  check(value === undefined, "超限返回 undefined");
  check(res.last()?.status === 413, "回了 413（不是静默截断）");
  check(res.last()?.json?.error === "body too large", "理由明确");
}
{
  // 关键契约：超限之后**不再写第二份响应**。真实事故是「413 被 TCP RST 截掉」，
  // 所以 413 必须发出去且后续字节只数不存。
  const res = fakeRes();
  const destroyLog = [];
  const req = fakeReq(["x".repeat(50), "y".repeat(50), "z".repeat(50)], { destroyLog });
  const value = await readJsonBody(req, res, 60);
  await new Promise((r) => setTimeout(r, 20));
  check(value === undefined, "超限后返回 undefined");
  check(res.writes.filter((w) => w.kind === "head").length === 1, "后续字节不再触发第二次响应");
  check(
    res.last()?.status === 413,
    "最后那份响应仍是 413（没有被后续块覆盖成别的状态）",
    JSON.stringify(res.writes),
  );
  check(destroyLog.length === 0, "没超宽限上限 → 不断连（让 413 有机会送达）");
}

console.log("\n=== readJsonBody：超过宽限上限才断连（防灌） ===");
{
  const res = fakeRes();
  const destroyLog = [];
  // maxBytes=10 → 宽限 40；喂 300 字节，必然越过宽限。
  const chunks = Array.from({ length: 6 }, () => "x".repeat(50));
  const value = await readJsonBody(fakeReq(chunks, { destroyLog }), res, 10);
  await new Promise((r) => setTimeout(r, 20));
  check(value === undefined, "仍然返回 undefined");
  check(destroyLog.length >= 1, "越过宽限 → 真的断连");
  check(res.last()?.status === 413, "断连前 413 已经发出");
}

console.log("\n=== readJsonBody：请求流自身出错 → 400 ===");
{
  const res = fakeRes();
  const value = await readJsonBody(fakeReq([], { errorAfter: true }), res, 4096);
  check(value === undefined, "返回 undefined");
  check(res.last()?.status === 400, "回了 400");
  check(res.last()?.json?.error === "request error", "理由是 request error");
}

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
