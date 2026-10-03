/**
 * 叙述层**装配**的集成测试（2026-10-03 架构审查 candidate #6）。
 *
 * ## 这个测试补的是什么缺口
 *
 * `narrative-layer.js` 是本仓最深的 module（一个 `installNarrativeLayer(ctx)` 入口，
 * 里面藏着 4 个 hook 的注册、**两条 turn-stopping 之间的顺序契约**、69 处诊断写入）。
 * 在这之前它**没有任何装配测试**：`test-supervisor` / `test-silence-guard` /
 * `test-beat-policy` 测的都是抽出来的纯函数，`test-llm-integration` 只测
 * `supervisor-llm` / `dream-distill-llm`。于是那两条最脆的知识 ——
 *
 *   1. **注册顺序**：静默护栏的 handler 跑在复核的 handler 之后（它要读
 *      `marks.supervisorLast` 才知道「这一轮的静默是不是复核故意要的」）；
 *   2. **子代理让过路**：三处 hook 都要问 `isSubagentAgent`，且问在动作之前，
 *
 * ——只由 `test-subagent-skip.mjs` 的**正则 grep 源码**守着。那个测试证明不了
 * 运行时行为（它自己也这么写），而这个测试真的把钩子跑一遍。
 *
 * ## 它凭什么算 interface 测试
 *
 * 装配的 interface 就是「`ctx` 上的注册调用」：本测试给一个假 ctx，记录
 * `on(event, fn)` 的**事件名与顺序**、`effect(fn)` 的实际执行，然后**真的调用**
 * 那些 handler（假 agent / 假会话事件）。于是「谁先谁后」变成可断言的事实，
 * 而不是源码里函数的书写顺序。
 *
 * ## 依赖
 *
 * `installNarrativeLayer` 会 `await import("@deepseek-ai/dsh-llm")` 做探测（真库），
 * 所以要用 resolve hook 跑：
 *
 * ```powershell
 * node --import ./scripts/test-resolve-hook.mjs scripts/test-narrative-layer.mjs
 * ```
 *
 * 信标（`narrative-beacon.js`）会往 `$DSH_HOME` 落盘，所以先把 `DSH_HOME` 指到
 * 临时目录 —— 不能污染本机那份真信标。
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** Windows 上绝对路径不能直接喂给 `import()` —— 必须转成 file:// URL。 */
const srcUrl = (name) => pathToFileURL(join(here, "..", "src", "host", name)).href;

// 必须在 import 叙述层**之前**设好：beaconPath() 每次调用现读环境变量，
// 但它太早落盘就会写进用户的真信标目录。
const SCRATCH = mkdtempSync(join(tmpdir(), "herta-narrative-layer-"));
process.env.DSH_HOME = SCRATCH;

const { installNarrativeLayer } = await import(srcUrl("narrative-layer.js"));
const { marks } = await import(srcUrl("host-marks.js"));
const { resetHostDepsForTest, getHostLlm, hostDepsReady } = await import(srcUrl("host-deps.js"));
const { PLUGIN_SOURCE } = await import(srcUrl("plugin-source.js"));

let passed = 0;
let failed = 0;
function check(ok, label, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
  }
}

/**
 * 假 ctx：把「装配」这件事变成可读的清单。
 *
 * `inject` 立刻回调（生产里它等服务就绪 —— 那是 cordis 的事，不是本测试要验的），
 * 并把**自身**当作用域上下文交给回调（生产里 scope 是另一个对象；对本测试而言
 * 只要 `scoped.llm` 可读就等价）。`effect` 立刻执行 —— 生产里它同样在注册时执行。
 */
function fakeCtx() {
  const registered = [];
  const effects = [];
  const ctx = {
    on(event, fn) {
      registered.push({ event, fn });
      return () => {};
    },
    effect(fn) {
      effects.push(fn());
      return () => {};
    },
    inject(deps, cb) {
      cb(ctx);
    },
  };
  return { ctx, registered, effects };
}

