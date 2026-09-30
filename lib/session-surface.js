/**
 * 从会话表面取出复核需要的东西：**她的候选回话** + 近期记录摘要。
 *
 * 拆成注入式的纯函数（`nodes` + `eventAt` 由调用方给），目的是**可单测**：
 * 从会话表面里挑「最后一条 assistant 回话」这件事的边界（工具结果排在后面、
 * 表面为空、事件缺失、内容块不是文本……）在 lab 里很难构造，在测试里很容易。
 *
 * 依据（`@deepseek-ai/dsh-session`）：
 *   · `session.surface.nodes` —— 当前表面的 seq 列表，**模型可见顺序**
 *   · `session.eventAt(seq)` —— 按 seq 取不可变事件
 *   · `session.deriveEventMessage(event)` —— 事件 → 模型消息（工具结果的重写也归它管）
 *
 * ## 事件形状（这里踩过一次坑，写清楚）
 *
 * ```ts
 * // dsh-session/lib/types/types.d.ts:460-467
 * export type SessionEvent = {
 *   type: K;
 *   seq: SessionSeq;
 *   time: number;
 *   data: SessionEventMap[K];   // ← payload 在 `data`，**不是** `payload`
 * };
 * ```
 *
 * 而各事件的字段直接挂在 `data` 上：
 *   · `'turn/start'` → `{ turn }`（`types.d.ts` 的 `SessionEventMap`）
 *   · `'assistant/message'` → `{ turn, step, message: AssistantMessage, stream, … }`
 *   · `'user/message'` → 同族，消息在 `data.message`
 *
 * **教训**：这里第一版写成了 `event.payload?.message?.content`，而单测的 mock 也用
 * 了同样错的形状 —— **测试和代码同错，所以全绿**。是真去读 `SessionEvent` 的类型
 * 定义才发现。测试的 mock 必须照抄类型定义，不能凭印象造。
 */

/** 从事件里取它的 `data`（带形状兜底，读不到就空对象）。 */
function dataOf(event) {
  const d = event?.data;
  return d !== null && typeof d === "object" ? d : {};
}

/** 取纯文本：只认 `text` 块 —— 与 `src/shared/mapping.js` 的 `textOf` 同一口径。 */
function textOfBlocks(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b !== null && typeof b === "object" && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * 沿表面从后往前找**最后一条 assistant 回话**。
 *
 * 为什么要从后往前扫而不是只取最后一个节点：表面上的最后几项很可能是
 * 工具结果（`tool result` 也是 user 角色的消息），而她刚说的话在它们前面。
 * 复核的对象必须是**她说的话**，不是工具输出。
 *
 * @param {object} params
 * @param {readonly number[]} params.nodes - `session.surface.nodes`。
 * @param {(seq: number) => object | undefined} params.eventAt - `session.eventAt`。
 * @param {(event: object) => object | null} [params.deriveMessage] - `session.deriveEventMessage`。
 * @returns {{text: string, seq: number} | null} 候选回话；取不到时 null。
 */
export function pickCandidate({ nodes, eventAt, deriveMessage }) {
  if (!Array.isArray(nodes)) return null;
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const seq = nodes[i];
    let event;
    try {
      event = eventAt(seq);
    } catch {
      continue;
    }
    if (event === null || event === undefined) continue;
    if (event.type !== "assistant/message") continue;

    // 优先用 session 自己的派生（它管着内容块的重写/剔除），
    // 取不到再退回直接读事件 —— **注意是 `event.data.message`**（见文件头）。
    let content = null;
    if (typeof deriveMessage === "function") {
      try {
        content = deriveMessage(event)?.content ?? null;
      } catch {
        content = null;
      }
    }
    if (content === null) content = dataOf(event).message?.content ?? null;

    const text = textOfBlocks(content);
    if (text.length > 0) return { text, seq };
  }
  return null;
}

