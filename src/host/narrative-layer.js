/**
 * 叙述调度层的运行时接线。
 *
 * ## 一、为什么先探测再使用（曾经的拦路问题）
 *
 * `supervisor-llm.js` 需要 `@deepseek-ai/dsh-llm` 的 `BlockAssembler` /
 * `createUserMessage`。而插件代码里的裸包名 `@deepseek-ai/*` 是怎么解析的，
 * 曾经是个真问题：
 *
 *   · lab profile 的 `node_modules` 里**没有** `@deepseek-ai` 目录
 *   · 从**插件所在目录**用 `createRequire` 解析 `dsh-llm` / `dsh-tools`
 *     → `MODULE_NOT_FOUND`
 *   · 但现存代码 import `@deepseek-ai/dsh-tools` 却工作正常
 *
 * 答案在 `@deepseek-ai/cordis-plugin-loader/lib/index.js:274`：
 *
 * ```js
 * if (this.ctx.loader.internal) return this.ctx.loader.internal.import(name, this.ctx.baseUrl, {});
 * ```
 *
 * 它拿的是 **Node 自己的 ESM loader**（`ModuleLoader.fromInternal()` →
 * `getOrInitializeCascadedLoader()`），解析基准是 **`ctx.baseUrl`（profile 根）**，
 * **不是插件目录**。实测以 profile 为基准时 `dsh-llm` 解析正常、两个导出都是 function。
 *
 * 即便如此，接入仍用**动态 import + try/catch**：静态 import 的解析失败发生在
 * 模块求值阶段，会连累**整个插件**挂载失败，把记忆 / 语音 / 界面一起弄坏。
 *
 * ## 二、复核的完整行为
 *
 * `agent/turn-stopping`（`dsh-agent-loop` emit，turn 关闭前被 await）里：
 *
 *   1. 从会话表面取出**她的候选回话**（`session-surface.js`）
 *   2. 从 turn 里取**路由**（`supervisor.resolveRoute`）
 *   3. 问一次模型判决（`supervisor-llm.callSupervisor`）
 *   4. 否决 → 检查配额 → 按阶段注入 rethink / respeak 提示（`agent.steer`）
 *
 * 三条安全底线（缺一条都会出真问题）：
 *   · **任何失败一律放行** —— 复核坏了不该让她说不出话
 *   · **配额到顶一律放行** —— `steer` 会让 turn 继续，持续否决她将永远说不完
 *   · **拿不到路由就跳过** —— 不猜模型（`GenerateOptions.provider/model` 必填）
 *
 * ## 三、空轮护栏（2026-09-30 补）
 *
 * 同一个 `agent/turn-stopping`，注册在复核**之后**：清点这一轮用户到底有没有
 * 看到东西（`silence-guard.js`），没有就注入一条**看得见的通知**并要求她重说。
 *
 * 起因是真事故：模型会把整段回话写进思考通道，DSH 的消息里于是只有 `reasoning`
 * 块、没有 `text` 块，`turn/end` 照样报 `completed` —— 界面上一个字都没有。
 * 这类轮次**复核拦不住**（复核看的是「她说的这句站不站得住」，而她什么都没说），
 * 所以必须有一条只管「有没有说」的护栏。
 *
 * 三条底线与复核一致：**任何失败一律放行**、**配额到顶一律放行**、
 * **复核本轮已否决时跳过**（那条静默是 rethink 阶段故意要的）。
 */

