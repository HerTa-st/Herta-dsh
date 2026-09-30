/**
 * 体检第三批（客户端之二）：把**计费字符数**显示到语音状态那一行。
 *
 * 宿主侧上一批已经把 `billedCharsTotal` / `lastBilledChars` 放进 voice readout
 * （`src/host/minimax/voice.ts`），差的只是界面上没地方看。
 *
 * 作用域是**读出来的、不是猜的**：那一行用的是 `voice`（同处已有 `voice.lastError`
 * 与 `voice.retryAt`），所以这里用 `voice?.billedCharsTotal`（带可选链，取不到就不显示）。
 *
 * 幂等：见到 `billedCharsTotal` 就当补过。备份 `<file>.bak-ux-texts-3`。
 * usage: node scripts/reapply-ux-texts-3.mjs <lib/client.js>
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const MARK = "billedCharsTotal";
const FIND = "\\u6CA1\\u53D1\\u58F0` : \"\")";
const REPL =
  "\\u6CA1\\u53D1\\u58F0` : \"\") + (voice?.billedCharsTotal ? `\\u3000\\xB7\\u3000\\u5DF2\\u8BA1\\u8D39 ${voice.billedCharsTotal} \\u5B57` : \"\")";

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
  copyFileSync(file, `${file}.bak-ux-texts-3`);
  const hits = text.split(FIND).length - 1;
  if (hits !== 1) {
    console.log(`  ✗ 锚点命中 ${hits} 次（要求 1 次）—— 不猜，跳过`);
    failed += 1;
    continue;
  }
  const before = Buffer.byteLength(text);
  text = text.replace(FIND, REPL);
  writeFileSync(file, text, "utf8");
  const okNow = text.includes(MARK);
  console.log(`  ${okNow ? "✅" : "✗"} 计费字符挂上去了`);
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-ux-texts-3`);
  if (!okNow) failed += 1;
}

console.log(`\n=== ${failed === 0 ? "通过" : "失败"} ===`);
process.exit(failed === 0 ? 0 : 1);
