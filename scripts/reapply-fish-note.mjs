/**
 * 给设置页「Fish 语音」那一组的说明补上一句：**没声通常就是没代理**。
 *
 * 背景：用户要的标注只有一条 ——「用 fish 的话，没声就代表需要代理」。
 * 而产物 `lib/client.js` 里那份分组说明是**旧的短版本**（源码
 * `src/host/settings-groups.js` 早就多了一句「直连不到 api.fish.audio 时…」，
 * 从没同步进产物）。这里补上，并把话说成用户能直接照做的形状。
 *
 * 做法不猜中文转义：定位 `title: "Fish \u8BED\u97F3"`，再往后找它那一组的
 * `hint: "` … 收尾引号，在引号前插入。
 *
 * 幂等：见到 `没声通常就是` 就当补过。备份 `<file>.bak-fish-note`。
 * usage: node reapply-fish-note.mjs <lib/client.js>
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const MARK = "没声通常就是";
const SENTENCE =
  "**没声通常就是这一条**：网络到不了 api.fish.audio（国内多数需要代理）——"
  + "在「Fish 代理」那一行填上代理地址，或者给系统挂上代理，再点一次试听即可。";

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
  const at = text.indexOf('title: "Fish \\u8BED\\u97F3"');
  if (at < 0) {
    console.log("  ✗ 找不到「Fish 语音」那一组 —— 不猜，跳过");
    failed += 1;
    continue;
  }
  const hintAt = text.indexOf('hint: "', at);
  if (hintAt < 0) {
    console.log("  ✗ 那一组里没有 hint —— 不猜，跳过");
    failed += 1;
    continue;
  }
  const open = hintAt + 'hint: "'.length;
  const close = text.indexOf('"', open);
  if (close < 0) {
    console.log("  ✗ hint 的收尾引号找不到 —— 不猜，跳过");
    failed += 1;
    continue;
  }
  copyFileSync(file, `${file}.bak-fish-note`);
  const before = Buffer.byteLength(text);
  const old = text.slice(open, close);
  text = `${text.slice(0, open)}${old}${SENTENCE}${text.slice(close)}`;
  writeFileSync(file, text, "utf8");
  console.log(`  ✅ 已补（原说明 ${old.length} 字符 → ${old.length + SENTENCE.length}）`);
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-fish-note`);
  if (!text.includes(MARK)) failed += 1;
}

console.log(`\n=== ${failed === 0 ? "通过" : "失败"} ===`);
process.exit(failed === 0 ? 0 : 1);
