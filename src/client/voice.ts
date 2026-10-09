/**
 * 「语音」那一层：SSE / PCM / 播放 / 音色状态（#2 拆出的四个 region 之二）。
 *
 * 为什么单独一个文件：这一段由**语音端点那条 SSE** 驱动，与机器层（bridge/凭据）、界面层（面板/视图）、
 * 设置页三项各不相干 —— 改 PCM 播放不必碰设置页的 diff（架构审查 candidate #2 的 Divergent change）。
 *
 * 从 `index.tsx` 原样搬来：只改了所在文件、export，以及给界面补了一个显式入口 stopVoiceModelTimer()。
 */
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
import { createSerialPlaybackQueue, decodePcmFrame } from "./minimax-pcm.ts";
// 语音与静音读的是设置表单那一层（`machineField`）—— 与界面层读的是同一份值。
import { machineField } from "./machine.ts";
// 播放档案（"点哪段读哪段"的复用）与"还在飞的 say 请求"那张表定义在界面层。
//
// 2026-10-10 修：这一行在 0.1.8 拆 region 时被漏掉了 —— `onMiniMaxPcm` 里的
// `rememberSpokenAudio(...)` / `awaitingSpokenTexts` 于是成了**未绑定标识符**，
// 每一帧 tts 都在那里抛 `ReferenceError`，音频进不了播放队列，而且因为抛在
// `markMinimax("minimaxAudioPlays", …)` 之前，连诊断标记都不留（表面就是"点了没反应"）。
// 两个模块本来就互相 import（界面层要点朗读，语音层要推状态），这里再补一条同向的边，
// 不引入新的循环。
import { awaitingSpokenTexts, rememberSpokenAudio } from "./ui.ts";
export let voiceModelState: Record<string, unknown> | null = null;

/** 订阅者（由整机视图的 `onVoiceModel` 挂上）。 */
export const voiceModelSubs = new Set<(state: unknown) => void>();

export let voiceModelTimer: ReturnType<typeof setInterval> | null = null;

function notifyVoiceModel(): void {
  for (const cb of voiceModelSubs) {
    try {
      cb(voiceModelState);
    } catch {
      /* 一个订阅者坏掉不该影响别的 */
    }
  }
}

/** 按当前阶段开关轮询：只有下载中才需要密集问。 */
function syncVoiceModelTimer(): void {
  const phase = voiceModelState?.phase;
  if (phase === "downloading" && voiceModelTimer === null) {
    voiceModelTimer = setInterval(() => {
      void refreshVoiceModel();
    }, 500);
  } else if (phase !== "downloading" && voiceModelTimer !== null) {
    clearInterval(voiceModelTimer);
    voiceModelTimer = null;
  }
}

/** 拉一次宿主状态；失败保留上一次（不把界面打回默认值）。 */
export async function refreshVoiceModel(): Promise<unknown> {
  try {
    const res = await fetch(VOICE_MODEL_URL, { headers: { accept: "application/json" } });
    if (res.ok) {
      voiceModelState = (await res.json()) as Record<string, unknown>;
    }
  } catch {
    /* 拿不到就沿用上一次 */
  }
  syncVoiceModelTimer();
  notifyVoiceModel();
  return voiceModelState;
}

/** 发一个动作（download / cancel / remove），返回宿主回的状态。 */
export async function postVoiceModel(action: string): Promise<unknown> {
  try {
    const res = await fetch(VOICE_MODEL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) voiceModelState = (await res.json()) as Record<string, unknown>;
  } catch {
    /* 动作发不出去：状态不变，下面的 refresh 会把它拉回真相 */
  }
  await refreshVoiceModel();
  return voiceModelState;
}

/** 把模型状态拼成 `buildRealtimeVoiceState` 要的宿主事实。 */
export function voiceModelFacts(): Record<string, unknown> {
  const phase = typeof voiceModelState?.phase === "string" ? voiceModelState.phase : "absent";
  // 运行时来自宿主对 `assets/tts-runtime` 的**真探测**（子进程加载 addon），
  // 不是常量。探测没成功（或还没问到）就是 false —— 设置面板把「下载模型」
  // 按钮与「实时语音」开关都 gate 在它上面，写死 true 就是假绿。
  const runtime = voiceModelState?.runtime as { available?: boolean } | undefined;
  return {
    runtime: runtime?.available === true,
    // 「bundle 在不在」＝ 模型装好了没有。
    bundle: phase === "ready",
    failed: phase === "failed",
    model: {
      phase,
      receivedBytes: voiceModelState?.receivedBytes,
      totalBytes: voiceModelState?.totalBytes,
      unpackedBytes: voiceModelState?.unpackedBytes,
    },
  };
}

