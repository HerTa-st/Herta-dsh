/**
 * 做梦蒸馏的 LLM 适配层 —— 与 `supervisor-llm.js` 同一个形状、同一个理由。
 *
 * ## 为什么单独一个文件
 *
 * 本机（lab 与正式环境）都没有 API Key，日志里都是
 * `llm-deepseek: no API key for provider route "deepseek-official"`。
 * 所以「发起一次蒸馏调用」这条路径**在当前环境跑不起来**，只能验证到
 * 「组装出合法请求」为止。
 *
 * 隔离成薄层的好处：`dream-distill.js` 里的提示构造与解析（真正容易写错的
 * 部分）**每一行都被单测覆盖**，这里只剩「调 dsh-llm 的管道代码」——
 * 照抄官方 `dsh-session-title-llm` 与 `supervisor-llm.js` 的形状。
 *
 * ## 两次调用，不是一个
 *
 * 上游是**多阶段**管线（worthiness → generation → critique → refine → …）。
 * 这里只做前两段：
 *
 *   1. 值不值得记 —— 不值得就如实返回，**不硬造**（编出来的记忆署着她的名字，
 *      那是她在纪律里专门写过的忌讳）
 *   2. 值得就生成候选 —— 产出的 `{title, body}` 交给 `promoteFeian` 过门
 *
 * 后续阶段（critique / refine / retitle / 各种 judge）不做：那属于「把一份
 * 已经合格的废案打磨得更像她」，收益远小于成本。
 */

import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
import {
  buildGenerationPrompt,
  buildWorthinessPrompt,
  parseDistilled,
  parseWorthiness,
} from "./dream-distill.js";

/**
 * 插件身份，写进消息的 source。
 *
 * ⚠️ 会话格式 v4 只认「生产者自有 kind」，写 `{ kind: "plugin", plugin: "..." }`
 * 会直接被拒（`format v4 message requires a producer-owned source kind`）。
 */
const PLUGIN_SOURCE = { kind: "plugin:dsh-herta" };

/** 单次蒸馏调用的默认超时。比复核宽松 —— 生成正文比出一句判决费时。 */
export const DEFAULT_DISTILL_TIMEOUT_MS = 60_000;

/** 生成阶段的输出上限（要写 120 字以上的正文，给足余量）。 */
export const DEFAULT_GENERATE_MAX_TOKENS = 1_200;

/** 判定阶段的输出上限（只要一个小 JSON）。 */
export const DEFAULT_WORTHINESS_MAX_TOKENS = 300;

/**
 * 跑一次辅助 LLM 调用并取回文本。
 *
 * 失败一律返回 `null`（**不抛**）：蒸馏是增值路径，它坏掉不该让工具调用崩，
 * 更不该让她的 turn 崩。
 *
 * @param {object} params
 * @param {object} params.ctx - 宿主 cordis 上下文（`ctx.llm` 才是 LLM 服务）。
 * @param {{provider: string, model: string}} params.route - 模型路由。
 * @param {string} params.system - system 提示。
 * @param {string} params.user - user 正文。
 * @param {AbortSignal} [params.signal] - 取消信号。
 * @param {number} [params.timeoutMs] - 超时。
 * @param {number} [params.maxTokens] - 输出上限。
 * @returns {Promise<string | null>} 文本；任何失败都是 null。
 */
async function callOnce({ ctx, route, system, user, signal, timeoutMs, maxTokens }) {
  const llm = ctx?.llm;
  if (llm === undefined || llm === null || typeof llm.stream !== "function") {
    console.log("[dsh-herta] 蒸馏跳过：宿主没有 llm 服务");
    return null;
  }
  if (typeof route?.provider !== "string" || typeof route?.model !== "string") {
    console.log("[dsh-herta] 蒸馏跳过：拿不到模型路由（provider/model）");
    return null;
  }

  const limit = timeoutMs ?? DEFAULT_DISTILL_TIMEOUT_MS;
  const timer = new AbortController();
  const onAbort = () => timer.abort();
  const timeout = setTimeout(onAbort, limit);
  signal?.addEventListener?.("abort", onAbort, { once: true });

  try {
    const options = {
      provider: route.provider,
      model: route.model,
      messages: [
        createUserMessage({
          content: [{ type: "text", text: user }],
          source: PLUGIN_SOURCE,
        }),
      ],
      system,
      maxTokens: maxTokens ?? DEFAULT_GENERATE_MAX_TOKENS,
      signal: timer.signal,
    };
    const assembler = new BlockAssembler();
    for await (const chunk of llm.stream(options)) assembler.push(chunk);

    const finish = assembler.finish;
    if (finish !== undefined && finish !== null && finish.kind !== "stop") {
      console.log(`[dsh-herta] 蒸馏调用未正常结束：${String(finish.kind)}`);
      return null;
    }
    return assembler
      .blocks()
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ");
  } catch (error) {
    console.log(`[dsh-herta] 蒸馏调用失败：${String(error?.message ?? error)}`);
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

/**
 * 蒸馏出一份废案候选（先判值不值得，再生成）。
 *
 * @param {object} params
 * @param {object} params.ctx - 宿主 cordis 上下文。
 * @param {{provider: string, model: string}} params.route - 模型路由。
 * @param {string} params.excerpt - 会话片段摘要。
 * @param {readonly string[]} [params.existingTitles] - 货架已有标题。
 * @param {AbortSignal} [params.signal] - 取消信号。
 * @returns {Promise<
 *   | {ok: true, title: string, body: string}
 *   | {ok: false, stage: "worthiness"|"generation", reason: string}
 * >} 结果。**成功也只是候选** —— 还要过 `promoteFeian` 的门。
 */
export async function distillFeian({ ctx, route, excerpt, existingTitles = [], signal }) {
  if (typeof excerpt !== "string" || excerpt.trim().length === 0) {
    return { ok: false, stage: "worthiness", reason: "没有可用的会话片段" };
  }

  // ── 第一阶段：值不值得记 ────────────────────────────────────────────────
  const worthRaw = await callOnce({
    ctx,
    route,
    system: buildWorthinessPrompt({ excerpt, existingTitles }),
    user: "判断这段会话片段值不值得记成废案。只输出 JSON。",
    signal,
    maxTokens: DEFAULT_WORTHINESS_MAX_TOKENS,
  });

  const worth = parseWorthiness(worthRaw);
  if (worth === null) {
    // 解析不出来就**不硬造** —— 编出来的记忆署着她的名字。
    return { ok: false, stage: "worthiness", reason: "判定结果无法解析，放弃这一次蒸馏" };
  }
  if (worth.worthy === false) {
    return {
      ok: false,
      stage: "worthiness",
      reason: worth.reason.length > 0 ? worth.reason : "判定为不值得记",
    };
  }

  // ── 第二阶段：生成候选 ──────────────────────────────────────────────────
  const genRaw = await callOnce({
    ctx,
    route,
    system: buildGenerationPrompt({ excerpt, existingTitles }),
    user: "按格式要求写这份废案。只输出 JSON。",
    signal,
    maxTokens: DEFAULT_GENERATE_MAX_TOKENS,
  });

  const parsed = parseDistilled(genRaw);
  if (parsed.error !== undefined) {
    return { ok: false, stage: "generation", reason: parsed.error };
  }
  return { ok: true, title: parsed.title, body: parsed.body };
}
