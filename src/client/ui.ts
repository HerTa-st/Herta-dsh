/**
 * 「界面」那一层：面板 / 视图 / 气泡 / 点击朗读（#2 拆出的四个 region 之三）。
 *
 * 为什么单独一个文件：这一段是**渲染**（React 组件与 shadow root），与机器层（bridge/凭据）、
 * 语音层（SSE/PCM）、设置页三项各不相干 —— 改布局不必碰凭据通道的 diff（candidate #2 的 Divergent change）。
 *
 * 从 `index.tsx` 原样搬来：只改了所在文件与 export（这一段没有外部写方，所以不需要 binder）。
 */
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HertaBubble } from "@gui/components/Workspace/HertaBubble";
import { UserBubble } from "@gui/components/Workspace/UserBubble";
import { LocaleProvider } from "@gui/i18n/LocaleProvider";
import hertaCss from "@gui/styles/reference-ux.css";
import { fullSnapshot, nodesToRecord, toBubbles } from "../shared/mapping.js";
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
import {
  FIELDS,
  normalizeSettings,
  SETTINGS_GROUPS,
  SETTINGS_NAMESPACE,
  UNWIRED_FIELD_NAMES,
} from "../host/settings-schema.js";
import { createSerialPlaybackQueue, decodePcmFrame } from "./minimax-pcm.ts";
// 机器层（设置表单 / 凭据缝）：整机 iframe 的应答器要同步读设置值、写字段、查密钥。
import {
  clearCredential,
  credentialStatus,
  machineField,
  machineValues,
  saveCredential,
  writeMachineField,
} from "./machine.ts";
// 语音层：歌词气泡的点击朗读、SSE 音色状态、MiniMax 的动作入口都在那边。
import {
  localQueue,
  playLocalVoice,
  postMiniMaxAction,
  postVoiceModel,
  refreshVoiceModel,
  registerVoiceSink,
  stopVoiceModelTimer,
  voiceModelFacts,
  voiceModelState,
  voiceModelSubs,
} from "./voice.ts";
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

/**
 * 把一段刚播完的音频存进档案（键是它念的那段文字），供「点哪段读哪段」复用。
 *
 * **`export` 是给 `voice.ts` 的**（那两个调用点住在那边的 `onMiniMaxPcm` 里）。
 * 2026-10-10 之前这里漏了 `export`、`voice.ts` 也漏了 `import` —— 于是产物里
 * 只剩两个调用点、零个定义，每一帧 tts 都在 `onMiniMaxPcm` 抛 `ReferenceError`，
 * 音频进不了播放队列。而这个错**连诊断标记都不留**（抛在 `markMinimax` 之前），
 * 表面症状就是"点了没反应"。0.1.7 是一整份 `index.tsx`、没有这条 import 的需要，
 * 0.1.8 拆成四个 region 时漏掉的就是这一行。
 */
export function rememberSpokenAudio(
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
/**
 * [点哪段读哪段] 还在飞的 say 请求：令牌 → 它将来归档用的那段文字。
 *
 * 是**表**不是单个格子。长段合成要几十秒，这中间你要是点了别的，单个格子会被
 * 顶掉 —— 长的那条回来就成了「无人认领的帧」，被直接放掉，于是它永远进不了
 * 档案，下次再点还得重来。
 *
 * `export` 的理由同上：匹配那一步（`onMiniMaxPcm`）住在 `voice.ts`。
 */
export const awaitingSpokenTexts = new Map<string, string>();

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
// `.opus` 播放那条路（点击朗读）已拆到独立文件（#2 精修）。
//
// ⚠️ 说明符写 **`./opus.ts`**（与 `./machine.ts` / `./minimax-pcm.ts` 一致），
// 不写 `./opus.js`：`build.mjs` 的 jsToTs 插件虽然也认 `.js`，但**客户端测试设施
// （`client-test-hook.mjs`）直连源码加载时不做那个替换** —— 于是 `./opus.js` 会让
// 整棵模块图解析失败（`test-client-regions` 一直红着，2026-10-10 修）。
// 磁盘上就是 `.ts`，写 `.ts` 两种加载方式都对。
import {
  playClip,
  playUrl,
} from "./opus.ts";


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

  // 这一条的墨色**不能靠 `color: inherit`** ⚠️
  //
  // 别的行都坐在自己那块底板（`ACTION_BUTTON_STYLE` 那套带 `bg-layer-2`）上；这条不是 ——
  // 它没有底板，直接压在主题铺的壁纸上。继承来的颜色出自 Herta 的 `:host{color:var(--ink)}`，
  // 而 `--ink` 只有宿主带 `data-theme="dark"` 时才是浅色；那个属性又只看
  // `documentElement.style.colorScheme`（= DSH 的色板偏好）。主题那边是**锁深色**的：
  // 它把 `data-ds-dark-theme` 盯住不放、`html` 底也照 #17131d 铺，却不碰 `color-scheme`
  // （碰了会改原生标题栏的绘制）。于是「DSH 偏好浅色 + 主题锁深色」这一档里两层打架：
  // 底是深的、墨是 #111417 的 → 整条只剩 emoji 看得见（emoji 的颜色由字体给，不吃 color）。
  //
  // 所以直接取 DSH 的 label 令牌 —— 它正是**当前胜出的那层色板**的墨色（主题那层带
  // `!important`，压得住 DSH 的 inline 值），底和墨从此同源。本文件其余控件也都用它。
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
        color: "var(--dsw-alias-label-primary)",
        // ── 吸顶（2026-10-10：用户反馈「上下文一长就点不到，得翻回最上面」）────────
        //
        // 这四个键（开场 / 语气 / 声音 / 自动配音）是她唯一常驻的开关，而面板是**长在
        // 会话流里**的 —— 对话一长，它就滚上去了，想静音得先翻到顶。
        //
        // 三个属性缺一不可：
        //   · `position: sticky` + `top: 0` —— 贴在**最近的滚动祖先**（会话区）顶端；
        //   · 一层**不透明底板** —— 这个键条原来没有自己的底（直接压在主题壁纸上），
        //     不铺底的话气泡会从下面透上来，比滚走更难看；
        //   · `zIndex: 1` —— 让它压在气泡之上（气泡没定位，同层里 sticky 自然在上面，
        //     但显式写下来，免得以后谁给气泡加了个 `position` 就翻过来）。
        //
        // 背景色取 DSH 的 base 令牌、**不取 `backdrop-filter`**：后者在这个壳里
        // 会强制新建合成层，卷动时和主题的背景图抢绘制（试过，会抖）。
        // 底板与工具条同宽（左右各 16 的 padding 留在里面），所以滚动内容从它下面过时
        // 不会在两侧漏出一条。
        position: "sticky",
        top: 0,
        zIndex: 1,
        background: "var(--dsw-alias-bg-base)",
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

  // 面板左右**不留** padding：工具条要吸顶，它那块底板得铺满面板宽度 ——
  // 留了边距，滚动的内容就会从两侧各漏出一条（比滚走更难看）。
  // 于是左右边距挪进里面：工具条自己 `padding: 8px 16px`，气泡那层沿用 `0 16px`，
  // 内容位置与改动前一致，只有底板因此铺满。
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
export function HertaView(props: {
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
export function HertaFullView(props: {
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
      stopVoiceModelTimer();
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