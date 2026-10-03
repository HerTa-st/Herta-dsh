/**
 * `tar-extract.js` 的接口测试。
 *
 * ## 为什么值得单独一条（2026-10-03 架构审查 candidate #7）
 *
 * 这个 module 是**解包安全边界**的实现：它拒绝一切路径逃逸、非 ustar、未知类型、
 * 超大归档、截断流。但在这之前它只有**间接**覆盖（`test-voice-model` 用真归档走
 * 成功路径），拒绝分支一条都没测过 —— 而那正是「出事时才会走到」的分支。
 *
 * ## 与 `test-voice-model.mjs` 的分工
 *
 * 那边（语音域）已经把**成功路径**走过了：小 tar 写入器造归档 → `extractTar` →
 * 断言解出来的文件，外加路径逃逸 / maxBytes / 截断三条。本测试**不重复**那些，
 * 专补它没碰的**拒绝分支**（坏校验和、非 ustar、未知类型、目录带 size、NUL 路径、
 * ustar 的 prefix 字段、无结尾块）与 `safeEntryPath` 的完整拒绝形态。
 *
 * ⚠️ 一条仓库约定（那边也标过）：**目录条目的名字不带尾斜杠**（与上游
 * `tar-pack.mjs` 一致）。所以目录写成 `name: "sub"`, `type: "5"`，而不是 `"sub/"` ——
 * 后者会被 `safeEntryPath` 当「空段」拒掉，那是**正确行为**（见下面那条断言）。
 *
 * 用法：node scripts/test-tar-extract.mjs
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { extractTar, safeEntryPath, tarTargetPath } = await import(
  pathToFileURL(join(here, "..", "src", "host", "tar-extract.js")).href
);

const SCRATCH = mkdtempSync(join(tmpdir(), "herta-tar-"));
let caseId = 0;
/** 每个用例一个干净目录 —— 免得上一个用例留下的文件把断言搞混。 */
function scratchDir() {
  caseId += 1;
  return join(SCRATCH, `case-${caseId}`);
}

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

/** 八进制字段（tar 的经典写法：N 位八进制 + NUL/空格补齐）。 */
const octal = (value, width) => value.toString(8).padStart(width - 1, "0") + "\0";

/**
 * 造一个 512 字节的 ustar 头。
 *
 * 校验和算法与 tar-extract.js 的 `checksumOk` 对应：先把 checksum 字段置为 8 个
 * 空格，再把整块按字节求和，最后把和写成八进制。
 */
function tarHeader({ name, size = 0, type = "0", prefix = "", magic = "ustar", mode = 0o644 }) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, "utf8");
  h.write(octal(mode, 8), 100, 8);
  h.write(octal(0, 8), 108, 8);
  h.write(octal(0, 8), 116, 8);
  h.write(octal(size, 12), 124, 12);
  h.write(octal(0, 12), 136, 12);
  h.write("        ", 148, 8); // checksum 先占位为空格
  h.write(type, 156, 1);
  h.write(`${magic}\0`, 257, 6);
  h.write("00", 263, 2);
  h.write(prefix, 345, 155);
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += h[i];
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return h;
}

/** 一个条目：头 + 数据 + 补齐到 512 的倍数。 */
function tarEntry({ name, body = "", type = "0", prefix = "", magic = "ustar", declaredSize = null }) {
  const data = Buffer.from(body, "utf8");
  const size = declaredSize === null ? data.length : declaredSize;
  const pad = (512 - (size % 512)) % 512;
  return Buffer.concat([tarHeader({ name, size, type, prefix, magic }), data, Buffer.alloc(pad)]);
}

/** 两片空块收尾（严格的 tar 结尾）。 */
const TAR_END = Buffer.alloc(1024);

/** 把 Buffer 包成 `extractTar` 要的异步可迭代流。 */
async function* asStream(buffer, chunkSize = 8192) {
  for (let i = 0; i < buffer.length; i += chunkSize) {
    yield buffer.subarray(i, i + chunkSize);
  }
}

/** 断言一次 extractTar 抛错（返回错误信息供断言用）。 */
async function rejects(buffer, { maxBytes = 1_000_000 } = {}) {
  const dest = scratchDir();
  try {
    await extractTar(asStream(buffer), dest, { maxBytes });
    return { threw: false };
  } catch (error) {
    return { threw: true, message: String(error?.message ?? error) };
  }
}

console.log("=== safeEntryPath：逃逸与畸形路径一律拒绝（interface 直测）===");
{
  const dest = join(SCRATCH, "root");
  const okCases = ["a.txt", "dir/a.txt", "dir/sub/a.txt"];
  for (const entry of okCases) {
    let threw = false;
    let got = null;
    try {
      got = safeEntryPath(dest, entry);
    } catch {
      threw = true;
    }
    check(
      threw === false && got === tarTargetPath(dest, entry),
      `接受并解析相对路径：${entry}`,
      String(got),
    );
  }

  const bad = [
    ["../evil.txt", "上一级"],
    ["dir/../../evil.txt", "中间夹 .."],
    ["/etc/passwd", "绝对路径"],
    ["dir\\evil.txt", "反斜杠"],
    ["dir//a.txt", "空段"],
    ["dir/./a.txt", "点段"],
    ["dir/..", "尾段是 .."],
    ["", "空串"],
    // 仓库约定：目录条目不带尾斜杠（写 "sub/" 是不合规的 tar）—— 空段会被拒。
    ["sub/", "尾斜杠造成的空段"],
  ];
  for (const [entry, why] of bad) {
    let message = null;
    try {
      safeEntryPath(dest, entry);
    } catch (error) {
      message = String(error?.message ?? error);
    }
    check(message !== null && message.includes("refusing tar entry path"), `拒绝（${why}）：${JSON.stringify(entry)}`, String(message));
  }

  // NUL 字节单独一条：它在 JSON.stringify 里看不见，但必须被拒。
  let nulMessage = null;
  try {
    safeEntryPath(dest, "dir/a\0b.txt");
  } catch (error) {
    nulMessage = String(error?.message ?? error);
  }
  check(nulMessage !== null, "拒绝带 NUL 的路径");
}

