/**
 * 宿主侧**依赖通道** —— 把 `ctx` / `llm` 送到拿不到它们的地方。
 *
 * ## 为什么需要这条通道
 *
 * 工具的 `execute(args, exec)` **拿不到 `ctx`**：`exec` 上只有 agent / callId /
 * name / arguments / signal（见 `@deepseek-ai/dsh-tools` 的类型）。而「做梦蒸馏」
 * 需要 `ctx.llm` 服务 —— 于是必须有一条把服务递进去的路。
 *
 * 送去哪儿：`ctx.llm` 只在**声明过依赖的作用域**里可读（cordis 的硬规矩）。
 * 叙述层用 `ctx.inject(["llm"], scoped => …)` 拿到那个作用域，回调里把
 * `scoped.llm` 交给 `setHostLlm()`；想读的人调 `getHostLlm()`。
 *
 * ## 与诊断（`host-marks.js`）的分工
 *
 * 这两件事原先**混在同一个 `globalThis.__DSH_HERTA_HOST__` 对象里**：依赖
 * （`marks.ctx` / `marks.llm`）与 69 个诊断字段共用一根无 interface 的全局，
 * 从外部看不出「谁写、何时就绪、哪些 key 合法」。现在分成两个具名模块：
 *
 *   · 本模块 —— **依赖通道**：写一次、读多次，就绪时序由这里的注释与
 *     `hostDepsReady()` 说清；
 *   · `host-marks.js` —— **诊断总线**：单向（写者往里记、外部只读快照）。
 *
 * ## 就绪时序（唯一需要记住的事实）
 *
 *   1. 插件挂载（`index.js` 的 `apply`）—— 此刻依赖**还没有**：`getHostLlm()` 返回 null。
 *   2. `ctx.inject(["llm"], …)` 回调触发 —— 依赖就绪。**没有 llm 的组合（无头 / SDK）
 *      里这一步永不触发**，依赖永远缺席 —— 那是合法状态，不是故障。
 *   3. 此后任何时刻读都拿得到。
 *
 * 所以调用方**必须**把「拿不到」当正常分支处理（做梦蒸馏就是这么做的：没有 llm
 * 时给一条可操作的拒绝理由，而不是笼统失败）。
 *
 * 刻意**不**把工具注册挪进 `ctx.inject` 回调：那会让「没有 llm 的组合里工具根本
 * 不存在」，用户看到的是「没有这个工具」而不是「这次蒸馏差一个模型」—— 后者可操作。
 */

/** `ctx.inject(["llm"], …)` 回调给的作用域上下文；未就绪时 null。 */
let scopedCtx = null;

/** `@deepseek-ai/dsh-llm` 的服务对象；未就绪时 null。 */
let llmService = null;

/**
 * 登记依赖。**只有叙述层的 `ctx.inject(["llm"], …)` 回调该调它。**
 *
 * @param {object} params
 * @param {object} params.ctx - **作用域**上下文（inject 回调给的，不是外层 `ctx`）。
 * @param {object} params.llm - `scoped.llm`。
 */
export function setHostLlm({ ctx, llm }) {
  scopedCtx = ctx ?? null;
  llmService = llm ?? null;
}

/**
 * 取依赖。
 *
 * @returns {{ctx: object|null, llm: object|null}} 当前依赖；未就绪时两个都是 null。
 */
export function getHostDeps() {
  return { ctx: scopedCtx, llm: llmService };
}

/**
 * 取 llm 服务（做梦蒸馏用）。
 *
 * @returns {object|null} 未就绪时 null —— 调用方必须把它当正常分支。
 */
export function getHostLlm() {
  return llmService;
}

/**
 * 取**作用域**上下文（复核注入需要它取 llm）。
 *
 * @returns {object|null} 未就绪时 null。
 */
export function getHostCtx() {
  return scopedCtx;
}

/**
 * 依赖是否已就绪（信标与诊断读它，不必判断 `getHostLlm()` 的真假）。
 *
 * @returns {boolean} 就绪与否。
 */
export function hostDepsReady() {
  return llmService !== null;
}

/**
 * 仅供测试：把依赖复位回未就绪。
 *
 * 生产代码**不要**调它 —— 依赖就绪是单向的（服务一旦出现就不会消失）。
 */
export function resetHostDepsForTest() {
  scopedCtx = null;
  llmService = null;
}