/** 一个只为「能读 llm」而存在的替身（本测试不驱动复核的模型判决）。 */
const fakeLlm = { stream() {} };

/**
 * 假 agent。
 *
 * @param {object} params
 * @param {number} params.turn - turn 号。
 * @param {boolean} [params.subagent] - 是不是子代理会话。
 * @param {readonly object[]} [params.events] - `session.snapshotEvents()` 的返回。
 * @returns {{agent: object, steered: object[]}} agent 与它收到的 steer 记录。
 */
function fakeAgent({ turn, subagent = false, events = null }) {
  const steered = [];
  const header = subagent
    ? { id: "child", origin: "subagent", delegationDepth: 1 }
    : { id: "main", delegationDepth: 0 };
  const session = {
    header,
    surface: { nodes: [] },
    snapshotEvents: () => events,
  };
  const agent = {
    session,
    steer: (message) => {
      steered.push(message);
    },
  };
  return { agent, steered, turn };
}

/** 一条「只出思考」的助手消息（用户看不见正文）。 */
function thoughtOnlyEvent(turn) {
  return {
    type: "assistant/message",
    seq: 1,
    time: "2026-10-03T00:00:00.000Z",
    data: {
      turn,
      step: 1,
      message: { content: [{ type: "text", text: "（我 想）只有心里话。（/我 想）" }] },
    },
  };
}

console.log("=== 装配：钩子挂上了，且依赖通道真的通了 ===");
resetHostDepsForTest();
const { ctx, registered } = fakeCtx();
ctx.llm = fakeLlm;
const returned = await installNarrativeLayer(ctx);

check(marks.depsOk === true, "依赖探测通过（真的解析到 @deepseek-ai/dsh-llm）");
check(hostDepsReady() === true, "依赖通道已就绪（hostDepsReady()）");
check(getHostLlm() === fakeLlm, "依赖通道里就是 ctx.inject 作用域给的 llm");
check(marks.llmReady === true, "诊断里也记了 llmReady");
check(returned === marks, "install 返回的就是诊断对象（外部不另建一份）");

// 装配清单 —— 这是本测试新暴露出来的 interface。
const events = registered.map((r) => r.event);
check(
  events.join(",") === "agent/turn-stopping,agent/turn-stopping,agent/error,tools/result",
  `装配清单与顺序：${events.join(" → ")}`,
);

const turnStopping = registered.filter((r) => r.event === "agent/turn-stopping");
check(turnStopping.length === 2, "两条 turn-stopping 钩子（复核 + 空轮护栏）");

console.log("\n=== 顺序契约：复核在前，护栏在后（护栏读复核写的结论）===");

// 先跑**第 0 条**：子代理应该被复核让过路。若注册顺序被颠倒，这里写的会是
// silenceLast 而不是 supervisorLast —— 于是「谁先谁后」不必读源码即可判定。
{
  delete marks.supervisorLast;
  delete marks.silenceLast;
  const { agent } = fakeAgent({ turn: 1, subagent: true });
  await turnStopping[0].fn({ agent, turn: 1 });
  check(marks.supervisorLast?.skipped === "subagent", "第 0 条是复核（写了 supervisorLast.skipped）");
  check(marks.silenceLast === undefined, "第 0 条没有动护栏的结论（顺序成立）");
}

// 再跑**第 1 条**：子代理同样让过路，但写的是另一份结论。
{
  delete marks.silenceLast;
  const { agent } = fakeAgent({ turn: 2, subagent: true });
  await turnStopping[1].fn({ agent, turn: 2 });
  check(marks.silenceLast?.skipped === "subagent", "第 1 条是护栏（写了 silenceLast.skipped）");
}

