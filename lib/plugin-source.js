/**
 * 插件身份：写进会话消息 `source` 的那个 kind。
 *
 * ## 为什么它必须是一处常量
 *
 * 会话格式 v4 只认「生产者自有 kind」—— 写 `{ kind: "plugin", plugin: "dsh-herta" }`
 * 会在**写入会话的那一刻**被 `assertV4SourceRowAdmission` 拒掉：
 *
 *     format v4 message requires a producer-owned source kind
 *
 * 症状极难定位：`agent.steer(...)` 抛出的异常让**整轮 turn 失败**（GUI 渲染成
 * 「本轮运行失败」），而被拒的事件根本没进日志 —— 事后翻会话文件是干净的，
 * 只有界面上那行红字。实测踩过一次（v0.1.3）。
 *
 * 合法形状是 `{ kind: "plugin:<包名>" }`（DSH 自己的 v3→v4 迁移为旧行推导出的形状，
 * 两代读回同一个 kind）。这条规则原先在三个模块里各写一遍（`supervisor-llm.js` 与
 * `dream-distill-llm.js` 各一个 `PLUGIN_SOURCE`，`narrative-layer.js` 里四个字面量），
 * 2026-10-03 收成这一处：**改一次到处改好**，而测试钉的是这个导出（而不是数源码里
 * 有几个字面量）。
 *
 * 纯数据、无 import —— 与 `settings-schema.js` 同一套理由（能被 Node 单测直接 import，
 * 也能被 esbuild 内联进客户端）。
 */

/**
 * 写进 `source` 的插件身份。**冻结**：它会被塞进会话事件，任何模块就地改它
 * 都会污染其它消息的来源标记。
 */
export const PLUGIN_SOURCE = Object.freeze({ kind: "plugin:dsh-herta" });
