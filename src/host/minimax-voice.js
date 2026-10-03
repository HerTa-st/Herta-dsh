/**
 * MiniMax 云端语音的**宿主接线**：认领、按 `voiceEngine` 分发、把 PCM 推给浏览器半侧。
 * 说话状态机本身在 `minimax/pipeline.ts`（纯逻辑、可单测）；这里只解决"接谁"。
 *
 * ## 这一层为什么存在（以及为什么不是客户端驱动）
 *
 * 「让黑塔用她自己的声音念回复」在 DSH 里缺的是**中间那一跳**：
 *
 *   宿主（唯一能读密钥、能挂 agent 流事件的地方）
 *     └─ SSE `/herta-minimax-events` ─→ 浏览器半侧
 *          └─ postMessage `push("voice", …)` ─→ 整机 iframe 播放
 *
 * 宿主动是**刻意的**（用户决策）：只有宿主侧拿得到 `agent/turn-stopping`，
 * 才能在复核否决/要求重说时把已经合成、还没播完的那一段掐掉。客户端驱动做不到，
 * 只能让被否决的台词先响一半。
 *
 * ## 为什么走自建 SSE，而不是 DSH 的事件通道
 *
 * DSH 的宿主→客户端事件（`ctx.remote.$on`）只有一张**硬编码白名单**
 * （`@deepseek-ai/dsh-api-remotes`），第三方插件没有扩展点；而且过线前要过
 * `isJsonValue`（`Int16Array` 一律被拒）。所以 PCM 只能走插件自己的 HTTP 路由 ——
 * `dsh-client-hmr` 的 SSE 是仓库里已有的先例，`/herta-voice-model` 的
 * 「GET 状态 + POST 动作」是设置页那一侧的现成形状。
 *
 * ## 两条端点
 *
 *   · `GET  /herta-minimax-events` —— SSE：`tts`（PCM，base64）/ `ttsStop` / `state`
 *   · `GET|POST /herta-minimax-state` —— 状态快照；POST
 *     `{action:"adopt"|"reset"|"preview"|"warm"}`
 *
 * ## 四个引擎值分别是谁在说话（`speaksFor` 是唯一判据）
 *
 *   · `minimax` —— 云端优先；云端不可用时**显式回落本地模型**，理由记进 `engineNote`；
 *   · `local`   —— 直接本地合成（2026-09-28 起真的会念；在此之前这一档只在回落里被调用）；
 *   · `fish`    —— Fish Audio 云端（`fish-tts.js`）。**失败不回落** —— 用户明确选了
 *                  这一档，换成别的声音比没声音更糟，所以只写理由、不出声；
 *   · `mimo`    —— 合成器尚未接线（`mimo-tts.js` 全仓零调用点），不发声，理由照写。
 *
 * 本地那两条（`local`，以及 `minimax` 不可用时的回落）都走**常驻合成进程**：
 * 模型加载一次，之后每句只付推理 —— 实测数字与四条生死规则见 `tts-runtime.js`。
 */
import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { readJsonBody, sendJson } from "./http-json.js";
import { decodeWavToPcm16 } from "./mimo-tts.js";
import {
  createEventBus,
  createSpeechPipeline,
  isTopLevelAgent,
  MAX_TURN_CHARS,
  speaksFor,
} from "./minimax/pipeline.js";
import { createMiniMaxSynthesizer } from "./minimax/synthesizer.js";
import { createMiniMaxVoiceService } from "./minimax/voice.js";
import { synthesize as synthesizeLocal } from "./tts-runtime.js";
// 常驻合成进程的三个口：状态（给设置页看）、预热（切到本地时叫起来）、卸载时杀掉。
import { disposeLocalWorker, localWorkerStatus, warmUpLocalWorker } from "./tts-runtime.js";
// 四档合成器的**唯一 interface** + router（架构审查 candidate #1）。
// 装配仍在本文件（Q14）：这里只取工厂与 router，引擎知识各留各的工厂。
import {
  createFishAdapter,
  createLocalAdapter,
  createMinimaxAdapter,
  createMimoAdapter,
  createSynthRouter,
  SYNTH_CODES,
} from "./synth-registry.js";

