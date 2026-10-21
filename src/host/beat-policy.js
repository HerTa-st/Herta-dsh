/**
 * 分拍（beat）策略 —— 「她在干活的中途插一句对眼前这一步的点评」。
 *
 * ## 上游是什么，这里是什么
 *
 * 上游的 beat 是**当拍插话**：后端（板砖）每产出一个实质事件（补丁预览 / 验证
 * 结果 / 一步失败），`makeFireBeat` 立刻让演员说一句，那句话带着它自己的
 * `（我 说）…（/我 说）` 围栏进记录（`thought-hint.ts:345-398` 的三条 beat 提示）。
 *
 * **DSH 里做不到当拍插话** —— `agent.steer()` 是**下一个 step 边界**才生效
 * （`dsh-agent/runtime-types.d.ts:194-200`：「Submit steering for the nearest
 * step」）。所以这里的 beat 是「**事件之后一个 step 补一句点评**」，不是在模型
 * 流式输出中途打断。语义等价（她仍然对这一步说了话），时机晚一拍。
 *
 * ## 为什么必须限额
 *
 * 每注入一次 beat 就多一个 step，而每个 step 都是一次 LLM 调用。一次 turn 里
 * 可能有十几个工具调用，**逐个点评会让成本和延迟爆炸**，而她也会碎成一地。
 * 所以：
 *   · 只对**失败**触发（成功是常态，不值得每次都评）
 *   · 每个 turn 有硬上限
 *
 * 判据来自上游：`BEAT_HINT_TOOL_FAIL` 那段正是「一步失败了，拎出失败点用人话讲
 * （不要照搬错误信息），态度可以冷 / 嘲讽，但不要装作这事不要紧」。
 */

import { BEAT_HINT_TOOL_FAIL, BEAT_HINT_VERIFICATION_FINISHED } from "./narrative-hints.js";

/** 一个 turn 里最多让她补几次点评。 */
export const MAX_BEATS_PER_TURN = 2;

/**
 * 验证类工具的名字特征 —— 它们的**成功**也值得一句点评。
 *
 * 上游对应的场景是「板砖刚跑完了一步验证（测试 / 编译 / lint）」，并且特别
 * 要求**不复述全部输出、不读 stack trace，短促、冷静**（`thought-hint.ts:385-388`）。
 *
 * 这里用名字匹配而不是工具清单：DSH 的工具集是**可配置的**（用户能加自己的
 * 工具），写死清单会在别人机器上失效。匹配不到就走通用失败条款，不会漏。
 */
const VERIFICATION_HINTS = ["test", "lint", "check", "build", "compile", "typecheck", "vet"];

/**
 * 这个工具名看起来是不是「验证」类。
 *
 * @param {string} name - 工具名。
 * @returns {boolean}
 */
export function looksLikeVerification(name) {
  const n = String(name ?? "").toLowerCase();
  if (n.length === 0) return false;
  return VERIFICATION_HINTS.some((h) => n.includes(h));
}

/**
 * 要不要**压住**这一次分拍 —— A / B / C 三道闸，都在这一处。
 *
 * 起因（2026-10-22）：新对话的第一句永远是「某一步失败了」的点评，因为她的开局
 * 动作（广域搜索 / 抓网页）在第一步就失败，而 `decideBeat` 对任何 isError 都触发。
 * 结果用户看到的第一句话不是在回答他，是在对某个报错冷嘲。
 *
 * 三道闸各治一层：
 *
 *   · **B `turn === 1`** —— 第一轮完全不分拍。开门第一句必须是回答，不是点评。
 *   · **C `step <= 1`** —— 第一步的失败不点评。那是"还没开始干"，谈不上"干到中途"。
 *   · **A `!spokeInTurn`** —— 这一轮她**一句话都还没说过**时不分拍。
 *     这条是最本质的：点评的前提是"她已经开了口"，否则点评本身就成了第一句
 *     （B 只堵第一轮，A 堵所有轮）。
 *
 * 三条都放行才注入。想放宽时只改这里 —— 例如允许第二轮的第一步点评，就把 C 去掉。
 *
 * @param {{turn: number|null, step: number|null, spokeInTurn: boolean}} ctx
 * @returns {"first-turn"|"first-step"|"not-spoken"|null} 跳过原因；null = 可以分拍。
 */
export function beatSkipReason(ctx) {
  if (ctx?.turn === 1) return "first-turn";
  if (typeof ctx?.step === "number" && Number.isFinite(ctx.step) && ctx.step <= 1) return "first-step";
  if (ctx?.spokeInTurn !== true) return "not-spoken";
  return null;
}

/**
 * 从一次工具结果判断要不要让她补一句点评，以及用哪条提示。
 *
 * **纯函数**：只看 `(exec, result)` 这两个入参，配额与状态由调用方管
 * （见 {@link BeatBudget}）。这样判据可以在 Node 里直接测，不用起会话。
 *
 * @param {{name?: string}} exec - `tools/result` 的 exec（用 `name`）。
 * @param {{isError?: boolean, error?: unknown}} result - 工具结果。
 * @returns {{beat: string, kind: string} | null} 要注入的提示；不需要时 null。
 */