/**
 * 取候选回话**之前**的近期记录摘要（给她自己复核时当上下文）。
 *
 * 为什么要上下文：supervisor 要判断的是「这句宣称有没有记录支撑」，没有记录
 * 就无从判断。这里只取**候选之前**的内容 —— 候选之后的都是结果，不该用来
 * 给她自己的话找理由。
 *
 * @param {object} params
 * @param {readonly number[]} params.nodes - `session.surface.nodes`。
 * @param {(seq: number) => object | undefined} params.eventAt - `session.eventAt`。
 * @param {number} [params.beforeSeq] - 候选所在的 seq，只取它之前的。
 * @param {number} [params.maxChars] - 摘要上限（字符）。
 * @param {number} [params.maxMessages] - 最多取几条。
 * @returns {string} 摘要文本；没有则空串。
 */
export function pickRecent({
  nodes,
  eventAt,
  deriveMessage,
  beforeSeq = Number.POSITIVE_INFINITY,
  maxChars = 2_000,
  maxMessages = 8,
} = {}) {
  if (!Array.isArray(nodes)) return "";
  const picked = [];
  for (let i = nodes.length - 1; i >= 0 && picked.length < maxMessages; i -= 1) {
    const seq = nodes[i];
    if (typeof beforeSeq === "number" && seq >= beforeSeq) continue;
    let event;
    try {
      event = eventAt(seq);
    } catch {
      continue;
    }
    if (event === null || event === undefined) continue;
    const type = event.type;
    if (type !== "user/message" && type !== "assistant/message") continue;

    let content = null;
    if (typeof deriveMessage === "function") {
      try {
        content = deriveMessage(event)?.content ?? null;
      } catch {
        content = null;
      }
    }
    if (content === null) content = dataOf(event).message?.content ?? null;
    const text = textOfBlocks(content);
    if (text.length === 0) continue;
    const who = type === "user/message" ? "开拓者" : "黑塔";
    picked.unshift(`${who}：${text}`);
  }
  const joined = picked.join("\n");
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}

/**
 * 取一段**供做梦蒸馏用的素材**：最近的对话，压成摘要文本。
 *
 * 与 {@link pickRecent} 的区别在用途：那个是给复核当上下文（要短、要「谁说了什么」），
 * 这个是**给蒸馏当素材**（要够长到能看出一段经历的全貌，但也不能无限长）。
 * 所以上限更宽，且拼接方式更适合模型阅读。
 *
 * @param {object} params
 * @param {readonly number[]} params.nodes - `session.surface.nodes`。
 * @param {(seq: number) => object | undefined} params.eventAt - `session.eventAt`。
 * @param {(event: object) => object | null} [params.deriveMessage] - `session.deriveEventMessage`。
 * @param {number} [params.maxChars] - 素材上限（字符）。
 * @param {number} [params.maxMessages] - 最多取几条消息。
 * @returns {string} 素材文本；没有内容时空串。
 */
export function pickExcerpt({
  nodes,
  eventAt,
  deriveMessage,
  maxChars = 6_000,
  maxMessages = 40,
} = {}) {
  if (!Array.isArray(nodes)) return "";
  const picked = [];
  for (let i = nodes.length - 1; i >= 0 && picked.length < maxMessages; i -= 1) {
    const seq = nodes[i];
    let event;
    try {
      event = eventAt(seq);
    } catch {
      continue;
    }
    if (event === null || event === undefined) continue;
    const type = event.type;
    if (type !== "user/message" && type !== "assistant/message") continue;

    let content = null;
    if (typeof deriveMessage === "function") {
      try {
        content = deriveMessage(event)?.content ?? null;
      } catch {
        content = null;
      }
    }
    if (content === null) content = dataOf(event).message?.content ?? null;
    const text = textOfBlocks(content);
    if (text.length === 0) continue;
    const who = type === "user/message" ? "开拓者" : "她";
    picked.unshift(`${who}：${text}`);
  }
  const joined = picked.join("\n\n");
  // 超长时**保留末尾**：一段经历的高潮与结论通常在后面，前面是铺垫。
  return joined.length > maxChars ? `（前略）\n${joined.slice(-maxChars)}` : joined;
}