export const HERTA_MINIMAX_EVENTS_ROUTE = "/herta-minimax-events";
export const HERTA_MINIMAX_STATE_ROUTE = "/herta-minimax-state";

/** 状态端点只收一个小动作名。 */
const MAX_BODY = 4 * 1024;

/** 密钥的凭据 ref。名字就是设置页「密钥」那一行写的那个。 */
const API_KEY_REF = "MINIMAX_API_KEY";
const PLAN_KEY_REF = "MINIMAX_PLAN_API_KEY";
/**
 * Fish Audio 的密钥 ref —— 设置页「Fish 密钥」那一行（`src/client/index.tsx` 的
 * `CREDENTIALS`）。**优先于** `C:/herta-ai/fish_key.txt`：那份明文文件退化成兜底，
 * 给不想把密钥交给设置页的人留的路（见 `fish-tts.js` 的 `readKey`）。
 */
const FISH_KEY_REF = "FISH_API_KEY";

/**
 * 选中 `mimo` 时给用户看的原因（设置页那一行、`herta_say`、试听共用一句）。
 *
 * 写这一句而不是静默返回 null：`mimo` 这一档在选择器里是**点得动**的
 * （用户决策：保留全部档位 + 逐档标注），所以"选了没声音"必须当场有解释 ——
 * 否则它与"密钥没填"、"模型没下"在界面上长得一模一样。
 */
const MIMO_NOT_WIRED = "MiMo 合成器尚未接线（mimo-tts.js 还没有调用点），不会发声";

/**
 * 「试听」的固定台词 —— **用户定的原话**（2026-09-28："有事吗？没事我就走了"）。
 *
 * 台词由**宿主**持有：界面只发一个动作名（`{action:"preview"}`），所以"试听说什么"
 * 只有这一处可改，客户端不需要跟着发版。
 *
 * 早先这句刻意带了阿拉伯数字与顿号（「…测试，1、2、3。」），用来顺带让本地模型那条
 * 数字/日期前端（`frontend/{number-zh,date-zh}.fst`）露一次脸。换成人话之后那个覆盖面
 * 就没了 —— 记在这里，免得下一个人以为它还在；**别为了测试往用户的台词里塞数字**。
 */
export const PREVIEW_TEXT = "有事吗？没事我就走了";

/**
 * 模块级单例。
 *
 * `apply` 会在**两个平面**各跑一次（profile 行与 preset 行），而 ESM 让这个模块
 * 只求值一次 —— 所以两个平面共享同一份服务、同一个 SSE 广播器。host 面负责
 * 「服务 + 路由 + 启动认领」，preset 面负责「订阅 agent 流 + 注册工具」。
 */
let shared = null;

/** 从 DSH 凭据服务读一把密钥（服务不在就是 null；值每次现读，不缓存明文）。 */
function credentialReader(ctx, ref) {
  return async () => {
    const credentials = ctx.get("credentials");
    if (credentials === undefined || credentials === null) return null;
    try {
      const hit = await credentials.resolve(ref);
      return hit === undefined || hit === null ? null : (hit.value ?? null);
    } catch {
      return null;
    }
  };
}

/** 全局 fetch 的注入形状：与 `minimax/api.ts` 的 `FetchLike` 同构。 */
const fetchLike = (url, init) => fetch(url, init);

/**
 * 取一个 volatile Config 字段的**当前值**。
 *
 * ⚠️ DSH 的 volatile 字段是**包装对象**（`@deepseek-ai/cosmokit` 的 `Volatile`），
 * 不是裸值：`dsh-settings` 的 `plainConfig()` 里写着
 * `if (isVolatile(value)) return plainConfig(value.get())`，官方插件
 * `dsh-agent-default-model` 读的也是 `this.config.provider.get()`。
 *
 * 2026-09-27 真踩过：直接把它当字符串用，拿到的是 `"[object Object]"`
 * —— 于是"引擎是不是 minimax"永远为假，`herta_say` 回一句
 * `voiceEngine=[object Object]…`（当时那句提示里还写着「只有 minimax 会合成」），
 * 而密钥、克隆、网络全是好的。
 * 这类 bug 的特点是**配置、密钥、链路全都没问题，只是读值的方式错了**。
 *
 * 这里用**鸭子类型**判 `.get()`，不引 cosmokit：DSH 以后要是改成传裸值，这段照样对。
 */
