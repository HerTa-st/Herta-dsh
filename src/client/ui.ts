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
import { toBubbles } from "../shared/mapping.js";
// 机器层（设置表单）：静音开关与音量读写的是同一份设置。
import {
  machineField,
  writeMachineField,
} from "./machine.ts";
// 语音层：歌词气泡的点击朗读、SSE 音色状态、MiniMax 的动作入口都在那边。
import {
  localQueue,
  playLocalVoice,
  postMiniMaxAction,
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


/**
 * 工具条那个静音键按下去该做什么 —— **抽成具名函数**，因为它值得被测试戳一下。
 *
 * 为什么（2026-10-10 用户第二次报"静音不是立刻生效"）：这个按钮原来只
 * `setMuted((m) => !m)` —— 一个组件内 state，**只影响标签文字与"自动配语气词"那两条
 * 判断，跟音频链路毫无关系**。真正拦声音的是设置里的 `voiceMuted`（`playLocalVoice`
 * 开头那次早退），所以按了它"没反应"，看起来就像"要等话说完"。
 *
 * 现在它写设置：那条写入经 `machine` 的订阅回调走到语音层的 `applyMuteNow()`，
 * 增益当场归零、已排的音频停掉 —— 这才是"点了就闭嘴"。
 *
 * @param current 当前显示的静音态（来自设置镜像）。
 * @param markLocal 把本地镜像立刻改掉（乐观更新：按钮不许等宿主回执才变色）。
 * @returns 新状态。
 */
export function toggleMuteSetting(current: boolean, markLocal: (next: boolean) => void): boolean {
  const next = !current;
  markLocal(next);
  void writeMachineField("voiceMuted", next);
  return next;
}

/**
 * 静音状态的订阅者（工具条那个按钮要跟着设置走）。
 *
 * 为什么需要：工具条的 `muted` 只是**镜像** —— 真相在设置里（`voiceMuted`）。
 * 设置页按了、或页面刷新时值本来就是静音，
 * 工具条的标签都得跟着变；否则两处显示会打架（一个说「有声」、实际一声不出）。
 *
 * 谁往这里推：装配层接到设置变更回调之后调 `notifyMuteChanged()`（见 `index.tsx`）——
 * 语音层与界面层互不认识，只能由那个同时认识两边的地方转发。
 */
const muteSubs = new Set<(muted: boolean) => void>();

export function subscribeMuteChanged(cb: (muted: boolean) => void): () => void {
  muteSubs.add(cb);
  return () => {
    muteSubs.delete(cb);
  };
}

/** 设置里的静音变了：叫醒所有订阅者（坏掉一个不影响别的）。 */
export function notifyMuteChanged(): void {
  const muted = machineField("voiceMuted") === true;
  for (const cb of muteSubs) {
    try {
      cb(muted);
    } catch {
      /* 一个订阅者坏掉不该影响别的 */
    }
  }
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
  // ⚠️ `muted` 的**真相在设置里**（`voiceMuted`），这里的 state 只是它的镜像。
  //
  // 2026-10-10 用户第二次报"静音不是立刻生效"：那时这个按钮只 `setMuted((m) => !m)`
  // —— 一个组件内 state，**只影响标签文字与"自动配语气词"那两条判断，跟音频链路毫无
  // 关系**。真正拦声音的是 `voiceMuted`（`playLocalVoice` 开头那次早退），所以按了它
  // 当然"没反应"，看起来就像"要等话说完"。
  //
  // 现在初值从设置读、按下写回设置：那条写入会经 `machine` 的订阅回调通知到语音层，
  // 于是 `applyMuteNow()` 立刻把增益压到 0（见 `voice.ts` 的那个函数）。
  const [muted, setMuted] = useState(() => machineField("voiceMuted") === true);

  // 别处改了静音（设置页、或宿主回写）→ 标签跟着变。
  useEffect(() => subscribeMuteChanged(setMuted), []);
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
        // 写设置（真闸门），不是只改本地 state —— 理由见 `toggleMuteSetting` 的注释。
        toggleMuteSetting(muted, setMuted);
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
