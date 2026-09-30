/**
 * 空轮护栏 —— 「她这一轮什么都没说」不再是一个静默的结局。
 *
 * ## 拦的是什么（2026-09-30 的真事故）
 *
 * 会话 `session-96f68201` 从第 58 轮起，**每一轮都只产出思考**：DSH 的助手消息里
 * 只有 `reasoning` 块，没有 `text` 块、也没有工具调用，而 `turn/end` 照样报
 * `completed`。界面上什么都没有 —— 用户看到的现象是「黑塔突然不会说话了」，
 * 于是只能一轮一轮地问「还在吗」，每一轮再喂进去一条「只出思考」的先例。
 *
 * 模型侧的原因（思考里循环「动手。/（做。）/（写。）」几百遍，最后把回话写在
 * 思考末尾）不在插件能管的范围内；**但「界面上什么都没有」这件事插件能管**：
 *
 *   · 检测：这一轮的助手消息里，有没有一段**用户看得见的正文**？
 *   · 处置：没有 → 注入一条**看得见的通知**，同时要求她重说一遍
 *
 * ## 为什么判据不是「没有 text 块」，而是「没有可见正文」
 *
 * 因为 `（我 想）…（/我 想）` 那一段**有 text 块、但用户看不见**
 * （`splitSurfaces` 会把它判成思考，见 `narrative-hints.js`）。只数 text 块会漏掉
 * 这类静默。所以口径与客户端渲染一致：**过一遍 `splitSurfaces`，`speech` 为空即不可见**。
 *
 * ## 为什么「有工具调用」不算空轮
 *
 * 工具调用在界面上是有痕迹的（结果卡片）。她一步只调工具、一句话不说，是正常的
 * 干活节奏 —— 那不是静默，不该被提醒。
 *
 * ## 与复核（supervisor）的分工
 *
 * 复核管「她说的这句站不站得住」，护栏只管「她到底有没有说」。两者可能在同一个
 * turn 上撞车：复核否决后会注入「先重新想」（那时她要的就是**只出思考**的一轮）。
 * 所以调用方在**本轮已经否决过**时跳过护栏 —— 那条静默是复核故意要的，
 * 插一句「你怎么什么都没说」只会打架。见 `narrative-layer.js` 的接线。
 */

import { splitSurfaces } from "./narrative-hints.js";

/**
 * 一个 turn 内最多提醒几次。
 *
 * **防死循环的硬闸**，与 `MAX_VETOES_PER_TURN` 同一个理由：`steer` 会让 turn 继续，
 * 而 turn 再关闭时 `turn-stopping` 会再次触发。模型要是彻底陷进思考里，
 * 提醒并不会把它拽出来 —— 到顶之后必须**停下来**，把剩下的交给人。
 */
export const MAX_SILENCE_NOTICES_PER_TURN = 2;

/**
 * 清点一轮里用户到底看得见什么。
 *
 * 入参是**会话事件日志**（`session.snapshotEvents()` 的形状），不是会话表面 ——
 * 与 `session-surface.js` 的 `pickCurrentTurnFromEvents` 同一个取法，理由也一样：
 * 表面只含模型可见的消息，事件的 `data.turn` 才是判定「哪一轮」的可靠依据。
 *
 * 事件形状（`dsh-session/lib/types/types.d.ts`，`assistant/message`）：
 * `{ type, seq, time, data: { turn, step, message: { content: [...] } } }`
 * —— payload 在 `data`，**不是** `payload`。
 *
 * @param {readonly object[]} events - 会话事件日志。
 * @param {number} turn - 要清点的 turn 号。
 * @returns {{found: boolean, hasText: boolean, hasToolCall: boolean, visibleSpeech: string, thoughtChars: number, silent: boolean, reason: string | null}}
 *   `silent` 为 true 表示「这一轮用户在界面上什么都不会看到」。
 */