function liveValue(raw) {
  if (raw !== null && typeof raw === "object" && typeof raw.get === "function") return raw.get();
  return raw;
}

/** 读一个字符串字段；不是字符串就用兜底值（绝不把对象塞进给用户看的文案里）。 */
function readStringField(config, name, fallback) {
  const value = liveValue(config?.[name]);
  return typeof value === "string" ? value : fallback;
}

/** 读一个布尔字段；不是布尔就用兜底值（volatile 包装同样要走 `.get()`）。 */
function readBoolField(config, name, fallback) {
  const value = liveValue(config?.[name]);
  return typeof value === "boolean" ? value : fallback;
}

/**
 * 本地回落的合成（离线模型），**串行排队** —— 一个单元一个子进程，
 * 不排队的话一轮回复会一次拉起一堆 worker。
 *
 * ⚠️ `tts-runtime.synthesize()` 的 `samples` 字段是**样本个数（number）**，
 * 不是 PCM ——音频在它写出的 `out`（wav 文件）里。早先这里按数组读，于是把一个
 * 明明可用的模型当成了空的（回落永远报"失败"）。所以这里必须：读 wav → 解码成
 * Int16 → 清掉那个临时目录。解码用 `mimo-tts.js` 里现成的那份（同一形状的
 * RIFF/WAVE，PCM16 单声道）。
 */
function createLocalQueue(log, onFailure = () => {}) {
  let chain = Promise.resolve(null);
  return (text) => {
    const run = chain.then(async () => {
      /** 记下原因**并**返回 null —— 2026-09-30：原因以前只进日志，用户什么都看不到。 */
      const fail = (reason) => {
        onFailure(reason);
        log(`本地模型合成失败：${reason}`);
        return null;
      };
      try {
        const res = await synthesizeLocal(text);
        if (res?.ok !== true) {
          return fail(res?.error ?? "未知原因");
        }
        const wavPath = typeof res.out === "string" && res.out !== "" ? res.out : null;
        if (wavPath === null) {
          return fail("本地模型没有给出 wav 路径");
        }
        try {
          const { samples, sampleRate } = decodeWavToPcm16(readFileSync(wavPath));
          if (samples.length === 0) {
            return fail("本地模型合成出来是空的");
          }
          return {
            samples,
            sampleRate,
            durationMs: res.durationMs ?? (samples.length / sampleRate) * 1000,
          };
        } finally {
          // worker 把 wav 写在它自己的临时目录里，读完就清掉（否则每句话漏一个目录）。
          try {
            rmSync(dirname(wavPath), { recursive: true, force: true });
          } catch {
            /* 清理失败不该影响发声 */
          }
        }
      } catch (err) {
        return fail(String(err?.message ?? err));
      }
    });
    chain = run.catch(() => null);
    return run;
  };
}

/** 一句话说清"为什么现在不是 MiniMax"。 */
function describeUnavailable(mini) {
  if (!mini.keyKnown()) return "没有 MiniMax 密钥";
  const voice = mini.voice.readout();
  if (voice.phase === "failed") return `认领失败（${voice.lastError ?? "unknown"}）`;
  if (voice.phase !== "ready") return "还没认领到克隆音色";
  const synth = mini.synthesizer.status();
  if (synth.refusal !== null) return `MiniMax 拒绝（${synth.refusal}）`;
  if (synth.lastFailure !== null) return `MiniMax 失败（${synth.lastFailure}）`;
  return "MiniMax 不可用";
}

