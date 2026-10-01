/**
 * 把设置页「Fish 语音」那一组的说明**补成 / 修成当前正确的说法**。
 *
 * ## 为什么打产物而不是改源码
 *
 * 设置页读的是**打包进 `lib/client.js` 的那份分组说明副本**（`SETTINGS_GROUPS`）；
 * 源码 `src/host/settings-groups.js` 改了不会自己进产物 —— 与
 * `reapply-fish-proxy-field.mjs` 同一个道理（那边管字段行，这边管分组说明）。
 *
 * ## 这句话为什么改过两次
 *
 * · 2026-09-30 第一次：用户要的标注是「用 fish 的话，没声就代表需要代理」，
 *   于是补了「网络到不了 api.fish.audio（国内多数需要代理）」。
 * · 同日稍后：Fish 的主接口换成**国内可直连的 `fishaudio.org`**，`api.fish.audio`
 *   退化成「国内被按 SNI 重置时的海外兜底」—— 「没声 = 需要代理」不再成立，
 *   那句话会把人指去配一个用不上的代理。所以本脚本现在**替换**旧句子，不再追加。
 *
 * 做法不猜中文转义：定位 `title: "Fish \u8BED\u97F3"`，再往后找它那一组的
 * `hint: "` … 收尾引号，在引号内替换（找不到旧句子时按「补一句」处理）。
 *
 * 幂等：见到 `两条都不通时才` 就当已经是对的。
 * 备份 `<file>.bak-fish-note`（已进 .gitignore）。
 * usage: node reapply-fish-note.mjs <lib/client.js> [...]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/** 新说明里的稳定片段：见到它就算改过。 */
const MARK = "两条都不通时才";

/** 旧说法（原样来自 391b211 打进产物的那句）—— 命中就整句替换。 */
const STALE =
  "**没声通常就是这一条**：网络到不了 api.fish.audio（国内多数需要代理）——"
  + "在「Fish 代理」那一行填上代理地址，或者给系统挂上代理，再点一次试听即可。";

/** 新说法。 */
const SENTENCE =
  "**没声通常就是这一条**：网络到不了 Fish 接口 —— 插件按 fishaudio.org（国内可直连）→ "
  + "api.fish.audio（旧域名，国内被墙）的顺序试，两条都不通时才需要在「Fish 代理」那一行填代理地址，再点一次试听。";

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
    console.log("  ✅ 已经是对的（跳过）");
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
  const replace = old.includes(STALE);
  const next = replace ? old.replace(STALE, SENTENCE) : `${old}${SENTENCE}`;
  text = `${text.slice(0, open)}${next}${text.slice(close)}`;
  writeFileSync(file, text, "utf8");
  console.log(`  ✅ 已${replace ? "替换旧说法" : "补上新说法"}（${old.length} → ${next.length} 字符）`);
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-fish-note`);
  if (!text.includes(MARK)) failed += 1;
}

console.log(`\n=== ${failed === 0 ? "通过" : "失败"} ===`);
process.exit(failed === 0 ? 0 : 1);
