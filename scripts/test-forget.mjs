/**
 * `herta_forget` 的测试（2026-09-30 体检补的缺口：记忆以前**删不掉**）。
 *
 * 这条工具会移动文件，所以它的边界比别的工具更要紧：
 *  · 只认货架的命名约定 —— 不然它就是一把随处可用的刀；
 *  · 不接受路径分隔符 —— `../` 之类必须在入口挡住；
 *  · 归档不覆盖 —— 放过同名归档之后，再收一次不能把它冲掉。
 *
 * 用法：node scripts/test-forget.mjs
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readNarrative } from "../src/host/narrative.js";
import { forgetTool, HERTA_TOOLS } from "../src/host/tools.js";

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

const scratch = (name) => join(tmpdir(), `dsh-herta-${name}-${process.pid}`);
const fakeExec = (cwd) => ({ agent: { session: { header: { cwd } } } });
const shelf = (cwd) => join(cwd, ".herta", "narrative");
const BODY = "### 废案_00：要被收起的一份\n\n（我 想）这段记忆够长，能过格式门。（/我 想）";

console.log("=== 工具装上了吗 ===");
ok(HERTA_TOOLS.some((t) => t.name === "herta_forget"), "HERTA_TOOLS 里有 herta_forget");
ok(typeof forgetTool.execute === "function", "它有 execute");

console.log("\n=== 必须挡住的输入 ===");
{
  const cwd = scratch("forget-refuse");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(shelf(cwd), { recursive: true });
  const exec = fakeExec(cwd);
  const bad = [
    ["空名字", { name: "" }],
    ["路径分隔符（正斜杠）", { name: "sub/### 废案_00：x.txt" }],
    ["路径分隔符（反斜杠）", { name: "sub\\### 废案_00：x.txt" }],
    ["上跳两级", { name: "../### 废案_00：x.txt" }],
    ["不是货架文件", { name: "README.md" }],
    ["货架上没有", { name: "### 废案_99：不存在.txt" }],
  ];
  for (const [label, args] of bad) {
    const r = await forgetTool.execute(args, exec);
    ok(r.forgotten === false && r.reason !== "", label, `forgotten=${r.forgotten}`);
  }
  rmSync(cwd, { recursive: true, force: true });
}

console.log("\n=== 正常取下：从货架上消失，但没被删掉 ===");
{
  const cwd = scratch("forget-ok");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(shelf(cwd), { recursive: true });
  const name = "### 废案_00：要被收起的一份.txt";
  writeFileSync(join(shelf(cwd), name), BODY, "utf8");

  const before = await readNarrative(cwd);
  ok(before.items.some((i) => i.name === name), "收起之前它确实在货架上（进提示词）");

  const r = await forgetTool.execute({ name, reason: "用户要求忘掉" }, fakeExec(cwd));
  ok(r.forgotten === true, "收起了", r.reason);
  ok(existsSync(r.archivedTo), "归档件真的落在盘上", r.archivedTo);
  ok(!existsSync(join(shelf(cwd), name)), "货架上已经没有了");
  ok(r.reason === "用户要求忘掉", "调用方给的说明原样带回来了");

  const after = await readNarrative(cwd);
  ok(!after.items.some((i) => i.name === name), "收起之后不再进提示词（读回来的清单里没有它）");
  ok(after.tokens < before.tokens, "预算也随之腾出来了", `${before.tokens} → ${after.tokens}`);

  const again = await forgetTool.execute({ name }, fakeExec(cwd));
  ok(again.forgotten === false, "再收一次会被挡住（它已经不在货架上）");

  const rendered = forgetTool.output.render({}, r).map((b) => b.text).join("\n");
  ok(rendered.includes("没有删"), "渲染里明说「没有删」，不假装真删了", rendered.split("\n")[1] ?? "");
  rmSync(cwd, { recursive: true, force: true });
}

console.log("\n=== 归档区不覆盖：收两次同名不冲掉旧的 ===");
{
  const cwd = scratch("forget-archive");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(join(shelf(cwd), "archive"), { recursive: true });
  const name = "### 废案_00：同名两次.txt";
  const first = "### 废案_00：同名两次\n\n（我 想）第一版。（/我 想）";
  const second = "### 废案_00：同名两次\n\n（我 想）第二版，内容不同。（/我 想）";
  // 先归档一份同名的，再收一份新的
  writeFileSync(join(shelf(cwd), name), first, "utf8");
  const r1 = await forgetTool.execute({ name }, fakeExec(cwd));
  writeFileSync(join(shelf(cwd), name), second, "utf8");
  const r2 = await forgetTool.execute({ name }, fakeExec(cwd));
  ok(r1.archivedTo !== r2.archivedTo, "两次归档落在不同文件上", `${r1.archivedTo} / ${r2.archivedTo}`);
  ok(existsSync(r1.archivedTo) && existsSync(r2.archivedTo), "两份归档件都在（旧的没有被冲掉）");
  rmSync(cwd, { recursive: true, force: true });
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