/** 建（或取回）共享实例。**不抛** —— 语音层坏掉不该把插件挂载带崩。 */
function ensureShared(ctx) {
  if (shared !== null) return shared;

  const log = (line) => console.log(`[dsh-herta] ${line}`);
  const bus = createEventBus((line) => log(`minimax ${line}`));
  const readApiKey = credentialReader(ctx, API_KEY_REF);
  const readPlanKey = credentialReader(ctx, PLAN_KEY_REF);
  const readFishKey = credentialReader(ctx, FISH_KEY_REF);

  /** `available()` 必须同步，所以缓存的是**布尔**；值本身每次现读。 */
  let keyKnown = false;
  const readKey = async () => {
    const value = await readApiKey();
    if (value !== null) keyKnown = true;
    return value;
  };

  const voice = createMiniMaxVoiceService({
    fetch: fetchLike,
    key: readKey,
    planKey: readPlanKey,
    log: (line) => log(`minimax ${line}`),
    onChange: () => mini?.noteState?.(),
  });

  const synthesizer = createMiniMaxSynthesizer({
    fetch: fetchLike,
    key: readKey,
    keyKnown: () => keyKnown,
    voice: () => voice.voice(),
    enabled: () => mini.engineOf() === "minimax",
    log: (line) => log(`minimax ${line}`),
    // 2026-09-30：合成器**一直**在传这个数（`onUsed?.(out.billedChars)`），
    // 是这里把它丢掉的 —— 于是「这一档花了多少」在界面上没有答案。
    onUsed: (billedChars) => voice.stampUsed(billedChars),
    onVoiceMissing: (id) => voice.markMissing(id),
    onRefusal: () => mini?.noteState?.(),
  });

  /**
   * 上一次本地合成的失败原因（`null` = 没失败或还没跑过）。
   * 由 `createLocalQueue` 的第二个参数写进来，`synthUnit` 把它端到 `engineNote` 上。
   */
  let localFailure = null;
  const localQueue = createLocalQueue(log, (reason) => {
    localFailure = reason;
  });

  // ── 四档 adapter + router（架构审查 candidate #1）──────────────────────────
  // 装配留本文件（Q14）：registry 只导出工厂，引擎知识各留各的工厂，router 只知道契约。
  // `noteState` 用**惰性闭包**：`mini` 在本文件后面才定义，而 router 每结束一次合成
  // 就要报状态（Q28）—— 与上面 `onChange: () => mini?.noteState?.()` 同一手法。
  const fishParams = () => {
    const num = (name) => {
      const v = liveValue(mini.config?.[name]);
      return typeof v === "number" && Number.isFinite(v) ? v : undefined;
    };
    // 七个参数收在这一档里（Q5），interface 上只剩 `synthesize(req)`。
    // 密钥不在这里：它由 `readKey` 现读现传（Q19，不缓存明文）。
    return {
      fishRef: readStringField(mini.config, "fishRef", undefined),
      fishSpeed: num("fishSpeed"),
      fishEffect: readBoolField(mini.config, "fishEffect", undefined),
      fishPreset: readStringField(mini.config, "fishPreset", undefined),
      fishProxy: readStringField(mini.config, "fishProxy", undefined),
    };
  };

  /** fish 的密钥在不在（Q18：`available()` 只看这个，不测网络）。由 synthUnit 刷新。 */
  let fishKeyPresent = false;

  const synthRouter = createSynthRouter({
    engineOf: () => mini.engineOf(),
    noteState: () => mini?.noteState?.(),
    log: (line) => log(`synth ${line}`),
    adapters: {
      local: createLocalAdapter({
        queue: (text) => localQueue(text),
        getFailure: () => localFailure,
      }),
      minimax: createMinimaxAdapter({
        synthesizer,
        // describeUnavailable 读的是 minimax 私有状态，所以留在这一档（Q20），
        // 但它**输出 code**、原文进 status()（Q13）。
        describe: () => describeUnavailable(mini),
      }),
      fish: createFishAdapter({
        load: () => import("./fish-tts.js"),
        params: () => fishParams(),
        keyPresent: () => fishKeyPresent,
        readKey: () => readFishKey(),
      }),
      // mimo：注册但 `available(): false`（Q6）。这里刻意**不构造** synthesizer ——
      // 构造它要一串还没核过的参数（fetch / keyRef / 参考 WAV），而这一档现在
      // 根本不发声，猜一串参数等于埋雷。接线（开放 available）时再传真的。
      mimo: createMimoAdapter({ synthesizer: null }),
    },
  });

  const mini = {
    /**
     * 分发用的 Config —— **只有 host 平面那份**（见 `setConfig`）。
     *
     * 刻意不"谁后挂谁赢"：preset 平面那份 config 是同一套 schema 的**另一份实例**，
     * 它的 `voiceEngine` 会落在默认值 `local` 上；要是让它覆盖宿主那份，引擎就永远不是
     * `minimax`，症状是"配置里明明写着 minimax，她一声不出"。
     */
    config: {},
    /** 由 host 平面装上它那份权威配置（volatile 包装对象，**保持引用**即可实时生效）。 */
    setConfig(config) {
      if (config === undefined || config === null) return;
      mini.config = config;
      log(`分发配置就位：voiceEngine=${mini.engineOf()}`);
    },
    bus,
    voice,
    synthesizer,
    readKey,
    readFishKey,
    keyKnown: () => keyKnown,
    /** 当前引擎。volatile 字段要走 `.get()`（见 `liveValue` 的注释）。 */
    engineOf: () => readStringField(mini.config, "voiceEngine", "local"),
    /**
     * 现在这一档为什么不出声（给人看的中文）；没失败就是 `null`。
     *
     * 只读：值**现算** —— router 记着最近一次的 `{name, code}`（ADR-0006），这里交给
     * 边界翻译一次。原先它是一个可变字段 `engineNote`（23 处读写散在四个文件里），
     * 候选 #1 之后它没有存在的理由了。
     */
    reasonText: () => {
      const { name, code } = synthRouter.lastCode();
      return code === SYNTH_CODES.ok ? null : reasonText({ name, code });
    },
    localQueue,
    noteState() {
      bus.send(mini.snapshot());
    },
    snapshot() {
      return {
        kind: "state",
        engine: mini.engineOf(),
        engineReason: mini.reasonText(),
        keyKnown: keyKnown,
        voice: voice.readout(),
        synth: synthesizer.status(),
        pipeline: pipeline.stats(),
        maxTurnChars: MAX_TURN_CHARS,
        clients: bus.count(),
        // 常驻合成进程的事实（设置页那行显示「合成进程：已预热 / 启动中 / 未启动」）。
        // 只读：查询**不会**把它叫起来 —— 起进程只由真正的合成或 `warm` 动作触发。
        localWorker: localWorkerStatus(),
      };
    },
    /** 启动/手动认领：先读一次密钥再认领。 */
    async adopt() {
      try {
        await readKey();
        const out = await voice.prepare();
        log(`MiniMax 认领：${out.phase}${out.lastError === undefined ? "" : `（${out.lastError}）`}`);
      } catch (err) {
        log(`MiniMax 认领抛错：${String(err?.message ?? err)}`);
      }
      mini.noteState();
    },
    /**
     * 「试听」：拿固定台词走一遍**当前引擎**的合成，并把结果告诉界面。
     *
     * 与 `herta_say` 的差别只有入口（HTTP 动作 vs 工具）：都落到
     * `pipeline.sayText`，**都不受 `realtimeVoice` 管** —— 用户是明确要求现在出声。
     *
     * 返回 `{ok, engine, text, note}`（与 `herta_say` 的结果同形），由状态端点
     * 拼在快照的 `preview` 字段里回给设置页。
     */
    async preview() {
      const engine = mini.engineOf();
      if (!speaksFor(engine)) {
        return { ok: false, engine, text: PREVIEW_TEXT, note: MIMO_NOT_WIRED };
      }
      const out = await mini.pipeline.sayText(PREVIEW_TEXT);
      if (out === null) {
        return { ok: false, engine, text: PREVIEW_TEXT, note: mini.reasonText() ?? "合成失败（看宿主日志）" };
      }
      return { ok: true, engine: out.engine ?? engine, text: PREVIEW_TEXT, note: "" };
    },
    /**
     * 「点哪段读哪段」：界面送一段文字来，用当前引擎说它。
     *
     * 与 `preview` 的唯一差别是**文本来自调用方** —— 两者都落到
     * `pipeline.sayText`，都一样**不受 `realtimeVoice` 管**：用户是明确点了它
     * 才出声的，不是「自动念回复」顺手带出来的。
     *
     * 回执只报成不成；音频照旧从 SSE 推回去，界面不靠这个返回值播放。
     */
    async say(text, options) {
      const engine = mini.engineOf();
      if (!speaksFor(engine)) {
        return { ok: false, engine, text, note: MIMO_NOT_WIRED };
      }
      const opts = options ?? {};
      // `exact` 走「整段一次合成」（点哪段读哪段）；其余调用方（试听、自动念
      // 回复）照旧按句切分 —— 那条路切得对，不该跟着改。
      const out = opts.exact === true
        ? await mini.pipeline.sayWhole(text, opts.token)
        : await mini.pipeline.sayText(text);
      if (out === null) {
        return { ok: false, engine, text, note: mini.reasonText() ?? "合成失败（看宿主日志）" };
      }
      return { ok: true, engine: out.engine ?? engine, text, note: "" };
    },
  };

  /**
   * 一个单元的音频 —— 按 `voiceEngine` 分派（用户决策，2026-09-28）：
   *
   *   · `local`   —— 直接本地合成，**不碰云端**；这不是回落，所以不记 `engineNote`；
   *   · `mimo`    —— 不发声，理由记进 `engineNote`（用户看得见为什么没声）；
   *   · `minimax` —— 云端优先；不可用时**显式回落本地模型**，回落理由记在
   *                  `engineNote` 上 —— 用户能看见"现在是谁在说话"，而不是被静默换声。
   */

  /**
   * 一个单元的音频 —— 现在只做两件事：**刷新"密钥在不在"的标志**，然后交给 router。
   *
   * 分派、回落（minimax→local）、失败原因全归 router（Q1/Q28）；本函数只剩
   * "只有装配时才知道的事"：密钥要现读 —— 刚在设置页填上时必须立刻被看见
   * （`available()` 是活开关，见 `minimax/types.ts` 的三条语义之二）。
   */
  const synthUnit = async (req) => {
    const engine = mini.engineOf();
    if (!speaksFor(engine)) {
      mini.noteState();
      return null;
    }
    if (!keyKnown) await readKey();
    if (engine === "fish") {
      try {
        fishKeyPresent = (await readFishKey()) !== null;
      } catch {
        fishKeyPresent = false;
      }
    }
    const out = await synthRouter.synthesize(req);
    if (out !== null) {
      return out;
    }
    mini.noteState();
    return null;
  };

  const pipeline = createSpeechPipeline({
    bus,
    log,
    engineOf: () => mini.engineOf(),
    synthUnit,
    // Q9：取消**转发给所有带 cancel 的 adapter**。老代码这一句硬接在 minimax 的
    // synthesizer 上，于是用户打断时若当前引擎是 fish/local，在飞请求根本没被取消
    // （交接 §3.5 那个 bug 苗子）。
    cancelUnit: (utteranceId) => synthRouter.cancel(utteranceId),
    noteState: () => mini.noteState(),
    maxTurnChars: MAX_TURN_CHARS,
    /** 只念顶层会话的正文（子代理的文字跳过，见 `isTopLevelAgent`）。 */
    isSpeakable: isTopLevelAgent,
    /**
     * `realtimeVoice` 是「自动念回复」的总开关（默认 `true`）。关掉它就不自动念、
     * 也不再触发云端合成（省钱）；`herta_say` 是明确要求说一句，**不受它管**。
     */
    repliesEnabled: () => readBoolField(mini.config, "realtimeVoice", true),
  });

  mini.pipeline = pipeline;
  shared = mini;
  log(`MiniMax 语音层就绪（引擎=${mini.engineOf()}，上限 ${MAX_TURN_CHARS} 字/轮）`);
  return mini;
}

