/**
 * 把入口那行**静态导入**换成兼容层（幂等）。
 *
 * 改的是这一行：
 *     import z from "@deepseek-ai/schemastery";   →   import z from "./schema-compat.js";
 *
 * 为什么必须改：静态导入一个运行时不保证提供的包，解析阶段就会抛，插件整个起不来
 * （用户侧症状：`1 entry did not activate herta (dsh-herta): failed to import`）。
 * 兼容层内部改用动态导入 + 兜底，详见 `src/host/schema-compat.js`。
 *
 * 幂等：已经是兼容层就跳过。锚点必须命中**恰好一次**，否则停下不猜。
 * 备份：`<file>.bak-schema-optional`。
 *
 * usage: node scripts/reapply-schema-optional.mjs <file.js> [file2.js ...]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const FROM = 'import z from "@deepseek-ai/schemastery";';
const TO = 'import z from "./schema-compat.js";';
const MARK = 'import z from "./schema-compat.js";';

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
    console.log("  ✅ 已经是兼容层（跳过）");
    continue;
  }
  const hits = text.split(FROM).length - 1;
  if (hits !== 1) {
    console.log(`  ✗ 锚点命中 ${hits} 次（要求恰好 1 次）—— 不猜，跳过`);
    failed += 1;
    continue;
  }
  copyFileSync(file, `${file}.bak-schema-optional`);
  const before = Buffer.byteLength(text);
  text = text.replace(FROM, TO);
  writeFileSync(file, text, "utf8");
  const ok = text.includes(MARK) && !text.includes(FROM);
  console.log(`  ${ok ? "✅" : "✗"} 已换成兼容层`);
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-schema-optional`);
  if (!ok) failed += 1;
}

console.log(`\n=== ${failed === 0 ? "通过" : "失败"} ===`);
process.exit(failed === 0 ? 0 : 1);
