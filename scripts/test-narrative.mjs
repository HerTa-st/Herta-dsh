/**
 * `src/host/narrative.js` 的独立测试。
 *
 * 两件事都要验：
 *  1. **正向不能误杀** —— 拿 Herta 真实的 11 个种子文件跑一遍，必须全部通过。
 *     上游为这个专门写过教训：第一版格式门用词表判断，把全部 18 份活样本
 *     静默丢了 25 天，直到有人发现语气变平了（few-shot-guard.ts 的注释）。
 *  2. **反向必须拦住** —— 栅栏不平衡、缺头、截断、空、超长。
 *
 * 用法：node scripts/test-narrative.mjs
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkFewShot, readNarrative } from "../src/host/narrative.js";

/** Herta 源码树（真实种子在这里）。与各 build 脚本同一个环境变量，默认值也一致。 */
const HERTA_SRC = process.env.HERTA_SRC ?? "E:\\deepseek工作区\\HerTa\\Herta-src";
const SEEDS = join(HERTA_SRC, "packages", "herta", "prompts", "feian-seeds");

/** 端到端用例的临时工作区。放系统临时目录，**不再往工作区里散落 dot 目录**。 */
const scratch = (name) => join(tmpdir(), `dsh-herta-${name}-${process.pid}`);

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

console.log("=== 正向：真实种子必须全部通过 ===");
const seedFiles = readdirSync(SEEDS).filter((n) => n.endsWith(".txt"));
console.log(`  找到 ${seedFiles.length} 个种子文件`);
for (const name of seedFiles) {
  const raw = readFileSync(join(SEEDS, name), "utf8");
  const r = checkFewShot(name, raw);
  ok(r.ok, `${name.slice(0, 34)}…`, r.ok ? "" : `被拦：${r.reason}`);
}

console.log("\n=== 反向：必须拦住的用例 ===");
// 第三列是**机器码**（`code`），不是措辞 —— 2026-09-30 起门会同时给 code 与中文 reason，
// 断言盯 code，以后改措辞不会再碰坏这份测试。
const cases = [
  ["空文件", "   \n\n  ", "empty"],
  ["没有废案/记录头", "这是一段普通文字，不是她的稿子。", "no-header"],
  ["未闭合的栅栏", "### 废案_99：测试\n\n（我 说）\n说的话没有关。", "fence"],
  ["多余的关闭", "### 废案_99：测试\n\n（/我 说）\n关了个没开的。", "fence"],
  ["嵌套开启", "### 废案_99：测试\n\n（我 说）\n（我 想）\n", "fence"],
  ["结尾截断的栅栏", "### 废案_99：测试\n\n（我 说）\n好的。（/我 说）\n（我 ", "truncated"],
  ["说话人不匹配", "### 废案_99：测试\n\n（我 说）\n话。（/开拓者 说）", "fence"],
];
for (const [label, content, expect] of cases) {
  const r = checkFewShot("test.txt", content);
  ok(r.ok === false && r.code === expect, label, r.ok ? "竟然通过了" : `code=${r.code} 原因=${r.reason}`);
}

console.log("\n=== 拒绝理由必须是「给人看的中文」且有机器码 ===");
for (const [label, content] of cases) {
  const r = checkFewShot("test.txt", content);
  if (r.ok) continue;
  ok(typeof r.code === "string" && r.code !== "", `${label}：有 code`);
  // 英文机器话（"unbalanced fences" / "body has no … header" / "too long (…)"）不许再出现
  ok(
    !/[a-z]{4,}\s+[a-z]{4,}/i.test(r.reason) || /token/.test(r.reason),
    `${label}：理由里没有成串的英文机器话`,
    `reason=${r.reason}`,
  );
  // 理由本身不该含一个**合法**栅栏（否则回喂给模型会把它自己绕进去）
  ok(
    !/（(\/?)([^（）/\n]{1,16}) (说|想)）/.test(r.reason),
    `${label}：理由里没有自带一个合法栅栏`,
    `reason=${r.reason}`,
  );
}