export function decideBeat(exec, result) {
  const name = String(exec?.name ?? "");
  if (name.length === 0) return null;

  const failed = result?.isError === true;
  if (failed) {
    // 失败一律值得一句 —— 上游的 tool.fail 拍正是为此存在。
    const kind = looksLikeVerification(name) ? "verification-failed" : "tool-failed";
    return { beat: BEAT_HINT_TOOL_FAIL, kind };
  }

  // 成功：只有验证类才值得说，而且**只在它真的跑完时**。
  // （成功的写文件、读文件、搜索是常态，逐个点评只会变成噪音。）
  if (looksLikeVerification(name)) {
    return { beat: BEAT_HINT_VERIFICATION_FINISHED, kind: "verification-passed" };
  }
  return null;
}

/**
 * 从工具结果里取出一小段失败摘要（给她当「眼前这一步」的上下文）。
 *
 * **刻意截断且不平铺整段输出**：上游那条 beat 提示明确要求「把失败点拎出来用人话
 * 讲（不要照搬错误信息）……不复述全部输出，不读 stack trace」。把整坨错误塞给她
 * 只会诱导她照抄。
 *
 * @param {{error?: unknown, content?: readonly unknown[]}} result - 工具结果。
 * @param {number} [maxChars] - 摘要上限。
 * @returns {string} 摘要；取不到时空串。
 */
export function failureSummary(result, maxChars = 400) {
  const err = result?.error;
  let text = "";
  if (typeof err === "string") text = err;
  else if (err !== null && typeof err === "object") {
    for (const key of ["message", "reason", "detail", "code"]) {
      const v = err[key];
      if (typeof v === "string" && v.length > 0) {
        text = v;
        break;
      }
    }
  }
  if (text.length === 0 && Array.isArray(result?.content)) {
    text = result.content
      .filter((b) => b !== null && typeof b === "object" && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  const trimmed = text.trim();
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
}

/**
 * 一个 turn 里的 beat 配额 —— 与 `VetoBudget` 同一个形状，理由也相同：
 * 每多一次 beat 就多一次 LLM 调用与一段延迟，必须有硬闸。
 */
export class BeatBudget {
  /**
   * @param {number} [max] - 每个 turn 允许的 beat 次数。
   * @param {number} [keepTurns] - 只保留最近这么多个 turn 的账。
   */
  constructor(max = MAX_BEATS_PER_TURN, keepTurns = 32) {
    this.max = max;
    this.keepTurns = keepTurns;
    /** @type {Map<number, number>} turn → 已用次数 */
    this.used = new Map();
  }

  /**
   * @param {number} turn - turn 号。
   * @returns {boolean} 还能不能再补一拍。
   */
  canBeat(turn) {
    const key = Number(turn);
    if (!Number.isFinite(key)) return false;
    return (this.used.get(key) ?? 0) < this.max;
  }

  /**
   * 记一次 beat。**调用方必须先用 `canBeat` 问过**。
   *
   * @param {number} turn - turn 号。
   * @returns {number} 该 turn 累计次数。
   */
  record(turn) {
    const key = Number(turn);
    const next = (this.used.get(key) ?? 0) + 1;
    this.used.set(key, next);
    if (this.used.size > this.keepTurns) {
      const keys = [...this.used.keys()].sort((a, b) => a - b);
      for (const k of keys.slice(0, this.used.size - this.keepTurns)) this.used.delete(k);
    }
    return next;
  }

  /** 清空（会话重置 / 测试用）。 */
  clear() {
    this.used.clear();
  }
}

/**
 * 组装真正要注入的那条消息文本。
 *
 * 为什么包一层外壳：`agent.steer` 注入的是 **user 角色**消息，而 beat 提示是
 * 给**她**的指令（`〔…〕` 是她提示词里的记号）。直接丢进去会读成「用户在用括号
 * 指挥我」。包一层「记录 · 现场」的口吻，与她自己的叙述语法对齐。
 *
 * **注意上游那条禁令**：`BEAT_NO_BANZHUAN_CLAUSE` 写着「不要在这一句里写
 * `@板砖` —— 板砖正在工作中」。在 DSH 里板砖（她的编码子代理）根本不接活，
 * 所以这条禁令的**字面**已经过时，但**意图**（拍是即评、不是派活）仍然成立，
 * 而她在 DSH 上本来就没有 `@板砖` 可写（`adaptation-suffix.md` 已另行说明）。
 *
 * @param {{kind: string, beat: string}} decision - {@link decideBeat} 的结果。
 * @param {string} [summary] - 失败/结果摘要。
 * @returns {string} 注入文本。
 */
export function buildBeatSteering(decision, summary = "") {
  const header =
    decision.kind === "verification-failed"
      ? "【记录 · 现场】她刚跑的一步验证失败了。"
      : decision.kind === "verification-passed"
        ? "【记录 · 现场】她刚跑完一步验证（测试 / 编译 / lint）。"
        : "【记录 · 现场】她刚有一步工具调用失败了。";
  const lines = [header];
  if (summary.length > 0) {
    lines.push(`这一步的结果：${summary}`);
  }
  lines.push("现在她为这一步补一句点评 —— 下面是指令原话：", "", decision.beat);
  return lines.join("\n");
}