// ── MiniMax 语音（PCM 播放 + 设置页那一行）────────────────────────────────────
//
// 宿主把合成好的 PCM 从 `/herta-minimax-events`（SSE）推过来，这里负责「放出来」。
// 两条播放路径**二选一**：
//
//   · **有整机 iframe**（甲方案）→ 用既有的 `push("voice", …)` 把帧原样推给
//     iframe，由她自己的 WebAudio 播放器放。样式、音量、她的语音偏好都在那一侧，
//     声音听起来与官网 demo 一模一样。
//   · **没有 iframe**（用户停在标准视图/别的页签）→ 在父窗口自己用 WebAudio 放
//     同一段 PCM。
//
// ## 为什么有 iframe 就不再自己放
//
// 两条路同时放就是**双声**：同一句话叠着响，而且两条路各自有自己的音量与调度
// 游标，听起来是回声。所以 sink 只能有一个，而且它是**瞬时的**：`push` 时
// 现看 `frameRef.current?.contentWindow` 在不在，不在才走父窗口那条。
//
// ## 为什么必须处理自动播放策略
//
// `AudioContext` 在用户手势之前创建会一直是 `suspended`（浏览器拦自动播），
// 此时 `start()` 不报错、就是不出声。所以：懒建 + 每次播放前 `resume()`；
// `resume()` 被拒就把状态记下来（`__DSH_HERTA__.minimaxAudioBlocked`），
// 让「点了页面才会出声」这件事可观测，而不是静默无声。
//
// ## 为什么 state 既有 SSE 帧又要轮询
//
// SSE 的 `state` 帧只在宿主**主动报状态**时到（认领完成、回落、到上限），
// 它很快但**不保证到达**（页面刷新、代理断流都会漏）；轮询是保底的事实来源，
// 代价是 5 秒的延迟。两条都要：快的那条负责即时反馈，慢的那条负责「界面不会
// 永远停在旧状态」。轮询**只在设置页那一行挂载期间开**（没有订阅者就没有定时器）。

/** 宿主推 PCM 的 SSE 端点（同源）。 */
const MINIMAX_EVENTS_URL = "/herta-minimax-events";
/** 状态快照 + 认领动作的端点（GET 读、POST 动作）。 */
const MINIMAX_STATE_URL = "/herta-minimax-state";
/** 设置页那一行的轮询间隔。 */
const MINIMAX_POLL_MS = 5000;

/**
 * 当前挂着的整机 iframe。
 *
 * 用「最后注册的那个」而不是全局唯一：整机视图切换会话时会卸载重挂，
 * 卸载时把引用清掉，于是 `push` 立刻退到父窗口那条路，不会往一个已经
 * 卸载的文档里 postMessage（那会静默丢掉，声音就永远不响了）。
 */
let fullFrame: HTMLIFrameElement | null = null;

/** 整机视图挂载时登记自己的 iframe；返回注销函数。 */
export function registerVoiceSink(frame: HTMLIFrameElement | null): () => void {
  fullFrame = frame;
  return () => {
    if (fullFrame === frame) fullFrame = null;
  };
}

/** iframe 的 window；不在（或已卸载）就是 null —— 决定这一刻声音从哪出来。 */
function voiceSinkWindow(): Window | null {
  const win = fullFrame?.contentWindow;
  return win === null || win === undefined ? null : win;
}

/** 往 iframe 推一条 voice 事件。形状**逐字**是 iframe 侧 `bridge.onVoice` 认的那个。 */
function pushVoiceToFrame(payload: Record<string, unknown>): void {
  const win = voiceSinkWindow();
  if (win === null) return;
  win.postMessage({ __herta: true, kind: "event", event: "voice", payload }, window.location.origin);
}