import { VetoBudget, buildVetoSteering, resolveRoute } from "./supervisor.js";
import {
  isSubagentAgent,
  pickCandidate,
  pickCurrentTurnFromEvents,
  pickRecent,
} from "./session-surface.js";
import {
  BeatBudget,
  buildBeatSteering,
  decideBeat,
  failureSummary,
} from "./beat-policy.js";
import { SilenceBudget, buildSilentTurnNotice, inspectTurnActivity } from "./silence-guard.js";
import { markPhase } from "./narrative-beacon.js";
// 诊断总线（写事实）与依赖通道（送服务）**是两个模块** —— 2026-10-03 之前它们
// 挤在同一个 globalThis 对象里，外部看不出哪个 key 是依赖、哪些是诊断。
import { marks } from "./host-marks.js";
import { getHostCtx, setHostLlm } from "./host-deps.js";
// 会话 v4 的 source kind 只有一处定义（原先本文件里四个字面量 + 两个模块各一个常量）。
import { PLUGIN_SOURCE } from "./plugin-source.js";

/** 一次探测的结果缓存。 */
let probeCache = null;

/**
 * 探测叙述层需要的依赖是否可用（结果缓存）。
 *
 * @returns {Promise<{ok: boolean, reason?: string, llm?: object}>} 探测结果。
 */
export async function probeNarrativeDeps() {
  if (probeCache !== null) return probeCache;
  try {
    const llm = await import("@deepseek-ai/dsh-llm");
    if (typeof llm.BlockAssembler !== "function") {
      probeCache = { ok: false, reason: "dsh-llm 没有导出 BlockAssembler" };
      return probeCache;
    }
    if (typeof llm.createUserMessage !== "function") {
      probeCache = { ok: false, reason: "dsh-llm 没有导出 createUserMessage" };
      return probeCache;
    }
    probeCache = { ok: true, llm };
  } catch (error) {
    probeCache = { ok: false, reason: String(error?.message ?? error) };
  }
  return probeCache;
}

/**
 * 复核一个 turn，必要时否决（注入提示让她重说）。
 *
 * **永不抛错**：任何一步出问题都记一条日志然后放行。
 *
 * @param {object} params
 * @param {object} params.ctx - 宿主 cordis 上下文（`ctx.llm` 才是 LLM 服务）。
 * @param {object} params.agent - turn-stopping 载荷里的 agent。
 * @param {number} params.turn - turn 号。
 * @param {AbortSignal} [params.signal] - turn 的取消信号。
 * @param {VetoBudget} params.budget - 否决配额。
 * @param {object} params.marks - 诊断标记对象。
 * @returns {Promise<boolean>} 是否否决（true = 已 steer，turn 会继续）。
 */
