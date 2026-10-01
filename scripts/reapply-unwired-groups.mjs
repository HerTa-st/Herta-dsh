/**
 * 把产物 `lib/client.js` 里那份 `SETTINGS_GROUPS` 内联副本，改成与
 * `src/host/settings-groups.js` 一致：**`theme` / `deviceScene` 从普通分组里摘掉**。
 *
 * ## 为什么必须打产物
 *
 * 设置页遍历的正是产物里那份内联副本（esbuild 打包时抄进去的），源码改了不会自己进产物
 * —— 与 `reapply-fish-proxy-field.mjs` / `reapply-ux-texts*.mjs` 同一个道理。
 *
 * ## 不改会怎样（2026-10-01 查出来的）
 *
 * 2026-09-30 的体检把 `theme` / `deviceScene` 标成了 `wired: false`，
 * 产物里这两个标记已经跟着改了；但**分组表没跟着摘**，而页面同时还会按
 * `UNWIRED_FIELD_NAMES` 渲染「暂未接线」那一组 —— 于是这两行在设置页上
 * **渲染了两遍**：一次在「界面」/「差分协处理器」里当正常行，一次在「暂未接线」里。
 *
 * 两处名单互斥是本仓的既有契约（见 `src/host/settings-groups.js` 头部）。
 *
 * 幂等：见到「界面那组只剩 locale」且「差分协处理器那组已不在」就当改过。
 * 备份 `<file>.bak-unwired-groups`（已进 .gitignore）。
 * usage: node reapply-unwired-groups.mjs <lib/client.js> [...]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/** ① 「界面」组：`["locale", "theme"]` → `["locale"]`。 */
const THEME_OLD = 'fields: Object.freeze(["locale", "theme"])';
const THEME_NEW = 'fields: Object.freeze(["locale"])';

/** ② 整组删掉「差分协处理器」（它只有 `deviceScene` 一个字段，且已标未接线）。 */
const UNWIRED_GROUP = /,\r?\n\s*Object\.freeze\(\{ title: "\\u5DEE\\u5206\\u534F\\u5904\\u7406\\u5668", fields: Object\.freeze\(\["deviceScene"\]\) \}\)/;

let failed = 0;
for (const file of process.argv.slice(2)) {
  console.log(`\n=== ${file} ===`);
  if (!existsSync(file)) {
    console.log("  ✗ 文件不存在");
    failed += 1;
    continue;
  }
  let text = readFileSync(file, "utf8");

  const done = !text.includes(THEME_OLD) && !text.includes('fields: Object.freeze(["deviceScene"])');
  if (done) {
    console.log("  ✅ 已经与源码一致（跳过）");
    continue;
  }
  if (!text.includes(THEME_OLD)) {
    console.log(`  ✗ 找不到「界面」组的旧字段表（${THEME_OLD}）—— 不猜，跳过`);
    failed += 1;
    continue;
  }
  if (!UNWIRED_GROUP.test(text)) {
    console.log("  ✗ 找不到「差分协处理器」那一组 —— 不猜，跳过");
    failed += 1;
    continue;
  }

  copyFileSync(file, `${file}.bak-unwired-groups`);
  const before = Buffer.byteLength(text);
  text = text.replace(THEME_OLD, THEME_NEW).replace(UNWIRED_GROUP, "");
  writeFileSync(file, text, "utf8");
  console.log(`  ✅ 已摘掉 theme（界面组只剩 locale）与整个「差分协处理器」组`);
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-unwired-groups`);

  const verify = [
    [text.includes(THEME_NEW), "界面组只剩 locale"],
    [!text.includes(THEME_OLD), "旧字段表已消失"],
    [!UNWIRED_GROUP.test(text), "「差分协处理器」组已消失"],
  ];
  for (const [ok, label] of verify) {
    console.log(`  ${ok ? "✅" : "✗"} ${label}`);
    if (!ok) failed += 1;
  }
}

console.log(`\n=== ${failed === 0 ? "通过" : `${failed} 处失败`} ===`);
process.exit(failed === 0 ? 0 : 1);