/** AudioContext 与主音量（懒建，见上面那段「自动播放策略」）。 */
let voiceAudio: { ctx: AudioContext; gain: GainNode } | null = null;
/** 每条 utterance 当前在播的源（打断时要停它）。 */
const voiceSources = new Map<string, Set<AudioBufferSourceNode>>();
/** 每条 utterance 下一次该排在哪（同一句的多段首尾相接，不叠声）。 */
const voiceCursor = new Map<string, number>();
/**
 * **[点哪段读哪段]** 全部音频共用的一个游标。
 *
 * 上面那个 `voiceCursor` 是**按 utterance** 存的，跨不过条：新一条 utterance
 * 拿不到前一条的结束时刻，于是 `at = currentTime` —— 直接盖在还在说的那段上面，
 * 听起来就是「同时念两段话」。全局游标把这件事收成一条时间轴，谁也盖不住谁。
 */
let voiceEndAt = 0;
/** 游标表的上界。只防内存（一页开着跑一整天）：过线整体清掉，旧游标不再需要。 */
const VOICE_CURSOR_LIMIT = 64;
/** 已经申请过「用户一动手就 resume」的监听。 */
let resumeArmed = false;

/** 记一条语音诊断（无头浏览器 / CDP 从 `__DSH_HERTA__` 读）。 */
function markMinimax(field: string, value: unknown): void {
  const mark = (globalThis as Record<string, unknown>).__DSH_HERTA__ as
    | Record<string, unknown>
    | undefined;
  if (mark !== undefined) mark[field] = value;
}

/**
 * 取（必要时建）AudioContext，并尽力把它唤醒。
 *
 * 返回 null 表示这个浏览器根本没有 WebAudio（或构造抛错）—— 调用方静默降级，
 * 与 `playUrl` 吞掉失败同一个口径：**静音是可以接受的，白屏不是**。
 */
function ensureVoiceAudio(): AudioContext | null {
  if (voiceAudio === null) {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor === undefined) return null;
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      ctx.addEventListener?.("statechange", () => {
        markMinimax("minimaxAudioState", ctx.state);
        markMinimax("minimaxAudioBlocked", ctx.state === "suspended");
      });
      voiceAudio = { ctx, gain };
    } catch {
      markMinimax("minimaxAudioError", "AudioContext 构造失败");
      return null;
    }
  }
  const { ctx } = voiceAudio;
  // 音量与静音是设置页那两个真字段（与录音片段那条路共用同一个来源）。
  try {
    const volume = Number(machineField("voiceVolume"));
    voiceAudio.gain.gain.value = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume / 100)) : 1;
  } catch {
    /* 设置读不到就用 1 */
  }
  if (ctx.state === "suspended") {
    // 被拦是**常态**（用户还没点过页面）。不抛、不重试失败路径，只把状态标出来；
    // 真正的重试挂在第一次用户手势上（见 armVoiceResume）。
    void ctx.resume().then(
      () => {
        markMinimax("minimaxAudioState", ctx.state);
        markMinimax("minimaxAudioBlocked", ctx.state === "suspended");
      },
      () => {
        markMinimax("minimaxAudioBlocked", true);
        armVoiceResume();
      },
    );
  }
  return ctx;
}

/**
 * 等用户第一次动手时再 resume 一次。
 *
 * 浏览器只允许「有用户手势」的那次 `resume()` 成功，所以被拦之后唯一的出路
 * 就是在下一次点击/按键时补一枪。只挂一次，成功即卸。
 */
function armVoiceResume(): void {
  if (resumeArmed) return;
  resumeArmed = true;
  const onGesture = (): void => {
    const ctx = voiceAudio?.ctx;
    if (ctx === undefined) return;
    void ctx.resume().then(
      () => {
        markMinimax("minimaxAudioBlocked", ctx.state === "suspended");
        if (ctx.state !== "suspended") {
          window.removeEventListener("pointerdown", onGesture);
          window.removeEventListener("keydown", onGesture);
        }
      },
      () => {
        /* 还是不让，就继续等下一次手势 */
      },
    );
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
}

/** 停掉某条 utterance（或全部）在父窗口播的声音，并清掉它的排队与游标。 */
function stopLocalVoice(utteranceId?: string): void {
  const ids = utteranceId === undefined ? [...voiceSources.keys()] : [utteranceId];
  for (const id of ids) {
    for (const source of voiceSources.get(id) ?? []) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        /* 已经结束了 */
      }
    }
    voiceSources.delete(id);
    voiceCursor.delete(id);
  }
  // 一条都不剩了：全局游标归零 —— 下一个到达的该**立刻**出声，
  // 而不是排在一个已经不存在的时间点上。
  if (voiceSources.size === 0) voiceEndAt = 0;
}