export async function reviewTurn({ ctx, agent, turn, signal, budget, marks }) {
  const session = agent?.session;
  if (session === null || session === undefined) return false;

  const eventAt = (seq) => session.eventAt(seq);
  const deriveMessage = (event) => session.deriveEventMessage(event);
  const nodes = session.surface?.nodes ?? [];

  const candidate = pickCandidate({ nodes, eventAt, deriveMessage });
  if (candidate === null) {
    marks.supervisorLast = { turn, skipped: "no-candidate" };
    return false;
  }

  const route = resolveRoute(agent);
  if (route === null) {
    marks.supervisorLast = { turn, skipped: "no-route" };
    return false;
  }

  if (budget.canVeto(turn) === false) {
    marks.supervisorLast = { turn, skipped: "budget-exhausted" };
    console.log(`[dsh-herta] supervisor: turn ${turn} 否决配额已用尽，放行`);
    return false;
  }

  const recent = pickRecent({
    nodes,
    eventAt,
    deriveMessage,
    beforeSeq: candidate.seq,
  });

  const { callSupervisor } = await import("./supervisor-llm.js");
  const decision = await callSupervisor({
    // **必须是 `ctx.llm`（cordis 服务），不是 `dsh-llm` 模块** ——
    // `stream()` 长在服务上，模块里没有它。传错的表现是复核永远静默跳过
    // （callSupervisor 会因为 `typeof llm.stream !== "function"` 直接返回 null）。
    ctx,
    route,
    candidate: candidate.text,
    recent,
    signal,
  });

  marks.supervisorLast = {
    turn,
    verdict: decision?.verdict ?? null,
    reason: decision?.reason ?? null,
    candidateChars: candidate.text.length,
  };
  // 信标：**复核真的执行过**（无论判 pass 还是 veto）—— 这正是「放行不留痕」
  // 那个盲区想要的证据。
  markPhase("review", { count: true, turn, verdict: decision?.verdict ?? null });

  if (decision === null || decision.verdict !== "veto") return false;

  // ── 否决：按阶段注入提示 ────────────────────────────────────────────────
  const stage = budget.record(turn);
  const steering = buildVetoSteering(decision.reason);
  // 第一次否决让她「先重新想」，第二次让她「照想清楚的说」——
  // 这正是上游两阶段（rethink → respeak）的顺序。合并注入会显得矛盾，
  // 所以按否决次数分阶段。
  const text = stage === 1 ? steering.rethink : steering.respeak;

  try {
    const { createUserMessage } = probeCache?.llm ?? {};
    if (typeof createUserMessage !== "function") {
      marks.supervisorLast.steerError = "createUserMessage 不可用";
      return false;
    }
    // source 必须是「生产者自有 kind」：会话格式 v4 会拒绝
    // `{ kind: "plugin", plugin: "..." }`（整轮 turn 报
    // `format v4 message requires a producer-owned source kind`）。
    agent.steer(
      createUserMessage({
        content: [{ type: "text", text }],
        source: PLUGIN_SOURCE,
      }),
    );
    marks.supervisorVetoes = (marks.supervisorVetoes ?? 0) + 1;
    marks.supervisorLast.stage = stage;
    markPhase("veto", { count: true, turn, stage });
    console.log(`[dsh-herta] supervisor 否决 turn ${turn}（第 ${stage} 次）：${steering.selfCorrection}`);
    return true;
  } catch (error) {
    marks.supervisorLast.steerError = String(error?.message ?? error);
    console.log(`[dsh-herta] supervisor 注入失败（已放行）：${marks.supervisorLast.steerError}`);
    return false;
  }
}

/**
 * 清点一轮，**什么都没说就注入一条看得见的通知**。
 *
 * 「什么都没说」的判据在 `silence-guard.js`：这一轮的助手消息里没有一段用户
 * 看得见的正文（`speech` 非空），也没有工具调用。命中就 `steer` 一条通知 ——
 * 它同时是给用户看的说明和给她下的重说指令。
 *
 * **永不抛错**：任何一步出问题都记一条日志然后放行（与 `reviewTurn` 同一条底线）。
 *
 * @param {object} params
 * @param {object} params.agent - turn-stopping 载荷里的 agent。
 * @param {number} params.turn - turn 号。
 * @param {SilenceBudget} params.budget - 提醒配额。
 * @param {object} params.marks - 诊断标记对象（复核的结论也在这里）。
 * @returns {Promise<boolean>} 是否注入了提醒。
 */
