/**
 * 宿主侧**诊断总线**（`marks`）—— 一个具名的单向出口。
 *
 * ## 它是什么
 *
 * DSH 不把宿主 cordis 上下文暴露给外部，所以「叙述层到底在不在跑、复核跳过没有、
 * 空轮护栏注入了吗」这些事实需要一个**进程级可读**的落点。就是这里的 `marks`：
 * 一个挂在 `globalThis.__DSH_HERTA_HOST__` 上的普通对象。
 *
 * 读它的人：`README` 的排查章节、lab 里的会话探测、以及本仓的叙述层测试。
 * 客户端那套 `globalThis.__DSH_HERTA__` 是同一个理由建的镜像。
 *
 * ## 2026-10-03：从「无 interface 的全局」收成一个 module
 *
 * 原先这个对象由**三处**各自 `globalThis.__DSH_HERTA_HOST__ ??= {}` 就地创建
 * （`narrative-layer.js`、`index.js`、以及 `dream.js` 读它），而它同时装着两种
 * 完全不同的东西：
 *
 *   · **依赖**（`marks.ctx` / `marks.llm`）—— 「把服务送到拿不到 ctx 的地方」，
 *   · **诊断**（69 个字段）—— 「把事实暴露给外面看」。
 *
 * 两个角色挤在一根无 interface 的全局里，外部无法区分「谁写、何时就绪、哪些 key
 * 合法」。现在拆开：依赖走 `host-deps.js`（具名、有就绪断言），诊断走本模块 ——
 * **创建点只有这一处**，外部读快照用 `marksSnapshot()`。
 *
 * 字段名保持原样（69 处写入不动）：改它们会把「诊断」变成一次大规模重构，
 * 而诊断的价值在于**稳定可读**，不在于封装。
 */

/**
 * 诊断标记对象。
 *
 * ⚠️ **只往里写「事实」**：谁在跑、跳过了什么、为什么。不要塞依赖（那是
 * `host-deps.js` 的事），也不要塞大对象（外部会读它、序列化它）。
 */
export const marks = (globalThis.__DSH_HERTA_HOST__ ??= {});

/**
 * 一份浅快照 —— 外部（测试、探针）读它，避免持有内部引用后被后续写入搅动。
 *
 * @returns {Record<string, unknown>} `marks` 的浅拷贝。
 */
export function marksSnapshot() {
  return { ...marks };
}
