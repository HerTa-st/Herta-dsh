/**
 * 说话管线 —— **纯逻辑**：帧进、PCM 帧出。零 DSH 依赖、零裸包导入。
 *
 * ## 为什么单独一个文件
 *
 * 「什么时候念、念哪一段、被否决时丢不丢、到上限怎么办」是这一组里最容易写错的
 * 地方，而它与 DSH 无关 —— 全是状态机。分开之后它可以被单测逐条钉住
 * （`scripts/test-minimax-pipeline.mjs`），不需要拉起 DSH、不需要连 MiniMax、
 * 也不需要浏览器。宿主接线那边（`src/host/minimax-voice.js`）只剩"接谁"的问题。
 *
 * ## 三条边界（用户决策，改动前先读）
 *
 *  1. **只念助手回复的正文**：只认 `text-delta`；`reasoning-delta`、
 *     `tool-call-delta`、工具结果一律不念。
 *  2. **不念子代理的东西**：见 `isTopLevelAgent`。
 *  3. **每轮字符上限**：到顶就只显示不发声，并让状态可见。
 */
                                               
import { segmentSpeechUnits } from "./segment.js";

/** 每轮最多合成多少个字符（用户决策：800）。 */
export const MAX_TURN_CHARS = 800;

/**
 * 哪些引擎**会真的出声** —— 这是行为，不是偏好。
 *
 *   · `minimax` —— 云端优先，云端不可用时**显式回落本地模型**（回落写在
 *     `synthUnit` 里，理由记进 `engineNote` 给用户看）；
 *   · `local`   —— 直接本地合成。2026-09-28 起这一档真的会念（在这之前它只在
 *     上面那条回落里被调用，"选本地模型"等于静音）；
 *   · `fish`    —— 走 Fish Audio 云端（`fish-tts.js`）。**失败不回落**：用户明确
 *     选了这一档，换成别的声音比没声音更糟 —— 理由进 `engineNote` 给用户看；
 *   · `mimo`    —— 合成器尚未接线（`mimo-tts.js` 全仓零调用点），不发声。
 *
 * 判据放在这里，而不是在宿主与工具里各写一遍：`onStream` 与 `sayText` 两道闸门、
 * 以及 `herta_say` / 试听给用户的解释，读的都是这一个函数。
 *
 * @param engine - `voiceEngine` 的当前值（任意字符串，来自配置）。
 * @returns 这个引擎是否会把音频推出来。
 */
export function speaksFor(engine        )          {
  // [herta-fish-engine] Fish 也算会说话的引擎
  return engine === "minimax" || engine === "local" || engine === "fish";
}

/** 一个单元合成出来的东西（宿主注入的 `synthUnit` 的返回形状）。 */
                                        
                      
                     
                      
                                             
                  
 

/** 管线需要的"一个单元"请求（与 `synthesizer.ts` 的 `SynthesisRequest` 同形）。 */
                              
                      
              
               
                    
 

/** SSE 帧。三种：音频、停止、状态。 */
                        
     
                  
                          
                  
                   
                         
                         
                         
                     
     
                                            
                            

/** 广播器（`bus.send` 是管线唯一用到的方法）。 */
                           
                                
                   
 

/** Int16 PCM → base64（SSE 是文本协议；iframe 那份播放器要的是 Int16Array）。 */
export function samplesToBase64(samples                                )         {
  const view = samples instanceof Int16Array ? samples : Int16Array.from(samples ?? []);
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString("base64");
}

/**
 * 这个 agent 的正文值不值得念。
 *
 * 只念**顶层会话**：子代理（`origin === "subagent"` 或带 `parentSession`）的文字
 * 是给主 agent 看的 —— 念出来既吵，又是按字符真花钱的。
 *
 * 读不到 `session.header`（内核结构变了 / 被裁剪）时返回 true：宁可多念一次，
 * 也不要因为读不到内部结构就把主 agent 静音。
 */