console.log("\n=== 护栏读复核的结论：本轮被否决过就跳过（不打架）===");
{
  // 模拟「复核刚刚否决了这一轮」—— 顺序契约的**下游后果**。
  marks.supervisorLast = { turn: 7, stage: 1 };
  delete marks.silenceLast;
  const { agent, steered } = fakeAgent({ turn: 7, events: [thoughtOnlyEvent(7)] });
  await turnStopping[1].fn({ agent, turn: 7 });
  check(
    marks.silenceLast?.skipped === "supervisor-intervened",
    "复核否决过 → 护栏跳过（理由记在 marks 里）",
    JSON.stringify(marks.silenceLast),
  );
  check(steered.length === 0, "跳过时不注入任何消息（否则与复核的 rethink 打架）");
}

console.log("\n=== 护栏本身真的会出声，且 source 来自 PLUGIN_SOURCE ===");
{
  delete marks.supervisorLast;
  delete marks.silenceLast;
  const { agent, steered } = fakeAgent({ turn: 8, events: [thoughtOnlyEvent(8)] });
  await turnStopping[1].fn({ agent, turn: 8 });
  check(marks.silenceLast?.injected === true, "只出思考 → 注入了一条看得见的通知", JSON.stringify(marks.silenceLast));
  check(steered.length === 1, "恰好注入一条");
  check(
    steered[0]?.source?.kind === PLUGIN_SOURCE.kind,
    `注入消息的 source.kind 来自常量（${steered[0]?.source?.kind}）`,
  );
}

console.log("\n=== 有工具调用的一轮不算空轮（不误报）===");
{
  delete marks.supervisorLast;
  delete marks.silenceLast;
  const withToolCall = {
    type: "assistant/message",
    seq: 2,
    data: {
      turn: 9,
      step: 1,
      message: { content: [{ type: "tool-call", name: "read", arguments: {} }] },
    },
  };
  const { agent, steered } = fakeAgent({ turn: 9, events: [withToolCall] });
  await turnStopping[1].fn({ agent, turn: 9 });
  check(marks.silenceLast?.silent === false, "有工具调用 → 判为不静默");
  check(steered.length === 0, "不注入");
}

console.log("\n=== 第三处闸门：分拍也不对子代理说话 ===");
{
  const beatHook = registered.find((r) => r.event === "tools/result");
  check(beatHook !== undefined, "tools/result 钩子也挂上了");
  delete marks.beatLast;
  delete marks.subagentToolResults;
  const { agent } = fakeAgent({ turn: 3, subagent: true });
  beatHook.fn({ agent, name: "read" }, { isError: true });
  check(marks.beatLast?.skipped === "subagent", "子代理的工具结果不补拍", JSON.stringify(marks.beatLast));
  check(marks.subagentToolResults === 1, "跳过被计数（日志只打第一次）");
}

console.log("\n=== 信标：阶段真的落盘了（外部读得到「它在跑」）===");
{
  const beacon = JSON.parse(readFileSync(join(SCRATCH, "dsh-herta-narrative.json"), "utf8"));
  const phases = beacon.phases ?? {};
  for (const phase of ["install", "llm", "turnStop", "subagentSkip"]) {
    check(phases[phase] !== undefined, `信标里有 ${phase} 阶段`);
  }
  check(
    typeof beacon.verdict === "string" && beacon.verdict.includes("让过路"),
    `verdict 读得出「对子代理让过路」：${beacon.verdict}`,
  );
}

console.log("\n=== 装配失败也不该抛（叙述层坏了其余照常）===");
{
  // install 的底线是「永不抛」：钩子里任何异常都被吞掉并留痕。
  delete marks.silenceError;
  const broken = {
    session: { header: { delegationDepth: 0 }, snapshotEvents: () => { throw new Error("boom"); } },
    steer: () => {},
  };
  await turnStopping[1].fn({ agent: broken, turn: 10 });
  check(typeof marks.silenceError === "string", "异常被接住并记进 marks.silenceError", String(marks.silenceError));
}

rmSync(SCRATCH, { recursive: true, force: true });

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