export async function guardSilentTurn({ agent, turn, budget, marks }) {
  const session = agent?.session;
  if (session === null || session === undefined) return false;

  let events;
  try {
    // 与 `pickCurrentTurnFromEvents` 同一个取法：事件的 `data.turn` 才是
    // 「哪一轮」的可靠依据（会话表面里没有 `turn/start`，也没有空的助手消息）。
    events = session.snapshotEvents?.();
  } catch (error) {
    marks.silenceError = String(error?.message ?? error);
    return false;
  }
  if (Array.isArray(events) === false) return false;

  const report = inspectTurnActivity(events, turn);
  marks.silenceLast = {
    turn,
    silent: report.silent,
    reason: report.reason,
    hasText: report.hasText,
    hasToolCall: report.hasToolCall,
    visibleChars: report.visibleSpeech.length,
    thoughtChars: report.thoughtChars,
  };
  if (report.silent === false) return false;

  // 复核刚否决过这一轮 → 那条静默是复核**故意要的**（rethink 阶段就是要她只想不说），
  // 这时候再插一句「你怎么什么都没说」只会打架。放行，交给复核的 respeak。
  const last = marks.supervisorLast;
  if (last !== undefined && last.turn === turn && typeof last.stage === "number") {
    marks.silenceLast.skipped = "supervisor-intervened";
    return false;
  }

  if (budget.canNotice(turn) === false) {
    marks.silenceLast.skipped = "budget-exhausted";
    console.log(`[dsh-herta] 空轮提醒配额已用尽（turn ${turn}），放行`);
    return false;
  }

  const { createUserMessage } = probeCache?.llm ?? {};
  if (typeof createUserMessage !== "function") {
    marks.silenceLast.skipped = "no-createUserMessage";
    return false;
  }

  const attempt = budget.record(turn);
  const text = buildSilentTurnNotice({ turn, attempt });
  try {
    agent.steer(
      createUserMessage({
        content: [{ type: "text", text }],
        // `form`/`summary` 是核心 `dsh-repeat-tool-reminder` 用的通知外形：
        // 会话格式 v4 只要求 `kind` 非空且不是字面量 `plugin`，其余字段原样保留
        // （`dsh-session-format-v3-to-v4` 的 `rewriteV3MessageSource`）。
        source: { ...PLUGIN_SOURCE, form: "notice", summary: `空轮 turn ${turn}` },
      }),
    );
  } catch (error) {
    // 通知外形万一不被接受，退回普通注入 —— 功能（让她重说）比外形要紧。
    marks.silenceLast.noticeFormError = String(error?.message ?? error);
    try {
      agent.steer(
        createUserMessage({
          content: [{ type: "text", text }],
          source: PLUGIN_SOURCE,
        }),
      );
    } catch (fallbackError) {
      marks.silenceLast.steerError = String(fallbackError?.message ?? fallbackError);
      console.log(`[dsh-herta] 空轮提醒注入失败（已放行）：${marks.silenceLast.steerError}`);
      return false;
    }
  }

  marks.silenceLast.injected = true;
  marks.silenceLast.attempt = attempt;
  markPhase("silence", { count: true, turn, attempt });
  console.log(
    `[dsh-herta] 空轮提醒 turn ${turn}（第 ${attempt} 次）：这一轮只出了思考（${report.reason}，思考 ${report.thoughtChars} 字），界面上不会显示任何东西`,
  );
  return true;
}

/**
 * 把叙述层挂到宿主上。
 *
 * 诊断事实记进 `host-marks.js` 的 `marks`（挂 `globalThis.__DSH_HERTA_HOST__`，
 * 外部探针读它）；依赖走 `host-deps.js`。两者原先混在同一个全局对象里。
 *
 * @param {object} ctx - 宿主 cordis 上下文。
 * @returns {Promise<object>} 诊断对象（即 `marks`）。
 */
