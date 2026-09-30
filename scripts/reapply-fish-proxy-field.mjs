/**
 * 把「Fish 代理」那一行补进**已经打好的 `lib/client.js` 产物**里。
 *
 * ## 为什么需要打产物
 *
 * 设置页是**通用渲染器**：它照着客户端里内联的一份 `FIELDS` 与 `SETTINGS_GROUPS`
 * 画行。而这两份是**打包进 `lib/client.js` 的副本** —— 只改 `src/host/settings-schema.js`
 * 与 `settings-groups.js`，浏览器读到的产物里没有那个字段，**那一行永远不会出现**。
 *
 * 2026-09-30 梦源就在这上面栽过一次：他在 `src/client/index.tsx` 里加了
 * 「Fish 密钥」那一行（`CREDENTIALS`），但产物只跟着改了注释 —— 于是源码看着有、
 * 界面里没有。**源码是真源，产物是当时那份字节**，两者必须一起动。
 *
 * ## 幂等
 *
 * 检测到 `fishProxy: Object.freeze({` 就当补过，跳过。覆盖前留
 * `<file>.bak-fish-proxy`（已进 .gitignore）。
 *
 * 用法：node scripts/reapply-fish-proxy-field.mjs <lib/client.js> [...]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/** 幂等标记。 */
const MARK = "fishProxy: Object.freeze({";

/** 字段定义：插在 `fishPreset` 那一块之后。 */
const FIELD_ANCHOR = `  fishPreset: Object.freeze({
    kind: "enum",
    values: Object.freeze(["terminal_textured", "terminal"]),
    def: "terminal_textured",
    label: "Fish \\u97F3\\u6548\\u6863\\u4F4D",
    wired: true
  }),`;

const FIELD_INSERT = `
  fishProxy: Object.freeze({
    kind: "text",
    def: "",
    placeholder: "http://127.0.0.1:7897（留空 = 直连）",
    label: "Fish 代理",
    wired: true
  }),`;

/** 分组字段表：把新字段挂进「Fish 语音」那一组。 */
const GROUP_OLD = 'fields: Object.freeze(["fishRef", "fishSpeed", "fishEffect", "fishPreset"])';
const GROUP_NEW =
  'fields: Object.freeze(["fishRef", "fishSpeed", "fishEffect", "fishPreset", "fishProxy"])';

/** 行内提示（FIELD_HINTS）：锚在这一行的行首，插在它整行之后。 */
const HINT_ANCHOR = '  fishPreset: "terminal_textured';
const HINT_INSERT = `
  fishProxy: "直连不到 api.fish.audio 时才需要（国内网络基本都需要）。留空则依次看 fish_config.json 的 proxy、环境变量 HTTPS_PROXY / HTTP_PROXY。",`;

let failed = 0;

for (const file of process.argv.slice(2)) {
  console.log(`\n=== ${file} ===`);
  if (!existsSync(file)) {
    console.log("  ✗ 文件不存在");
    failed += 1;
    continue;
  }
  const before = readFileSync(file, "utf8");

  if (before.includes(MARK)) {
    console.log("  ✅ 已经补过（跳过）");
    continue;
  }

  const checks = [
    [before.includes(FIELD_ANCHOR), "字段锚点（fishPreset 那一块）在"],
    [before.split(GROUP_OLD).length - 1 === 1, "分组字段表锚点唯一"],
    [before.includes(HINT_ANCHOR), "提示锚点（FIELD_HINTS 的 fishPreset 行）在"],
  ];
  let ok = true;
  for (const [pass, label] of checks) {
    console.log(`  ${pass ? "✅" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  if (!ok) {
    console.log("  ✗ 锚点对不上 —— 不猜，放弃");
    failed += 1;
    continue;
  }

  copyFileSync(file, `${file}.bak-fish-proxy`);

  // ① 字段定义
  let after = before.replace(FIELD_ANCHOR, FIELD_ANCHOR + FIELD_INSERT);
  // ② 分组字段表
  after = after.replace(GROUP_OLD, GROUP_NEW);
  // ③ 行内提示：插在那**一整行**之后
  const at = after.indexOf(HINT_ANCHOR);
  const eol = after.indexOf("\n", at);
  after = `${after.slice(0, eol)}${HINT_INSERT}${after.slice(eol)}`;

  writeFileSync(file, after, "utf8");

  const verify = [
    [after.includes(MARK), "字段已插入"],
    [after.includes('"fishProxy"])'), "分组字段表已含 fishProxy"],
    [after.includes("fishProxy: \"直连不到"), "提示已插入"],
    [after.split(GROUP_OLD).length - 1 === 0, "旧的分组字段表已消失"],
  ];
  for (const [pass, label] of verify) {
    console.log(`  ${pass ? "✅" : "✗"} ${label}`);
    if (!pass) failed += 1;
  }
  console.log(`  备份：${file}.bak-fish-proxy`);
  console.log(`  字节：${Buffer.byteLength(before)} → ${Buffer.byteLength(after)}`);
}

console.log(`\n=== ${failed === 0 ? "全部通过" : `${failed} 处失败`} ===`);
process.exit(failed === 0 ? 0 : 1);
