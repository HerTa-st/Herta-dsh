/**
 * MiniMax 云端合成器 —— DSH 宿主的 `SpeechSynthesizer` 实现（上游移植件）。
 *
 * 上游：`Herta-src/packages/gui/src/main/tts/minimax-synthesizer.ts`。
 * 结构照 `dsh-herta/src/host/mimo-tts.js`（同一契约的另一家实现），语义照上游。
 *
 * ## 五条必须守住的语义（改动前先读这段）
 *
 *  1. **失败与取消都 resolve `null`**，绝不抛给调用方：该单元退化成打字节奏，
 *     整段回复照常推进。抛出去会把一次偶发网络抖动变成"回复卡住"。
 *  2. **`refusal` 是全局的、并且会 doom 整个 utterance**：`auth` / `invalid_key` /
 *     `quota` 三种原因下，该 utterance 剩下的单元**不再发请求**（密钥错了，
 *     再发一百次也是错的），而下一条 utterance 只探一次。任一单元成功即清除。
 *  3. **密钥变了就清除 refusal**：改完密钥立刻恢复发声，不必等下一次重启。
 *  4. **`voice_missing` 不 doom**：它只是说"这个克隆没了"，由宿主去决定回落
 *     （本插件不带克隆能力，所以宿主会显式回落本地模型）。
 *  5. **`available()` 必须是同步的活开关**，而 DSH 的凭据服务是异步的 ——
 *     所以这里收两个注入口：`keyKnown()`（同步布尔，只服务 available()）与
 *     `key()`（异步、每次现读值）。**缓存的是布尔，不是明文密钥。**
 */
import type { FetchLike, MiniMaxFailure } from "./api.js";
import { MiniMaxError, MINIMAX_DEFAULT_MODEL, synthesizePcm, withDeadline } from "./api.js";
import type { SpeechSynthesizer, SynthesizedAudio, SynthesisRequest } from "./types.js";
import { errorMessage } from "./types.js";

/** 上游的 refusal 三态（会 doom 整个 utterance 的那三种）。 */
export type MiniMaxRefusal = "auth" | "invalid_key" | "quota";

/** 哪几种失败算 refusal。 */
export const REFUSALS: ReadonlySet<MiniMaxFailure> = new Set<MiniMaxFailure>([
  "auth",
  "invalid_key",
  "quota",
]);

/** 每单元的 HTTP 超时（上游同名常量）。 */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** `doomed` 集合的上限：只防内存无限涨，不参与正确性。 */
export const MAX_DOOMED = 64;

export interface MiniMaxVoiceRef {
  voiceId: string;
  host: string;
}

export interface MiniMaxSynthesizerOptions {
  fetch: FetchLike;
  /** 每次合成前现读密钥（异步：走 DSH 凭据服务）。 */
  key: () => Promise<string | null>;
  /** 同步的"密钥存在"标志，只服务 `available()`。 */
  keyKnown: () => boolean;
  voice: () => MiniMaxVoiceRef | null;
  enabled: () => boolean;
  model?: string;
  /** 音色处理（上游用它套"空间站终端"的音色）。收 Float32，返回 Float32。 */
  applyEffect?: (samples: Float32Array, sampleRate: number) => Float32Array;
  onVoiceMissing?: (voiceId: string) => void;
  onUsed?: (billedChars: number) => void;
  onRefusal?: (reason: MiniMaxRefusal | null) => void;
  log?: (line: string) => void;
  requestTimeoutMs?: number;
  maxInFlight?: number;
}

export interface MiniMaxSynthesizerStatus {
  keySet: boolean;
  voiceReady: boolean;
  inFlight: number;
  lastFailure: MiniMaxFailure | null;
  refusal: MiniMaxRefusal | null;
  missingVoice: string | null;
}

export interface MiniMaxSynthesizer extends SpeechSynthesizer {
  dispose(): void;
  cancelAll(): void;
  status(): MiniMaxSynthesizerStatus;
}

/** Int16 PCM ↔ Float32 的来回换算（`applyEffect` 用）。 */
function int16ToFloat(samples: Int16Array): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = (samples[i] ?? 0) / 32768;
  return out;
}

function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

