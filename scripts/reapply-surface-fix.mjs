/**
 * 把「围栏之外的字是说话」这一条**补进已经打好的 `client.js` 产物**里。
 *
 * ## 为什么需要「补产物」而不是重新构建
 *
 * `splitSurfaces` 住在 `src/shared/mapping.js` 的依赖 `src/host/narrative-hints.js` 里，
 * 而客户端半侧是 esbuild 打出来的 `lib/client.js` —— 浏览器读的是**产物**。
 * 这台机器上没有 esbuild（`build.mjs` 要从 `HERTA_SRC` 的 pnpm store 里取，而那个盘不存在），
 * 所以 `node scripts/build.mjs` 跑不通；只能像上一版修 click-to-read 那样**手补产物**。
 *
 * ## 补的是什么
 *
 * `narrative-hints.js` 的 `splitSurfaces` 形状 B 原本把**整段文本**当思考
 * （`thoughtBeforeSpeechTag(raw)`），于是「正常发言 + 一段 `（我 想）…（/我 想）`」
 * 这种回话在界面上一个字都不显示。补丁做两件事：
 *
 *   1. 在 `splitSurfaces` 前面插入 `splitThoughtFences`（围栏之内是思考，之外是说话）
 *   2. 把形状 B 的返回值改成用它的结果
 *
 * ## 幂等
 *
 * 重复跑不会叠加：检测到标记就跳过，并把「已经补过」写进输出。
 * 覆盖前留 `<file>.bak-surface-fix`（同目录），跑坏了能原地还原。
 *
 * 用法：node scripts/reapply-surface-fix.mjs <client.js> [<client.js> ...]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/** 幂等标记 —— 出现在文件里就说明补过。 */
const MARK = "dsh-herta: 围栏之外的字是说话";

/** 要插进产物的实现（与 `src/host/narrative-hints.js` 的版本逐字同义）。 */
const HELPER = `// ${MARK}（补进产物；源码见 src/host/narrative-hints.js）
function splitThoughtFences(text) {
  const raw = String(text);
  const thoughtParts = [];
  const speechParts = [];
  let rest = raw;
  for (;;) {
    const open = rest.indexOf(THOUGHT_OPEN_TAG);
    if (open < 0) {
      speechParts.push(rest);
      break;
    }
    speechParts.push(rest.slice(0, open));
    const afterOpen = rest.slice(open + THOUGHT_OPEN_TAG.length);
    const close = afterOpen.indexOf(STOP_THOUGHT_CLOSE);
    if (close < 0) {
      thoughtParts.push(afterOpen);
      break;
    }
    thoughtParts.push(afterOpen.slice(0, close));
    rest = afterOpen.slice(close + STOP_THOUGHT_CLOSE.length);
  }
  return {
    thought: thoughtParts.join("\\n").trim(),
    speech: speechParts.join("").replaceAll(STOP_THOUGHT_CLOSE, "").trim()
  };
}
`;

const ANCHOR = "function splitSurfaces(text) {";

const OLD_SHAPE_B = `  if (thoughtIdx >= 0) {
    const thought = thoughtBeforeSpeechTag(raw);
    return { thought, speech: "", hasThought: thought.length > 0, hasSpeech: false };
  }`;

const NEW_SHAPE_B = `  if (thoughtIdx >= 0) {
    const surfaces = splitThoughtFences(raw);
    return {
      thought: surfaces.thought,
      speech: surfaces.speech,
      hasThought: surfaces.thought.length > 0,
      hasSpeech: surfaces.speech.length > 0
    };
  }`;

let failed = 0;
for (const file of process.argv.slice(2)) {
  console.log(`\n=== ${file} ===`);
  if (existsSync(file) === false) {
    console.log("  ✗ 文件不存在");
    failed += 1;
    continue;
  }
  const beforeRaw = readFileSync(file, "utf8");
  // 产物有两种换行：仓库工作区是 CRLF（`core.autocrlf=true`），装到 profile 里那份是 LF。
  // 在 LF 视图上匹配，写回时还原成原来的风格 —— 免得为了补一个函数把整份产物的换行都换掉。
  const usesCrlf = beforeRaw.includes("\r\n");
  const before = usesCrlf ? beforeRaw.replaceAll("\r\n", "\n") : beforeRaw;

  if (before.includes(MARK)) {
    const ok = before.includes("const surfaces = splitThoughtFences(raw);");
    console.log(ok ? "  ✅ 已经补过（跳过）" : "  ✗ 有标记但没有替换结果，产物可能被改坏过");
    if (!ok) failed += 1;
    continue;
  }
  const anchorCount = before.split(ANCHOR).length - 1;
  const oldCount = before.split(OLD_SHAPE_B).length - 1;
  if (anchorCount !== 1 || oldCount !== 1) {
    console.log(`  ✗ 锚点不唯一：splitSurfaces × ${anchorCount}、形状 B 原样 × ${oldCount} —— 不猜，放弃`);
    failed += 1;
    continue;
  }

  copyFileSync(file, `${file}.bak-surface-fix`);
  const patched = before
    .replace(ANCHOR, `${HELPER}${ANCHOR}`)
    .replace(OLD_SHAPE_B, NEW_SHAPE_B);
  const after = usesCrlf ? patched.replaceAll("\n", "\r\n") : patched;
  writeFileSync(file, after, "utf8");

  const checks = [
    [after.includes(MARK), "标记写入"],
    [after.includes("const surfaces = splitThoughtFences(raw);"), "形状 B 已改"],
    [after.includes(OLD_SHAPE_B) === false, "旧的形状 B 已消失"],
    [after.split(ANCHOR).length - 1 === 1, "splitSurfaces 仍只有一处"],
  ];
  for (const [pass, label] of checks) {
    console.log(`  ${pass ? "✅" : "✗"} ${label}`);
    if (!pass) failed += 1;
  }
  console.log(`  备份：${file}.bak-surface-fix`);
  console.log(`  字节：${Buffer.byteLength(before)} → ${Buffer.byteLength(after)}`);
}

console.log(`\n=== ${failed === 0 ? "全部通过" : `${failed} 处失败`} ===`);
process.exit(failed === 0 ? 0 : 1);
