/**
 * 做梦逻辑的测试。
 *
 * 从**构建产物 `lib/`** 导入（不是 src/）：`dream.js` 会静态 import
 * `@deepseek-ai/dsh-tools`，而本仓库刻意不带 `node_modules`。
 * 先用 `test-resolve-hook.mjs` 把 `@deepseek-ai/*` 指到本机 DSH 运行时那份，
 * 于是这个测试**不再依赖任何已部署的 profile** —— 原版指向 lab profile 的
 * node_modules，实验室一搬家/重建就断（实测就是这么断的）。
 *
 * 用法：node scripts/test-dream.mjs
 *   DSH_MODULES / DSH_PACKAGES  指定 DSH 运行时（见 test-resolve-hook.mjs）
 *   DSH_HERTA_LIB               覆盖要测的产物目录
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const LIB = process.env.DSH_HERTA_LIB ?? join(repoRoot, "lib");

// 必须在 import 产物之前注册 —— registerHooks 只影响之后发生的解析。
await import("./test-resolve-hook.mjs");

const mod = async (name) => import(pathToFileURL(join(LIB, name)).href);
const { promoteFeian, titleNoveltyOk, normalizeTitle, nextFeianNumber, titlesOf } = await mod("feian.js");
const { hertaDreamTool, readDreamManifest } = await mod("dream.js");

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${label}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
  }
};

const fakeExec = (cwd) => ({ agent: { session: { header: { cwd } } } });
const body = (n) => `（我 说）\n${"话".repeat(n)}\n（/我 说）`;

console.log("=== 标题归一化（移植自 novelty.ts）===");
ok(normalizeTitle("一条不需要回复的消息") === "一条不需要回复的消息", "中文恒等");
ok(normalizeTitle("Unix/Windows 的抉择") === "unix_windows 的抉择", "文件名非法字符折成 _", normalizeTitle("Unix/Windows 的抉择"));
ok(normalizeTitle("The Same Evening") === "the same evening", "大小写折叠（仅用于比较）");
ok(normalizeTitle("会喘气的树（其二）") === "会喘气的树", "连载后缀剥离", normalizeTitle("会喘气的树（其二）"));

console.log("\n=== 标题新颖性 ===");
const shelf = ["终端外侧的噪声", "会喘气的树（其一）"];
ok(titleNoveltyOk("一条不需要回复的消息", shelf), "全新标题通过");
ok(!titleNoveltyOk("终端外侧的噪声", shelf), "完全同名被拒");
ok(!titleNoveltyOk("Unix/Windows 的抉择", ["Unix_Windows 的抉择"]), "消毒后同名也被拒（上游踩过的坑）");
ok(titleNoveltyOk("会喘气的树（其二）", ["会喘气的树（其一）"]), "连载篇豁免同底名");

console.log("\n=== 编号与标题抽取 ===");
ok(nextFeianNumber(["### 废案_00：甲.txt", "### 废案_09：乙.txt"]) === "10", "下一号 = 最大号 + 1");
ok(nextFeianNumber([]) === "00", "空货架从 00 开始");
ok(titlesOf(["### 废案_07：一条不需要回复的消息.txt"]).join() === "一条不需要回复的消息", "从文件名抽出标题");
ok(titlesOf(["随便一个文件.txt"]).length === 0, "不符合命名的文件抽不出标题");

console.log("\n=== promoteFeian 端到端（临时目录）===");
const root = mkdtempSync(join(tmpdir(), "herta-dream-"));
try {
  const r1 = await promoteFeian(root, { title: "第一次", body: body(80) });
  ok(r1.saved && r1.name === "### 废案_00：第一次.txt", "第一份落到 00", r1.name || r1.reason);
  const r2 = await promoteFeian(root, { title: "第二次", body: body(80) });
  ok(r2.saved && r2.name === "### 废案_01：第二次.txt", "第二份落到 01", r2.name || r2.reason);
  const r3 = await promoteFeian(root, { title: "第一次", body: body(80) });
  ok(!r3.saved && String(r3.reason).includes("同名"), "同名被拒且给出原因", r3.reason);
  const r4 = await promoteFeian(root, { title: "坏的", body: "（我 说）\n没关栅栏" });
  // 拒收理由是**给人看的**，0.1.5 起中文化（机器可读的稳定码是 `checkFewShot`
  // 返回的 `code: "fence"`）。这里跟本文件其它断言一样，钉中文措辞。
  ok(!r4.saved && String(r4.reason).includes("栅栏"), "格式不过被拒", r4.reason);
  const r5 = await promoteFeian(root, { title: "  ", body: body(80) });
  ok(!r5.saved, "空标题被拒", r5.reason);
  const onDisk = readFileSync(join(root, ".herta", "narrative", "### 废案_00：第一次.txt"), "utf8");
  ok(onDisk.startsWith("### 废案_00：第一次\n\n"), "落盘文本头行形态正确", JSON.stringify(onDisk.slice(0, 30)));
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("\n=== herta_dream：门槛与账本 ===");
const root2 = mkdtempSync(join(tmpdir(), "herta-dream2-"));
try {
  const exec = fakeExec(root2);

  const short = await hertaDreamTool.execute({ title: "太短", body: "（我 说）\n就一句\n（/我 说）" }, exec);
  // 同上：理由是给人看的中文（0.1.5 起「太短了：16 字 < 下限 120 字…」）。
  ok(short.result === "archived" && short.reason.includes("太短"), "太短 -> archived", short.reason);
  ok(short.archived === 1 && short.promoted === 0, "账本记了 1 条 archived");

  const good = await hertaDreamTool.execute({ title: "一段真的记忆", body: body(150) }, exec);
  ok(good.result === "promoted" && good.name.endsWith("一段真的记忆.txt"), "合格 -> promoted", good.name || good.reason);
  ok(good.promoted === 1 && good.archived === 1, "账本：晋升 1、归档 1", `promoted=${good.promoted} archived=${good.archived}`);

  const dup = await hertaDreamTool.execute({ title: "一段真的记忆", body: body(150) }, exec);
  ok(dup.result === "archived" && dup.reason.includes("同名"), "重复标题 -> archived", dup.reason);

  const m = await readDreamManifest(root2);
  ok(m.episodes.length === 3, "账本累计 3 条 episode", String(m.episodes.length));
  ok(m.created.length === 1 && m.created[0].state === "live", "created 只记晋升的那条");
  ok(typeof m.lastRunAt === "string" && m.lastRunAt.includes("T"), "lastRunAt 是 ISO 时间", String(m.lastRunAt));
  ok(m.episodes.every((e) => e.at !== undefined && e.result !== undefined), "每条 episode 都有 at 与 result");

  const manifestOnDisk = JSON.parse(readFileSync(join(root2, ".herta", "dream", "manifest.json"), "utf8"));
  ok(manifestOnDisk.episodes.length === 3, "账本真的落到了 .herta/dream/manifest.json");
} finally {
  rmSync(root2, { recursive: true, force: true });
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