export function createMiniMaxSynthesizer(opts: MiniMaxSynthesizerOptions): MiniMaxSynthesizer {
  const log = opts.log ?? ((line: string) => console.log(`[herta-minimax] ${line}`));
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = opts.model ?? MINIMAX_DEFAULT_MODEL;
  const maxInFlight = Math.max(1, opts.maxInFlight ?? 2);

  let disposed = false;
  let inFlight = 0;
  let lastFailure: MiniMaxFailure | null = null;
  let refusal: MiniMaxRefusal | null = null;
  /** refusal 是在哪把密钥下产生的 —— 密钥变了就作废。 */
  let refusalKey: string | null = null;
  let missingVoice: string | null = null;
  const doomed = new Set<string>();
  const waiters: Array<() => void> = [];
  const controllers = new Map<string, Set<AbortController>>();

  const setRefusal = (next: MiniMaxRefusal | null, key: string | null): void => {
    const changed = refusal !== next;
    refusal = next;
    refusalKey = next === null ? null : key;
    // 只在**变化**时回调：否则每个失败单元都会往客户端推一条同样的状态。
    if (changed) opts.onRefusal?.(next);
  };

  /** 密钥换了就解除 refusal（语义 3）。 */
  const syncRefusalKey = (key: string | null): void => {
    if (refusal !== null && refusalKey !== key) setRefusal(null, key);
  };

  /** 克隆换了就解除 missing 闩锁（上游 `currentVoice()` 的同一行为）。 */
  const syncMissingVoice = (voiceId: string | null): void => {
    if (missingVoice !== null && missingVoice !== voiceId) missingVoice = null;
  };

  const acquire = (): Promise<void> => {
    if (inFlight < maxInFlight) {
      inFlight += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      waiters.push(() => {
        inFlight += 1;
        resolve();
      });
    });
  };

  const release = (): void => {
    inFlight -= 1;
    const next = waiters.shift();
    if (next !== undefined) next();
  };

  const track = (utteranceId: string, ac: AbortController): (() => void) => {
    const set = controllers.get(utteranceId) ?? new Set<AbortController>();
    set.add(ac);
    controllers.set(utteranceId, set);
    return () => {
      set.delete(ac);
      if (set.size === 0) controllers.delete(utteranceId);
    };
  };

  return {
    available() {
      return !disposed && opts.enabled() && opts.keyKnown() && opts.voice() !== null;
    },

    async synthesize(req: SynthesisRequest): Promise<SynthesizedAudio | null> {
      if (disposed || !opts.enabled()) return null;
      const voice = opts.voice();
      if (voice === null) return null;
      syncMissingVoice(voice.voiceId);
      // 同一个 utterance 在 refusal 之后不再发请求（语义 2）。
      if (doomed.has(req.utteranceId)) return null;

      let key: string | null = null;
      try {
        key = await opts.key();
      } catch (err) {
        lastFailure = "other";
        log(`读密钥失败：${errorMessage(err)}`);
        return null;
      }
      if (key === null) {
        lastFailure = "no_key";
        return null;
      }
      syncRefusalKey(key);

      const ac = new AbortController();
      const untrack = track(req.utteranceId, ac);
      await acquire();
      if (disposed || ac.signal.aborted) {
        release();
        untrack();
        return null;
      }

      // 超时与取消**都走 abort**，但由 api 层按 reason 的名字区分（`abortedAs`）：
      // 超时的 reason 是 TimeoutError → `network`；调用方取消被原样转发 → `cancelled`。
      // 分类只有那一处，这里不再判第二遍 —— 早先我自己在本地用 AbortError 造超时，
      // 结果被 api 分类成 cancelled，超时被静默吞掉（连 lastFailure 都不留）。
      try {
        const out = await withDeadline(timeoutMs, ac.signal, (signal) =>
          synthesizePcm(opts.fetch, voice.host, key, {
            voiceId: voice.voiceId,
            text: req.text,
            model,
            signal,
          }),
        );
        lastFailure = null;
        if (refusal !== null) setRefusal(null, key);
        opts.onUsed?.(out.billedChars);
        let samples = out.samples;
        if (opts.applyEffect !== undefined && samples.length > 0) {
          samples = floatToInt16(opts.applyEffect(int16ToFloat(samples), out.sampleRate));
        }
        return {
          samples,
          sampleRate: out.sampleRate,
          durationMs: out.sampleRate > 0 ? (samples.length / out.sampleRate) * 1000 : 0,
        };
      } catch (err) {
        // 取消是静默的（语义 1）：调用方撤回了一个不再需要的单元，这不是失败。
        // 注意**超时不算取消** —— 超时走的是 withDeadline 自己那条 signal，
        // `ac.signal` 并没有被中止。
        if (err instanceof MiniMaxError && err.reason === "cancelled") return null;
        if (ac.signal.aborted) return null;
        if (err instanceof MiniMaxError) {
          lastFailure = err.reason;
          if (err.reason === "voice_missing") {
            missingVoice = voice.voiceId;
            log(`克隆 ${voice.voiceId} 已不存在（2054）—— 交给宿主决定回落`);
            opts.onVoiceMissing?.(voice.voiceId);
            return null;
          }
          if (REFUSALS.has(err.reason)) {
            doomed.add(req.utteranceId);
            if (doomed.size > MAX_DOOMED) {
              const oldest = doomed.values().next().value;
              if (oldest !== undefined) doomed.delete(oldest);
            }
            log(`单元 ${req.seq} 被拒绝（${err.reason}）：${err.message}`);
            setRefusal(err.reason as MiniMaxRefusal, key);
            return null;
          }
          log(`单元 ${req.seq} 失败（${err.reason}）：${err.message}`);
          return null;
        }
        lastFailure = "other";
        log(`单元 ${req.seq} 未预期错误：${errorMessage(err)}`);
        return null;
      } finally {
        release();
        untrack();
      }
    },

    cancel(utteranceId: string) {
      const set = controllers.get(utteranceId);
      if (set === undefined) return;
      for (const ac of set) ac.abort(new DOMException("cancelled", "AbortError"));
    },

    cancelAll() {
      for (const set of controllers.values()) {
        for (const ac of set) ac.abort(new DOMException("cancelled", "AbortError"));
      }
      controllers.clear();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const set of controllers.values()) {
        for (const ac of set) ac.abort(new DOMException("disposed", "AbortError"));
      }
      controllers.clear();
    },

    status() {
      return {
        keySet: opts.keyKnown(),
        voiceReady: opts.voice() !== null,
        inFlight,
        lastFailure,
        refusal,
        missingVoice,
      };
    },
  };
}
