/**
 * MiniMax 音色**认领**服务（只认领，不克隆）。
 *
 * ## 与上游最大的差别，以及为什么
 *
 * 上游 `Herta-src/.../tts/minimax-voice.ts` 的 `prepare()` 会做三件事：探测 host、
 * 列账号上的克隆、**没有就上传参考音频现克隆一个**。本插件**不做第三件**
 * （用户决策：参考音频 8.36 MB 且只存在于她的安装目录里，不把它带进插件）——
 * 于是这里的 `prepare()` 只有两步：
 *
 *   1. `probeHost` 选一个能用的大陆/国际端点；
 *   2. `listClones` 找**带 herta tag 的克隆**并采用最新那个。
 *
 * 认领是可行的，因为她的克隆 id 形如 `herta-b1a43133-uo58hrlu1x`，而
 * `LEGACY_REFERENCE_TAG = "b1a43133"` 正是上游为"参考音频换过一次"准备的兼容标记
 * （它同时是 `herta-reference.wav` 的 SHA-256 前 8 位 —— 这条巧合让"不下载那份
 * 8 MB 音频也能认领"成立）。
 *
 * ## 没有克隆可认领时会发生什么（诚实版本）
 *
 * MiniMax 会删除 7 天没用的克隆。上游这时会自动重克隆一次；**我们没有克隆能力**，
 * 所以：清掉记录 → 进入 `failed` → 由宿主分发层**显式回落本地模型**（并在状态里
 * 标明"已回落"）。`failed` 同时写进冷却（10 分钟），到期后会再 `listClones` 一次 ——
 * 如果你在独立版里重新克隆了，DSH 这边就会自动认领回来。
 *
 * ## 密钥是异步的（这条与上游不同）
 *
 * 上游从 `key-store` 同步读文件；DSH 的凭据服务 `ctx.credentials.resolve()` 是
 * **异步**的。所以这里注入的 `key()` / `planKey()` 返回 Promise —— 值每次现读，
 * 不缓存明文。
 */
import type { FetchLike, MiniMaxFailure } from "./api.js";
import { MINIMAX_CONTROL_TIMEOUT_MS, MiniMaxError, listClones, probeHost, withDeadline } from "./api.js";
import type { MiniMaxStateFile } from "./state.js";
import { adoptCoolingDown, cloneRecordOf, emptyState, readMiniMaxState, writeMiniMaxState } from "./state.js";
import { errorMessage } from "./types.js";

/**
 * 上游的 `LEGACY_REFERENCE_TAG`：第一版参考音频的 tag。
 * 它同时是 `herta-reference.wav` 的 SHA-256 前 8 位（`b1a43133…`）。
 */
export const LEGACY_REFERENCE_TAG = "b1a43133";

/** 认领阶段。与上游同名同义（`preparing` 是瞬态，读状态的人可能看不到它）。 */
export type MiniMaxVoicePhase = "absent" | "preparing" | "ready" | "failed";

/** 与上游一致：失败原因 = HTTP 层的原因码，外加"没有可认领的克隆"。 */
export type MiniMaxVoiceError = MiniMaxFailure | "no_clone_key";

/** 给宿主/设置页读的一份事实（可 JSON 序列化，直接进 SSE 与端点）。 */
export interface MiniMaxVoiceReadout {
  phase: MiniMaxVoicePhase;
  voiceId?: string;
  host?: string;
  clonedAt?: string;
  lastUsedAt?: string;
  /** 最近一次合成花了多少**计费字符**（MiniMax 自己报的数）。 */
  lastBilledChars?: number;
  /** 本进程内累计的计费字符（重启归零；它是"这次会话花了多少"的答案）。 */
  billedCharsTotal?: number;
  lastError?: MiniMaxVoiceError;
  /** 冷却到期时间（有失败时才有）：设置页据此显示"多久后自动重试"。 */
  retryAt?: string;
}

export interface MiniMaxVoiceOptions {
  fetch: FetchLike;
  /** 按量计费密钥（异步：走 DSH 凭据服务）。 */
  key: () => Promise<string | null>;
  /** Token Plan 密钥（可选）。认领只需要**任意一把**。 */
  planKey?: () => Promise<string | null>;
  /** 状态文件读写（默认走 `$DSH_HOME/dsh-herta-minimax.json`）。 */
  load?: () => MiniMaxStateFile;
  save?: (state: MiniMaxStateFile) => void;
  hosts?: readonly string[];
  now?: () => number;
  log?: (line: string) => void;
  /** 状态变化回调（宿主用它推 SSE；只在**真的变了**时触发）。 */
  onChange?: (readout: MiniMaxVoiceReadout) => void;
  cooldownMs?: number;
  stampThrottleMs?: number;
}