/** 一条 PCM 交给 WebAudio：调度到 `max(now, 全局游标)` —— 所有音频首尾相接，不叠声。 */
export function playLocalVoice(
  utteranceId: string,
  seq: number,
  samples: Int16Array,
  sampleRate: number,
  durationMs: number,
): void {
  if (machineField("voiceMuted") === true) return;
  if (samples.length === 0 || !(sampleRate > 0)) return;
  const ctx = ensureVoiceAudio();
  if (ctx === null) return;
  try {
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      // Int16 → [-1, 1)。32768 而不是 32767：与宿主/整机那边同一套换算，
      // 负满量程才是精确的。
      channel[i] = (samples[i] ?? 0) / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(voiceAudio!.gain);
    const at = Math.max(ctx.currentTime, voiceEndAt);
    let set = voiceSources.get(utteranceId);
    if (set === undefined) {
      set = new Set();
      voiceSources.set(utteranceId, set);
    }
    set.add(source);
    // 兜底与自然结束都走同一个收尾，且都带上**这一段自己的身份**：
    // `complete` 只认 {utteranceId, seq}，所以先到的那次生效、后到的是空操作。
    // 少了身份，兜底定时器会把队首的**下一段**误当成"播完了"（提前切句）。
    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      localQueue.complete(utteranceId, seq);
    };
    source.onended = (): void => {
      set!.delete(source);
      if (set!.size === 0) voiceSources.delete(utteranceId);
      settle();
    };
    source.start(at);
    if (!voiceCursor.has(utteranceId) && voiceCursor.size >= VOICE_CURSOR_LIMIT) voiceCursor.clear();
    voiceCursor.set(utteranceId, at + buffer.duration);
    voiceEndAt = at + buffer.duration;
    markMinimax("minimaxAudioPlays", ((globalThis.__DSH_HERTA__?.minimaxAudioPlays as number) ?? 0) + 1);
    markMinimax("minimaxAudioLast", `#${samples.length}/${sampleRate}Hz`);
    // `onended` 在某些情况下可能不来（上下文被回收、调度被掐），到点强制推进队列，
    // 否则下一条 utterance 的第一句会永远排不上。
    const guardMs = Math.max(0, durationMs) + Math.round((at - ctx.currentTime) * 1000) + 250;
    setTimeout(settle, guardMs);
  } catch {
    markMinimax("minimaxAudioError", "调度失败");
    localQueue.complete(utteranceId, seq);
  }
}

/**
 * 父窗口这条路的播放队列（纯逻辑在 `minimax-pcm.ts`）。
 *
 * 只在**没有 iframe** 的时候真的被推东西；有 iframe 时它一个单元都不会收到。
 */
export const localQueue = createSerialPlaybackQueue({
  onPlay: (item) => {
    playLocalVoice(
      item.utteranceId,
      item.seq,
      item.payload.samples,
      item.payload.sampleRate,
      item.payload.durationMs,
    );
  },
  onStop: (id) => {
    // 空 id = 「什么都别响了」。需要这条分支，是因为命中档案的那一段是**直接
    // 送喇叭**的，从没经过队列，队列叫不出它的名字。
    if (id === "") stopLocalVoice();
    else stopLocalVoice(id);
  },
});

/**
 * 一个 `tts` 帧：解码 → 按「有没有整机 iframe」二选一交付。
 *
 * 解码失败（帧坏了）只记账、不抛：一条坏帧不该让整条 SSE 连接崩掉，
 * 后面的句子还得继续念。
 */