/**
 * 取一个 agent 当前所处的 turn 号（分拍与复核的配额都按 turn 记）。
 *
 * 从哪里取：会话表面里**最近的 `turn/start`**，其 `data.turn` 就是当前轮
 * （`SessionEventMap`：`'turn/start': { turn: number }`）。表面是模型可见顺序，
 * `turn/start` 会随每轮追加。
 *
 * 取不到返回 `null` —— 调用方据此跳过。**不猜**：拿错 turn 号会把配额记到
 * 别人账上，而配额是防 LLM 调用爆炸的唯一闸门。
 *
 * @param {object} params
 * @param {readonly number[]} params.nodes - `session.surface.nodes`。
 * @param {(seq: number) => object | undefined} params.eventAt - `session.eventAt`。
 * @returns {number | null} turn 号，或 null。
 */
export function pickCurrentTurn({ nodes, eventAt }) {
  if (!Array.isArray(nodes)) return null;
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    let event;
    try {
      event = eventAt(nodes[i]);
    } catch {
      continue;
    }
    if (event?.type !== "turn/start") continue;
    const turn = dataOf(event).turn;
    if (Number.isFinite(turn)) return Number(turn);
  }
  return null;
}

/**
 * 取当前 turn 号 —— **从事件日志取，不是从会话表面取**。
 *
 * ## 为什么不复用 `pickCurrentTurn`
 *
 * 实测踩过：`session.surface.nodes` 只含**模型可见的消息**，**不含 `turn/start`**
 * （那是生命周期事件）。所以拿表面去找 `turn/start` 永远返回 `null`，现象是
 * 「分拍判据明明返回了 `tool-failed`，但注入那一步静默返回」。
 *
 * 这里改用 `session.snapshotEvents()`（全量事件日志，按 seq 有序）从后往前找。
 * 代价是 O(事件数)，但分拍每次 turn 最多两回、且只在这条路径上调用，可以接受；
 * 换来的是**准确**。
 *
 * @param {object} session - `agent.session`。
 * @returns {number | null} turn 号，或 null。
 */
export function pickCurrentTurnFromEvents(session) {
  if (session === null || session === undefined) return null;
  let events;
  try {
    events = session.snapshotEvents?.();
  } catch {
    return null;
  }
  if (!Array.isArray(events)) return null;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.type !== "turn/start") continue;
    const turn = dataOf(event).turn;
    if (Number.isFinite(turn)) return Number(turn);
  }
  return null;
}

/**
 * 这个 agent 是不是「派出去干活的子代理」。
 *
 * ## 为什么要判它
 *
 * 叙述层那三样（复核 / 空轮护栏 / 分拍）都是**人格行为**：它们对着「跟你说话的
 * 那个她」说话。子代理不是她 —— 它是她在会话里派出去的工人，产出通过父级回话
 * 交回，它自己不需要跟任何人「说话」。
 *
 * ## 实测形状（2026-09-30，本机）
 *
 * 子代理的会话头：
 *   `{ id, parentSession, origin: "subagent", delegationDepth: 1, agentPreset: "herta" }`
 * 人机会话头只有 `delegationDepth: 0`，**没有 `origin`**。
 *
 * 注意第三个字段：子代理**继承人设**（`agentPreset` 仍是 `herta`），所以人格机制
 * 会一视同仁地打进它们。那天的代价是两次收尾被吃掉 —— 一次子代理把一句「分拍
 * 点评」当成交付物（几千字的摘要没交出来），一次被复核拉去做「重想」。
 *
 * ## 判据为什么用两个字段
 *
 * `origin` 是语义字段（DSH 自己就这么标），`delegationDepth` 是结构字段。
 * 任何一个说「这是子代理」就认；两个都读不到（更老的格式）时才当人机 ——
 * 默认站在「照常服务她」这一边，而不是误伤。
 *
 * @param {object} agent - turn 载荷里的 agent（`agent.session.header`）。
 * @returns {boolean} 是子代理则为 true。
 */
export function isSubagentAgent(agent) {
  const header = agent?.session?.header;
  if (header === null || header === undefined) return false;
  if (header.origin === "subagent") return true;
  return typeof header.delegationDepth === "number" && header.delegationDepth > 0;
}
