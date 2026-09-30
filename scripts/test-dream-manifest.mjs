/**
 * 账本的两条硬规矩（2026-09-30 体检后加）：
 *
 *  1. **坏账本要留档，不能就地覆盖。** 以前 `JSON.parse` 失败会静默返回空账本，
 *     紧接着下一次追写就把坏文件覆盖掉 —— 用户手编打错一个字符，15 条历史变 1 条，
 *     零警告。现在坏文件改名成 `manifest.corrupt-<sha8>.json` 留在原目录。
 *  2. **写入必须原子。** 走「临时文件 → fsync → rename」：任何时刻盘上要么是完整的
 *     旧版、要么是完整的新版，不会留下半截 JSON（半截 JSON 会被下一次读当成坏账本）。
 *
 * 用法：node scripts/test-dream-manifest.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hertaDreamTool, readDreamManifest } from "../src/host/dream.js";

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
const dreamDir = (cwd) => join(cwd, ".herta", "dream");
const manifestOf = (cwd) => join(dreamDir(cwd), "manifest.json");
/** 工具的 execute 只要一个能给出 `session.header.cwd` 的假 exec。 */
const fakeExec = (cwd) => ({ agent: { session: { header: { cwd } } } });

/** 做梦有 120 字的篇幅下限 —— 测试用的正文必须真的够长，否则测的是「太短」那条路。 */
const goodBody = [
  "### 废案_01：账本测试",
  "",
  "（我 想）今天改账本这两条规矩，值得记一笔：坏文件要留档，写入要原子。"
    + "前者保的是数据，后者保的是「任何时刻盘上那份都是完整的」——半截 JSON 比没有更坏，"
    + "因为它会被下一次读当成坏账本，然后触发一连串谁也想不到的事。（/我 想）",
  "",
  "（我 说）账本要留档，也要说话。留档不说，用户永远不知道自己踩过一次坑。（/我 说）",
].join("\n");

console.log("=== 坏账本：留档而不是丢弃 ===");
{
  const cwd = scratch("dream-corrupt");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(dreamDir(cwd), { recursive: true });
  const bad = '{\n  "version": 1,\n  "episodes": [ THIS IS NOT JSON\n';
  writeFileSync(manifestOf(cwd), bad, "utf8");

  const m = await readDreamManifest(cwd);
  ok(m.episodes.length === 0, "读坏账本 → 从空账本继续（不让整条链失败）");
  ok(typeof m.quarantined === "string" && existsSync(m.quarantined), "坏文件已留档且确实在盘上", String(m.quarantined));
  ok(readFileSync(m.quarantined, "utf8") === bad, "留档的是**原文**（一个字都没改）");
  ok(!existsSync(manifestOf(cwd)), "原位置已经让出来了（不会挡住后面的写入）");
  rmSync(cwd, { recursive: true, force: true });
}

console.log("\n=== 那句警告要能到用户眼前 ===");
{
  const cwd = scratch("dream-warn");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(dreamDir(cwd), { recursive: true });
  // **故意不先读**：警告只属于「读到坏账本的那一次」，所以要让它成为第一个读者。
  writeFileSync(manifestOf(cwd), '{ "episodes": [ OOPS', "utf8");

  const r = await hertaDreamTool.execute({ title: "账本测试", body: goodBody }, fakeExec(cwd));
  ok(r.result === "promoted", "留档之后还能正常做梦", `${r.result}：${r.reason ?? ""}`);
  ok(typeof r.manifestWarning === "string" && r.manifestWarning.includes("留档"), "工具输出里带上了那句警告", String(r.manifestWarning));
  // render 挂在 `output` 上（工具对象本身只有 name/description/parameters/output/execute）。
  const rendered = hertaDreamTool.output.render({}, r).map((b) => b.text).join("\n");
  ok(rendered.includes("⚠️"), "渲染里那句警告在最前面（用户看得见）", rendered.split("\n")[0]);
  rmSync(cwd, { recursive: true, force: true });
}

console.log("\n=== 好账本：历史不能丢 ===");
{
  const cwd = scratch("dream-good");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(dreamDir(cwd), { recursive: true });
  const before = {
    version: 1,
    lastRunAt: "2026-09-01T00:00:00.000Z",
    episodes: [
      { at: "2026-09-01T00:00:00.000Z", result: "promoted", title: "旧的甲", file: "a.txt", tokens: 10 },
      { at: "2026-09-01T00:01:00.000Z", result: "archived", title: "旧的乙", reason: "太短" },
      { at: "2026-09-01T00:02:00.000Z", result: "promoted", title: "旧的丙", file: "c.txt", tokens: 20 },
    ],
    created: [{ title: "旧的甲", file: "a.txt", state: "live" }],
  };
  writeFileSync(manifestOf(cwd), `${JSON.stringify(before, null, 2)}\n`, "utf8");

  const r = await hertaDreamTool.execute({ title: "账本测试", body: goodBody }, fakeExec(cwd));
  ok(r.result === "promoted", "正常晋升", r.reason ?? "");
  ok(r.promoted === 3, "累计晋升 = 历史 2 + 这次 1", String(r.promoted));
  ok(r.manifestWarning === undefined, "账本没坏时**没有**警告");
  const after = JSON.parse(readFileSync(manifestOf(cwd), "utf8"));
  ok(after.episodes.length === 4, "历史三条一条不少", String(after.episodes.length));
  ok(after.created.some((c) => c.title === "旧的甲"), "旧的 created 记录还在");
  rmSync(cwd, { recursive: true, force: true });
}

console.log("\n=== 原子写：不留半截、不留临时文件 ===");
{
  const cwd = scratch("dream-atomic");
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(dreamDir(cwd), { recursive: true });
  await hertaDreamTool.execute({ title: "账本测试", body: goodBody }, fakeExec(cwd));
  const leftovers = readdirSync(dreamDir(cwd)).filter((n) => n.includes(".tmp-"));
  ok(leftovers.length === 0, "写完之后没有留下临时文件", leftovers.join(", "));
  const text = readFileSync(manifestOf(cwd), "utf8");
  ok(text.trimEnd().endsWith("}"), "盘上那份是完整的 JSON（不是半截）");
  JSON.parse(text);
  ok(true, "解析得开");
  rmSync(cwd, { recursive: true, force: true });
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
