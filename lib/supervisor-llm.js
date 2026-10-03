/**
 * supervisor 的 LLM 适配层 —— **这是整个叙述调度层里唯一无法在本机验证的文件**。
 *
 * ## 为什么单独一个文件
 *
 * 本机没有 API Key：lab 与正式环境的日志里都是
 * `llm-deepseek: no API key for provider route "deepseek-official"`。
 * 所以「发起一次复核调用」这条路径**在当前环境跑不起来**，只能验证到
 * 「组装出了合法的请求」为止。
 *
 * 把它隔离成薄薄一层，好处是：`supervisor.js` 里的判决解析与提示构造（真正
 * 容易写错的部分）**每一行都被单测覆盖**，而这里只剩下「调 dsh-llm 的管道代码」
 * —— 那是照抄官方 `dsh-session-title-llm` 的形状，错的概率最低。
 *
 * ## 调用形状的来源
 *
 * 逐条对照官方样板 `@deepseek-ai/dsh-session-title-llm/lib/index.js:196-239`：
 *
 * ```js
 * const assembler = new BlockAssembler();
 * for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk);
 * const terminalError = finishError(assembler.finish);
 * if (terminalError !== undefined) throw terminalError;
 * const text = assembler.blocks().filter(b => b.type === "text").map(b => b.text).join(" ");
 * ```
 *
 * 我们的差异只有两处，都是刻意的：
 *   1. **不设 `purpose`** —— 它的类型只允许 `'compaction' | 'session-title'`
 *      （`dsh-llm/types.d.ts:443`），复核不属于其中任何一种。硬塞一个会撒谎，
 *      所以留空（该字段可选）。
 *   2. **超时短** —— 复核是每轮多出来的一次调用，不能让用户干等。
 */

import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
import { PLUGIN_SOURCE } from "./plugin-source.js";
import {
  buildSupervisorSystemPrompt,
  buildSupervisorUserPrompt,
  parseSupervisorVerdict,
} from "./supervisor.js";

/**
 * 插件身份，写进消息的 source。
 *
 * 常量本体住在 `plugin-source.js`（2026-10-03 收拢：原先它在本文件与
 * `dream-distill-llm.js` 里各写一份、`narrative-layer.js` 里还有四个字面量）。
 * 从这里**再导出**一次，是为了不动已经 import 它的调用方与测试。
 */
export { PLUGIN_SOURCE };

/** 复核调用的默认超时。短 —— 它是额外开销，不是主路径。 */
export const DEFAULT_SUPERVISOR_TIMEOUT_MS = 20_000;

/** 默认输出上限。判决是一个小 JSON，不该让模型长篇大论。 */
export const DEFAULT_SUPERVISOR_MAX_TOKENS = 400;

/**
 * 向模型要一次复核判决。
 *
 * **失败一律返回 null（放行）**，绝不抛给调用方：
 * 复核是附加保障，它坏掉不该让她的正常回复发不出去。
 *
 * @param {object} params
 * @param {object} params.ctx - 宿主 cordis 上下文（需可取到 `llm` 服务）。
 * @param {{provider: string, model: string}} params.route - 模型路由。
 * @param {string} params.candidate - 她的候选回话。
 * @param {string} [params.recent] - 近期记录摘要。
 * @param {AbortSignal} [params.signal] - 取消信号（通常来自 turn）。
 * @param {number} [params.timeoutMs] - 超时。
 * @param {number} [params.maxTokens] - 输出上限。
 * @returns {Promise<{verdict: string, reason: string} | null>} 判决；任何失败都是 null。
 */
export async function callSupervisor(params) {
  const { ctx, route, candidate, recent = "", signal, timeoutMs, maxTokens } = params ?? {};

  const llm = ctx?.llm;
  if (llm === undefined || llm === null || typeof llm.stream !== "function") {
    // 没有 llm 服务（例如无头组合）：如实记下并放行，不假装复核过了。
    console.log("[dsh-herta] supervisor 跳过：宿主没有 llm 服务");
    return null;
  }
  if (typeof route?.provider !== "string" || typeof route?.model !== "string") {
    console.log("[dsh-herta] supervisor 跳过：拿不到模型路由（provider/model）");
    return null;
  }

  const limit = timeoutMs ?? DEFAULT_SUPERVISOR_TIMEOUT_MS;
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
          content: [{ type: "text", text: buildSupervisorUserPrompt({ candidate, recent }) }],
          source: PLUGIN_SOURCE,
        }),
      ],
      system: buildSupervisorSystemPrompt(),
      maxTokens: maxTokens ?? DEFAULT_SUPERVISOR_MAX_TOKENS,
      signal: timer.signal,
    };

    const assembler = new BlockAssembler();
    for await (const chunk of llm.stream(options)) assembler.push(chunk);

    // finish 上带终止失败时，文本不可信 —— 直接放行。
    const finish = assembler.finish;
    if (finish !== undefined && finish !== null && finish.kind !== "stop") {
      console.log(`[dsh-herta] supervisor 调用未正常结束：${String(finish.kind)}`);
      return null;
    }

    const text = assembler
      .blocks()
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ");

    return parseSupervisorVerdict(text);
  } catch (error) {
    // 网络/配额/取消 —— 一律放行，只留一行日志。
    console.log(`[dsh-herta] supervisor 调用失败（已放行）：${String(error?.message ?? error)}`);
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", onAbort);
  }
}