console.log("\n=== 成功路径：普通文件与目录 ===");
{
  const dest = scratchDir();
  const tar = Buffer.concat([
    tarEntry({ name: "hello.txt", body: "你好，tar" }),
    tarEntry({ name: "sub", type: "5" }), // 目录：名字不带尾斜杠
    tarEntry({ name: "sub/inner.txt", body: "inner" }),
    TAR_END,
  ]);
  const result = await extractTar(asStream(tar), dest, { maxBytes: 1_000_000 });
  check(result.files === 2, "解出 2 个普通文件（目录不计入 files）", JSON.stringify(result));
  check(
    readFileSync(join(dest, "hello.txt"), "utf8") === "你好，tar",
    "文件内容逐字正确（多字节 UTF-8 不截断）",
  );
  check(readFileSync(join(dest, "sub", "inner.txt"), "utf8") === "inner", "子目录里的文件也在");
}
{
  // prefix 字段（ustar 的长路径机制）：entry = `${prefix}/${name}`。
  const dest = scratchDir();
  const tar = Buffer.concat([
    tarEntry({ name: "deep.txt", prefix: "a/b", body: "x" }),
    TAR_END,
  ]);
  await extractTar(asStream(tar), dest, { maxBytes: 1_000_000 });
  check(existsSync(join(dest, "a", "b", "deep.txt")), "prefix + name 拼出目标路径");
}
{
  // 没有两片空块结尾也接受（代码注释写明：clean end without the zero blocks）。
  const dest = scratchDir();
  const tar = tarEntry({ name: "only.txt", body: "no end marker" });
  const result = await extractTar(asStream(tar), dest, { maxBytes: 1_000_000 });
  check(result.files === 1, "没有 tar 结尾标记也接受");
}

console.log("\n=== 拒绝路径：逃逸的文件一个字节都不许落地 ===");
{
  const outside = join(SCRATCH, "escaped.txt");
  const r = await rejects(Buffer.concat([tarEntry({ name: "../escaped.txt", body: "pwn" }), TAR_END]));
  check(r.threw && r.message.includes("refusing tar entry path"), "回到上一级的条目被拒", r.message);
  check(existsSync(outside) === false, "目标目录之外没有生成文件");
}

console.log("\n=== 拒绝路径：格式与流异常 ===");
{
  const corrupted = tarEntry({ name: "a.txt", body: "hi" });
  corrupted.write("000000", 148, 6); // 改坏校验和
  const r = await rejects(Buffer.concat([corrupted, TAR_END]));
  check(r.threw && r.message.includes("bad tar header checksum"), "坏校验和被拒", r.message);
}
{
  const r = await rejects(
    Buffer.concat([tarEntry({ name: "a.txt", body: "hi", magic: "GNUtar" }), TAR_END]),
  );
  check(r.threw && r.message.includes("not a ustar archive"), "非 ustar 魔数被拒", r.message);
}
{
  // 目录条目带 size（合规的 tar 里目录 size 恒为 0）。
  const r = await rejects(Buffer.concat([tarEntry({ name: "d", type: "5", body: "x" }), TAR_END]));
  check(r.threw && r.message.includes("directory entry with a size"), "目录条目带 size 被拒", r.message);
}
{
  const r = await rejects(Buffer.concat([tarEntry({ name: "link", type: "2", body: "" }), TAR_END]));
  check(r.threw && r.message.includes("unsupported tar entry type 2"), "符号链接（未知类型）被拒", r.message);
}
{
  // 头声明 100 字节，实际只给 10 字节就结束。
  const head = tarHeader({ name: "short.txt", size: 100 });
  const r = await rejects(Buffer.concat([head, Buffer.from("0123456789")]));
  check(r.threw && r.message.includes("archive truncated"), "截断的数据被拒", r.message);
}
{
  // 连头都不够 512 字节。
  const r = await rejects(Buffer.from("too short"));
  check(r.threw && r.message.includes("archive truncated"), "头部不完整被拒", r.message);
}
{
  const r = await rejects(Buffer.concat([tarEntry({ name: "big.txt", body: "x".repeat(300) }), TAR_END]), {
    maxBytes: 100,
  });
  check(r.threw && r.message.includes("archive larger than expected"), "超过 maxBytes 被拒", r.message);
}

console.log("\n=== 收尾：坏归档不许留下可用的部分产物之外的东西 ===");
{
  // 铁律是「调用方删掉整个 dest」，所以这里只验证：失败时**抛错**，
  // 而不是静默返回一个「解了一半」的成功结果。
  const dest = scratchDir();
  const tar = Buffer.concat([
    tarEntry({ name: "first.txt", body: "ok" }),
    tarHeader({ name: "second.txt", size: 999 }), // 声明 999 字节但不给数据
  ]);
  let threw = false;
  try {
    await extractTar(asStream(tar), dest, { maxBytes: 1_000_000 });
  } catch {
    threw = true;
  }
  check(threw, "中途截断 → 抛错（不是静默成功）");
}

rmSync(SCRATCH, { recursive: true, force: true });

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