// 超长：非 ASCII 每字符约 1 token，所以 12000 个汉字必然超上限
{
  const big = `### 废案_99：超长\n\n${"黑".repeat(12_000)}`;
  const r = checkFewShot("big.txt", big);
  ok(r.ok === false && r.code === "too-long", "超长文件（约 12000 汉字）", r.ok ? "竟然通过了" : r.reason);
}

// 零宽字符夹带：把栅栏拆开，靠零宽字符在提示词里重新拼起来
{
  const smuggled = "### 废案_99：夹带\n\n（我\u200B 说）\n内容（/我 说）\n（我 说）\n没关\u200B";
  const r = checkFewShot("smuggle.txt", smuggled);
  ok(r.ok === false, "零宽字符夹带的栅栏（清洗后应暴露不平衡）", r.ok ? "竟然通过了" : r.reason);
}

console.log("\n=== 端到端：读一个真实货架目录 ===");
{
  const root = scratch("narrative-test");
  const dir = join(root, ".herta", "narrative");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // 两个合格 + 一个不合格 + 一个不参与（文件名前缀不对）
  writeFileSync(join(dir, "### 废案_00：甲.txt"), "### 废案_00：甲\n\n（我 说）\n第一份。\n（/我 说）", "utf8");
  writeFileSync(join(dir, "### 废案_01：乙.txt"), "### 废案_01：乙\n\n（我 说）\n第二份。\n（/我 说）", "utf8");
  writeFileSync(join(dir, "### 废案_02：丙.txt"), "没有头的坏文件", "utf8");
  writeFileSync(join(dir, "随便一个文件.txt"), "不该被读到", "utf8");

  const r = await readNarrative(root);
  ok(r.files.length === 3, "按前缀筛出 3 个候选（第 4 个前缀不符）", `实际 ${r.files.length}`);
  ok(r.dropped.length === 1, "坏文件被门拦下并记录原因", JSON.stringify(r.dropped));
  ok(r.text.includes("第一份") && r.text.includes("第二份"), "两份合格样本进了正文");
  ok(!r.text.includes("没有头") && !r.text.includes("不该被读到"), "坏文件与无关文件都没进正文");
  ok(r.text.indexOf("第一份") < r.text.indexOf("第二份"), "按文件名升序拼装");
  ok(r.text.split("\n\n").length >= 2, "正文之间有空行分隔");
  rmSync(root, { recursive: true, force: true });
}

console.log("\n=== 预算挑选 ===");
{
  const root = scratch("narrative-budget");
  const dir = join(root, ".herta", "narrative");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const mk = (n, chars, tag) =>
    writeFileSync(
      join(dir, n),
      `### 废案_${n.slice(6, 8)}：${tag}\n\n（我 说）\n${"黑".repeat(chars)}\n（/我 说）`,
      "utf8",
    );
  mk("### 废案_00：甲.txt", 1000, "甲");
  mk("### 废案_01：乙.txt", 5000, "乙");
  mk("### 废案_02：丙.txt", 1000, "丙");
  mk("### 废案_03：丁.txt", 1000, "丁");

  const r = await readNarrative(root, { maxTokens: 2500, order: "newest-first" });
  ok(r.tokens <= 2500, "总量不超预算", `实际 ${r.tokens}`);
  ok(
    r.selected.join(",") === "### 废案_02：丙.txt,### 废案_03：丁.txt",
    "newest-first 挑中最新的两份",
    r.selected.join(","),
  );
  ok(
    r.skipped.some((s) => s.name.includes("01")),
    "超预算的那份进了 skipped 而不是被静默丢掉",
    JSON.stringify(r.skipped),
  );
  // 拼装顺序必须与挑选顺序无关：必须是升序（02 在 03 前面），不是挑选顺序（03 在前）
  ok(
    r.text.indexOf("丙") < r.text.indexOf("丁"),
    "拼装顺序回到升序（与挑选顺序无关）—— 保证前缀稳定",
    `丙@${r.text.indexOf("丙")} 丁@${r.text.indexOf("丁")}`,
  );

  const r2 = await readNarrative(root, { maxTokens: 2500, order: "oldest-first" });
  ok(r2.selected.join(",") === "### 废案_00：甲.txt,### 废案_02：丙.txt", "oldest-first 换成从最老的挑", r2.selected.join(","));

  rmSync(root, { recursive: true, force: true });
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
