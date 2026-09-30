/**
 * 「叙述层对子代理让过路」的**接线检查**（`src/host/narrative-layer.js`）。
 *
 * ## 为什么单独一个文件，而且只查源码
 *
 * 判据本身（`isSubagentAgent`）是纯函数，单测在 `test-session-surface.mjs` 里。
 * 这里盯的是**接线**：三处钩子必须都问过它，而且必须**问在动作之前**。
 *
 * 这类错单测抓不到 —— 假对象喂不出「钩子里少了一次判断」，而叙述层的接线在
 * lab 里要用真会话才验得到（README 的『已知缺口』表就是这么写的）。所以退一步，
 * 用源码级断言把「三处都在、且都在动作之前」钉住：它证明不了运行时行为，但它
 * 能证明**没有人偷偷把某一处漏掉或挪到后面**。
 *
 * 教训出处：2026-09-30，分拍与复核打进子代理，毁掉两次收尾 —— 一次子代理把一句
 * 「点评」当成交付物（几千字的摘要没交），一次被复核拿去做「重想」。
 *
 * 用法：node scripts/test-subagent-skip.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

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

const layer = readFileSync(join(root, "src/host/narrative-layer.js"), "utf8");
const beacon = readFileSync(join(root, "src/host/narrative-beacon.js"), "utf8");
const surface = readFileSync(join(root, "src/host/session-surface.js"), "utf8");

console.log("=== 判据在，且只在一处 ===");
ok(surface.includes("export function isSubagentAgent"), "session-surface.js 导出 isSubagentAgent");
ok(
  (surface.match(/export function isSubagentAgent/g) ?? []).length === 1,
  "判据只有一份定义",
);
ok(layer.includes("isSubagentAgent,"), "narrative-layer.js 从 session-surface 引入它（同一句 import）");

console.log("\n=== 三处钩子都问过它 ===");
const askCount = (layer.match(/isSubagentAgent\(/g) ?? []).length;
ok(askCount === 3, `narrative-layer.js 里问了 3 次（复核 / 空轮护栏 / 分拍），实际 ${askCount}`);

console.log("\n=== 而且都问在动作之前 ===");
/**
 * 同一文件里 a 必须出现在 b 之前。
 *
 * **两个锚点都必须是「只出现在调用点」的写法** —— 第一版这里用了 `reviewTurn({`，
 * 结果 `indexOf` 命中的是函数**定义**（在文件更前面），两条断言假失败。
 * 尺子拿错了，不是代码错了。
 */
const before = (a, b, label) => {
  const ia = layer.indexOf(a);
  const ib = layer.indexOf(b);
  ok(ia >= 0 && ib >= 0 && ia < ib, label, `a@${ia} b@${ib}`);
};

before("isSubagentAgent(agent)", "await reviewTurn({", "复核：先判子代理，再 reviewTurn");
before("isSubagentAgent(agent)", "await guardSilentTurn({", "护栏：先判子代理，再 guardSilentTurn");
before("isSubagentAgent(exec?.agent)", "= decideBeat(exec, result)", "分拍：先判子代理，再 decideBeat");

console.log("\n=== 跳过要留痕（否则以后分不清「跳过」与「坏了」）===");
const marks = (layer.match(/skipped: "subagent"/g) ?? []).length;
ok(marks === 3, `三处都写了 marks 的 skipped: "subagent"（实际 ${marks}）`);
ok(layer.includes('markPhase("subagentSkip"'), "信标里记了 subagentSkip 阶段");
ok(beacon.includes("subagentSkip:"), "PHASE_LABEL 里有 subagentSkip 的中文说法");
ok(/const order = \[[^\]]*"subagentSkip"/.test(beacon), "subagentSkip 在信标的阶段顺序里");

console.log("\n=== 分拍那处不该刷屏 ===");
ok(
  layer.includes("marks.subagentToolResults === 1"),
  "分拍的日志只在第一次跳过时打（工具结果很频繁）",
);

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