export interface MiniMaxVoiceService {
  readout(): MiniMaxVoiceReadout;
  /** 可用于合成的克隆（没有就是 null）。 */
  voice(): { voiceId: string; host: string } | null;
  /** 认领一次（并发调用共享同一次网络往返）。 */
  prepare(): Promise<MiniMaxVoiceReadout>;
  /** 清掉记录与失败状态 —— 设置页「重新认领」按钮的前半步。 */
  reset(): MiniMaxVoiceReadout;
  /** 服务端说这个克隆已经不存在了：清记录 + 进冷却。 */
  markMissing(voiceId: string): void;
  /** 记一次"刚用过"（节流落盘）。 */
  /** 记账：这一单元花了多少计费字符（MiniMax 报的数）。没有它就没有「花了多少」的答案。 */
  stampUsed(billedChars?: number): void;
}

/** 克隆 id 是不是"她的"（上游按 tag 判断；这里用包含判定，与她 id 的形状一致）。 */
export function isHertaVoiceId(voiceId: string, tag = LEGACY_REFERENCE_TAG): boolean {
  return voiceId.includes(tag);
}

/** 把上游的 `createdTime`（数字秒/毫秒或字符串）折成毫秒；不认识就给兜底值。 */
function createdMs(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * 创建认领服务。
 *
 * 构造时**同步**读一次状态（读文件是同步的、且失败一律当空），所以 `readout()` 与
 * `voice()` 都是同步的 —— 宿主可以在任何地方问"现在有没有克隆"，不必 await。
 */
export function createMiniMaxVoiceService(opts: MiniMaxVoiceOptions): MiniMaxVoiceService {
  const log = opts.log ?? ((line: string) => console.log(`[herta-minimax] ${line}`));
  const now = opts.now ?? (() => Date.now());
  const cooldownMs = opts.cooldownMs ?? 10 * 60_000;
  const stampThrottleMs = opts.stampThrottleMs ?? 10 * 60_000;
  const load = opts.load ?? (() => readMiniMaxState());
  const save = opts.save ?? ((state: MiniMaxStateFile) => writeMiniMaxState(state));

  let state: MiniMaxStateFile = (() => {
    try {
      return load();
    } catch {
      return emptyState();
    }
  })();

  /** 瞬态失败（取消）不写盘，只影响本次 readout。 */
  let transientError: MiniMaxVoiceError | undefined;
  let lastStampAt = 0;
  let inFlight: Promise<MiniMaxVoiceReadout> | null = null;
  /**
   * 计费字符（进程级，不随克隆记录走）。
   *
   * 为什么值得单独记：MiniMax 每合成一次都会回一个 `billedChars`，而它以前**被丢掉**
   * （`onUsed` 收了参数没人用）—— 于是「这一档到底花了多少」在界面上没有任何答案，
   * 用户能看到的只有「静音不停合成」这行小字。
   */
  let billedCharsTotal = 0;
  let lastBilledChars: number | undefined;

  const record = () => cloneRecordOf(state);

  function readout(): MiniMaxVoiceReadout {
    const rec = record();
    /** 计费字符是**进程级**的事实（不属于某一条克隆记录），两条分支都要带上。 */
    const billing = {
      ...(lastBilledChars === undefined ? {} : { lastBilledChars }),
      ...(billedCharsTotal > 0 ? { billedCharsTotal } : {}),
    };
    if (rec !== null) {
      return {
        phase: "ready",
        voiceId: rec.voiceId,
        host: rec.host,
        clonedAt: rec.clonedAt,
        lastUsedAt: rec.lastUsedAt,
        ...billing,
      };
    }
    const cooling = adoptCoolingDown(state, now(), cooldownMs);
    const lastError = (state.adoptFailure as MiniMaxVoiceError | undefined) ?? transientError;
    const out: MiniMaxVoiceReadout = { phase: lastError === undefined ? "absent" : "failed", ...billing };
    if (lastError !== undefined) out.lastError = lastError;
    if (cooling && state.adoptAttemptAt !== undefined) {
      const at = Date.parse(state.adoptAttemptAt);
      if (Number.isFinite(at)) out.retryAt = new Date(at + cooldownMs).toISOString();
    }
    return out;
  }

  function emit(): MiniMaxVoiceReadout {
    const out = readout();
    try {
      opts.onChange?.(out);
    } catch (err) {
      // 回调坏掉不该影响认领本身。
      log(`onChange 抛错：${errorMessage(err)}`);
    }
    return out;
  }

  function persist(patch: Partial<MiniMaxStateFile>): void {
    state = { ...state, version: state.version || 1, ...patch };
    try {
      save(state);
    } catch (err) {
      log(`状态落盘失败：${errorMessage(err)}`);
    }
  }

  /** 记一次失败：**失败才写时间戳**（成功的尝试不需要冷却）。 */
  function fail(reason: MiniMaxVoiceError, options: { cooldown?: boolean } = {}): MiniMaxVoiceReadout {
    const cooldown = options.cooldown ?? true;
    log(`认领失败（${reason}）${cooldown ? `，${Math.round(cooldownMs / 60000)} 分钟内不再重试` : ""}`);
    if (cooldown) {
      persist({ adoptAttemptAt: new Date(now()).toISOString(), adoptFailure: reason });
    } else {
      transientError = reason;
    }
    return emit();
  }

  async function adopt(): Promise<MiniMaxVoiceReadout> {
    const existing = record();
    if (existing !== null) return emit();

    if (adoptCoolingDown(state, now(), cooldownMs)) {
      log("在冷却期内，跳过这次认领");
      return emit();
    }

    let key: string | null = null;
    try {
      key = await opts.key();
      if (key === null && opts.planKey !== undefined) key = await opts.planKey();
    } catch (err) {
      return fail("other");
    }
    if (key === null) {
      // 没填密钥不是"网络失败"：不该进冷却，否则用户填完还要等 10 分钟。
      log("没有 MiniMax 密钥，认领无从开始");
      transientError = "no_key";
      return emit();
    }

    transientError = undefined;
    try {
      // 控制面必须带截止时间：一个被接受却永不回话的连接会把认领永远挂住
      // （上游 2026-09-10 的教训）。probeHost 自带 per-host 截止时间，
      // listClones 这里另套一条。超时的 reason 是 TimeoutError → 分类成 network。
      const host = await probeHost(opts.fetch, key, undefined, opts.hosts, MINIMAX_CONTROL_TIMEOUT_MS);
      const clones = await withDeadline(MINIMAX_CONTROL_TIMEOUT_MS, undefined, (signal) =>
        listClones(opts.fetch, host, key, signal),
      );
      const mine = clones
        .filter((c) => isHertaVoiceId(c.voiceId))
        .map((c) => ({ voiceId: c.voiceId, createdMs: createdMs(c.createdTime, 0) }))
        .sort((a, b) => b.createdMs - a.createdMs);
      const newest = mine[0];
      if (newest === undefined) {
        // 账号上没有她的克隆 —— 而本插件不带克隆能力，所以这是终局失败（等冷却后再看）。
        return fail("no_clone_key");
      }
      // `undefined` 在 JSON.stringify 里会被丢掉 —— 所以"清掉上次的失败"只要把
      // 它设成 undefined 就够了，不需要额外的 delete。
      persist({
        voiceId: newest.voiceId,
        host,
        clonedAt: new Date(newest.createdMs || now()).toISOString(),
        adoptedTag: LEGACY_REFERENCE_TAG,
        adoptAttemptAt: new Date(now()).toISOString(),
        adoptFailure: undefined,
      });
      log(`已认领克隆 ${newest.voiceId}（${host}）`);
      return emit();
    } catch (err) {
      if (err instanceof MiniMaxError) {
        if (err.reason === "cancelled") {
          transientError = "cancelled";
          return emit();
        }
        return fail(err.reason);
      }
      log(`认领时未预期错误：${errorMessage(err)}`);
      return fail("other");
    }
  }

  return {
    readout,

    voice() {
      const rec = record();
      return rec === null ? null : { voiceId: rec.voiceId, host: rec.host };
    },

    prepare() {
      if (inFlight !== null) return inFlight;
      inFlight = adopt().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    reset() {
      log("已清掉克隆记录（等待重新认领）");
      transientError = undefined;
      persist({
        voiceId: undefined,
        host: undefined,
        clonedAt: undefined,
        lastUsedAt: undefined,
        adoptedTag: undefined,
        adoptAttemptAt: undefined,
        adoptFailure: undefined,
      });
      return emit();
    },

    markMissing(voiceId) {
      const rec = record();
      if (rec === null || rec.voiceId !== voiceId) return;
      log(`服务端说克隆 ${voiceId} 已不存在 —— 本插件不带克隆能力，转由宿主回落`);
      // 清记录 + 写冷却：冷却到期后会再列一次（若你在独立版里重新克隆过，就能捡回来）。
      persist({
        voiceId: undefined,
        host: undefined,
        clonedAt: undefined,
        lastUsedAt: undefined,
        adoptedTag: undefined,
        adoptAttemptAt: new Date(now()).toISOString(),
        adoptFailure: "voice_missing",
      });
      emit();
    },

    /**
     * 记账：这一单元花了多少**计费字符**（MiniMax 自己报的数，2026-09-30 起真的收下）。
     *
     * **累计在节流之前、也在 `rec === null` 早退之前**：节流是为了少写盘、
     * 认领记录缺失是另一件事，而**钱是按次花的** —— 不能因为「同一秒内第二次」
     * 或者「记录刚被删」就不计这笔账。
     */
    stampUsed(billedChars = 0) {
      if (Number.isFinite(billedChars) && billedChars > 0) {
        billedCharsTotal += billedChars;
        lastBilledChars = billedChars;
      }
      const rec = record();
      if (rec === null) return;
      const at = now();
      if (at - lastStampAt < stampThrottleMs) return;
      lastStampAt = at;
      persist({ lastUsedAt: new Date(at).toISOString() });
    },
  };
}