function onMiniMaxPcm(frame: {
  utteranceId?: unknown;
  seq?: unknown;
  samplesB64?: unknown;
  sampleRate?: unknown;
  durationMs?: unknown;
  /** 合成这段音频用的**那一段文字**（宿主一直在推，只是以前没人用）。 */
  text?: unknown;
}): void {
  const utteranceId = typeof frame.utteranceId === "string" ? frame.utteranceId : "";
  const seq = typeof frame.seq === "number" ? frame.seq : 0;
  const sampleRate = typeof frame.sampleRate === "number" ? frame.sampleRate : 0;
  const durationMs = typeof frame.durationMs === "number" ? frame.durationMs : 0;
  if (utteranceId === "" || typeof frame.samplesB64 !== "string") {
    markMinimax("minimaxFrameDropped", "缺少 utteranceId / samplesB64");
    return;
  }
  let samples: Int16Array;
  try {
    samples = decodePcmFrame(frame.samplesB64).samples;
  } catch (error) {
    markMinimax("minimaxFrameDropped", String((error as Error)?.message ?? error));
    return;
  }
  markMinimax("minimaxLastFrame", `${utteranceId}#${seq} ${samples.length} samples`);

  // [点哪段读哪段] 先按**它自己的文字**归档，再决定往哪放。
  // 放在这里而不是下面：整机视图那条路绕过 localQueue 直接推 iframe，
  // 但它同样该进档案 —— 档案是两条路共用的。
  rememberSpokenAudio(frame.text, samples, sampleRate, durationMs);
  // [点哪段读哪段] 这一帧来自**我们**发出去的某次 say 请求：按当时报上去的那段
  // 文字归档 —— 那正是下一次点击会递上来的钥匙。可能有好几笔请求同时在飞，
  // 所以整张表都要比一遍。
  for (const [token, askedText] of awaitingSpokenTexts) {
    if (utteranceId.indexOf(token) >= 0) {
      rememberSpokenAudio(askedText, samples, sampleRate, durationMs);
      awaitingSpokenTexts.delete(token);
      break;
    }
  }

  // 甲方案（有 iframe）：只推给它。**不**自己再放一遍 —— 那就是双声。
  // 形状逐字是 `{ kind:"tts", utteranceId, seq, samples, sampleRate, durationMs }`，
  // `kind:"tts"` 也是唯一能在 iframe 里放出声音的 kind（`cue` 走的是另一套协议）。
  if (voiceSinkWindow() !== null) {
    pushVoiceToFrame({ kind: "tts", utteranceId, seq, samples, sampleRate, durationMs });
    return;
  }
  // 标准视图（没有 iframe）：父窗口自己放。
  localQueue.push(utteranceId, seq, { samples, sampleRate, durationMs });
}

/** 一条 `ttsStop` 帧：有 iframe 就推给它，没有就停父窗口这边。 */
function onMiniMaxStop(utteranceId: string): void {
  if (voiceSinkWindow() !== null) {
    pushVoiceToFrame({ kind: "ttsStop", utteranceId });
    return;
  }
  localQueue.stop(utteranceId);
}

/** 最近一次宿主状态快照；null = 还没问过。 */
export let miniMaxState: Record<string, unknown> | null = null;
/** 设置页那一行的订阅者。 */
const miniMaxSubs = new Set<(state: Record<string, unknown> | null) => void>();
/** 轮询定时器：只有那一行挂载期间才存在。 */
let miniMaxTimer: ReturnType<typeof setInterval> | null = null;
/** 订阅者数量变 0 之后要清掉的那些（见 `subscribeMiniMax`）。 */
function notifyMiniMax(): void {
  for (const cb of miniMaxSubs) {
    try {
      cb(miniMaxState);
    } catch {
      /* 一个订阅者坏掉不该影响别的 */
    }
  }
}

/** 拉一次宿主快照。失败**保留上一次** —— 别把界面打回「未知」。 */
async function refreshMiniMax(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(MINIMAX_STATE_URL, { headers: { accept: "application/json" } });
    if (res.ok) miniMaxState = (await res.json()) as Record<string, unknown>;
  } catch {
    /* 拿不到就沿用上一次 */
  }
  notifyMiniMax();
  return miniMaxState;
}

/**
 * 发一个动作，把宿主回的快照回填。
 *
 * `extra` 是给 `say` 用的 —— 那一个动作要带正文（点的是哪段，就送哪段）。
 * 其余动作（adopt / reset / preview / warm）不带负载，行为不变。
 */
export async function postMiniMaxAction(
  action: string,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(MINIMAX_STATE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...(extra ?? {}) }),
    });
    if (res.ok) miniMaxState = (await res.json()) as Record<string, unknown>;
    else markMinimax("minimaxActionError", `${action} → HTTP ${res.status}`);
  } catch (error) {
    markMinimax("minimaxActionError", String((error as Error)?.message ?? error));
  }
  notifyMiniMax();
  return miniMaxState;
}

