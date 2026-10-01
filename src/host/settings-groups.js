/**
 * 「黑塔」设置页的**分组表** —— 纯数据、无 import。
 *
 * ## 为什么单独一个文件、且放在 `src/host/`
 *
 * 与 `voice-settings-shared.js` 同一个理由：`scripts/build.mjs` 把
 * `src/host/*.js` **平铺**拷进 `lib/`，客户端那份由 esbuild 内联 —— 两种布局下
 * 都能解析。而 Node 单测（`scripts/test-herta-settings.mjs`）**必须**能 import 它，
 * 才能断言「每个 `wired` 字段都出现在某个分组里」。
 *
 * ## 那条断言为什么值得存在（2026-09-27 的真事）
 *
 * `voiceEngine` 与 `realtimeVoice` 在那天被标成 `wired: true`（宿主真的按它们
 * 分发、真的按它省钱）—— 于是它们被「暂未接线」那一组自动排除（那一组由
 * `UNWIRED_FIELD_NAMES` 生成），而分组表**没有跟着加**。结果是这两个字段
 * （连同「语音引擎」这一行）在设置页上**一行都不渲染**：改引擎只能手改 profile
 * 的 `cordis.patch.yml`。两处名单各说各的，合起来就是"没有行"。
 *
 * 断言把这条接缝钉住：`wired` 字段必须落在某个分组里，或者被显式标成
 * `wired: false` 收进「暂未接线」。
 *
 * ## 组的顺序就是页面的顺序
 *
 * 「语音」组内是**先选谁说话、再决定听不听得见，最后才是那几行状态事实** ——
 * 状态行（`MiniMaxVoiceRow`）不是设置字段，由客户端按组名挂在组尾。
 *
 * ## 2026-10-01：`theme` / `deviceScene` 从分组里摘掉
 *
 * 2026-09-30 的体检把这两个字段标成了 `wired: false`（DSH 侧真的没有消费方），
 * 但分组表没跟着摘 —— 于是它们在页面上**渲染了两遍**：一次在「界面」/「差分协处理器」
 * 里当正常行，一次在「暂未接线」里（那一组由 `UNWIRED_FIELD_NAMES` 生成）。
 * 两处名单必须互斥，这是本文件头部那条契约的另一半。
 * 现在它们只活在「暂未接线」里，各带一条 `note` 说明为什么不生效。
 */
export const SETTINGS_GROUPS = Object.freeze([
  Object.freeze({ title: "界面", fields: Object.freeze(["locale"]) }),
  Object.freeze({
    title: "语音",
    hint: "这四个值都是宿主真在读的，改完立刻生效。静音只决定「听不听得见」，不决定要不要花钱合成。",
    fields: Object.freeze(["voiceEngine", "realtimeVoice", "voiceMuted", "voiceVolume"]),
  }),
  Object.freeze({
    title: "Fish 语音",
    hint: "只在「语音引擎」选 fish 时生效。这里的值**优先**于外部 fish_config.json —— 那边退化成「没设过时的兜底」。密钥不在这里：它在上面的「Fish 密钥」那一行，走 DSH 凭据存储，不落明文配置。**没声通常就是这一条**：网络到不了 Fish 接口 —— 插件按 fishaudio.org（国内可直连）→ api.fish.audio（旧域名，国内被墙）的顺序试，两条都不通时才需要在「Fish 代理」那一行填代理地址，再点一次试听。",
    fields: Object.freeze(["fishRef", "fishSpeed", "fishEffect", "fishPreset", "fishProxy"]),
  }),
]);

/**
 * 某个字段在哪一组里（`undefined` = 不在任何一组，页面不会渲染它）。
 *
 * @param {string} field - 字段名。
 * @returns {string|undefined} 组标题。
 */
export function groupOfField(field) {
  for (const entry of SETTINGS_GROUPS) {
    if (entry.fields.includes(field)) return entry.title;
  }
  return undefined;
}
