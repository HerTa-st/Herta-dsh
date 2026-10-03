/**
 * dsh-herta 的 client（浏览器）半侧。
 *
 * 里程碑 3：把 DSH 的真实会话数据接进 Herta 的渲染组件。
 *
 * 数据来自官方扩展点，不是猜的：
 *   ctx.uiConversation.binding(sessionId)      → ConversationBinding
 *     .target('chat')                          → ObservableSnapshot<ChatSnapshot>
 *       .legacy.nodes                          → readonly ConversationNode[]
 *
 * `binding().target(id)` 是 `ConversationBinding` 的公开方法
 * （ui-conversation/src/client/conversation/assembly.ts:27-44）：第一个订阅者
 * 会激活该 target，之后它随会话生命周期常驻。所以我的视图可以在「对话」页签
 * 没被选中时也读到同一份组装结果。
 *
 * 组件拿数据的方式是 `inject` 返回的 `hooks` 隔间：里面每个 name 会被渲染器绑成
 * 一个 `use<Name>` 选择器钩子（ui-slots/src/renderer.ts:75-76），组件永远看不到
 * 订阅机制本身 —— 这是 DSH 客户端「业务组件不含订阅机器」那条硬规则。
 *
 * 样式仍然关在 shadow root 里，理由见 scripts/build.mjs 的 CSS 转换说明。
 */
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HertaBubble } from "@gui/components/Workspace/HertaBubble";
import { UserBubble } from "@gui/components/Workspace/UserBubble";
import { LocaleProvider } from "@gui/i18n/LocaleProvider";
import hertaCss from "@gui/styles/reference-ux.css";
// 两个方向的映射都在共享模块里（纯函数，Node 里可直接单测：
// scripts/test-mapping.mjs）。客户端只负责订阅与渲染。
import { fullSnapshot, nodesToRecord, toBubbles } from "../shared/mapping.js";
// 语音偏好：默认值、归一化、iframe 要的 RealtimeVoiceState 都由这个纯模块给出
// —— 与宿主侧 `src/host/voice-settings.js` 共用同一份，而它无 import，
// 所以既能 Node 单测，也能被 esbuild 打进这份 bundle。
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
// 设置字段表：与宿主**同一份**（无 import 的纯数据模块，esbuild 直接内联）。
// 页面的标签、枚举选项、默认值、「哪些字段整机真的会读」、**展示元数据**
// （分组归属 / 枚举中文 / 行内提示 / 引擎行逐档文案）全部从它读 ——
// 客户端不再自持第二份字段清单或展示表（2026-10-03 收编，原先散着六张）。
import {
  FIELDS,
  normalizeSettings,
  SETTINGS_GROUPS,
  UNWIRED_FIELD_NAMES,
} from "../host/settings-schema.js";
// MiniMax 语音的两件纯逻辑：base64 → Int16 PCM 的解码，与按 utteranceId/seq 交付的
// 播放队列状态机。**零 import** 是刻意的 —— 它能被 Node 直接单测
// （`scripts/test-minimax-pcm.mjs`），所以「顺序 / 去重 / 打断 / 停止」这些最容易
// 写错的地方不靠浏览器验证。
import { createSerialPlaybackQueue, decodePcmFrame } from "./minimax-pcm.ts";

/** Cordis 插件名，与 cordis.patch.yml 里的 loader 条目 id 一致。 */
const name = "herta";

/** 客户端服务：槽位注册表 + Conversation 组装。 */
const inject = ["uiConversation", "slots"];

/**
 * 视图 id：`conversation.view` 槽内的唯一键。
 * 壳会把用户选中的视图偏好按这个 id 持久化，所以改它等于换一个页签。
 */
const VIEW_ID = "herta";

/** 整机页签的视图 id（甲方案，iframe）。 */
const FULL_VIEW_ID = "herta-full";

/**
 * 设置命名空间 = 宿主那条 profile 条目的 id。
 *
 * 字面量，不 import 宿主模块：客户端包不得依赖宿主包（DSH 的
 * `packages/client/tsdown.client.ts` 纯净度门），官方四个伴生设置页也全都
 * 在客户端重写一遍这个常量。它与 `src/host/index.js` 的
 * `HERTA_SETTINGS_NAMESPACE` 必须是同一个字符串。
 */
const MACHINE_NS = "herta";

/** `ctx.configForms.get(ns)` 返回的那张表单（只列本文件用到的成员）。 */
interface MachineForm {
  getSnapshot(): {
    status: "loading" | "ready" | "unavailable";
    value?: Record<string, unknown>;
    user?: unknown;
    writable?: boolean;
  };
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<boolean>;
  unset(field: string): Promise<boolean>;
  mutate(ops: readonly unknown[]): Promise<boolean>;
}

/**
 * 当前绑定的设置表单。由 `apply` 里的 `ctx.inject(["configForms"], …)` 赋值 ——
 * 服务缺席（或命名空间还没被宿主服务）时保持 null，所有读取退到默认值，
 * 所有写入变成无害的空操作。**不报错、不白屏**是这里唯一的设计要求。
 */
let machineForm: MachineForm | null = null;

/** 设置值快照（永远完整：非法/缺失一律回落默认），供 iframe 的应答器同步读。 */
function machineValues(): Record<string, unknown> {
  return normalizeSettings(machineForm?.getSnapshot().value);
}

/** 一趟原子写入：一次 revision 栅栏、一次失败重读。 */
async function writeMachineOps(ops: readonly Record<string, unknown>[]): Promise<boolean> {
  const field = String((ops[0]?.path as readonly string[] | undefined)?.[0] ?? "");
  if (machineForm === null) {
    markMachine("settingsWriteSkipped", field);
    return false;
  }
  try {
    const accepted = await machineForm.mutate(ops);
    markMachine("settingsLastWrite", field);
    markMachine("settingsLastWriteAccepted", accepted);
    return accepted;
  } catch (error) {
    markMachine("settingsWriteError", String((error as Error)?.message ?? error));
    return false;
  }
}

/** 写一个设置字段。 */
async function writeMachineField(field: string, value: unknown): Promise<boolean> {
  return writeMachineOps([{ op: "set", path: [field], value }]);
}

/**
 * 读一个设置字段的当前值（已归一）。
 *
 * iframe 的应答器要用它 —— 那里是**同步**应答（`getLocale` 这类不能 await HTTP），
 * 所以只能读客户端手上的这份快照。
 */
function machineField(field: string): unknown {
  return machineValues()[field];
}

/** 记一条设置相关的诊断，便于从无头浏览器外部确认「到底写没写」。 */
function markMachine(field: string, value: unknown): void {
  const mark = (globalThis as Record<string, unknown>).__DSH_HERTA__ as
    | Record<string, unknown>
    | undefined;
  if (mark !== undefined) mark[field] = value;
}

/**
 * DSH 的**凭据缝**（`ctx.remote.credentials`）—— 只列本文件用到的三个成员。
 *
 * ## 为什么密钥不走 Config
 *
 * Config 落在 profile 的 `cordis.patch.yml` 里，那是**明文 YAML**。密钥走那条路
 * 等于把它们公开。凭据缝才是它的位置：值的读写分两半，读的那半只回
 * `{configured, source, writable}`（**没有能装值的槽位**），所以它才能安全地跨
 * Remote 走到浏览器；写的那半是 `set(ref, value)`，落 `$DSH_HOME/.credentials.yaml`
 * （0600，file 层，可写）。
 *
 * ## 为什么是 `remote.credentials` 而不是自己开一条 HTTP
 *
 * 官方设置页（`dsh-client-ui-settings-models`）存密钥走的就是这一套
 * （`lib/client.js:2787-2795`）。自己再开一条写入口就是第二个真相来源 ——
 * 上一版正因这个理由删掉了 `/herta-settings`。
 *
 * 服务缺席（无头 / SDK 组合）时这里保持 `null`，页面上的密钥行显示「不可用」
 * 而不是抛错：`ctx.inject` 的回调不触发，别的部分照常。
 */
interface CredentialsRemote {
  describe(refs: readonly string[]): Promise<{
    ok: boolean;
    value?: Record<string, { configured?: boolean; source?: string; writable?: boolean }>;
    error?: { message?: string };
  }>;
  set(ref: string, value: string): Promise<{ ok: boolean; error?: { message?: string } }>;
  unset(ref: string): Promise<{ ok: boolean; error?: { message?: string } }>;
}

/** 由 `installSettingsSection` 里的惰性 inject 赋值；缺席即 null。 */
let credentialsRemote: CredentialsRemote | null = null;

/**
 * 凭据缝**晚一点**才出现的订阅者。
 *
 * 页面的密钥行在挂载时就会查一次状态，而 `remote.credentials` 可能是握手之后
 * 才挂上来的（见 `installSettingsSection` 里的注释）。没有这张订阅表，那一次
 * 查询会永久停在「凭据服务不可用」，即使服务半秒后就绪 —— 那是「界面在说谎」，
 * 正是这一轮要消灭的东西。
 */
const credentialsSubs = new Set<() => void>();

/** 绑定凭据缝并通知所有正在等它的行。 */
function bindCredentialsRemote(next: CredentialsRemote): void {
  credentialsRemote = next;
  for (const cb of credentialsSubs) {
    try {
      cb();
    } catch {
      /* 一个订阅者坏掉不该影响别的 */
    }
  }
}

/** 订阅「凭据缝就绪」。返回退订函数。 */
function subscribeCredentials(cb: () => void): () => void {
  credentialsSubs.add(cb);
  return () => {
    credentialsSubs.delete(cb);
  };
}

/**
 * 解析凭据缝（`remote.credentials`）。拿不到就返回 `undefined`，**永不抛错**。
 *
 * ## 为什么不用 `ctx.inject(["remote.credentials"], …)`
 *
 * 实测（lab，三次构建）：
 *   · `inject(["remote.credentials"])` —— 回调**不触发**，三行密钥全「不可用」；
 *   · `inject(["remote"])` 之后读 `scoped.remote.credentials` —— 也不可靠
 *     （第一次构建里那次回调确实触发了，可那次没读属性；之后两次连回调都没来，
 *     计时器也没到超时，与「读属性抛异常」一致）。
 *
 * 所以这里不再依赖注入时机，也不假设属性读取会安静地返回 undefined ——
 * 两种取法都包在 try 里，失败就交给上层的**有界轮询**再试。
 * 轮询不是洁癖：`credentials` 是握手之后挂到 `remote` 上的命名空间，
 * 客户端插件挂载时它常常还没到。
 *
 * @param ctx - 插件（或注入作用域）的 cordis 上下文。
 * @returns 凭据缝，或 undefined。
 */
function resolveCredentials(ctx: {
  get?(name: string): unknown;
  remote?: unknown;
}): CredentialsRemote | undefined {
  try {
    const direct = ctx.get?.("remote.credentials");
    if (direct !== undefined && direct !== null) return direct as CredentialsRemote;
  } catch {
    // 服务路径解不开：退回下面那次属性读取。
  }
  try {
    const remote = ctx.remote;
    if (remote === null || remote === undefined || typeof remote !== "object") return undefined;
    return (remote as { credentials?: CredentialsRemote }).credentials;
  } catch {
    return undefined;
  }
}

/** 有界轮询凭据缝并绑定；每次结果都写进诊断标记（`__DSH_HERTA__`）。 */
function watchCredentials(
  ctx: { get?(name: string): unknown; remote?: unknown; effect?(cb: () => unknown, label?: string): unknown },
  mark: Record<string, unknown>,
): void {
  const already = resolveCredentials(ctx);
  if (already !== undefined) {
    bindCredentialsRemote(already);
    mark.settingsCredentialsBound = true;
    mark.settingsCredentialsAttempts = 1;
    return;
  }
  const INTERVAL_MS = 500;
  const MAX_ATTEMPTS = 40; // 20 秒
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const found = resolveCredentials(ctx);
    if (found !== undefined) {
      bindCredentialsRemote(found);
      mark.settingsCredentialsBound = true;
      mark.settingsCredentialsAttempts = attempts;
      clearInterval(timer);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      mark.settingsCredentialsError = `remote.credentials 在 ${(MAX_ATTEMPTS * INTERVAL_MS) / 1000} 秒内没有出现（试了 ${attempts} 次）`;
      clearInterval(timer);
    }
  }, INTERVAL_MS);
  // 随插件 fiber 一起释放，别留下没人清的定时器。
  ctx.effect?.(() => () => clearInterval(timer), "dsh-herta: 等 remote.credentials");
}

