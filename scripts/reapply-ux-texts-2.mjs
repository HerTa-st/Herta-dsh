/**
 * 体检第三批（客户端）：**模型下载失败要说出原因**。
 *
 * 体检结论：状态里有 `error` 键（`network` / `http` / `size` / `hash` / `archive` /
 * `verify` / `disk` / `cancelled`），端点也回传，但界面那一行只显示「上次失败」——
 * 用户知道「失败了」，不知道「因为什么」，也就没法自助（是该换网络？还是磁盘满了？）。
 *
 * 这里把 `state.error` 挂在同一句后面。**不做过度美化**：那个键本身就是最具体的
 * 事实，先让它可见，比继续猜要有用。
 *
 * 幂等：见到 `state.error` 就当补过。备份 `<file>.bak-ux-texts-2`（已进 .gitignore）。
 * usage: node scripts/reapply-ux-texts-2.mjs <lib/client.js>
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const MARK = "（原因：${String(state.error)}）";
const FIND =
  'phase === "failed" ? "\\u4E0A\\u6B21\\u5931\\u8D25" : "\\u672A\\u5B89\\u88C5"';
const REPL =
  'phase === "failed" ? "\\u4E0A\\u6B21\\u5931\\u8D25\\uFF08\\u539F\\u56E0\\uFF1A" + String(state?.error ?? "\\u672A\\u77E5") + "\\uFF09" : "\\u672A\\u5B89\\u88C5"';

let failed = 0;
for (const file of process.argv.slice(2)) {
  console.log(`\n=== ${file} ===`);
  if (!existsSync(file)) {
    console.log("  ✗ 文件不存在");
    failed += 1;
    continue;
  }
  let text = readFileSync(file, "utf8");
  if (text.includes(MARK)) {
    console.log("  ✅ 已经补过（跳过）");
    continue;
  }
  const hits = text.split(FIND).length - 1;
  if (hits !== 1) {
    console.log(`  ✗ 锚点命中 ${hits} 次（要求 1 次）—— 不猜，跳过`);
    failed += 1;
    continue;
  }
  copyFileSync(file, `${file}.bak-ux-texts-2`);
  const before = Buffer.byteLength(text);
  text = text.replace(FIND, REPL);
  writeFileSync(file, text, "utf8");
  console.log(`  ✅ 失败时会带上原因`);
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-ux-texts-2`);
  failed += text.includes('String(state?.error ?? "\\u672A\\u77E5")') ? 0 : 1;
}

console.log(`\n=== ${failed === 0 ? "通过" : "失败"} ===`);
process.exit(failed === 0 ? 0 : 1);