/**
 * host 面：建服务、装上分发配置、启动时认领一次、订阅凭据变化。
 *
 * @param ctx - 宿主 cordis 上下文。
 * @param config - profile 那一条 `herta` 的 Config（volatile 包装对象；`voiceEngine`
 *   的真相在这里，**只有这一面**会装它）。
 */
/** 挂载追踪（落盘）—— 这台机器上 DSH 的 console 不进日志，所以"没挂载"这件事只写在文件里才看得见。 */
function mountTrace(line) {
  try {
    const dir = join(process.env.USERPROFILE ?? process.env.HOME ?? ".", ".dsh");
    appendFileSync(join(dir, "dsh-herta-voice-mount.txt"), `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* 追踪本身不许影响挂载 */
  }
}
export function installMiniMaxVoice(ctx, config) {
  try {
    const mini = ensureShared(ctx);
    mini.setConfig(config);
    // 启动认领：异步跑，不阻塞插件挂载（网络挂了也不该让界面起不来）。
    void mini.adopt();
    // 设置页填完密钥 → 凭据层广播 → 立刻重认领（不用重启）。
    ctx.on("credentials/reference-updated", (ref) => {
      // Fish 的密钥既没有缓存、也没有认领流程：填上或清掉只需要让设置页那行状态刷新，
      // 顺手抹掉上一次「Fish 不可用」的说明 —— 用户刚补上的正是它缺的那一样。
      if (ref === FISH_KEY_REF) {
        mini.noteState();
        return;
      }
      if (ref !== API_KEY_REF && ref !== PLAN_KEY_REF) return;
      void mini.adopt();
    });
    // 常驻合成进程：插件卸载时杀掉它。不挂这一条的话，热重载（或关掉插件）会在
    // 用户机器上留下一个 ~250 MB 的 node 孤儿进程 —— 而它只在有人用本地合成时才存在，
    // 所以这条泄漏最难被发现。
    ctx.effect?.(() => () => disposeLocalWorker(), "dsh-herta: local tts worker");
    return mini;
  } catch (err) {
    mountTrace(`MiniMax 语音层未挂载：${String(err?.stack ?? err?.message ?? err)}`);
    console.log(`[dsh-herta] MiniMax 语音层未挂载：${String(err?.message ?? err)}`);
    return null;
  }
}

/** host 面：挂 SSE 与状态端点。 */
export function registerMiniMaxVoiceRoutes(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === undefined) {
    mountTrace('没有 webServer → 端点跳过（inject 回调没等到服务）');
    console.log(`[dsh-herta] 没有 webServer，MiniMax 端点跳过（${HERTA_MINIMAX_EVENTS_ROUTE}）`);
    return undefined;
  }
  const mini = shared ?? ensureShared(ctx);
  const disposers = [];

  disposers.push(
    webServer.register({
      kind: "exact",
      path: HERTA_MINIMAX_EVENTS_ROUTE,
      handler: (req, res) => {
        mini.bus.add(res);
        req.on("close", () => mini.bus.remove(res));
      },
    }),
  );

  disposers.push(
    webServer.register({
      kind: "prefix",
      path: HERTA_MINIMAX_STATE_ROUTE,
      handler: async (req, res) => {
        const method = req.method ?? "GET";
        if (method === "GET" || method === "HEAD") {
          sendJson(res, 200, mini.snapshot());
          return;
        }
        if (method !== "POST") {
          sendJson(res, 405, { error: "method not allowed" });
          return;
        }
        const body = await readJsonBody(req, res, MAX_BODY);
        if (body === undefined) return; // 已回过 413 / 400
        const action = body !== null && typeof body === "object" ? body.action : undefined;
        if (action === "adopt") {
          mini.voice.reset();
          await mini.adopt();
        } else if (action === "reset") {
          mini.voice.reset();
          mini.noteState();
        } else if (action === "preview") {
          // 试听：合成结果照旧走 SSE，回执只用来给设置页一句话（成功 / 为什么没声）。
          const out = await mini.preview();
          sendJson(res, 200, { ...mini.snapshot(), preview: out });
          return;
        } else if (action === "say") {
          // 「点哪段读哪段」：正文由界面给 —— 点的是哪条气泡，就是哪段字。
          // 音频和别的合成一样从 SSE 推回去，所以这里**不等它播完**就回执。
          const text = typeof body.text === "string" ? body.text.trim() : "";
          if (text === "") {
            sendJson(res, 400, { error: "say 需要非空的 text" });
            return;
          }
          // `token` 是界面生成的短标识，会进 utteranceId —— 它靠这个确认
          // 「哪一帧是我要的那一帧」，而不是猜。只收安全字符，因为它要当 id 用。
          const token =
            typeof body.token === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(body.token)
              ? body.token
              : "";
          const said = await mini.say(text, { exact: body.exact === true, token });
          sendJson(res, 200, { ...mini.snapshot(), say: said });
          return;
        } else if (action === "warm") {
          // 预热常驻合成进程：设置页把引擎切到「本地模型」时调它 —— 把那 ~3 秒的
          // 模型加载挪到用户还在选的那几秒里。这里**等它加载完**再回执，所以回执
          // 说的是事实（ok/warmMs）而不是"我发出了一个请求"。
          const warm = await warmUpLocalWorker();
          sendJson(res, 200, { ...mini.snapshot(), warm });
          return;
        } else {
          sendJson(res, 400, {
            error: `unknown action: ${String(action)}`,
            allowed: ["adopt", "reset", "preview", "say", "warm"],
          });
          return;
        }
        sendJson(res, 200, mini.snapshot());
      },
    }),
  );

  console.log(
    `[dsh-herta] MiniMax 端点已挂：${HERTA_MINIMAX_EVENTS_ROUTE}（SSE）/ ${HERTA_MINIMAX_STATE_ROUTE}（状态）`,
  );
  return () => {
    for (const dispose of disposers) dispose?.();
  };
}

/**
 * preset 面：订阅 agent 的助手流与 turn 边界。
 *
 * 挂在这一面而不是 host 面，是因为 preset 面的作用域**只覆盖黑塔自己的会话** ——
 * 挂在 host 面会让她在别人的会话里也开口。
 *
 * **刻意不收 config**：preset 平面那份配置是同一套 schema 的另一份实例（`voiceEngine`
 * 会是默认值 `local`），让它参与分发就会把宿主那份权威配置盖掉。
 */
export function installMiniMaxSpeech(ctx) {
  try {
    const mini = ensureShared(ctx);
    ctx.on("agent/assistant-stream", (payload) => mini.pipeline.onStream(payload));
    ctx.on("agent/turn-stopping", (payload) => mini.pipeline.onTurnStopping(payload));
    return mini;
  } catch (err) {
    console.log(`[dsh-herta] MiniMax 语音订阅未挂载：${String(err?.message ?? err)}`);
    return null;
  }
}

/**
 * `herta_say` —— 让黑塔**用她自己的声音**说一句话（调试入口 + 真实验收通道）。
 *
 * 与 `herta_speak` 的区别是根本性的：那个放的是**录音片段**（`.opus`），
 * 这条是**合成**。所以它同时是"合成对不对"的探针：端到端哑掉时，先用它把
 * 「合成」与「推给界面」两段分开看。
 *
 * 用哪条引擎由 `voiceEngine` 说了算（`local` 直连本地模型、`minimax` 云端优先），
 * 只有 `mimo` 会因为"合成器尚未接线"而拒绝。
 */
export const hertaSayTool = defineTool({
  name: "herta_say",
  description:
    "让黑塔用她自己的声音说一句话（按当前语音引擎合成：MiniMax 云端克隆音色，"
    + "或本地离线模型；不是录音片段）。用于调试语音链路：它会真的合成音频并把声音推给界面。"
    + "云端不可用时会回落到本地模型，并在结果里注明用的是哪条引擎。",
  parameters: {
    text: { type: "string", description: "要说的话（中文）。" },
  },
  output: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ok: { type: "boolean", description: "是否真的出声了。" },
        engine: { type: "string", description: "实际使用的引擎：minimax | local。" },
        text: { type: "string", description: "实际说的话。" },
        note: { type: "string", description: "没出声时的原因。" },
      },
    },
    render: (_args, value) =>
      value.ok
        ? [{ type: "text", text: `（用 ${value.engine} 说了：「${value.text}」）` }]
        : [{ type: "text", text: `（没说出来：${value.note}）` }],
  },
  isConcurrencySafe: () => true,
  async execute(args) {
    const text = typeof args?.text === "string" ? args.text.trim() : "";
    if (text === "") return { ok: false, engine: "", text: "", note: "text 为空" };
    const mini = shared;
    if (mini === null) return { ok: false, engine: "", text, note: "MiniMax 语音层还没挂载" };
    const engine = mini.engineOf();
    if (!speaksFor(engine)) {
      // `[object Object]` 那个坑（volatile 包装没解）就是在这里被发现的，
      // 所以 `engine` 走的是 `engineOf()` 而不是直接读 config。
      return { ok: false, engine: "", text, note: `voiceEngine=${engine}：${MIMO_NOT_WIRED}` };
    }
    const out = await mini.pipeline.sayText(text);
    if (out === null) {
      return { ok: false, engine: "", text, note: mini.reasonText() ?? "合成失败（看宿主日志）" };
    }
    return { ok: true, engine: out.engine ?? "minimax", text, note: "" };
  },
});