/** 查一个密钥「设了没有」。拿不到服务时返回 undefined（页面显示「不可用」）。 */
async function credentialStatus(
  ref: string,
): Promise<{ configured: boolean; writable: boolean } | undefined> {
  if (credentialsRemote === null) {
    markMachine("credentialsStatusError", "no-remote");
    return undefined;
  }
  try {
    const res = await credentialsRemote.describe([ref]);
    if (!res.ok) {
      // 注入成功但调用失败，是最容易看错的一种：注入标记为 true，页面却全线
      // 「不可用」。所以这里单独记一条，好从无头浏览器外部一眼分清。
      markMachine("credentialsStatusError", res.error?.message ?? "describe rejected");
      return undefined;
    }
    const info = res.value?.[ref];
    return { configured: info?.configured === true, writable: info?.writable !== false };
  } catch (error) {
    markMachine("credentialsStatusError", String((error as Error)?.message ?? error));
    return undefined;
  }
}

/** 存一个密钥。返回 null 表示成功，否则是给用户看的原因。 */
async function saveCredential(ref: string, value: string): Promise<string | null> {
  if (credentialsRemote === null) return "这个部署没有挂凭据服务";
  try {
    const res = await credentialsRemote.set(ref, value);
    return res.ok ? null : (res.error?.message ?? "宿主拒绝了这次写入");
  } catch (error) {
    return String((error as Error)?.message ?? error);
  }
}

/** 清掉一个密钥。返回 null 表示成功，否则是原因。 */
async function clearCredential(ref: string): Promise<string | null> {
  if (credentialsRemote === null) return "这个部署没有挂凭据服务";
  try {
    const res = await credentialsRemote.unset(ref);
    return res.ok ? null : (res.error?.message ?? "宿主拒绝了这次删除");
  } catch (error) {
    return String((error as Error)?.message ?? error);
  }
}

/**
 * 语音偏好的读写口 —— iframe 那边的语音应答器读它。
 *
 * **对外形状刻意保持不变**（`{getSnapshot().value, set(field, value)}`）。
 *
 * 0.1.7-rc.2 起背后是 DSH 的设置表单（`ctx.configForms.get("herta")`）：
 * 同一个命名空间既喂这些应答器、也喂 DSH 自己设置页里的「黑塔」一页，
 * 而且写入会落进 profile 的 `cordis.patch.yml`。
 */
const voiceScope = {
  getSnapshot(): { value?: unknown } {
    const values = machineValues();
    return { value: { engine: values.voiceEngine, realtimeVoice: values.realtimeVoice } };
  },
  async set(field: string, value: unknown): Promise<void> {
    // 字段名在这里翻译一次：bridge 的契约叫 `engine`，DSH 的字段叫 `voiceEngine`。
    const name = field === "engine" ? "voiceEngine" : field;
    await writeMachineField(name, value);
  },
};

/**
 * 本地语音模型（离线 TTS）状态 —— 宿主 `/herta-voice-model` 的镜像。
 *
 * 为什么要有本地镜像 + 轮询，而不是每次现问：
 *   · 整机 iframe 的 `getRealtimeVoice` 是**同步应答**的（它读 `RealtimeVoiceState`
 *     里的 `model` 字段），不能在里面 await 一次 HTTP
 *   · 下载要显示进度，而进度只能靠轮询拿（宿主是 GET 状态 / POST 动作的形态）
 *
 * 轮询**只在 `downloading` 时开**：平时一个定时器都不留，下载一结束就清掉。
 */
const VOICE_MODEL_URL = "/herta-voice-model";

/** 当前状态；null = 还没问过宿主。 */
let voiceModelState: Record<string, unknown> | null = null;

/** 订阅者（由整机视图的 `onVoiceModel` 挂上）。 */
const voiceModelSubs = new Set<(state: unknown) => void>();

