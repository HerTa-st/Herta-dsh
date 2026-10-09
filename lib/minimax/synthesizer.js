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
                                                          
import { MINIMAX_HOSTS, MiniMaxError, defaultModelOf, synthesizePcm, withDeadline } from "./api.js";
                                                   
import { DEFAULT_ENDPOINT_SHAPE, shapeFor } from "./endpoint.js";
                                                                                        
import { errorMessage } from "./types.js";

/** 上游的 refusal 三态（会 doom 整个 utterance 的那三种）。 */
                                                              

/** 哪几种失败算 refusal。 */
export const REFUSALS                              = new Set                ([
  "auth",
  "invalid_key",
  "quota",
]);

/** 每单元的 HTTP 超时（上游同名常量）。 */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** `doomed` 集合的上限：只防内存无限涨，不参与正确性。 */
export const MAX_DOOMED = 64;

                                  
                  
               
 

                                            
                   
                                  
                                    
                                       
                          
                                      
                         
                                                
                                                        
    
                                          
                                                              
                                              
                                        
                                                    
                              
                                                 
                                    
                                                                  
                                           
                                       
                                             
                                                    
                                                                            
                                             
                                         
                                                      
                               
                            
                       
 

                                           
                  
                      
                   
                                     
                                 
                              
 

                                                               
                  
                    
                                     
 

/** Int16 PCM ↔ Float32 的来回换算（`applyEffect` 用）。 */
function int16ToFloat(samples            )               {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = (samples[i] ?? 0) / 32768;
  return out;
}

function floatToInt16(samples              )             {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

export function createMiniMaxSynthesizer(opts                           )                     {
  const log = opts.log ?? ((line        ) => console.log(`[herta-minimax] ${line}`));
  const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxInFlight = Math.max(1, opts.maxInFlight ?? 2);
  /** 请求形状。每次合成现问 —— 用户在设置里改了「接口形状」不该等到下次重启。
   *
   *  ⚠️ **最终形状由地址说了算**（`shapeFor`），不是由配置那一格说了算：填了中转站
   *  地址却把形状留在默认「官方原生」时，官方路径打在中转站上必然 404，
   *  而用户看到的是"配置全对、每句都没声"。见 `endpoint.ts` 的 `shapeFor`。 */
  const shapeAt = (host        )                => {
    const official = opts.officialHosts ?? MINIMAX_HOSTS;
    const thirdParty = opts.isThirdParty?.(host) ?? !official.includes(host);
    return shapeFor(host, opts.shape?.() ?? DEFAULT_ENDPOINT_SHAPE, thirdParty, official);
  };

  /** 当前模型名：现读（用户可能中途改设置），或者用构造时给的固定值。 */
  const currentModel = ()                     => {
    if (typeof opts.model === "function") return opts.model();
    return opts.model;
  };

  let disposed = false;
  let inFlight = 0;
  let lastFailure                        = null;
  let refusal                        = null;
  /** refusal 是在哪把密钥下产生的 —— 密钥变了就作废。 */
  let refusalKey                = null;
  let missingVoice                = null;
  const doomed = new Set        ();
  const waiters                    = [];
  const controllers = new Map                              ();

  const setRefusal = (next                       , key               )       => {
    const changed = refusal !== next;
    refusal = next;
    refusalKey = next === null ? null : key;
    // 只在**变化**时回调：否则每个失败单元都会往客户端推一条同样的状态。
    if (changed) opts.onRefusal?.(next);
  };

  /** 密钥换了就解除 refusal（语义 3）。 */
  const syncRefusalKey = (key               )       => {
    if (refusal !== null && refusalKey !== key) setRefusal(null, key);
  };

  /** 克隆换了就解除 missing 闩锁（上游 `currentVoice()` 的同一行为）。 */
  const syncMissingVoice = (voiceId               )       => {
    if (missingVoice !== null && missingVoice !== voiceId) missingVoice = null;
  };

  const acquire = ()                => {
    if (inFlight < maxInFlight) {
      inFlight += 1;
      return Promise.resolve();
    }
    return new Promise      ((resolve) => {
      waiters.push(() => {
        inFlight += 1;
        resolve();
      });
    });
  };

  const release = ()       => {
    inFlight -= 1;
    const next = waiters.shift();
    if (next !== undefined) next();
  };

  const track = (utteranceId        , ac                 )               => {
    const set = controllers.get(utteranceId) ?? new Set                 ();
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

    async synthesize(req                  )                                   {
      if (disposed || !opts.enabled()) return null;
      const voice = opts.voice();
      if (voice === null) return null;
      syncMissingVoice(voice.voiceId);
      // 同一个 utterance 在 refusal 之后不再发请求（语义 2）。
      if (doomed.has(req.utteranceId)) return null;

      let key                = null;
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
            model: currentModel(),
            shape: shapeAt(voice.host),
            officialHosts: opts.officialHosts,
            peak: opts.peak,
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
            setRefusal(err.reason                  , key);
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

    cancel(utteranceId        ) {
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


//# sourceURL=synthesizer.ts