/**
 * 设置页那一行的订阅口：挂上就开 5 秒轮询，卸载就停。
 *
 * 「SSE 的 `state` 帧到了也立刻回填」由 `dispatchMiniMaxFrame` 直接改
 * `miniMaxState` 再 `notifyMiniMax()` 完成 —— 这里不再单独订阅 SSE，
 * 因为设置页与播放器看到的是**同一份**宿主快照。
 */
export function subscribeMiniMax(cb: (state: Record<string, unknown> | null) => void): () => void {
  miniMaxSubs.add(cb);
  void refreshMiniMax();
  if (miniMaxTimer === null) {
    miniMaxTimer = setInterval(() => {
      void refreshMiniMax();
    }, MINIMAX_POLL_MS);
  }
  return () => {
    miniMaxSubs.delete(cb);
    if (miniMaxSubs.size === 0 && miniMaxTimer !== null) {
      clearInterval(miniMaxTimer);
      miniMaxTimer = null;
    }
  };
}

/** `lastError` / `refusal` 这些机器码的中文说法。没见过的码原样显示。 */
const MINIMAX_ERROR_LABELS: Record<string, string> = {
  no_key: "没有填 MiniMax 密钥",
  no_clone_key: "没有填克隆用密钥",
  auth: "鉴权失败（密钥不对或已失效）",
  invalid_key: "密钥格式不被接受",
  quota: "额度用尽",
  rate: "被限流（稍后重试）",
  network: "网络到不了 MiniMax",
  http: "MiniMax 返回了 HTTP 错误",
  cancelled: "这次认领被取消了",
  other: "别的原因",
  voice_missing: "克隆音色在 MiniMax 那边不见了",
};

/** 把一个机器码翻成中文；已经是中文/未知就原样。 */
export function miniMaxErrorText(code: unknown): string {
  const key = typeof code === "string" ? code : "";
  if (key === "") return "未知原因";
  return MINIMAX_ERROR_LABELS[key] ?? key;
}

/** 冷却到期时间：ISO → 本地时间；没有就是 null。 */
export function miniMaxRetryText(retryAt: unknown): string | null {
  if (typeof retryAt !== "string" || retryAt === "") return null;
  const at = new Date(retryAt);
  if (Number.isNaN(at.getTime())) return retryAt;
  const seconds = Math.max(0, Math.round((at.getTime() - Date.now()) / 1000));
  return `${at.toLocaleTimeString()}（约 ${seconds} 秒后）`;
}

/**
 * SSE 一帧的派发。
 *
 * 与 iframe 那侧的 `bridge.onVoice` 认的是同一组 kind：`tts` / `ttsStop`，
 * 外加宿主的状态帧 `state`（它没有独立的推送通道，就搭在这条流上）。
 */
function dispatchMiniMaxFrame(frame: Record<string, unknown>): void {
  if (frame.kind === "tts") {
    onMiniMaxPcm(frame);
    return;
  }
  if (frame.kind === "ttsStop") {
    const id = typeof frame.utteranceId === "string" ? frame.utteranceId : "";
    if (id !== "") onMiniMaxStop(id);
    return;
  }
  // 状态快照：既有 `kind:"state"` 的 SSE 帧，也有 GET 端点的裸快照，
  // 两者形状一样，靠 `voice` / `synth` 这两个键认出来。
  if (frame.voice !== undefined || frame.synth !== undefined || frame.kind === "state") {
    miniMaxState = frame;
    markMinimax("minimaxEngine", frame.engine);
    markMinimax("minimaxEngineNote", frame.engineReason ?? null);
    notifyMiniMax();
  }
}