let voiceModelTimer: ReturnType<typeof setInterval> | null = null;

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
async function refreshVoiceModel(): Promise<unknown> {
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
async function postVoiceModel(action: string): Promise<unknown> {
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
function voiceModelFacts(): Record<string, unknown> {
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
function registerVoiceSink(frame: HTMLIFrameElement | null): () => void {
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
function playLocalVoice(
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
const localQueue = createSerialPlaybackQueue({
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
let miniMaxState: Record<string, unknown> | null = null;
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
async function postMiniMaxAction(
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
function subscribeMiniMax(cb: (state: Record<string, unknown> | null) => void): () => void {
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
function miniMaxErrorText(code: unknown): string {
  const key = typeof code === "string" ? code : "";
  if (key === "") return "未知原因";
  return MINIMAX_ERROR_LABELS[key] ?? key;
}

/** 冷却到期时间：ISO → 本地时间；没有就是 null。 */
function miniMaxRetryText(retryAt: unknown): string | null {
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
    markMinimax("minimaxEngineNote", frame.engineNote ?? null);
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
function startMiniMaxStream(): () => void {
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

/** 从 DSH 的 ContentBlock[] 里取纯文本；图片/文件/工具块这一版先不处理。 */
/** DSH 把生效主题写在 documentElement 的 inline colorScheme 上（ui-theme/boot-theme.ts:19）。 */
function currentDshTheme(): "dark" | "light" {
  return document.documentElement.style.colorScheme === "dark" ? "dark" : "light";
}

/**
 * 准备 shadow root：样式表只注入一次，挂载点复用。
 * 用 shadow 是为了让 279 KB 的 Herta 全局样式表既生效又外溢不出去。
 */
function ensureShadowMount(host: HTMLElement): HTMLElement {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (shadow.querySelector("style[data-herta]") === null) {
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.setAttribute("data-herta", "");
    style.textContent = hertaCss;
    shadow.append(style);
  }
  // [点哪段读哪段] 可点的是**气泡自己的盒子**，不是它所在的那一整行。
  // 写进 CSS 是为了让指针和判定说同一件事 —— 否则鼠标在空白处伸出手，
  // 点下去却被处理器拒绝。
  if (shadow.querySelector("style[data-herta-click]") === null) {
    const clickStyle = document.createElement("style");
    clickStyle.setAttribute("data-herta-click", "");
    clickStyle.textContent = ".message-bubble,.code-standalone{cursor:pointer}";
    shadow.append(clickStyle);
  }
  const existing = shadow.querySelector("[data-herta-mount]");
  if (existing instanceof HTMLElement) return existing;
  const mount = document.createElement("div");
  mount.setAttribute("data-herta-mount", "");
  shadow.append(mount);
  return mount;
}

/**
 * 「点哪段，读哪段」—— 唯一由**人**发起的打断入口。
 *
 * 两件事，顺序不能换：
 *   1. `stopAll()` 先把正在播的、和排着队的全掐掉 —— 用户点了新的，旧的
 *      就该立刻让位，而不是念完再说；
 *   2. 再把这段文字送去合成，音频照旧从 SSE 回来，队列接着播。
 *
 * 先掐后送是有意的：合成要一秒上下，先送再掐会让旧的那句多念出一个字。
 */
/**
 * [点哪段读哪段] 按「合成它用的那段文字」归档的音频。
 *
 * 一次云端往返实测约 4.8 秒 —— 所以「点一段，立刻听见」只能靠**记忆**：只要
 * 那段话被合成过，就不该再去要第二遍。而它通常被合成过：每一帧 `tts` 都带着
 * 自己那一段文字（宿主一直在推，只是这边以前没接），开了自动念回复就更是整条
 * 回复都念过一遍 —— 那些采样以前播完就丢了。
 *
 * 键是文字；限额两道（条数 + 采样总数），因为 `Int16Array` 两个字节才一个采样，
 * 按条存长回复很能吃内存。
 */
const spokenAudio = new Map<
  string,
  { samples: Int16Array; sampleRate: number; durationMs: number }
>();
const SPOKEN_AUDIO_LIMIT = 64;
const SPOKEN_AUDIO_MAX_SAMPLES = 15_000_000;
let spokenAudioSamples = 0;

function rememberSpokenAudio(
  text: unknown,
  samples: Int16Array,
  sampleRate: number,
  durationMs: number,
): void {
  const key = String(text ?? "").trim();
  if (key === "" || samples.length === 0) return;
  const prev = spokenAudio.get(key);
  if (prev !== undefined) spokenAudioSamples -= prev.samples.length;
  if (spokenAudio.size >= SPOKEN_AUDIO_LIMIT) {
    spokenAudio.clear();
    spokenAudioSamples = 0;
  }
  spokenAudio.set(key, { samples, sampleRate, durationMs });
  spokenAudioSamples += samples.length;
  // 超了从最旧的开始丢，但**至少留一条** —— 否则刚存进来的会被自己挤出去。
  while (spokenAudioSamples > SPOKEN_AUDIO_MAX_SAMPLES && spokenAudio.size > 1) {
    const oldest = spokenAudio.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const victim = spokenAudio.get(oldest);
    spokenAudio.delete(oldest);
    if (victim !== undefined) spokenAudioSamples -= victim.samples.length;
  }
}

function recallSpokenAudio(text: string) {
  return spokenAudio.get(text.trim());
}

/**
 * [点哪段读哪段] 还在飞的 say 请求：令牌 → 它将来归档用的那段文字。
 *
 * 是**表**不是单个格子。长段合成要几十秒，这中间你要是点了别的，单个格子会被
 * 顶掉 —— 长的那条回来就成了「无人认领的帧」，被直接放掉，于是它永远进不了
 * 档案，下次再点还得重来。
 */
const awaitingSpokenTexts = new Map<string, string>();

async function speakText(text: string): Promise<void> {
  const body = text.trim();
  if (body === "") return;
  localQueue.stopAll();
  const hit = recallSpokenAudio(body);
  if (hit !== undefined) {
    // 直接送喇叭：没有往返，也就没有等的理由。上面那句 stopAll() 已经把全局
    // 游标归零，所以它是「现在」响，而不是排在谁后面。
    playLocalVoice(`cached-${Date.now()}`, 0, hit.samples, hit.sampleRate, hit.durationMs);
    return;
  }
  const token = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36)}`;
  awaitingSpokenTexts.set(token, body);
  // `exact` 要宿主把整段**一次**合成，而不是照常按句切碎。两个好处：
  // 等待从「几趟云端往返」降到一趟；而且档案的钥匙正好是整段本身 ——
  // 也就是下一次点击它会递上来的那把。
  await postMiniMaxAction("say", { text: body, exact: true, token });
}

/**
 * 这一下，点在**哪一段**上？
 *
 * `HertaBubble` 内部按 `segmentSpeech` 把一条消息拆成一段一个
 * `div.message-row.herta-row`（空行分段、围栏块单列），所以指针底下那个元素
 * 就能唯一定位到段 —— 这正是「点哪段读哪段」缺的那一环。
 *
 * 挂 onClick 的那层壳**铺满整行**，所以还得先问一句：这一下**落进气泡自己的
 * 盒子了吗**（话语是 `.message-bubble`，代码块是 `.code-standalone`）。
 * 落在盒子外面返回 `null` —— 那是**明确的「不算」**，和 `fallback`（算，但
 * 定位不到段，退回整条）是两回事。宁可念多，不要念错。
 */
function paragraphUnderPointer(event: { target?: unknown } | null, fallback: string): string | null {
  try {
    const target = event?.target as { closest?: (sel: string) => Element | null } | null | undefined;
    if (typeof target?.closest !== "function") return fallback;
    const bubble = target.closest(".message-bubble") ?? target.closest(".code-standalone");
    if (bubble === null) return null;
    const row = bubble.closest(".message-row") ?? bubble;
    const body = row.querySelector(".message-text") ?? row.querySelector(".code-block") ?? bubble;
    const text = (body.textContent ?? "").trim();
    return text === "" ? fallback : text;
  } catch {
    return fallback;
  }
}

/**
 * 把所有气泡渲染成 Herta 的组件树。
 *
 * 她的话外面包了一层可点的壳：点一下就重念那一段。
 * 壳加在外层而不是改 `HertaBubble` —— 那是 `@gui` 的组件，住在 Herta 源码树里，
 * 不归这份代码管，也没有留 onClick 的位置。
 */
function renderBubbleList(bubbles: readonly Bubble[]): unknown {
  const children = bubbles.map((b, i) => {
    if (b.role === "user") {
      return createElement(UserBubble, {
        key: `${i}-user`,
        text: b.text,
        ...(b.at === undefined ? {} : { at: b.at }),
      });
    }
    return createElement(
      "div",
      {
        key: `${i}-herta`,
        onClick: (event: { target?: unknown }) => {
          const hit = paragraphUnderPointer(event, b.text);
          if (hit === null) return; // 点在气泡旁边的空白：不算点她
          void speakText(hit);
        },
        title: "点一下，读这一段",
      },
      createElement(HertaBubble, {
        text: b.text,
        lang: "zh",
        ...(b.at === undefined ? {} : { at: b.at }),
      }),
    );
  });
  return createElement("div", null, children);
}

// ── 语音（C 层）──────────────────────────────────────────────────────────────
// 80 条 .opus 由宿主侧的静态路由 `/herta-voice` 提供（见 src/host/voice.js）。
// 这一档零依赖：浏览器原生就能放 Ogg Opus，没有 TTS 运行时、没有模型。

/** 语音索引：`{ 类别: [相对路径, …] }`，启动时由宿主扫出来。 */
type VoiceIndex = Record<string, readonly string[]>;

/** 一条剪辑的完整 URL。路径里可能有中文与特殊字符，逐段编码。 */
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
function playUrl(url: string): void {
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
function playClip(rel) {
  playUrl(clipUrl(rel));
}

/** 从数组里随机取一个。 */
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 黑塔面板：语音条 + 气泡列表。
 *
 * 语音状态（索引、静音）由这个组件持有 —— 它挂在 shadow 里的嵌套 root 上，
 * 所以 hooks 照常可用。数据仍由外层通过 props 传入，组件本身不订阅会话。
 */
function HertaPanel(props: { bubbles: readonly Bubble[]; voiceCues: readonly VoiceCue[] }): unknown {
  const [index, setIndex] = useState(null);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState("");
  const [autoVoice, setAutoVoice] = useState(true);

  // 索引只取一次。
  useEffect(() => {
    let alive = true;
    fetch("/herta-voice/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive) setIndex(data?.categories ?? null);
      })
      .catch(() => {
        if (alive) setIndex(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const hertaBubbles = props.bubbles.filter((b) => b.role === "herta").length;

  const playParticle = useCallback(() => {
    if (index === null) return;
    const particles = index.particle ?? [];
    if (particles.length === 0) return;
    playClip(pick(particles));
    setNotice(`语气：${pick(particles).split("/")[1]}`);
  }, [index]);

  // 她的新气泡出现时自动配一声语气词。首帧不响（挂载时不该突然出声）。
  const seen = useRef(0);
  useEffect(() => {
    if (!muted && autoVoice && index !== null && hertaBubbles > seen.current && seen.current > 0) {
      playParticle();
    }
    seen.current = hertaBubbles;
  }, [hertaBubbles, muted, autoVoice, index, playParticle]);

  // 模型主动发声：`herta_speak` 的工具结果带一条指令，这里按 seq 去重后播放。
  // 用 Set 去重是必须的 —— 视图每次重渲都会重新走一遍全部节点，
  // 不记已播过的 seq 就会把历史里每一声都重放一遍。
  const playedSeqs = useRef(new Set());
  useEffect(() => {
    if (muted) return;
    for (const cue of props.voiceCues) {
      if (playedSeqs.current.has(cue.seq)) continue;
      playedSeqs.current.add(cue.seq);
      playUrl(cue.url);
      setNotice(`她说（${cue.category}）`);
    }
  }, [props.voiceCues, muted]);

  const total = index === null ? 0 : Object.values(index).reduce((n, l) => n + l.length, 0);

  const button = (label, onClick, key) =>
    createElement(
      "button",
      {
        key,
        type: "button",
        onClick,
        style: {
          font: "inherit",
          padding: "4px 10px",
          borderRadius: "6px",
          border: "1px solid currentColor",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          opacity: muted ? 0.5 : 1,
        },
      },
      label,
    );

  const bar = createElement(
    "div",
    {
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "8px 16px",
        opacity: 0.85,
      },
    },
    [
      button("开场", () => {
        const openings = index?.openings ?? [];
        if (openings.length > 0) {
          playClip(pick(openings));
          setNotice("开场白");
        }
      }, "open"),
      button("语气", playParticle, "particle"),
      button(muted ? "🔇 已静音" : "🔊 有声", () => {
        setMuted((m) => !m);
        setNotice("");
      }, "mute"),
      button(autoVoice ? "自动配音：开" : "自动配音：关", () => setAutoVoice((v) => !v), "auto"),
      createElement(
        "span",
        { key: "info", style: { fontSize: "12px", opacity: 0.7 } },
        index === null
          ? "语音资产不可用"
          : `语音资产 ${total} 条${notice === "" ? "" : ` · ${notice}`}`,
      ),
    ],
  );

  return createElement("div", { style: { padding: "8px 0 16px" } }, [
    bar,
    createElement("div", { key: "bubbles", style: { padding: "0 16px" } }, renderBubbleList(props.bubbles)),
  ]);
}

/** 空节点列表的稳定引用，避免每次渲染都造新数组去刷新 useMemo。 */
const NO_NODES: readonly unknown[] = [];

/**
 * 黑塔会话视图。
 *
 * 数据经 `props.useHertaChat(...)` 到达 —— 由 `inject` 的 `hooks` 隔间绑定的
 * 选择器钩子。组件本身不做任何订阅。
 *
 * 注意必须传选择器：这个钩子是 ui-renderer 的 `bindSnapshotSelector` 产的
 * （bind.ts:21-26），签名是 `(sel, eq?)`，运行时**没有**默认选择器 ——
 * 不传就会在 uSES 内部炸 `l is not a function`。恒等选择器即可拿到原快照。
 */
function HertaView(props: {
  useHertaChat?: (
    sel: (s: unknown) => unknown,
  ) => { legacy?: { nodes?: readonly unknown[] } } | undefined;
}): unknown {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<{ host: HTMLElement; root: Root } | null>(null);

  const chat =
    typeof props.useHertaChat === "function"
      ? (props.useHertaChat((s) => s) as
          | { legacy?: { nodes?: readonly unknown[] } }
          | undefined)
      : undefined;
  const nodes = chat?.legacy?.nodes ?? NO_NODES;
  const { bubbles, dropped, voiceCues } = useMemo(() => toBubbles(nodes), [nodes]);

  // 卸载时释放嵌套 root（shadow root 本身跨挂载存活，所以这里只收 root）。
  useEffect(
    () => () => {
      rootRef.current?.root.unmount();
      rootRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const mount = ensureShadowMount(host);
    if (rootRef.current === null || rootRef.current.host !== host) {
      rootRef.current = { host, root: createRoot(mount) };
    }
    const theme = currentDshTheme();
    // 主题要挂在 shadow **host** 上（也就是 hostRef 那个 div），
    // Herta 的暗色规则是 :host([data-theme="dark"])。
    // 注意不能用 mount.parentElement —— 那是 ShadowRoot，属于 DocumentFragment，
    // 根本没有 setAttribute。
    if (theme === "dark") host.setAttribute("data-theme", "dark");
    else host.removeAttribute("data-theme");
    rootRef.current.root.render(
      createElement(
        LocaleProvider,
        { locale: "zh", onLocaleChange: () => {} },
        // HertaPanel 的位置与类型都稳定，所以外层每次重渲只会更新 props，
        // 面板自己的语音状态（索引/静音/已播 seq）不会被重置。
        createElement(HertaPanel, { bubbles, voiceCues }),
      ),
    );

    const mark = (globalThis as Record<string, unknown>).__DSH_HERTA__ as
      | Record<string, unknown>
      | undefined;
    if (mark !== undefined) {
      mark.viewMounted = true;
      mark.theme = theme;
      mark.cssWhere = host.shadowRoot !== null ? "shadow" : "none";
      mark.bubbles = bubbles.length;
      mark.droppedNodes = dropped.total;
      mark.droppedKinds = [...new Set(dropped.kinds)];
    }
  }, [bubbles, dropped]);

  return createElement("div", { ref: hostRef, "data-dsh-herta-view": "ready" });
}

/**
 * DSH 会话节点 → 她的 `TerminalRecord`（甲的数据映射，乙映射的反方向）。
 *
 * 她的记录只有三种块：`user` / `herta`（surface 分 speech|thought）/ `system`。
 * 映射规则与乙那边保持一致，只是方向相反：
 *
 * | DSH 节点 | 她的块 |
 * |---|---|
 * | `user` / `steering` | `user` |
 * | `assistant`（text 块） | `herta{surface:'speech'}` |
 * | `assistant`（reasoning 块） | **丢弃** —— 她的 `thought` surface 本来就不渲染 |
 * | `tool-result` | `system{label:'系统', body:工具摘要}` |
 * | `turn-error` | `system{label:'系统', body:错误}` |
 * | context / command / compaction | `system` 或丢弃（她的模型里没有对应物） |
 */
/**
 * 「黑塔·整机」视图（甲方案）。
 *
 * 与「黑塔」页签（乙）的分工：
 *   · 乙 = 用她的**展示组件**渲染 DSH 的会话 —— 「她在 DSH 里干活」
 *   · 甲 = 用 iframe 装下她的**整个世界**（侧栏 / 开场 / 设备卡 / 她自己的会话）
 *
 * 用 iframe 而不是把整机组件塞进槽里，有三个实打实的理由：
 *   1. **样式**：整机用的是她原版的整页样式（`:root` / `body` 整页规则），
 *      塞进宿主的 slot 必然打架；iframe 天然是独立文档。
 *   2. **隔离**：整机是 16 MB 的应用，它崩了不该拖垮 DSH 界面。
 *   3. **它本来就是按窗口写的**：固定定位、vw/vh、按视口测量 —— 上游官网
 *      也是因此把 demo 放进 iframe 的。
 *
 * 数据流：这个组件用 `useHertaChat` 订阅会话，把节点映射成她的记录后用
 * postMessage 推给 iframe；iframe 里的 bridge 发过来的调用也在这里回答。
 */
function HertaFullView(props: {
  sessionId?: string;
  useHertaChat?: (
    sel: (s: unknown) => unknown,
  ) => { legacy?: { nodes?: readonly unknown[]; partial?: unknown } } | undefined;
}): unknown {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const chat =
    typeof props.useHertaChat === "function"
      ? (props.useHertaChat((s) => s) as
          | { legacy?: { nodes?: readonly unknown[]; partial?: unknown } }
          | undefined)
      : undefined;
  const nodes = chat?.legacy?.nodes ?? NO_NODES;
  const record = useMemo(() => nodesToRecord(nodes), [nodes]);
  const title = useMemo(() => null, []);

  // 最新一帧的数据放在 ref 里 —— 应答 iframe 的调用时需要同步读到它，
  // 而事件监听器只挂一次，闭包捕获不到后续的新值。
  const latest = useRef({ record, nodes, sessionId: props.sessionId, title });
  latest.current = { record, nodes, sessionId: props.sessionId, title };

  /** 往 iframe 推一条消息。iframe 还没加载完时静默丢弃。 */
  const push = (event: string, payload: unknown) => {
    const win = frameRef.current?.contentWindow;
    if (win === null || win === undefined) return;
    win.postMessage({ __herta: true, kind: "event", event, payload }, window.location.origin);
  };

  // 数据变了就整份推送（她的 store 走 replace 路径）。
  useEffect(() => {
    const { record: r, nodes: n, sessionId, title: t } = latest.current;
    if (r.length === 0 && n.length === 0) {
      // 空会话：推「没有会话」，让渲染层走它自己的未连接分支而不是空转。
      push("reset", { noSession: true });
      return;
    }
    push("reset", fullSnapshot(sessionId, r));
    const mark = globalThis.__DSH_HERTA__;
    if (mark !== undefined) {
      mark.fullViewPushed = (mark.fullViewPushed ?? 0) + 1;
      mark.fullViewBlocks = r.length;
    }
  }, [record, nodes, props.sessionId]);

  // 离线模型状态：**父窗口主动推一次**。
  // iframe 那边的 `onVoiceModel` 本来只登记本地监听，订阅时才补一个 call 过来；
  // 而那台设置面板是先 `getRealtimeVoice()` 再订阅 —— 父窗口不主动推的话，
  // 首次读到的 `model.unpackedBytes` 是 0，面板就显示「约 0 MB」而不是真实体积。
  useEffect(() => {
    let alive = true;
    void refreshVoiceModel().then((s) => {
      if (!alive) return;
      push("voiceModel", s);
      const mark = globalThis.__DSH_HERTA__;
      if (mark !== undefined) {
        mark.voiceModelPushed = true;
        mark.voiceModelPhase = (s as { phase?: string } | null)?.phase ?? null;
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // 应答 iframe 的调用。
  useEffect(() => {
    const reply = (id: number, value: unknown) =>
      frameRef.current?.contentWindow?.postMessage(
        { __herta: true, kind: "reply", id, value },
        window.location.origin,
      );
    const fail = (id: number, error: string) =>
      frameRef.current?.contentWindow?.postMessage(
        { __herta: true, kind: "reply", id, error },
        window.location.origin,
      );

    const onMessage = (event: MessageEvent) => {
      const msg = event.data as {
        __herta?: boolean;
        kind?: string;
        id?: number;
        method?: string;
        params?: unknown;
      };
      if (msg === null || typeof msg !== "object" || msg.__herta !== true) return;

      if (msg.kind === "hello") {
        const { record: r, nodes: n, sessionId, title: t } = latest.current;
        push("reset", r.length === 0 && n.length === 0 ? { noSession: true } : fullSnapshot(sessionId, r));
        const mark = globalThis.__DSH_HERTA__;
        if (mark !== undefined) mark.fullViewBooted = true;
        return;
      }
      if (msg.kind !== "call" || typeof msg.id !== "number") return;

      switch (msg.method) {
        // ── 设置（全部读写同一个设置命名空间）────────────────────────────
        //
        // **以前这几个是坏的**：`getLocale` / `getCloseToTray` / `getDreamConfig`
        // 返回硬编码常量，三个 setter 根本没进 switch（落到 default 的
        // 「还没有实现」分支）。也就是她的设置面板能点、点了不报错、值却永远不变 ——
        // 典型假绿。现在统一读写 `ctx.configForms.get("herta")`，
        // 与 DSH 设置页里的「黑塔」一页是同一份值、同一条写入路径。
        //
        // ## 为什么她的设置页删了，这里的分支还留着
        //
        // 删掉 `Herta-src` 那套 `components/Settings/*` 之后，`getDreamConfig` /
        // `getCloseToTray` / `getAutoUpdate` / `getBackendConfig` / `getModelConfig`
        // / `getInteractionLanguage` / `getRealtimeVoice` / `getVoiceEngine` 与
        // 各自的 setter **在渲染层里已经没有调用方**了。它们留在这里有两个理由：
        //   · `HertaBridge` 契约把这些成员声明为**必填**（`bridge-types.ts:617-672`），
        //     少一个就是类型错，而它是上游文件 —— 我们不改它的形状；
        //   · 这些正是「暂未接线」那组字段的接线点：将来把消费方接回来时，
        //     落地处就是这些分支，不是别处。
        // 字段表里对应项的 `wired: false` + `note` 记的才是事实，别把「有分支」
        // 误读成「有人调」。
        case "getLocale": {
          // bridge 的 `getLocale` 要一个真语言（`"zh" | "en"`），而设置里的
          // `locale` 允许空串 = 跟随系统。空串在这里按系统语言解析。
          const locale = machineValues().locale;
          if (typeof locale === "string" && locale !== "") return reply(msg.id, locale);
          return reply(msg.id, navigator.language?.startsWith("zh") === true ? "zh" : "en");
        }
        case "setLocale": {
          const next = (msg.params as { locale?: unknown } | undefined)?.locale;
          if (next === "zh" || next === "en") void writeMachineField("locale", next);
          return reply(msg.id, undefined);
        }
        case "getTheme":
          return reply(msg.id, currentDshTheme());
        case "getCloseToTray":
          return reply(msg.id, machineValues().closeToTray);
        case "setCloseToTray": {
          const next = (msg.params as { enabled?: unknown } | undefined)?.enabled;
          if (typeof next === "boolean") void writeMachineField("closeToTray", next);
          return reply(msg.id, undefined);
        }
        case "getDreamConfig":
          return reply(msg.id, { enabled: machineValues().dreamEnabled });
        case "setDreamConfig": {
          const next = (msg.params as { cfg?: { enabled?: unknown } } | undefined)?.cfg?.enabled;
          if (typeof next === "boolean") void writeMachineField("dreamEnabled", next);
          return reply(msg.id, undefined);
        }
        case "getDeepSeekKeyStatus": {
          // **真值，不是常量。** 上一版这里硬返回 `{set:true}`：她的界面会显示
          // 「密钥已设置」，而 DSH 到底有没有那把钥匙谁也不知道。现在读的是
          // DSH 自己的凭据缝 —— ref 与官方模型页用的是同一个
          // （`dsh-llm-deepseek-api-key` 的 `apiKeyEnv` 默认 `DEEPSEEK_API_KEY`）。
          // 拿不到凭据服务时如实报未设置，而不是猜「已设置」。
          void credentialStatus("DEEPSEEK_API_KEY").then((status) => {
            reply(msg.id, {
              set: status?.configured === true,
              hint: status === undefined ? null : "DSH 的模型配置",
              encrypted: true,
            });
          });
          return;
        }
        case "listSessions":
          // 整机视图目前只服务「当前这一个 DSH 会话」，所以她自己的会话列表是空的。
          return reply(msg.id, []);
        case "maybePlayEasterEgg":
          return reply(msg.id, undefined);
        // ── 语音（VoiceSettings 的 12 个应答器，见 Herta-语音模块-交接.md §2.2）──
        // 上游 bridge 契约里这些方法原本全部缺失，整块静默失败（能选但不生效）。
        //
        // **引擎与开关现在是真的**：来自 DSH 设置命名空间 `herta` 的两个字段
        // （`voiceEngine` / `realtimeVoice`），也就是 DSH 设置页里「黑塔」那一页
        // 改的是同一份值。写入落进 profile 的 `cordis.patch.yml`，并由宿主侧
        // 同步进整机自己的 `settings.json`。
        //
        // 其余字段是**宿主事实**（模型在不在、密钥设没设）。三个引擎现在都还没
        // 接线（第三步离线引擎、第四步触发点），所以如实报告「不可用」——
        // 这修掉了上一版硬编码 `bundle: true, runtime: true` 的假绿：
        // 那会让设置面板把离线引擎显示成「已就绪」，而 DSH 一个音都合成不出来。
        case "getRealtimeVoice":
          return reply(
            msg.id,
            buildRealtimeVoiceState(
              normalizeVoiceSettings(voiceScope.getSnapshot().value),
              // 宿主事实：离线模型的真实阶段与进度（runtime 仍如实报 false）。
              voiceModelFacts(),
            ),
          );
        case "setRealtimeVoice": {
          const next = (msg.params as { next?: unknown } | undefined)?.next;
          if (typeof next === "boolean") void voiceScope.set("realtimeVoice", next);
          return reply(msg.id, undefined);
        }
        case "getVoiceEngine":
          return reply(msg.id, normalizeVoiceSettings(voiceScope.getSnapshot().value).engine);
        case "setVoiceEngine": {
          const engine = (msg.params as { engine?: unknown } | undefined)?.engine;
          if (isVoiceEngine(engine)) void voiceScope.set("engine", engine);
          return reply(msg.id, undefined);
        }
        case "downloadVoiceModel":
          // 真实的离线模型下载（ADR 0061）：宿主 `/herta-voice-model` 点火即返回，
          // 进度靠 `voiceModelFacts()` 轮询回给 `getRealtimeVoice` 与 `voiceModel` 事件。
          // 成功后宿主把模型装到 `$DSH_HOME/tts/herta-best-e72`。
          void postVoiceModel("download").then((s) => reply(msg.id, s));
          return;
        case "onVoiceModel": {
          // 整机那边的 bridge 用 `on("voiceModel", cb)` 本地订阅，父窗口这里
          // 只负责「开始推」：先补一条当前状态，之后每次变化都推。
          const sub = (state: unknown) => push("voiceModel", state);
          voiceModelSubs.add(sub);
          void refreshVoiceModel().then(() => push("voiceModel", voiceModelState));
          return reply(msg.id, undefined);
        }
        case "getVoicePrefs": {
          // 静音与音量原来住在渲染层 localStorage（`herta.voice.muted` /
          // `herta.voice.volume`），DSH 侧没有任何通道能读写它们。现在它们是
          // 设置字段表的两个真字段，经这里下发；整机那边由
          // `voice-prefs.ts` 的 `hydrateVoicePrefs` 接住。
          // bridge 契约用 0–1（与 HTMLAudioElement / WebAudio 同一单位），
          // 设置字段用 0–100 —— 换算只在这一处。
          const volume = Number(machineField("voiceVolume"));
          return reply(msg.id, {
            muted: machineField("voiceMuted") === true,
            volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume / 100)) : 1,
          });
        }
        case "setVoiceMuted": {
          const next = (msg.params as { muted?: unknown } | undefined)?.muted;
          if (typeof next === "boolean") void writeMachineField("voiceMuted", next);
          return reply(msg.id, undefined);
        }
        case "setVoiceVolume": {
          const next = (msg.params as { volume?: unknown } | undefined)?.volume;
          if (typeof next === "number" && Number.isFinite(next)) {
            const percent = Math.round(Math.min(1, Math.max(0, next)) * 100);
            void writeMachineField("voiceVolume", percent);
          }
          return reply(msg.id, undefined);
        }
        case "prepareMiniMaxVoice":
          return reply(msg.id, { phase: "absent" });
        case "onMiniMaxVoice":
          return reply(msg.id, undefined);
        case "clearMiniMaxKey": {
          // 真删。上一版固定回 `{ok:true}` 而不真删 —— 界面显示「已清除」，
          // 磁盘上的密钥还在，是那种最坏的假绿。
          void clearCredential("MINIMAX_API_KEY").then((failure) => {
            reply(msg.id, {
              ok: failure === null,
              status: { set: false, hint: failure, encrypted: true },
            });
          });
          return;
        }
        case "setMiniMaxKey": {
          // 真存。密钥进 DSH 的凭据存储，**不进** profile 的明文配置。
          const value = (msg.params as { key?: unknown } | undefined)?.key;
          if (typeof value !== "string" || value.trim().length === 0) {
            return reply(msg.id, { ok: false, reason: "empty" });
          }
          void saveCredential("MINIMAX_API_KEY", value.trim()).then((failure) => {
            reply(
              msg.id,
              failure === null
                ? { ok: true, status: { set: true, hint: "DSH 凭据存储", encrypted: true } }
                : { ok: false, reason: failure },
            );
          });
          return;
        }
        case "cancelVoiceModelDownload":
          // 以前这里是个空实现 —— 点了取消什么都没发生。
          void postVoiceModel("cancel").then(() => reply(msg.id, undefined));
          return;
        case "removeVoiceModel":
          void postVoiceModel("remove").then((s) => reply(msg.id, s));
          return;
        default:
          return fail(msg.id, `整机视图还没有实现 ${String(msg.method)}`);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      // 整机视图卸载：订阅者与轮询都该停 —— 否则每挂一次就多留一个定时器。
      voiceModelSubs.clear();
      if (voiceModelTimer !== null) {
        clearInterval(voiceModelTimer);
        voiceModelTimer = null;
      }
    };
  }, []);

  return createElement("iframe", {
    // 回调 ref 而不是 `ref={frameRef}`：挂载/卸载的那一刻就把这份 iframe
    // 登记成 MiniMax PCM 的语音出口（卸载时自动退回父窗口那条路）。
    // 用 `useEffect` 做不到这一点 —— 它读到的 `frameRef.current` 在首次渲染时
    // 还是 null。
    ref: (node: HTMLIFrameElement | null) => {
      frameRef.current = node;
      registerVoiceSink(node);
    },
    "data-dsh-herta-view": "full",
    src: "/herta-ui/",
    title: "黑塔 · 整机",
    style: {
      width: "100%",
      // 槽位不一定给出确定高度，所以两个都给：父容器有高度就用 100%，
      // 没有就退到视口高度减掉顶栏/输入区的估值。
      height: "100%",
      minHeight: "70vh",
      border: "0",
      display: "block",
    },
  });
}

// ── 设置页：「黑塔」（`settings.section` 的独立一页）──────────────────────────
//
// 为什么是独立一页而不是靠 schema 自动生成：
//   · 这一页有 14 项、分四组，自动表单一长条读不动；
//   · 枚举项（语言、主题、引擎、模型）要的是分段选择器，不是文本框；
//   · 「工作区」那组还要说明「留空 = 不同步」，那是文案不是 schema 能表达的。
// 宿主侧因此声明了 `configure({auto:false})`（与所有官方自带页插件一致），
// 免得将来某个客户端按 schema 生成页时多出一页。
//
// 页面**不自持状态**：值全部来自 `ctx.configForms.get("herta")` 的快照，
// 写入直接 `form.set(field, value)`（它自己带 revision 栅栏、串行化、失败重读）。
// 乐观更新是没必要的 —— 宿主接受后镜像会自己推进一帧。

// 分组表、枚举中文、行内提示、引擎行逐档文案**都在字段描述符里**
// （`src/host/settings-schema.js`），本文件 2026-10-03 之前那六张平行表
// （`ENUM_LABELS` / `FIELD_HINTS` / `ENGINE_NOTES|BADGES|SUMMARY|FACTS`）已删除。
// 教训：`voiceEngine` / `realtimeVoice` 被标成 `wired: true` 之后从「暂未接线」组
// 掉出去、又没人加进分组表 —— 两个字段在页面上**一行都不渲染**；`theme` /
// `deviceScene` 摘出分组时两边名单不同步，**渲染了两遍**。现在一处声明。

/**
 * 「暂未接线」那一组的说明。逐行的原因写在字段表的 `note` 里 ——
 * 那是「谁该读它、现在缺什么」的备忘，不是免责声明。
 */
const UNWIRED_HINT =
  "下面这些项在 DSH 里改得动、写得进，但**整机当前不会调用它们**：它们原本只被她自己的设置页读写，或者只被「写回她自己的 settings.json」这条已删除的链路消费。逐行的原因见每一项下面那行小字。";

/**
 * 要进 DSH 凭据存储的三个密钥。
 *
 * 值本身**不进** Config —— profile 的 `cordis.patch.yml` 是明文 YAML，
 * 密钥写进去等于公开。它们走 DSH 的凭据缝（`ctx.remote.credentials`），
 * 落在 `$DSH_HOME/.credentials.yaml`（0600，file 层，可写）。
 *
 * `ref` 是 POSIX 环境变量名：DSH 的凭据按这个名字索引，宿主代码也按它取值
 * （`src/host/mimo-tts.js` 读的就是 `MIMO_API_KEY`）。
 */
const CREDENTIALS = [
  {
    ref: "MIMO_API_KEY",
    label: "MiMo 密钥",
    hint: "MiMo 语音合成用。它写进 DSH 凭据存储；宿主侧的 MiMo 合成器目前还没有接线（它只读环境变量），所以现在填了也不会有人读 —— 但那个合成器目前还没有调用点，所以存下来暂时不会发声（见「语音引擎」那一行）。",
    placeholder: "MiMo 控制台里的密钥",
  },
  {
    ref: "MINIMAX_API_KEY",
    label: "MiniMax 密钥",
    hint: "MiniMax 云端语音用。宿主侧会读它去认领你已有的克隆（只认领、不克隆），没填就用不了云端引擎。",
    placeholder: "sk-api-…",
  },
  {
    ref: "MINIMAX_PLAN_API_KEY",
    label: "MiniMax 套餐密钥",
    hint: "MiniMax Token 套餐（`sk-cp-…`）。同样被宿主读取；两把都填时合成优先用套餐密钥。",
    placeholder: "sk-cp-…",
  },
  {
    ref: "FISH_API_KEY",
    label: "Fish 密钥",
    hint: "Fish Audio 云端语音用（「语音引擎」选 Fish 时才读）。填在这里**优先**于 `C:\\herta-ai\\fish_key.txt` —— 那份明文只是没填这里的兜底。",
    placeholder: "Fish Audio 控制台里的 API Key",
  },
];

/**
 * 「打开网盘」的目标。
 *
 * 抄自 `Herta-src/packages/gui/src/shared/links.ts` 的 `NETDISK_URL` ——
 * 客户端 bundle 不能 import 上游源码，所以这里是**第三份**副本（另两份是
 * 那个常量本身与官网下载页）。它几乎不会变；真变了改三处。
 */
const NETDISK_URL = "https://pan.baidu.com/s/1k-47zy6TTDWl0OaT2WCFUg?pwd=y195";

/**
 * 引擎那一行的逐档文案。**住在字段描述符里**（`FIELDS.voiceEngine.engine`），
 * 这里只是取出来给下面几处用 —— 2026-10-03 之前它是本文件里的四张
 * `ENGINE_NOTES|BADGES|SUMMARY|FACTS` 平行表。
 *
 * 结构（为什么不是段落）：原来 84 字的说明堆在卡片左列折成 4~6 行 ——
 * `badges` 短标签一行扫完、`summary` 一句不超行、`facts` 展开后整宽三列。
 * 文案要短：`fish` 第一版 84 字是当时最长的一条，那正是那段 UI 变难看的直接原因。
 */
const ENGINE_META = (
  FIELDS.voiceEngine as {
    engine: {
      notes: Record<string, string>;
      badges: Record<string, readonly string[]>;
      summary: Record<string, string>;
      facts: Record<string, readonly (readonly [string, string])[]>;
    };
  }
).engine;

/** 引擎值 → 中文档位名（缺了就原样显示，与 `EnumControl` 同口径）。 */
function engineLabel(engine: unknown): string {
  const value = typeof engine === "string" ? engine : "";
  const labels = (FIELDS.voiceEngine.enumLabels ?? {}) as Record<string, string>;
  return labels[value] ?? value;
}

/** 选择器要用的空数组常量：引用必须稳定，否则 useSyncExternalStore 会自激。 */
const EMPTY_WORKSPACES = Object.freeze([]);

const SECTION_STYLE = { display: "grid", gap: 28, padding: "4px 2px 32px", maxWidth: 720 };
const GROUP_TITLE_STYLE = {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--dsw-alias-label-secondary)",
  letterSpacing: "0.02em",
};
const ROW_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  padding: "10px 0",
  borderTop: "1px solid var(--dsw-alias-border-l1)",
};
const LABEL_STYLE = { fontSize: 13, color: "var(--dsw-alias-label-primary)", lineHeight: "20px" };
const HINT_STYLE = { marginTop: 3, fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: "17px" };
const NOTE_STYLE = { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: "18px" };
const INPUT_STYLE = {
  width: 300,
  maxWidth: "42vw",
  boxSizing: "border-box",
  padding: "5px 9px",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  outline: "none",
};
const SUGGEST_STYLE = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--dsw-alias-brand-primary)",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};
/** 「暂未接线」的逐行小字。刻意用斜体，好和上面那句「它是什么」分开读。 */
const UNWIRED_NOTE_STYLE = {
  marginTop: 4,
  fontSize: 12,
  color: "var(--dsw-alias-label-secondary)",
  lineHeight: "17px",
  fontStyle: "italic",
};
/** 密钥状态的徽标。 */
const BADGE_STYLE = {
  marginLeft: 8,
  padding: "1px 6px",
  fontSize: 11,
  fontWeight: 400,
  color: "var(--dsw-alias-label-secondary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l1)",
  borderRadius: 4,
};
/** 次要按钮：密钥的存/清、模型动作、打开网盘。 */
const ACTION_BUTTON_STYLE = {
  padding: "4px 10px",
  fontSize: 12,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  cursor: "pointer",
};

/**
 * 运行时从模块加载器取一个种子模块。
 *
 * ## 为什么不用 `import()`
 *
 * 客户端 bundle 被包成 `__ModuleLoader__.load({ factory: (require) => … })`：
 * 外壳**冻结的模块表只通过工厂参数 `require` 暴露**。esbuild 会把**外部**模块的
 * 动态 `import()` 原样保留（实测产物里就是 `import("@deepseek-ai/…")`），
 * 于是浏览器自己拿原生解析器去解析 —— 那里没有这张表，报
 * `Failed to resolve module specifier '@deepseek-ai/dsh-client-ui-primitives'`。
 *
 * ## 为什么也不直接静态 import
 *
 * 静态 import 会正确变成 `require("…")`（见产物里 `require("react")`），
 * 但它发生在**求值期**：模块不在表里就让整份 bundle 失败 —— 连她的两个对话
 * 页签一起没了。所以这里用**变量 specifier** 调一次运行时的 `require`：
 * 落到工厂参数上（正确通道），又不被构建期解析，于是失败能被 caller 的 try 关住。
 *
 * @param id - 包名。
 * @returns 该模块的命名空间；调用方自己核对要用到的导出。
 */
function loadSeedModule(id: string): any {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- 工厂参数，不是全局 require
  return require(id);
}

/**
 * 造「黑塔」设置页组件。
 *
 * @param ui - 模块加载器给的 `@deepseek-ai/dsh-client-ui-primitives`。
 * @returns 组件。
 */
function createSettingsSection(ui: unknown) {
  const { Switch, SegmentedControl } = ui as { Switch: any; SegmentedControl: any };

  /** 一行：左标签 + 说明（+ 可选的「暂未接线」小字），右控件。 */
  function Row(props: { label: string; hint?: string; note?: string; control: unknown }): unknown {
    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, props.label),
        props.hint === undefined ? null : createElement("div", { style: HINT_STYLE }, props.hint),
        // 「暂未接线」的逐行标注。文案来自字段表的 `note`，页面只负责摆位置。
        props.note === undefined ? null : createElement("div", { style: UNWIRED_NOTE_STYLE }, props.note),
      ),
      createElement("div", { style: { flex: "0 0 auto", paddingTop: 1 } }, props.control),
    );
  }

  /** 分段选择器；取值域直接来自字段表，所以加一项不用改这里。 */
  function EnumControl(props: { field: string; value: unknown; disabled?: boolean; onChange: (next: string) => void }): unknown {
    const spec = FIELDS[props.field];
    const labels = (spec.enumLabels ?? {}) as Record<string, string>;
    const options = (spec.values as readonly string[]).map((value) => ({
      value,
      label: labels[value] ?? value,
    }));
    return createElement(SegmentedControl, {
      id: `herta-setting-${props.field}`,
      value: typeof props.value === "string" ? props.value : spec.def,
      options,
      label: spec.label,
      disabled: props.disabled === true,
      onChange: props.onChange,
    });
  }

  /** 数值项（目前只有音量）：滑杆 + 读数。范围与步长来自字段表。 */
  function NumberControl(props: {
    field: string;
    value: unknown;
    disabled?: boolean;
    onChange: (next: number) => void;
  }): unknown {
    const spec = FIELDS[props.field];
    const current = typeof props.value === "number" ? props.value : (spec.def as number);
    return createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 10 } },
      createElement("input", {
        type: "range",
        min: spec.min,
        max: spec.max,
        step: spec.step,
        value: current,
        disabled: props.disabled === true,
        "aria-label": spec.label,
        style: { width: 180 },
        onChange: (event: { target: { value: string } }) => props.onChange(Number(event.target.value)),
      }),
      createElement(
        "span",
        {
          style: {
            fontSize: 12,
            color: "var(--dsw-alias-label-secondary)",
            minWidth: 30,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          },
        },
        String(current),
      ),
    );
  }

  /**
   * 一行密钥：状态徽标 + 密码框 + 存/清。
   *
   * 值的去处是 DSH 的凭据缝（`$DSH_HOME/.credentials.yaml`），**不是** Config ——
   * 理由见 `CredentialsRemote` 的注释。所以这一行不读写 `machineForm`，
   * 也不参与 `normalizeSettings`。
   */
  function CredentialRow(props: {
    spec: { ref: string; label: string; hint: string; placeholder: string };
  }): unknown {
    type Status =
      | { kind: "loading" }
      | { kind: "unavailable" }
      | { kind: "ok"; configured: boolean; writable: boolean };
    const [status, setStatus] = useState<Status>({ kind: "loading" });
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reprobe = useCallback((): void => {
      void credentialStatus(props.spec.ref).then((next) => {
        setStatus(next === undefined ? { kind: "unavailable" } : { kind: "ok", ...next });
      });
    }, [props.spec.ref]);

    useEffect(() => {
      // 挂载先查一次；凭据缝若是稍后才挂上来的（见 `installSettingsSection`），
      // 那一次查询会白跑，所以再订阅一次「它到了」。
      const unsubscribe = subscribeCredentials(reprobe);
      reprobe();
      return unsubscribe;
    }, [reprobe]);

    const save = (): void => {
      const value = draft.trim();
      if (value.length === 0 || busy) return;
      setBusy(true);
      setError(null);
      void saveCredential(props.spec.ref, value).then((failure) => {
        setBusy(false);
        if (failure !== null) {
          setError(failure);
          return;
        }
        setDraft("");
        reprobe();
      });
    };

    const clear = (): void => {
      if (busy) return;
      setBusy(true);
      setError(null);
      void clearCredential(props.spec.ref).then((failure) => {
        setBusy(false);
        if (failure !== null) {
          setError(failure);
          return;
        }
        reprobe();
      });
    };

    const badgeText =
      status.kind === "loading"
        ? "读取中…"
        : status.kind === "unavailable"
          ? "凭据服务不可用"
          : status.configured
            ? "已配置"
            : "未配置";
    const canWrite = status.kind === "ok" && status.writable && !busy;

    return createElement(
      "div",
      { style: ROW_STYLE, key: props.spec.ref },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement(
          "div",
          { style: LABEL_STYLE },
          props.spec.label,
          createElement("span", { style: BADGE_STYLE }, badgeText),
        ),
        createElement("div", { style: HINT_STYLE }, props.spec.hint),
        createElement("div", { style: HINT_STYLE }, `存放位置：DSH 凭据存储（ref = ${props.spec.ref}）`),
        error === null ? null : createElement("div", { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-error, #c0392b)" } }, error),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", display: "grid", gap: 6, justifyItems: "end" } },
        createElement("input", {
          type: "password",
          value: draft,
          disabled: busy || status.kind === "unavailable",
          spellCheck: false,
          autoComplete: "off",
          placeholder: status.kind === "ok" && status.configured ? "已存（填入即覆盖）" : props.spec.placeholder,
          "aria-label": props.spec.label,
          style: { ...INPUT_STYLE, width: 220 },
          onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
          onKeyDown: (event: { key: string }) => {
            if (event.key === "Enter") save();
          },
        }),
        createElement(
          "div",
          { style: { display: "flex", gap: 8 } },
          createElement(
            "button",
            {
              type: "button",
              style: ACTION_BUTTON_STYLE,
              disabled: draft.trim().length === 0 || !canWrite,
              onClick: save,
            },
            busy ? "处理中…" : "保存",
          ),
          createElement(
            "button",
            {
              type: "button",
              style: ACTION_BUTTON_STYLE,
              disabled: !canWrite || status.kind !== "ok" || !status.configured,
              onClick: clear,
            },
            "清除",
          ),
        ),
      ),
    );
  }

  /**
   * 本地语音模型的下载/删除。
   *
   * 这是**真动作**：宿主侧 `/herta-voice-model`（`src/host/voice-model-route.js`
   * + `voice-model.js`）真的会去上游地址取归档、解到 `$DSH_HOME/tts/`。
   * 状态与进度靠轮询（下载中才开定时器），复用 iframe 那侧同一套镜像。
   */
  function VoiceModelRow(): unknown {
    const [state, setState] = useState<Record<string, unknown> | null>(voiceModelState);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      const sub = (next: unknown): void => {
        setState((next as Record<string, unknown> | null) ?? null);
      };
      voiceModelSubs.add(sub);
      // 挂载就先问一次宿主，别让首屏停在「未知」。
      void refreshVoiceModel().then(() => setState(voiceModelState));
      return () => {
        voiceModelSubs.delete(sub);
      };
    }, []);

    const phase = typeof state?.phase === "string" ? state.phase : "absent";
    const phaseText =
      phase === "ready"
        ? "已安装"
        : phase === "downloading"
          ? "下载中…"
          : phase === "failed"
            ? `上次失败（原因：${String(state?.error ?? "未知")}）`
            : "未安装";
    const received = typeof state?.receivedBytes === "number" ? (state.receivedBytes as number) : 0;
    const total = typeof state?.totalBytes === "number" ? (state.totalBytes as number) : 0;
    const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
    const runtimeReady = (state?.runtime as { available?: boolean } | undefined)?.available === true;

    const act = (action: string): void => {
      if (busy) return;
      setBusy(true);
      void postVoiceModel(action).then(() => {
        setBusy(false);
        setState(voiceModelState);
      });
    };

    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, "本地语音模型"),
        createElement(
          "div",
          { style: HINT_STYLE },
          `离线 TTS 的模型归档。状态：${phaseText}${phase === "downloading" ? `（${percent}%，${Math.round(received / 1048576)} / ${Math.round(total / 1048576)} MB）` : ""}`,
        ),
        createElement(
          "div",
          { style: HINT_STYLE },
          runtimeReady
            ? "运行时已就绪（宿主真的加载过 addon 并探测通过）。"
            : "运行时**未就绪** —— 宿主探测 addon 没成功，所以现在合成不出声音。这不是按钮的问题，是运行时还没装好。",
        ),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", display: "flex", gap: 8, paddingTop: 1 } },
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase === "downloading" || phase === "ready",
            onClick: () => act("download"),
          },
          "下载",
        ),
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase !== "downloading",
            onClick: () => act("cancel"),
          },
          "取消",
        ),
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase === "absent" || phase === "downloading",
            onClick: () => act("remove"),
          },
          "删除",
        ),
      ),
    );
  }

  /**
   * 「语音引擎」那一行 —— 分段控件 + 试听 + 逐档现状 + 本地就绪。
   *
   * ## 为什么不走通用的 `Row` + `fieldRow`
   *
   * 这一行要多三样**不是字段**的东西：
   *   ① 逐档「现在到底会不会出声、要付什么代价」的一句说明（`FIELDS.voiceEngine.engine.notes`）；
   *   ② 本地模型 / 运行时的**真探测**结果 —— 同一份 `/herta-voice-model` 镜像，
   *      与「整机动作 › 本地语音模型」那行共用（不另开一次 HTTP）；
   *   ③ 试听按钮与它的结果。
   *
   * 静音提示也挂在这里：试听走的是浏览器播放路径，而那条路有静音闸门
   * （`machineField("voiceMuted")` 为真就 return）。不提示的话，按下去就是
   * "没反应" —— 用户分不清"静音"和"坏了"，所以这里同时给一个一键取消静音。
   */
  function VoiceEngineRow(props: {
    value: unknown;
    disabled?: boolean;
    muted: boolean;
    setField: (field: string, value: unknown) => void;
  }): unknown {
    const [model, setModel] = useState<Record<string, unknown> | null>(voiceModelState);
    const [mini, setMini] = useState<Record<string, unknown> | null>(miniMaxState);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    /** 「详情」展开与否。默认收起 —— 这一行的高度不该由最长的那段文案决定。 */
    const [detailOpen, setDetailOpen] = useState(false);

    useEffect(() => {
      const sub = (next: unknown): void => {
        setModel((next as Record<string, unknown> | null) ?? null);
      };
      voiceModelSubs.add(sub);
      // 挂载就先问一次宿主，别让首屏停在「未知」。
      void refreshVoiceModel().then(() => setModel(voiceModelState));
      return () => {
        voiceModelSubs.delete(sub);
      };
    }, []);

    // 常驻合成进程的状态来自宿主快照（与「MiniMax 语音」那一行是同一份，订阅按引用计数
    // 共用一条 5 秒轮询，不会开出第二条定时器）。
    useEffect(() => subscribeMiniMax(setMini), []);

    const engine = typeof props.value === "string" ? props.value : String(FIELDS.voiceEngine.def);
    const phase = typeof model?.phase === "string" ? model.phase : "absent";
    const phaseText =
      phase === "ready"
        ? "已就绪（herta-best-e72）"
        : phase === "downloading"
          ? "下载中…"
          : phase === "failed"
            ? "上次安装失败"
            : "未下载";
    const runtimeReady = (model?.runtime as { available?: boolean } | undefined)?.available === true;
    const workerState = (mini?.localWorker as { state?: unknown } | undefined)?.state;
    const workerText =
      workerState === "running"
        ? "已预热"
        : workerState === "starting"
          ? "启动中…"
          : "未启动（首次合成就地加载，约 3 秒）";

    /**
     * 换引擎。切到「本地模型」时顺手把常驻进程热起来 —— 那 ~3 秒的模型加载就落在
     * 用户还在选的这几秒里，而不是落在他第一次真的想听的那一刻。
     *
     * `warm` 是 fire-and-forget：回执会经同一条快照通道回来，上面那行
     * 「合成进程：」自己会从「未启动」变成「启动中…」再到「已预热」。
     */
    const chooseEngine = (next: string): void => {
      props.setField("voiceEngine", next);
      if (next === "local") void postMiniMaxAction("warm");
    };

    const preview = (): void => {
      if (busy) return;
      setBusy(true);
      setResult(null);
      // 复用 `POST /herta-minimax-state {action:"preview"}`：宿主拿固定台词走一遍
      // **当前引擎**的合成，PCM 仍从那条 SSE 回来（与她的自动念回复同一条路），
      // 所以这里不自己造第二条播放通道。
      void postMiniMaxAction("preview").then((next) => {
        setBusy(false);
        const out = (next?.preview ?? null) as { ok?: unknown; engine?: unknown; note?: unknown } | null;
        if (out === null) {
          setResult("试听没有回执：宿主的语音层可能没挂载（看宿主日志）。");
          return;
        }
        if (out.ok === true) {
          setResult(`试听已经推给界面（用 ${engineLabel(out.engine ?? engine)}）。`);
          return;
        }
        setResult(
          `试听没有出声：${typeof out.note === "string" && out.note !== "" ? out.note : "原因未知（看宿主日志）"}`,
        );
      });
    };

    /**
     * 一行里的窄元素：小标签（徽章）。
     *
     * 用 `inline-block` + 圆角，视觉上跟按钮区分开（按钮有边框，徽章只有底色）。
     */
    const badge = (text: string, i: number): unknown =>
      createElement(
        "span",
        {
          key: `b${i}`,
          style: {
            display: "inline-block",
            padding: "1px 8px",
            borderRadius: 9,
            fontSize: 11,
            lineHeight: "17px",
            background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.14))",
            color: "var(--dsw-alias-label-secondary)",
            whiteSpace: "nowrap",
          },
        },
        text,
      );

    /** 展开后的「标签 / 值」小格。整宽三列 —— 不是横贯的长句。 */
    const facts = [
      ...(ENGINE_META.facts[engine] ?? []),
      // 本机事实：两个云端档也会回落本地，所以这几项对它们同样有用。
      ["本地模型", phaseText] as [string, string],
      ["运行时", runtimeReady ? "可用" : "缺失"] as [string, string],
      ["合成进程", workerText] as [string, string],
    ];

    const factGrid = createElement(
      "div",
      {
        style: {
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          columnGap: 16,
          rowGap: 10,
        },
      },
      ...facts.map(([k, v], i) =>
        createElement(
          "div",
          { key: `f${i}`, style: { minWidth: 0 } },
          createElement(
            "div",
            { style: { fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-secondary)" } },
            k,
          ),
          createElement(
            "div",
            { style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-primary)", wordBreak: "break-word" } },
            v,
          ),
        ),
      ),
    );

    return createElement(
      "div",
      // 整行改成**纵向三段**，不再「左文字 | 右控件」两列 —— 文字因此拿到整宽，
      // 同样的字数从 6 行降到 1~2 行，右侧控件下方也不会再留空白。
      { style: { display: "block" } },

      // ── ① 标题 + 控件（同一行，垂直居中对齐） ──
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
        createElement(
          "div",
          { style: { ...LABEL_STYLE, flex: "1 1 auto", minWidth: 0 } },
          FIELDS.voiceEngine.label,
        ),
        createElement(EnumControl, {
          field: "voiceEngine",
          value: props.value,
          disabled: props.disabled === true,
          onChange: chooseEngine,
        }),
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || props.disabled === true,
            onClick: preview,
          },
          busy ? "试听中…" : "试听",
        ),
        props.muted
          ? createElement(
              "button",
              {
                type: "button",
                style: ACTION_BUTTON_STYLE,
                disabled: props.disabled === true,
                onClick: () => props.setField("voiceMuted", false),
              },
              "取消静音",
            )
          : null,
      ),

      // ── ② 徽章摘要 + 「详情」开关（整宽一行） ──
      createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--dsw-alias-border-l)",
          },
        },
        ...(ENGINE_META.badges[engine] ?? []).map(badge),
        createElement(
          "span",
          { style: { ...HINT_STYLE, marginTop: 0, flex: "1 1 auto", minWidth: 0 } },
          ENGINE_META.summary[engine] ?? "",
        ),
        createElement(
          "button",
          {
            type: "button",
            style: {
              ...ACTION_BUTTON_STYLE,
              padding: "2px 8px",
              fontSize: 12,
            },
            onClick: () => setDetailOpen((v: boolean) => !v),
          },
          detailOpen ? "收起详情" : "详情",
        ),
      ),

      // ── ③ 展开后的事实网格 ──
      detailOpen ? factGrid : null,

      props.muted
        ? createElement(
            "div",
            { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-warning, #b7791f)" } },
            "当前是静音，试听不会出声。",
          )
        : null,
      result === null ? null : createElement("div", { style: HINT_STYLE }, result),
    );
  }

  /**
   * MiniMax 语音的**认领状态 + 重新认领**。
   *
   * 「设置页黑塔 → 语音那一栏」的这一行，与上面那个「本地语音模型」是两条不同的
   * 链路：那个是离线模型归档，这个是云端克隆音色的认领状态。值的来源是
   * `/herta-minimax-state`，与 SSE 的 `state` 帧是**同一份**宿主快照。
   *
   * ## 为什么一行里要显示这么多东西
   *
   * 「她怎么没声了」有六种完全不同的原因（没密钥 / 认领失败 / 额度用完 / 在冷却 /
   * 回落到本地 / 到了每轮上限），而它们在界面上原来长得一模一样 —— 全是「没声音」。
   * 把 `engine`、`engineNote`、`voice.phase`、`lastError`、`retryAt`、
   * `maxTurnChars`、`clients` 一起摆出来，就是为了让每一种原因都能被认出来，
   * 而不是让人去翻日志。
   */
  function MiniMaxVoiceRow(): unknown {
    const [state, setState] = useState<Record<string, unknown> | null>(miniMaxState);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      // 挂上就拉一次 + 开 5 秒轮询；卸载即停（没有订阅者就没有定时器）。
      return subscribeMiniMax(setState);
    }, []);

    const engine = typeof state?.engine === "string" ? state.engine : "未知";
    const engineNote = typeof state?.engineNote === "string" && state.engineNote !== "" ? state.engineNote : null;
    const keyKnown = state?.keyKnown === true;
    const voice = (state?.voice ?? {}) as {
      phase?: unknown;
      voiceId?: unknown;
      host?: unknown;
      clonedAt?: unknown;
      lastError?: unknown;
      retryAt?: unknown;
      /** 这一档累计的计费字符（宿主 readout 带出来的）；取不到就不显示。 */
      billedCharsTotal?: unknown;
    };
    const synth = (state?.synth ?? {}) as { refusal?: unknown; lastFailure?: unknown; inFlight?: unknown };
    const pipeline = (state?.pipeline ?? {}) as {
      cappedUtterances?: unknown;
      utterances?: unknown;
      /** 最近一次撞到每轮上限的记录（`src/host/minimax/pipeline.ts` 的 `lastCap`）。 */
      lastCap?: { spokenChars?: unknown; limit?: unknown } | null;
    };
    const maxTurnChars = typeof state?.maxTurnChars === "number" ? state.maxTurnChars : null;
    const clients = typeof state?.clients === "number" ? state.clients : null;
    const phase = typeof voice.phase === "string" ? voice.phase : "absent";

    const phaseText =
      phase === "ready"
        ? `已认领：${String(voice.voiceId ?? "（没有 id）")} @ ${String(voice.host ?? "未知端点")}`
        : phase === "preparing"
          ? "认领中…"
          : phase === "failed"
            ? `认领失败：${miniMaxErrorText(voice.lastError)}`
            : "还没有认领（或密钥还没填）";
    const retryText = phase === "failed" ? miniMaxRetryText(voice.retryAt) : null;

    const adopt = (): void => {
      if (busy) return;
      setBusy(true);
      // 按钮期间禁用：`adopt` 在宿主那边是「清记录 + 重新认领一次」，会打网络；
      // 连点就是连着重认领，白花钱也白等。
      void postMiniMaxAction("adopt").then((next) => {
        setBusy(false);
        setState(next);
      });
    };

    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, "MiniMax 语音"),
        createElement(
          "div",
          { style: HINT_STYLE },
          `当前引擎：${engineLabel(engine)}` + `　·　密钥：${keyKnown ? "已填" : "未填"}`,
        ),
        // 「语音状态」要显式说 —— 否则用户只会觉得"她的声音变了"，说不出为什么。
        // 措辞必须中性：fish 明确不回落，写成「已回落：Fish Audio 不可用…」会自相矛盾。
        engineNote === null
          ? null
          : createElement(
              "div",
              { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-warning, #b7791f)" } },
              `语音状态：${engineNote}`,
            ),
        createElement("div", { style: HINT_STYLE }, phaseText),
        retryText === null ? null : createElement("div", { style: HINT_STYLE }, `下次可重试：${retryText}`),
        synth.refusal === null || synth.refusal === undefined
          ? null
          : createElement("div", { style: HINT_STYLE }, `MiniMax 拒绝：${miniMaxErrorText(synth.refusal)}`),
        synth.lastFailure === null || synth.lastFailure === undefined
          ? null
          : createElement(
              "div",
              { style: HINT_STYLE },
              `上次合成失败：${miniMaxErrorText(synth.lastFailure)}（在飞 ${String(synth.inFlight ?? 0)}）`,
            ),
        createElement(
          "div",
          { style: HINT_STYLE },
          `每轮上限：${maxTurnChars === null ? "未知" : `${maxTurnChars} 字`}` +
            `　·　已到上限的轮数：${String(pipeline.cappedUtterances ?? 0)}` +
            `　·　SSE 客户端：${clients === null ? "未知" : clients}` +
            (pipeline.lastCap
              ? `　·　⚠️ 上一轮太长：只念了前 ~${String(pipeline.lastCap.spokenChars)} 字（上限 ${String(pipeline.lastCap.limit)} 字），后面的内容只显示、没发声`
              : "") +
            (voice?.billedCharsTotal ? `　·　已计费 ${String(voice.billedCharsTotal)} 字` : ""),
        ),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", paddingTop: 1 } },
        createElement(
          "button",
          { type: "button", style: ACTION_BUTTON_STYLE, disabled: busy, onClick: adopt },
          busy ? "认领中…" : "重新认领",
        ),
      ),
    );
  }

  /** 「打开网盘」—— 一个真链接，不是占位。 */
  function NetdiskRow(): unknown {
    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, "安装包网盘"),
        createElement(
          "div",
          { style: HINT_STYLE },
          "整机安装包的网盘镜像（网络到不了 GitHub 时用）。**不含语音模型**（模型只能从 GitHub 下）。在新标签页里打开。",
        ),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", paddingTop: 1 } },
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            onClick: () => {
              window.open(NETDISK_URL, "_blank", "noopener,noreferrer");
            },
          },
          "打开网盘",
        ),
      ),
    );
  }

  /**
   * 「同步到工作区」的路径输入。
   *
   * 独立组件，好让它成为 `useWorkspaces` 的**唯一调用点**：只有当
   * `settings.section` 真的带了这个标准 prop 时才挂载它，钩子调用次数因此
   * 与渲染次数无关（合规），也不会因为 prop 缺席而炸整页。
   */
  function WorkspacePicker(props: { useWorkspaces: any; onPick: (path: string) => void; disabled?: boolean }): unknown {
    const items = props.useWorkspaces((snapshot: unknown) => (snapshot as { items?: unknown })?.items ?? EMPTY_WORKSPACES);
    if (!Array.isArray(items) || items.length === 0) return null;
    return createElement(
      "div",
      { style: { marginTop: 8, display: "grid", gap: 4 } },
      createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "从 DSH 已登记的工作区里选："),
      ...items
        .filter((item: unknown) => typeof (item as { path?: unknown })?.path === "string")
        .slice(0, 8)
        .map((item: any) =>
          createElement(
            "button",
            {
              key: item.path,
              type: "button",
              style: SUGGEST_STYLE,
              disabled: props.disabled === true,
              onClick: () => props.onPick(item.path),
            },
            `${item.title ?? item.path} — ${item.path}`,
          ),
        ),
    );
  }

  /**
   * 路径 / 文本输入：本地暂存草稿，失焦或回车才写（逐键写会把 profile 补丁刷爆）。
   *
   * `placeholder` 由字段表给（`kind: "text"` 的字段各写各的）；
   * `useWorkspaces` **只在 `kind: "path"` 时传进来** —— 「音色模型 ID」这种
   * 纯文本字段不该看到「从 DSH 已登记的工作区里选」那一块。
   */
  function WorkspaceInput(props: {
    value: string;
    disabled?: boolean;
    onCommit: (next: string) => void;
    placeholder?: string;
    useWorkspaces: any;
  }): unknown {
    const [draft, setDraft] = useState(props.value);
    useEffect(() => {
      // 外部值变了（例如从下面的建议里选了）就同步草稿。
      setDraft(props.value);
    }, [props.value]);
    return createElement(
      "div",
      null,
      createElement("input", {
        type: "text",
        value: draft,
        disabled: props.disabled === true,
        spellCheck: false,
        placeholder: props.placeholder ?? "例如 D:\\项目\\我的仓库",
        style: INPUT_STYLE,
        onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
        onKeyDown: (event: { key: string }) => {
          if (event.key === "Enter") props.onCommit(draft);
        },
        onBlur: () => {
          if (draft !== props.value) props.onCommit(draft);
        },
      }),
      props.useWorkspaces === undefined
        ? null
        : createElement(WorkspacePicker, {
            useWorkspaces: props.useWorkspaces,
            disabled: props.disabled,
            onPick: (path: string) => {
              setDraft(path);
              props.onCommit(path);
            },
          }),
    );
  }

  return function HertaSettingsSection(props: {
    useHertaMachine?: (selector: (snapshot: unknown) => unknown) => unknown;
    setHertaField?: (field: string, value: unknown) => void;
    useWorkspaces?: unknown;
  }): unknown {
    const snapshot = (typeof props.useHertaMachine === "function"
      ? props.useHertaMachine((s: unknown) => s)
      : undefined) as { status?: string; value?: unknown; writable?: boolean } | undefined;
    const values = useMemo(() => normalizeSettings(snapshot?.value), [snapshot]);

    const header = createElement(
      "div",
      null,
      createElement("div", { style: { fontSize: 15, fontWeight: 600, marginBottom: 6 } }, "黑塔"),
      createElement(
        "div",
        { style: NOTE_STYLE },
        "黑塔的设置**只有这一处**。她的整机界面里那套设置面板已经删除，所以这里改的值就是她读到的值。",
      ),
      createElement(
        "div",
        { style: NOTE_STYLE },
        "写入落进 DSH 的 profile 配置（`cordis.patch.yml` 的 `herta` 条目）。密钥是唯一的例外：它们进 DSH 的凭据存储，不进这份明文配置。",
      ),
    );

    if (snapshot?.status !== "ready") {
      const why = snapshot?.status === "unavailable" ? "宿主没有向这个页面提供设置（可能当前部署把设置存在本地）。" : "正在读取设置…";
      return createElement("div", { style: SECTION_STYLE }, header, createElement("div", { style: NOTE_STYLE }, why));
    }

    const disabled = snapshot.writable === false;
    const setField = (field: string, value: unknown) => props.setHertaField?.(field, value);

    /** 一个字段 → 一行。控件类型由字段表的 `kind` 决定，加一项不用改这里。 */
    const fieldRow = (field: string): unknown => {
      const spec = (FIELDS as Record<string, any>)[field];
      const value = (values as Record<string, unknown>)[field];
      // 引擎那一行不是「标签 + 一个控件」：它还有逐档现状、本地就绪、试听。
      // 通用形状装不下 —— 所以由描述符的 `widget` 指名（**不是**按字段名硬编码：
      // 加一个同样形状的字段时，这里一行都不用改）。
      if (spec.widget === "engineRow") {
        return createElement(VoiceEngineRow, {
          key: field,
          value,
          disabled,
          muted: (values as Record<string, unknown>).voiceMuted === true,
          setField,
        });
      }
      let control: unknown;
      if (spec.kind === "boolean") {
        control = createElement(Switch, {
          checked: value === true,
          label: spec.label,
          disabled,
          onChange: (next: boolean) => setField(field, next),
        });
      } else if (spec.kind === "enum") {
        control = createElement(EnumControl, {
          field,
          value,
          disabled,
          onChange: (next: string) => setField(field, next),
        });
      } else if (spec.kind === "number") {
        control = createElement(NumberControl, {
          field,
          value,
          disabled,
          onChange: (next: number) => setField(field, next),
        });
      } else {
        control = createElement(WorkspaceInput, {
          value: typeof value === "string" ? value : "",
          disabled,
          onCommit: (next: string) => setField(field, next),
          // `kind: "text"` 用字段自己的占位符；其余（`path`）保持原样。
          placeholder: typeof spec.placeholder === "string" ? spec.placeholder : undefined,
          // 只有路径字段才给工作区选择器 —— 模型 ID 那一类看了会莫名其妙。
          useWorkspaces: spec.kind === "path" ? props.useWorkspaces : undefined,
        });
      }
      return createElement(Row, {
        key: field,
        label: spec.label,
        hint: spec.hint,
        // 「暂未接线」的逐行原因来自字段表本身（`FIELDS[field].note`）——
        // 页面不抄第二遍，所以字段表改了这里跟着改。
        note: typeof spec.note === "string" ? spec.note : undefined,
        control,
      });
    };

    /** 一个分组：标题 + 可选说明 + 若干行。 */
    const group = (title: string, hint: string | undefined, rows: readonly unknown[]): unknown =>
      createElement(
        "section",
        { key: title },
        createElement("h3", { style: GROUP_TITLE_STYLE }, title),
        hint === undefined
          ? null
          : createElement("div", { style: { ...NOTE_STYLE, marginTop: -6, marginBottom: 6 } }, hint),
        ...rows,
      );

    /**
     * 组尾挂件：声明里的**名字** → 渲染器。
     *
     * 名字是数据（在字段表的 `GROUP_DECLARATION` 里），组件在这里注册 —— 于是
     * 「哪一组末尾挂什么」不需要拿显示文案当逻辑 key（2026-10-03 之前是
     * `entry.title === "语音"`，改个组标题就会静默丢掉那行状态）。
     */
    const GROUP_TRAILERS: Record<string, () => unknown> = {
      "minimax-voice": MiniMaxVoiceRow,
    };

    const wiredGroups = SETTINGS_GROUPS.map((entry) => {
      const trailer = GROUP_TRAILERS[(entry as { trailer?: string }).trailer ?? ""];
      const rows = entry.fields.map(fieldRow);
      return group(
        entry.title,
        (entry as { hint?: string }).hint,
        // 「语音」那一栏末尾多一行宿主事实（认领状态 + 重新认领）。它**不是**设置
        // 字段，所以不来自字段表；挂在组尾是因为它讲的是上面那几行的**后果**
        // （谁在说话、为什么回落、到没到上限）—— 先选，再看状态。
        trailer === undefined ? rows : [...rows, createElement(trailer, { key: (entry as { trailer?: string }).trailer })],
      );
    });

    const credentialsGroup = group(
      "密钥",
      "密钥存进 DSH 的凭据存储（`$DSH_HOME/.credentials.yaml`，权限 0600），不写进 profile 的明文配置。上面那行状态读的是宿主的事实，不是本地的乐观值。",
      CREDENTIALS.map((spec) => createElement(CredentialRow, { key: spec.ref, spec })),
    );

    const actionsGroup = group(
      "整机动作",
      "下面两个都是**真动作**：宿主侧的实现已经存在，按下去会有实际后果。",
      [createElement(VoiceModelRow, { key: "voice-model" }), createElement(NetdiskRow, { key: "netdisk" })],
    );

    // 「暂未接线」那一组由字段表自己的 `UNWIRED_FIELD_NAMES` 生成 ——
    // 名单与逐行原因都只有一份，在 `settings-schema.js` 里。
    const unwiredGroup = group("暂未接线", UNWIRED_HINT, UNWIRED_FIELD_NAMES.map(fieldRow));

    return createElement(
      "div",
      { style: SECTION_STYLE },
      header,
      ...wiredGroups,
      credentialsGroup,
      actionsGroup,
      unwiredGroup,
    );
  };
}