export async function installNarrativeLayer(ctx) {
  marks.narrativeInstalled = true;
  marks.installedAt = new Date().toISOString();

  const probe = await probeNarrativeDeps();
  marks.depsOk = probe.ok;
  // 信标：钩子挂上了（install 阶段）。§启动信标见 narrative-beacon.js。
  markPhase("install", { depsOk: probe.ok, reason: probe.reason ?? null });
  if (!probe.ok) {
    marks.depsReason = probe.reason;
    console.log(`[dsh-herta] 叙述层依赖不可用，已跳过：${probe.reason}`);
    return marks;
  }
  delete marks.depsReason;
  console.log("[dsh-herta] 叙述层依赖就绪（dsh-llm 可用）");

  // `ctx.llm` 必须**声明后再取**（cordis 的硬规矩）。用 `ctx.inject` 而不是
  // 往插件级 `inject` 里加一项：
  //   · `ctx.inject(["llm"], cb)` 会等服务就绪再回调，没有 llm 的组合
  //     （无头 / SDK）里只是**永不触发**，不会把插件卡成 PENDING
  //   · 插件级 `inject` 加 `"llm"` 则是硬依赖：缺了它整个插件都不挂
  // 这与 `index.js` 里 `ctx.inject(["webServer"], …)` 是同一个已验证的写法。
  ctx.inject(["llm"], (scoped) => {
    // 工具的 `execute(args, exec)` **拿不到 `ctx`**（exec 上只有 agent / callId /
    // name / arguments / signal），而做梦蒸馏需要 `ctx.llm`。所以把服务交给
    // `host-deps.js` 那条**具名依赖通道**，`dream.js` 从那里读回来。
    // **必须存 `scoped`（inject 回调给的作用域上下文），不是外面的 `ctx`。**
    // cordis 只在声明过依赖的作用域里才允许取服务：用原始 `ctx` 去读 `ctx.llm`
    // 会抛 `cannot get property "llm" without inject` —— 实测踩过，表现是
    // 「复核真的发出去了，但 reviewTurn 里取 llm 时抛错，于是每轮都被放行」。
    setHostLlm({ ctx: scoped, llm: scoped.llm });
    marks.llmReady = true;
    markPhase("llm", { ok: true });
    console.log("[dsh-herta] llm 服务已就绪（复核与做梦蒸馏可用）");
  });

  const budget = new VetoBudget();
  marks.vetoBudgetPerTurn = budget.max;

  // ── 复核：turn 关闭前问一次 ──────────────────────────────────────────────
  let turnStoppingSeen = 0;
  ctx.effect(
    () =>
      ctx.on("agent/turn-stopping", async ({ agent, turn, signal }) => {
        turnStoppingSeen += 1;
        marks.turnStoppingSeen = turnStoppingSeen;
        marks.lastTurnStopping = { turn, hasAgent: agent !== undefined && agent !== null };
        // 信标：**turn 边界钩子真的被触发过** —— 这是「叙述层是否活着」最硬的
        // 信号（比「有没有人 veto」硬：放行是不留痕迹的）。
        markPhase("turnStop", { count: true, turn });
        // 子代理不是她：复核是人格行为，不该打进派出去干活的工人。
        // 跳过要留痕（`marks` + 一行日志），否则以后没人分得清「跳过了」与「坏了」。
        if (isSubagentAgent(agent)) {
          marks.supervisorLast = { turn, skipped: "subagent" };
          markPhase("subagentSkip", { count: true, hook: "supervisor", turn });
          console.log(`[dsh-herta] 复核跳过：turn ${turn} 是子代理会话（origin=subagent）`);
          return;
        }
        try {
          // 用 await：钩子是 serial 模式，turn 会在边界提交前等它。
          // `getHostCtx()` 给的是 inject 回调存的**作用域**上下文（只有它才能取 llm）。
          await reviewTurn({ ctx: getHostCtx(), agent, turn, signal, budget, marks });
        } catch (error) {
          // 兜底：reviewTurn 内部已全程 try，这里再包一层是双保险 ——
          // 复核绝不能让她的 turn 崩掉。
          marks.supervisorError = String(error?.message ?? error);
          console.log(`[dsh-herta] supervisor 异常（已放行）：${marks.supervisorError}`);
        }
      }),
    "dsh-herta: 复核（supervisor）",
  );

  // ── 空轮护栏：这一轮什么都没说就出声 ────────────────────────────────────
  //
  // **注册顺序有关系**：`turn-stopping` 是 serial 模式，监听器按注册顺序执行，
  // 所以这个钩子跑在复核之后 —— `guardSilentTurn` 要读 `marks.supervisorLast`
  // 才能知道「这一轮的静默是不是复核故意要的」。万一顺序变了，后果只是复核否决
  // 的那一轮多出一句多余提醒（不会崩、不会死循环：两边都有配额）。
  const silenceBudget = new SilenceBudget();
  marks.silenceBudgetPerTurn = silenceBudget.max;
  let silenceNotices = 0;

  ctx.effect(
    () =>
      ctx.on("agent/turn-stopping", async ({ agent, turn }) => {
        // 子代理同样跳过空轮护栏：它的「沉默」不是用户看到的沉默，而注入一条
        // 「你怎么没说话」只会把派出去干活的工人再打断一次。
        if (isSubagentAgent(agent)) {
          marks.silenceLast = { turn, skipped: "subagent" };
          markPhase("subagentSkip", { count: true, hook: "silence", turn });
          return;
        }
        try {
          const injected = await guardSilentTurn({ agent, turn, budget: silenceBudget, marks });
          if (injected) {
            silenceNotices += 1;
            marks.silenceNotices = silenceNotices;
          }
        } catch (error) {
          // 兜底：护栏坏掉绝不能影响她的 turn。
          marks.silenceError = String(error?.message ?? error);
          console.log(`[dsh-herta] 空轮护栏异常（已放行）：${marks.silenceError}`);
        }
      }),
    "dsh-herta: 空轮护栏（silence guard）",
  );

  // ── 诊断：turn 出错时也取一次路由 ───────────────────────────────────────
  // 为什么盯 `agent/error`：lab 与无 Key 环境里 turn 会以失败告终，
  // **`turn-stopping` 根本不会触发**（实测：界面显示「1 轮 1 步」但钩子没到），
  // 所以拿不到任何「路由能不能读出来」的证据。而 `agent/error` 在这条路径上
  // **会**触发，正好用它证明 `resolveRoute` 到底能不能从真实会话里取到
  // provider/model（`supervisor.js` 的单测只用了假对象，证明不了真实形状）。
  let agentErrorSeen = 0;
  ctx.effect(
    () =>
      ctx.on("agent/error", ({ agent, turn, step, error }) => {
        agentErrorSeen += 1;
        marks.agentErrorSeen = agentErrorSeen;
        try {
          const route = resolveRoute(agent);
          marks.routeFromErrorPath = route;
          marks.routeReadOk = route !== null;
          console.log(
            `[dsh-herta] 路由可读性实测（agent/error 路径）: ${route === null ? "取不到" : JSON.stringify(route)}`,
          );
          if (route === null) {
            // 取不到就顺手记下形状，方便下一轮定位（不抛错）。
            const keys = (o) => (o === null || o === undefined ? null : Object.keys(o).slice(0, 40));
            marks.routeMissShape = {
              sessionKeys: keys(agent?.session),
              hasRequestContext: typeof agent?.session?.requestContext,
              hasRequestHeader: typeof agent?.session?.requestHeader,
              surfaceKeys: keys(agent?.session?.surface),
              error: String(error?.message ?? error).slice(0, 120),
            };
          }
        } catch (e) {
          marks.routeProbeError = String(e?.message ?? e);
        }
        if (marks.agentShape === undefined && agent !== undefined && agent !== null) {
          const keys = (o) => (o === null || o === undefined ? null : Object.keys(o).slice(0, 40));
          marks.agentShape = { agentKeys: keys(agent), sessionKeys: keys(agent.session) };
        }
      }),
    "dsh-herta: 路由可读性诊断",
  );

  // ── 分拍：工具结果之后让她补一句点评 ───────────────────────────────────
  //
  // 用 `tools/result` 而**不是** `tools/post-execute`：
  //   · `tools/result` 是 **emit**（只观察，监听器失败被容纳 —— 见
  //     `dsh-tools/types/index.d.ts:76-83` 的原文），签名就是 `(exec, result)`
  //   · `tools/post-execute` 是 **waterfall**，带 `next()` 约定，是用来改结果的；
  //     我们只想观察，用它会无谓地卷进决策链
  //
  // 语义差距（必须知道）：DSH 的 `agent.steer` 是**下一个 step 边界**生效，
  // 不像上游那样能在后端事件发生当拍插话。所以这是「事件后一个 step 补评」。
  const beatBudget = new BeatBudget();
  marks.beatBudgetPerTurn = beatBudget.max;
  let beatsInjected = 0;

  ctx.effect(
    () =>
      ctx.on("tools/result", (exec, result) => {
        try {
          // 子代理的工具结果不进分拍：判据与计数都留在人机会话上，信标才读得准。
          if (isSubagentAgent(exec?.agent)) {
            marks.subagentToolResults = (marks.subagentToolResults ?? 0) + 1;
            marks.beatLast = { skipped: "subagent" };
            if (marks.subagentToolResults === 1) {
              markPhase("subagentSkip", { count: true, hook: "beat" });
              console.log("[dsh-herta] 分拍跳过：子代理会话的工具结果不补拍（后续同类不再刷屏）");
            }
            return;
          }
          marks.toolResultsSeen = (marks.toolResultsSeen ?? 0) + 1;
          const decision = decideBeat(exec, result);
          // 信标：分拍判据执行过（判 null 也算 —— 它证明工具结果流到了这里）。
          markPhase("beat", { count: true, kind: decision?.kind ?? null });
          // 诊断：每个工具结果都记一行，把「事件到没到」与「判据怎么判的」
          // 分开 —— 分拍不触发时，这两者要能一眼区分。
          console.log(
            `[dsh-herta] tools/result #${marks.toolResultsSeen} name=${exec?.name} isError=${result?.isError} → ${decision === null ? "不补拍" : decision.kind}`,
          );
          if (decision === null) return;

          // **从事件日志取 turn，不是从会话表面** —— 实测：表面只含模型可见的
          // 消息，不含 `turn/start`，用表面去找永远得到 null（分拍因此静默失效）。
          const turn = pickCurrentTurnFromEvents(exec?.agent?.session);
          // 诊断：turn 取不到是分拍静默失效的头号嫌疑（配额按 turn 记）。
          console.log(`[dsh-herta] 分拍候选 turn=${turn}`);
          if (turn === null) {
            marks.beatLast = { skipped: "no-turn" };
            return;
          }
          if (beatBudget.canBeat(turn) === false) {
            marks.beatLast = { turn, kind: decision.kind, skipped: "budget-exhausted" };
            return;
          }

          const summary = failureSummary(result);
          const text = buildBeatSteering(decision, summary);
          const { createUserMessage } = probeCache?.llm ?? {};
          if (typeof createUserMessage !== "function") {
            marks.beatLast = { turn, kind: decision.kind, skipped: "no-createUserMessage" };
            return;
          }
          // 同步注入 —— emit 模式下不 await（钩子不等待观察者）。
          // source 取自 `PLUGIN_SOURCE`（会话格式 v4 只认「生产者自有 kind」，
          // 写成 `{ kind: "plugin", plugin: "..." }` 会被拒、整轮 turn 报错）。
          exec.agent.steer(
            createUserMessage({
              content: [{ type: "text", text }],
              source: PLUGIN_SOURCE,
            }),
          );
          beatBudget.record(turn);
          beatsInjected += 1;
          marks.beatsInjected = beatsInjected;
          marks.beatLast = { turn, kind: decision.kind, injected: true };
          // 记一行日志：分拍是「注入了一条 steer」，从外面看不出发生了什么。
          // 与 supervisor 的否决日志对称 —— 验证时靠它确认分拍真的触发了。
          console.log(
            `[dsh-herta] 分拍 turn ${turn}（${decision.kind}）：${summary.slice(0, 60) || "（无摘要）"}`,
          );
        } catch (error) {
          // 分拍坏掉不该影响工具结果本身。
          marks.beatError = String(error?.message ?? error);
        }
      }),
    "dsh-herta: 分拍（beat）",
  );

  marks.subscribed = true;
  return marks;
}