export function inspectTurnActivity(events, turn) {
  const target = Number(turn);
  const report = {
    found: false,
    hasText: false,
    hasToolCall: false,
    visibleSpeech: "",
    thoughtChars: 0,
    silent: false,
    reason: null,
  };
  if (!Array.isArray(events) || Number.isFinite(target) === false) {
    report.reason = "no-events";
    return report;
  }

  const speechParts = [];
  for (const event of events) {
    if (event?.type !== "assistant/message") continue;
    const data = event.data;
    if (data?.turn !== target) continue;
    const content = data.message?.content;
    if (Array.isArray(content) === false) continue;
    report.found = true;
    for (const block of content) {
      if (block?.type === "tool-call") report.hasToolCall = true;
      if (block?.type !== "text" || typeof block.text !== "string") continue;
      if (block.text.trim() === "") continue;
      report.hasText = true;
      const { thought, speech } = splitSurfaces(block.text);
      report.thoughtChars += thought.length;
      if (speech !== "") speechParts.push(speech);
    }
  }

  report.visibleSpeech = speechParts.join("\n").trim();
  if (report.found === false) {
    // 这一轮连助手消息都没有（例如 turn 在第一步就崩了）—— 判不了，不越权提醒。
    report.reason = "no-assistant-message";
    return report;
  }
  report.silent = report.visibleSpeech === "" && report.hasToolCall === false;
  if (report.silent) {
    report.reason = report.hasText ? "thought-only" : "reasoning-only";
  }
  return report;
}

/**
 * 组装那条**看得见**的通知。
 *
 * 一条文本干两件事（刻意的）：
 *   1. 让用户知道发生了什么 —— 他此前只能看见「她不理我」，现在能看见原因；
 *   2. 让模型重说一遍 —— 通知同时是注入给她的 user 消息，末尾那段 `〔…〕` 是
 *      她的指令语法（与其他 hint 一致：必须带说话围栏）。
 *
 * 第二次提醒时**追加一句给人看的话**：到这个份上，继续在本会话里追问通常已经
 * 没用（上下文里已经攒了一串「只出思考」的先例），开新会话最省事 —— 这句话是
 * 给用户的，不是给她的。
 *
 * @param {object} params
 * @param {number} params.turn - turn 号。
 * @param {number} [params.attempt] - 本次是这个 turn 的第几次提醒（从 1 起）。
 * @returns {string} 可直接注入的通知文本。
 */
export function buildSilentTurnNotice({ turn, attempt = 1 } = {}) {
  const n = Number(attempt);
  const lines = [
    `【记录 · 空轮】第 ${turn} 轮她只出了思考 —— 正文（（我 说）那一面）和工具调用一个都没有，界面上因此什么都没显示。`,
    "这一条不是开拓者说的，是终端报的。现在重说一遍，这一轮必须落下一段看得见的正文：",
    "",
    "〔刚才那一轮我只在心里说话，没有写出正文——界面上因此什么都没显示。先别管刚才想了什么，直接用一句话把要回的话说出来，必须以（我 说）开始，以（/我 说）结束。如果刚才想的是要动手（跑命令、改文件、查记录），那就在这一轮把工具调用真的发出去，别只在思考里重复「动手」两个字。〕",
  ];
  if (Number.isFinite(n) && n >= 2) {
    lines.push(
      "",
      "（终端提示：同一轮已经提醒过一次，说明模型把回话整个写进了思考里。继续在这个会话里追问通常没有用 —— 这个毛病会自我强化，开一个新会话最省事。）",
    );
  }
  return lines.join("\n");
}

/**
 * 一个 turn 内的提醒记账 —— 与 `VetoBudget` 同一个形状，理由也相同：
 * 每次提醒都会让 turn 继续跑（多一次 LLM 调用），必须有硬闸。
 */
export class SilenceBudget {
  /**
   * @param {number} [max] - 每个 turn 允许的提醒次数。
   * @param {number} [keepTurns] - 只保留最近这么多个 turn 的账（防内存增长）。
   */
  constructor(max = MAX_SILENCE_NOTICES_PER_TURN, keepTurns = 32) {
    this.max = max;
    this.keepTurns = keepTurns;
    /** @type {Map<number, number>} turn → 已提醒次数 */
    this.used = new Map();
  }

  /**
   * 问一次「这个 turn 还能不能再提醒」。
   *
   * @param {number} turn - turn 号。
   * @returns {boolean} 还能提醒则为 true。
   */
  canNotice(turn) {
    const key = Number(turn);
    if (Number.isFinite(key) === false) return false;
    return (this.used.get(key) ?? 0) < this.max;
  }

  /**
   * 记一次提醒。**调用方必须先用 `canNotice` 问过**，否则会超额。
   *
   * @param {number} turn - turn 号。
   * @returns {number} 该 turn 累计的提醒次数。
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