/**
 * 绑定设置表单并挂上「黑塔」设置页。
 *
 * 三件事都是**惰性**的，这是有意的：
 *   · `ctx.inject(["configForms","slots"], …)` 而不是写进 `inject` 数组 ——
 *     没有设置 UI 的组合（无头 / SDK）里这两个服务不存在，硬依赖会让
 *     整个客户端插件永不挂载，连她的对话页签一起没。
 *   · 凭据缝既不进 `inject` 数组、**也不用 `inject` 取**：它是握手之后挂到
 *     `remote` 上的命名空间，注入时机的行为实测不可靠（见 `resolveCredentials`）。
 *     走 `ctx.get("remote.credentials")` + 有界轮询，缺席时只是密钥那几行显示
 *     「不可用」，其余设置照常可用。
 *   · 原语用动态 import —— 解析失败只损失这一页，不影响其余界面。
 *
 * @param ctx - 客户端 cordis 上下文（`inject` + 服务解析）。
 * @param mark - 诊断标记对象（DSH 不把客户端上下文暴露到 window）。
 */
function installSettingsSection(
  ctx: {
    inject(names: readonly string[], callback: (scoped: any) => unknown): unknown;
    /** cordis 的服务解析（凭据缝靠它取，见 `resolveCredentials`）。 */
    get?(name: string): unknown;
    remote?: unknown;
    effect?(callback: () => unknown, label?: string): unknown;
  },
  mark: Record<string, unknown>,
): void {
  // 凭据缝：**不用 inject**（实测不可靠，见 `resolveCredentials` 的注释），
  // 改成有界轮询 `ctx.get("remote.credentials")`。服务缺席时它永远保持 null ——
  // 页面把密钥行显示成「不可用」并给出原因，而不是假装能用。
  watchCredentials(ctx, mark);

  ctx.inject(["configForms", "slots"], (scoped) => {
    const form = scoped.configForms.get(MACHINE_NS) as MachineForm;
    machineForm = form;
    mark.settingsBound = true;
    mark.settingsNamespace = MACHINE_NS;

    // 原语走模块加载器（见 `loadSeedModule` 的注释）；拿不到就只损失这一页。
    let Component: unknown;
    try {
      const ui = loadSeedModule("@deepseek-ai/dsh-client-ui-primitives");
      if (typeof ui?.Switch !== "function" || typeof ui?.SegmentedControl !== "function") {
        throw new Error(`原语模块缺少 Switch / SegmentedControl（拿到的是 ${Object.keys(ui ?? {}).slice(0, 8).join(", ") || "空对象"}）`);
      }
      Component = createSettingsSection(ui);
    } catch (error) {
      mark.settingsSectionError = String((error as Error)?.message ?? error);
      console.log(`[dsh-herta] 设置页未挂载：${String((error as Error)?.message ?? error)}`);
      return;
    }

    scoped.effect(
      () =>
        // `slots.inject` 而不是裸 register：`settings.section` 这个槽是由
        // ui-settings-general 的 `sidebar.settings` 一并声明的，不等声明到位
        // 就 register 会静默落空。inject 会在槽坍塌时自动撤下贡献。
        scoped.slots.inject("settings.section", () =>
          scoped.slots.register(
            {
              name: "settings.section",
              id: MACHINE_NS,
              // account(-10) / general(0) / models(10) / plugins(15) / agent-presets(20)
              order: 30,
              label: () => "黑塔",
              inject: () => ({
                hooks: { hertaMachine: form },
                setHertaField: (field: string, value: unknown) => {
                  void writeMachineField(field, value);
                },
              }),
            },
            Component,
          ),
        ),
      "dsh-herta: settings section",
    );
    mark.settingsSectionRegistered = true;
  });
}

