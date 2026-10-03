/**
 * `.opus` 播放那条路：把「80 条随包音频」变成一个可点的声音（#2 精修，报告 candidate #2 的第三块）。
 *
 * 为什么单独一个文件：这一段是**点击朗读**那条链路（URL → Audio → 播放队列 / 影子 DOM 的高亮），
 * 与视图渲染（HertaView / HertaFullView）不是同一个变更原因 —— 改气泡布局不该碰播放的 diff。
 *
 * 从 `ui.ts` 原样搬来：只改了所在文件与 export。
 */
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
function clipUrl(rel) {
  return `/herta-voice/${String(rel).split("/").map(encodeURIComponent).join("/")}`;
}

/** 记一条诊断信息，便于从无头浏览器外部确认「到底放没放」。 */
function markVoice(field, value) {
  const mark = globalThis.__DSH_HERTA__;
  if (mark !== undefined) mark[field] = value;
}

/**
 * 播放一个 URL。
 *
 * 自动播放可能被浏览器策略拦下（没有用户手势时），这里**吞掉失败** ——
 * 静音降级是合理的，不该因此报错或中断界面。播放事实记进诊断标记，
 * 所以从外部仍然能确认「到底放没放」。
 */
export function playUrl(url: string): void {
  try {
    const audio = new Audio(url);
    audio.volume = 0.9;
    const p = audio.play();
    if (p !== undefined) p.catch(() => {});
    markVoice("lastVoiceUrl", url);
    markVoice("voicePlays", (globalThis.__DSH_HERTA__?.voicePlays ?? 0) + 1);
  } catch {
    markVoice("lastVoiceError", url);
  }
}

/** 播放资产里的一条剪辑（传相对路径）。 */
export function playClip(rel) {
  playUrl(clipUrl(rel));
}