export function isTopLevelAgent(agent         )          {
  try {
    const header = (agent                                                                                        )?.session
      ?.header;
    if (header === undefined || header === null) return true;
    if (header.origin === "subagent") return false;
    return header.parentSession === undefined;
  } catch {
    return true;
  }
}

                                        
                
                                                                                
                         
                                        
                                                                                     
                                             
                               
                         
                               
                        
                                            
     
                                           
    
                                                          
                                          
                  
     
                                 
 

                 
               
                                 
                 
                
 

                     
             
                
                             
              
                
                  
                           
                     
                      
                     
 

/**
 * 建管线。依赖全部注入 —— 这个函数不读任何全局状态。
 */
export function createSpeechPipeline(opts                       ) {
  const { bus, engineOf, synthUnit } = opts;
  const log = opts.log ?? (() => {});
  const cancelUnit = opts.cancelUnit ?? (() => {});
  const noteState = opts.noteState ?? (() => {});
  const isSpeakable = opts.isSpeakable ?? (() => true);
  const repliesEnabled = opts.repliesEnabled ?? (() => true);
  const maxTurnChars = opts.maxTurnChars ?? MAX_TURN_CHARS;

  /** 每个 agent 一份：它的 tag 与当前 utterance。WeakMap —— agent 释放即回收。 */
  const agents = new WeakMap                                                      ();
  let utteranceSeq = 0;
  let agentSeq = 0;
  let saySeq = 0;
  let cappedUtterances = 0;
  /**
   * 最近一次「撞到上限」的事实（`null` = 还没撞过）。
   *
   * 为什么要留下它而不是只留一个计数：计数只能说「发生过几次」，用户看到的是
   * 「她说了一半停了」——他需要知道的是**这一轮念了多少、上限是多少**。
   */
  let lastCap                                                            = null;
  let ignoredFrames = 0;
  /** 被 `realtimeVoice` 关掉而没念的帧数（诊断用：能区分"关了"与"坏了"）。 */
  let mutedFrames = 0;

  const stateFor = (agent        ) => {
    let s = agents.get(agent);
    if (s === undefined) {
      s = { tag: `a${(agentSeq += 1)}`, utterance: null };
      agents.set(agent, s);
    }
    return s;
  };

  function open(tag        , label        )            {
    return {
      id: `${tag}-${(utteranceSeq += 1)}`,
      label,
      blocks: new Map(),
      seq: 0,
      chars: 0,
      capped: false,
      streaming: true,
      cancelled: false,
    };
  }

  const blockFor = (utt           , index        )        => {
    let b = utt.blocks.get(index);
    if (b === undefined) {
      b = { text: "", spoken: 0, done: false };
      utt.blocks.set(index, b);
    }
    return b;
  };

  /**
   * 已闭合的单元。`finished=false` 时**丢掉最后一个** —— 它可能还在长，
   * 现在念出来会和下一帧的切分结果不一致（上游那条"前缀稳定"的承诺正是为了
   * 这个：已闭合的单元不再变）。
   */
  function closedUnits(text        , finished         )               {
    const units = segmentSpeechUnits(Array.from(text), finished, "zh");
    return finished ? units : units.slice(0, -1);
  }

  /** 把一个 block 里新闭合的单元发出去。 */
  function pump(utt           , block       )       {
    if (utt.cancelled) return;
    const units = closedUnits(block.text, block.done);
    for (let i = block.spoken; i < units.length; i += 1) {
      block.spoken = i + 1;
      const body = typeof units[i].speak === "string" ? units[i].speak.trim() : "";
      if (body === "") continue;
      void dispatch(utt, body);
    }
  }

  /** 发一个单元去合成，并把 PCM 推给客户端。返回结果（供 `herta_say` 报告引擎）。 */
  function dispatch(utt           , text        )                                        {
    if (utt.cancelled || utt.capped) return Promise.resolve(null);
    if (utt.chars + text.length > maxTurnChars) {
      utt.capped = true;
      cappedUtterances += 1;
      // 2026-09-30：以前这里只写日志 + 一个累计计数，用户那边**看不出来发生了什么**，
      // 只感觉「她说了一半停了」。现在把「上限多少、念了多少」也放进状态里，
      // 客户端那一行才能说一句人话。
      lastCap = { at: new Date().toISOString(), spokenChars: utt.chars, limit: maxTurnChars };
      log(`本轮语音已到上限（${maxTurnChars} 字）：后面的内容只显示不发声`);
      noteState();
      return Promise.resolve(null);
    }
    utt.chars += text.length;
    const req              = { utteranceId: utt.id, seq: (utt.seq += 1), text, lang: "zh" };
    return Promise.resolve()
      .then(() => synthUnit(req))
      .then((out) => {
        if (out === null || out === undefined) {
          log(`单元 ${req.seq} 没有音频（${utt.id}）`);
          return null;
        }
        // 被掐掉的 utterance：结果直接丢弃（否决之后不该再听到旧台词）。
        if (utt.cancelled) return null;
        bus.send({
          kind: "tts",
          utteranceId: utt.id,
          seq: req.seq,
          text,
          samplesB64: samplesToBase64(out.samples),
          sampleRate: out.sampleRate,
          durationMs: out.durationMs ?? 0,
          engine: out.engine ?? "minimax",
        });
        return out;
      })
      .catch((err         ) => {
        log(`单元 ${req.seq} 合成失败：${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
  }

  function closeForVeto(utt           )          {
    if (!utt.streaming) return false; // 正常收尾过的不要掐（会把正在播的尾音切掉）
    utt.streaming = false;
    utt.cancelled = true;
    cancelUnit(utt.id);
    bus.send({ kind: "ttsStop", utteranceId: utt.id });
    return true;
  }

  return {
    /** `agent/assistant-stream` 的监听体。 */
    onStream(payload                                                     )       {
      const agent = payload?.agent;
      const frame = payload?.frame;
      if (agent === undefined || frame === undefined) return;
      // 不发声的引擎（`mimo`）整条管线静默：帧不念、也**不计数** —— 那是引擎的选择，
      // 既不是"被 realtimeVoice 关掉"也不是"坏了"；混进 `mutedFrames` 只会让
      // 设置页那行诊断把三种原因看成一种。
      if (!speaksFor(engineOf())) return;
      if (!repliesEnabled()) {
        mutedFrames += 1;
        return;
      }
      if (!isSpeakable(agent)) {
        ignoredFrames += 1;
        return;
      }
      const s = stateFor(agent);
      if (frame.type === "start") {
        if (s.utterance !== null) s.utterance.streaming = false; // 上一段收尾
        s.utterance = open(s.tag, `turn ${String(frame.turn)}`);
        return;
      }
      if (s.utterance === null) s.utterance = open(s.tag, "implicit");
      const utt = s.utterance;

      if (frame.type === "end") {
        for (const block of utt.blocks.values()) {
          block.done = true;
          pump(utt, block);
        }
        utt.streaming = false;
        log(`${utt.id}（${utt.label}）收尾：${utt.seq} 个单元、${utt.chars} 字`);
        return;
      }

      const chunk = frame.chunk                                                                   ;
      if (chunk === undefined) return;
      if (chunk.type === "text-delta") {
        const block = blockFor(utt, typeof chunk.index === "number" ? chunk.index : 0);
        block.text += typeof chunk.text === "string" ? chunk.text : "";
        pump(utt, block);
        return;
      }
      if (chunk.type === "block-end") {
        const block = blockFor(utt, typeof chunk.index === "number" ? chunk.index : 0);
        block.done = true;
        pump(utt, block);
      }
      // 其余 chunk（reasoning / tool-call / usage / finish / block-start）不念。
    },

    /** `agent/turn-stopping` 的监听体：否决/重说时掐掉还在流的这一段。 */
    onTurnStopping(payload                    )       {
      const agent = payload?.agent;
      if (agent === undefined) return;
      const s = agents.get(agent);
      if (s === undefined || s.utterance === null) return;
      if (closeForVeto(s.utterance)) {
        log(`turn 边界时 ${s.utterance.id} 仍在流式：掐掉（多半是复核否决后要重说）`);
      }
    },

    /** `herta_say` / 试听用：立刻把一段文本说出来，返回实际用了哪条引擎。 */
    async sayText(rawText        )                                        {
      if (!speaksFor(engineOf())) return null;
      const text = String(rawText ?? "").trim();
      if (text === "") return null;
      const utt = open(`say${(saySeq += 1)}`, "herta_say");
      const units = segmentSpeechUnits(Array.from(text), true, "zh");
      const results                                      = [];
      for (const unit of units) {
        const body = typeof unit.speak === "string" ? unit.speak.trim() : "";
        if (body === "") continue;
        results.push(await dispatch(utt, body));
      }
      utt.streaming = false;
      const hit = results.find((r) => r !== null && r !== undefined);
      return hit ?? null;
    },

    /**
     * 整段一次合成 —— 「点哪段读哪段」专用，**不切分**。
     *
     * 为什么另开一个入口而不是给 `sayText` 加开关：`sayText` 的调用方还有试听
     * 和自动念回复，它们的切分是对的（每片十几秒内就开口）。只有点击那条路吃亏，
     * 而且吃在两头：
     *
     *   · **等待**：一次云端往返实测约 4.8 秒，切成四片就是四个排队 —— 十几秒。
     *   · **存档对不上**：界面按「合成它用的那段文字」存档，存进去的是碎片；
     *     而点击给的是一整段，钥匙永远对不上，于是每点一次都从头再来一遍。
     *
     * `token` 由界面生成并塞进 utteranceId —— 于是界面**确知**哪一帧是它要的
     * 那一帧，不必靠「第一帧多半是我的」这种猜测。
     */
    async sayWhole(rawText        , token         )                                        {
      if (!speaksFor(engineOf())) return null;
      const text = String(rawText ?? "").trim();
      if (text === "") return null;
      const units = segmentSpeechUnits(Array.from(text), true, "zh");
      const whole = units
        .map((u) => (typeof u.speak === "string" ? u.speak.trim() : ""))
        .filter((s) => s !== "")
        .join("");
      if (whole === "") return null;
      const tag = typeof token === "string" && token !== "" ? `say-${token}` : `say${(saySeq += 1)}`;
      const utt = open(tag, "herta_say");
      const out = await dispatch(utt, whole);
      utt.streaming = false;
      return out ?? null;
    },

    stats() {
      return {
        cappedUtterances,
        lastCap: lastCap === null ? null : { ...lastCap },
        ignoredFrames,
        mutedFrames,
        utterances: utteranceSeq,
      };
    },
  };
}

/** SSE 心跳：没有它，中间的代理/浏览器会在一段时间后悄悄收掉长连接。 */
export const SSE_HEARTBEAT_MS = 30_000;

/**
 * 一个极小的 SSE 广播器。
 *
 * 不做断线重放：浏览器半侧在页面加载时就订阅了，正常时序下不需要。页面在回复
 * 中途刷新会丢掉已经推过的帧 —— 这条局限写在这里，等真遇到再说（补重放要么给
 * 每条 utterance 留环形缓冲，要么让客户端按 seq 补拉，都不是现在该猜的）。
 */
export function createEventBus(log                         = () => {}) {
  const clients = new Set                                                                                                        ();
  let heartbeat                                        = null;

  const stopHeartbeat = () => {
    if (heartbeat === null) return;
    clearInterval(heartbeat);
    heartbeat = null;
  };

  return {
    add(res                                                                                                        ) {
      clients.add(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // 有些代理会缓冲 text/event-stream；这一条让它们别缓冲。
        "X-Accel-Buffering": "no",
      });
      res.write(": connected\n\n");
      if (heartbeat === null) {
        heartbeat = setInterval(() => {
          for (const client of clients) {
            try {
              client.write(": hb\n\n");
            } catch {
              clients.delete(client);
            }
          }
          if (clients.size === 0) stopHeartbeat();
        }, SSE_HEARTBEAT_MS);
        // 心跳不该拖住进程退出。
        (heartbeat                          ).unref?.();
      }
      log(`SSE 客户端接入（当前 ${clients.size}）`);
    },
    remove(res         ) {
      clients.delete(res         );
      if (clients.size === 0) stopHeartbeat();
    },
    send(frame            ) {
      if (clients.size === 0) return;
      const line = `data: ${JSON.stringify(frame)}\n\n`;
      for (const client of clients) {
        try {
          client.write(line);
        } catch {
          clients.delete(client);
        }
      }
    },
    count() {
      return clients.size;
    },
    stop() {
      stopHeartbeat();
      clients.clear();
    },
  };
}


//# sourceURL=pipeline.ts