/**
 * 注册视图。
 *
 * `slots.inject(name, register)` 是 DSH 唯一支持的组合方式（见仓库
 * `packages/client/AGENTS.md` 的「Slot and props discipline」第 1 条）：
 * 它等真正的槽声明出现，槽坍塌时自动撤下贡献，重声明后重跑，
 * 并且随调用方插件的 fiber 一起释放。
 */
function apply(ctx: {
  uiConversation: { binding(sessionId: string): { target(id: string): unknown } };
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(options: Record<string, unknown>, component: unknown): unknown;
  };
  /** 按需注入一个服务（服务缺席时回调不触发，不会卡住已注册的视图）。 */
  inject(names: readonly string[], callback: (scoped: any) => unknown): unknown;
  /**
   * 登记一个随插件 fiber 释放的副作用（回调返回退订函数）。
   *
   * MiniMax 的 SSE 订阅用它：插件卸载时连接必须跟着关，否则每挂一次就留一条
   * 永不关闭的 `EventSource`（浏览器对同源并发连接数是有限的）。
   */
  effect?(callback: () => unknown, label?: string): unknown;
}): void {
  // 诊断标记。DSH 不把客户端的 cordis 上下文暴露到 window，所以这是从外部
  // （无头浏览器 / CDP）确认插件走到哪一步的唯一可靠信号。
  const mark: Record<string, unknown> = {
    applyRan: true,
    slotsResolved: true,
    viewRegistered: false,
    viewMounted: false,
    viewId: VIEW_ID,
    plugin: name,
  };
  (globalThis as Record<string, unknown>).__DSH_HERTA__ = mark;

  // 设置：绑定 DSH 的设置表单 + 在设置里挂上「黑塔」一页。
  // `voiceScope` 也从这一份表单读，所以整机面板与 DSH 设置页永远同值。
  installSettingsSection(ctx, mark);

  // MiniMax 的 PCM 流：**插件级订阅**，不是某个视图里的订阅。
  //
  // 理由：声音该在用户停在任何页签时都响。挂在整机视图里的话，切走页签就哑了 ——
  // 那正是「这功能只在开着某个页签时有效」的毛病。这里的退订随插件 fiber 释放
  // （`ctx.effect`），页面卸载时连接跟着关掉。
  ctx.effect?.(() => startMiniMaxStream(), "dsh-herta: MiniMax PCM 流");

  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: VIEW_ID,
        order: 20,
        label: () => "黑塔",
        // 首个订阅会激活 chat target；此后它随会话常驻。
        inject: (sessionId: string) => ({
          hooks: { hertaChat: ctx.uiConversation.binding(sessionId).target("chat") },
        }),
      },
      HertaView,
    );
    mark.viewRegistered = true;
    return disposer;
  });

  // 第二个页签：整机（甲）。它同样订阅 chat target —— 数据由这个组件映射成
  // 她的记录后用 postMessage 推给 iframe，而不是让 iframe 自己去连 DSH 的传输层。
  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: FULL_VIEW_ID,
        order: 30,
        label: () => "黑塔·整机",
        // `sessionId` 由会话作用域的槽自带，不用 inject 再返回一次。
        inject: (sessionId: string) => ({
          hooks: { hertaChat: ctx.uiConversation.binding(sessionId).target("chat") },
        }),
      },
      HertaFullView,
    );
    mark.fullViewRegistered = true;
    return disposer;
  });
}

export { apply, inject, name };