/** 把 `data:` 那一行解析成帧。坏 JSON（截断/乱码）返回 null，绝不抛。 */
function parseSseData(data: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * SSE 的**单例 + 引用计数**。
 *
 * `apply` 理论上一页只跑一次，但同一页被挂两次（重复的 loader 条目、调试时手动
 * 再挂）的代价是两条 `EventSource`、同一段 PCM 到两次 —— 而队列是按帧去重的，
 * 两条连接各自去重、各自播一遍，听起来就是回声。所以这里只留一条连接，
 * 引用计数归零才真的 close。
 */
let miniMaxStream: EventSource | null = null;
let miniMaxStreamRefs = 0;

/**
 * 订阅宿主的 PCM 流。
 *
 * **挂在插件级（`apply`）而不是整机视图里**：声音该在用户停在任何页签时都响 ——
 * 只在整机页签订阅的话，切到别的页签就全哑了，而那正是「功能只在开着某个页签时
 * 有效」的典型毛病。
 *
 * `EventSource` 不存在（无头 / 旧浏览器）时只记一条，不抛 —— 设置页那一行靠
 * 轮询照常工作。
 *
 * @returns 退订函数。`ctx.effect` 会带它一起释放。
 */
export function startMiniMaxStream(): () => void {
  miniMaxStreamRefs += 1;
  if (miniMaxStream !== null) {
    // 已经连上了：这次只是旁观，别开第二条。
    let released = false;
    return () => {
      if (released) return;
      released = true;
      miniMaxStreamRefs -= 1;
      if (miniMaxStreamRefs <= 0 && miniMaxStream !== null) {
        miniMaxStream.close();
        miniMaxStream = null;
        markMinimax("minimaxSse", "closed");
      }
    };
  }
  if (typeof EventSource !== "function") {
    markMinimax("minimaxSse", "unavailable");
    return () => {
      miniMaxStreamRefs = Math.max(0, miniMaxStreamRefs - 1);
    };
  }
  let source: EventSource;
  try {
    source = new EventSource(MINIMAX_EVENTS_URL);
  } catch (error) {
    markMinimax("minimaxSse", `construct failed: ${String((error as Error)?.message ?? error)}`);
    return () => {
      miniMaxStreamRefs = Math.max(0, miniMaxStreamRefs - 1);
    };
  }
  miniMaxStream = source;
  markMinimax("minimaxSse", "connecting");
  source.onopen = () => {
    markMinimax("minimaxSse", "open");
    // 连上就顺手对一次账：SSE 的 state 帧不保证到达，GET 是保底的事实来源。
    void refreshMiniMax();
  };
  source.onerror = () => {
    // EventSource 会自己重连，这里只记录状态（别手动 close —— 那才是真的断了）。
    markMinimax("minimaxSse", "error");
  };
  source.onmessage = (event: MessageEvent) => {
    // `onmessage` 每次就是**一整帧**：SSE 按空行分帧，多行 `data:` 已被浏览器
    // 用 \n 拼好。所以这里不需要缓冲区、也不需要自己切块 —— 逐帧解析即可。
    const frame = parseSseData(String(event.data ?? ""));
    if (frame === null) {
      markMinimax("minimaxBadFrames", ((globalThis.__DSH_HERTA__?.minimaxBadFrames as number) ?? 0) + 1);
      return;
    }
    dispatchMiniMaxFrame(frame);
  };

  let released = false;
  return () => {
    if (released) return;
    released = true;
    miniMaxStreamRefs -= 1;
    if (miniMaxStreamRefs <= 0) {
      source.close();
      if (miniMaxStream === source) miniMaxStream = null;
      markMinimax("minimaxSse", "closed");
    }
  };
}

/** 一个待渲染的气泡，已经从 DSH 节点降维成 Herta 组件认识的两要素。 */
interface Bubble {
  readonly role: "user" | "herta";
  readonly text: string;
  readonly at?: string;
}

/** 降维时被丢掉、Herta 的模型里没有对应物的节点计数。 */
interface Dropped {
  readonly total: number;
  readonly kinds: readonly string[];
}

/** 一条来自 `herta_speak` 工具结果的发声指令。 */
interface VoiceCue {
  readonly seq: number;
  readonly url: string;
  readonly clip: string;
  readonly category: string;
}
/**
 * 停掉共享的语音模型轮询。界面的 `useEffect` 清理调它 —— 否则每挂一次视图就多留一个定时器。
 *
 * 为什么要有这个函数：原先清理里直接 `clearInterval(voiceModelTimer); voiceModelTimer = null;`，
 * 而那个状态现在归本文件 —— 外面再直接赋值就是「给 import 赋值」。状态归这一层，外面只经这个口子。
 */
export function stopVoiceModelTimer(): void {
  if (voiceModelTimer !== null) {
    clearInterval(voiceModelTimer);
    voiceModelTimer = null;
  }
}
