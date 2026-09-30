/**
 * MiniMax 语音在**浏览器半侧**的两件纯逻辑：
 *
 *   1. `decodePcmFrame` —— SSE 帧里的 base64 → `Int16Array`（小端 16 bit 单声道）
 *   2. `createPlaybackQueue` —— 按 utteranceId/seq 交付的播放队列状态机
 *
 * ## 为什么这个文件**零 import**
 *
 * 它是这一组里唯一能逐条钉住行为的地方（顺序、去重、打断、停止都是状态机，
 * 而 WebAudio / postMessage / EventSource 都不是），所以必须能在 Node 里直接跑。
 * Node 24 的类型剥离只处理「不需要解析模块」的 TS：一旦有 import，就得靠
 * resolve hook 或先编译（宿主那条 minimax 链路就是这么做的，见
 * `scripts/build-minimax.mjs`）。这里**故意一行 import 都不写**，于是
 * `scripts/test-minimax-pcm.mjs` 可以直接 `import … from "../src/client/minimax-pcm.ts"`。
 * 代价只是所有类型要自己声明 —— 值得。
 *
 * 又因为「零运行时依赖」是硬约束，base64 也不走 `Buffer`（浏览器里没有）或
 * `atob`（Node 里有，但两边行为不完全一致）：查表自己解，两个环境对同一份代码
 * 求值，结果逐字节相同。
 */

/** 一条 `tts` 帧解出来的音频（`samples` 是小端 Int16 单声道 PCM）。 */
export interface PcmFrame {
  readonly samples: Int16Array;
  /** 字节数（= `samples.length * 2`）。诊断与告警用。 */
  readonly byteLength: number;
  /** 解码时忽略掉的非法字符数（换行、空白、截断产生的伪字符，正常是 0）。 */
  readonly skippedChars: number;
}

/** 一个排到队的播放单元：帧里的东西 + 交付时要用的身份。 */
export interface PlaybackItem<T = unknown> {
  readonly utteranceId: string;
  readonly seq: number;
  readonly payload: T;
}

export type PushResult = "playing" | "queued" | "duplicate" | "stopped";

export interface PlaybackQueueOptions<T = unknown> {
  /**
   * 轮到它了 —— 现在开始播。
   *
   * **播完之后必须调 `queue.complete(utteranceId, seq)`**，参数就是这里收到的
   * `item.utteranceId` / `item.seq`（WebAudio 那条路在 `source.onended` 与兜底
   * 定时器里调）。队列据此交付下一个 seq。不做「onPlay 返回值」那一套是有意的：
   * 返回一个函数会诱使调用方忘了调，而一个显式的方法在两条播放路径上写法一致。
   */
  onPlay: (item: PlaybackItem<T>) => void;
  /**
   * 要停了 —— 停掉**真实音频**。两种触发：
   *   · `push` 换了 utteranceId（打断上一条）
   *   · `stop(utteranceId)`
   *
   * 队列只管自己的状态，音频是调用方的事（它才知道 `AudioBufferSourceNode`
   * 或 iframe 在哪里）。只在这条 utterance **确实还有活的东西**（正在播或在排队）
   * 时触发，所以「空停」不会白叫一次。
   */
  onStop?: (utteranceId: string) => void;
  log?: (line: string) => void;
}

/** 队列的自述状态（诊断标记与测试断言用）。 */
export interface PlaybackQueueState {
  /** 当前这条 utterance；空闲时 null。 */
  readonly current: string | null;
  /** 正在播的 seq；空闲时 null。 */
  readonly playing: number | null;
  /** 已排到队、还没轮到播的 seq（升序）。 */
  readonly queued: readonly number[];
}

export interface PlaybackQueue<T = unknown> {
  /**
   * 收一个单元。返回 `"playing"`（立刻交付）/ `"queued"`（排在后面）/
   * `"duplicate"`（同一个 utterance 里这个 seq 已经收过，丢弃）/
   * `"stopped"`（这帧根本不合法，丢弃 —— 不是「已停」那条 utterance）。
   */
  push(utteranceId: string, seq: number, payload: T): PushResult;
  /**
   * 当前这个单元播完了 —— 交付下一个。
   *
   * `{utteranceId, seq}` 必须与交付时收到的那个一致：播放层的兜底定时器会晚于
   * 真实结束触发，只认序号才不会把队首的下一段误当成"播完了"。
   */
  complete(utteranceId: string, seq: number): void;
  /** 停一条 utterance：清掉它排队的，并让正在播的那条走 `onStop`。 */
  stop(utteranceId: string): void;
  /** 清空一切（不触发 `onStop`：调用方自己知道要停什么）。 */
  reset(): void;
  state(): PlaybackQueueState;
}

/** base64 字符 → 6 bit 值；非法字符与 `=` 都是 -1。128 项覆盖全部 ASCII。 */
const B64_VALUE: Int8Array = ((): Int8Array => {
  const table = new Int8Array(128).fill(-1);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i += 1) table[alphabet.charCodeAt(i)] = i;
  return table;
})();

/**
 * base64 → 字节。
 *
 * 宽容是**刻意的**：base64 里混进换行/空白（有些代理会折行）不该让整段音频消失，
 * 所以非法字符计一个数、跳过。真正会抛错的是「字节数为奇数」——那是凑不齐一个
 * 16 bit 采样，属于帧坏了，见 `decodePcmFrame`。
 */
function decodeBase64ToBytes(input: string): { bytes: Uint8Array; skipped: number } {
  let cleanLength = 0;
  for (let i = 0; i < input.length; i += 1) {
    const at = input.charCodeAt(i);
    if (at < 128 && B64_VALUE[at]! >= 0) cleanLength += 1;
  }
  const bytes = new Uint8Array(Math.floor((cleanLength * 3) / 4));
  let byteIndex = 0;
  let accumulator = 0;
  let bits = 0;
  let skipped = 0;
  let padding = 0;

  for (let i = 0; i < input.length; i += 1) {
    const at = input.charCodeAt(i);
    const value = at < 128 ? B64_VALUE[at]! : -1;
    if (value < 0) {
      // `=` 是合法的填充：它出现的位置就是数据的末尾。
      if (at === 61) padding += 1;
      else skipped += 1;
      continue;
    }
    if (padding > 0) {
      // 填充之后再出现数据字符：这一帧坏了，但不值得为它静音，跳过并记账。
      skipped += 1;
      continue;
    }
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = (accumulator >> bits) & 0xff;
      byteIndex += 1;
    }
  }
  return {
    bytes: byteIndex === bytes.length ? bytes : bytes.subarray(0, byteIndex),
    skipped,
  };
}

/**
 * 解一条 `tts` 帧的 `samplesB64`。
 *
 * 空串 → 空数组（宿主对「没有音频」的单元根本不发帧，但空帧不该炸掉播放队列）。
 * 非字符串 → 抛 TypeError。字节数为奇数 → 抛 Error：那是**真的坏了**，
 * 静默吞掉只会让人以为「音量没开」。
 *
 * @param samplesB64 - 帧里的 base64 字段。
 * @returns 小端 Int16 单声道 PCM。
 */
export function decodePcmFrame(samplesB64: string): PcmFrame {
  if (typeof samplesB64 !== "string") {
    throw new TypeError(`decodePcmFrame 需要 string，收到 ${typeof samplesB64}`);
  }
  if (samplesB64 === "") return { samples: new Int16Array(0), byteLength: 0, skippedChars: 0 };

  const { bytes, skipped } = decodeBase64ToBytes(samplesB64);
  if (bytes.length % 2 !== 0) {
    throw new Error(
      `PCM 长度不是 16 bit 的整数倍：${bytes.length} 字节（base64 ${samplesB64.length} 字符）`,
    );
  }
  // 复制一份而不是直接建视图：`Uint8Array` 的 buffer 起点由分配决定，
  // `Int16Array` 需要 2 字节对齐（未对齐会抛 RangeError）。
  const aligned = new Int16Array(bytes.length / 2);
  for (let i = 0; i < aligned.length; i += 1) {
    const lo = bytes[i * 2]!;
    const hi = bytes[i * 2 + 1]!;
    // 小端：低字节在前。显式拼而不用 `Int16Array` 视图，也就不必担心对齐。
    aligned[i] = ((hi << 8) | lo) << 16 >> 16;
  }
  return { samples: aligned, byteLength: bytes.length, skippedChars: skipped };
}

/**
 * 造一个播放队列。
 *
 * ## 它解决什么
 *
 * SSE 的帧是**合成完一段就推一段**，各段之间没有顺序保证（回落本地模型时后面的
 * 小段完全可能先合成完），而耳朵对顺序极其敏感。队列把这件事收成三条不变式：
 *
 *  1. **同一个 utterance 内一次只播一个，按 seq 升序交付**。早到的先排队等前面的
 *     播完，不叠声（叠声听起来是两句同时在说）。
 *  2. **同一个 utterance 内重复的 seq 丢弃** —— 浏览器自动重连、中间的代理重放，
 *     都会让同一帧来第二次；不记已收过的 seq 就会把同一句话念两遍。
 *  3. **换 utterance 就是打断**：宿主先发 `ttsStop`，这一步把上一条正在播的与
 *     排队的全部停掉；`push` 里还留着一条兜底 —— 当前这条还在忙时，别的
 *     utteranceId 的帧一律丢，绝不让上一条的迟到帧抢走播放位（见 `push`）。
 *
 * ## 为什么是「收过的集合」而不是「下一个期望的 seq」
 *
 * 用 `nextExpected` 推进时，丢一帧就永久卡住：第 2 段没到，第 3、4 段就再也播不出来。
 * 这里允许**按到达顺序跨越空洞交付**——已经排队的不因为前面缺一段而全体押后，
 * 而重复判定仍然按 seq 严格进行。
 */
export function createPlaybackQueue<T = unknown>(
  options: PlaybackQueueOptions<T>,
): PlaybackQueue<T> {
  const onPlay = options.onPlay;
  const onStop = options.onStop;
  const log = options.log ?? ((): void => {});

  /** 当前 utterance。 */
  let current: string | null = null;
  // `playingSeq` 既是「谁在播」也是「忙不忙」的唯一标志：`stop()` 会把它置空，
  // 于是掐掉音频之后 `onended` 迟到的 `complete()` 自动变成空操作 —— 幂等靠这个。
  let playingSeq: number | null = null;
  /**
   * 被 `stop()` 明确停掉的 utterance。
   *
   * 只记这一种收尾（不记"播完了"的）：`stop` 是宿主**显式**说「这条别放了」，
   * 所以它之后同一条 utterance 还在飞的帧一律不再收 —— 否则复核否决之后
   * 那些已经在管道里的段会接着念出来，人听得到自己被否决掉的台词。
   * 播完的自然收尾不能这样记：宿主是流式推帧的，播完第 1 段时第 2 段常常
   * 还没到，记早了就会把同一条的后半句永久吞掉。
   */
  let stopped = new Set<string>();
  /** 上界，只防内存（一页跑一整天）：过线整个清掉，见上面那段注释。 */
  const STOPPED_LIMIT = 512;
  /**
   * 见过的 utterance → 「第几条」（首见顺序）。用来区分**旧**帧与**新**一条：
   *   · 见过的、且排在当前这条之前 → 旧 utterance 的迟到帧 → 丢；
   *   · 没见过的 → 新一条 → **打断**当前这条。
   *
   * 早先这里是「当前这条还忙时，别的 utterance 一律丢」。那会把**新**的也丢掉，
   * 而 DSH 里"上一条还在播、新一条已经开始"是常态：一轮里常有多条 assistant
   * 消息（工具调用之后再回一条），下一轮也常紧接上一轮。丢掉新的 = 后面整段静默。
   * 真正的否决打断宿主会先发 `ttsStop`，所以这里只管"新旧"，不管"谁对"。
   */
  let order = new Map<string, number>();
  let orderSeq = 0;
  let currentOrder = -1;
  /** 已收过的 seq（当前 utterance），用来去重。 */
  let received = new Set<number>();
  /** 排到队、还没轮到播的。用 Map 而不是数组：去重是 O(1)。 */
  let queue = new Map<number, T>();

  /** 当前这条 utterance 还有活的东西吗（决定要不要叫 onStop / 能不能被打断）。 */
  const busy = (): boolean => playingSeq !== null || queue.size > 0;

  /** 交付队首（最小 seq）。只在空闲时调用。 */
  function drain(): void {
    if (playingSeq !== null || queue.size === 0 || current === null) return;
    let headSeq: number | null = null;
    for (const seq of queue.keys()) {
      if (headSeq === null || seq < headSeq) headSeq = seq;
    }
    if (headSeq === null) return;
    const payload = queue.get(headSeq) as T;
    queue.delete(headSeq);

    const id = current;
    playingSeq = headSeq;
    const item: PlaybackItem<T> = { utteranceId: id, seq: headSeq, payload };
    try {
      onPlay(item);
    } catch (error) {
      // 播放方抛错不该把队列卡死（否则后面每一段都排不上）。当成「播完了」推进。
      log(`onPlay 抛错（${id}#${headSeq}）：${String(error)}`);
      playingSeq = null;
      drain();
    }
  }

  /** 丢掉当前 utterance 的全部状态（不叫 onStop，调用方决定）。 */
  function clear(): void {
    queue = new Map();
    received = new Set();
    playingSeq = null;
  }

  /** 停一条 utterance：清状态 + 叫一次 `onStop`（只在真有活的东西时）。 */
  function halt(id: string): void {
    const had = busy();
    clear();
    if (had && onStop !== undefined) {
      try {
        onStop(id);
      } catch (error) {
        log(`onStop 抛错（${id}）：${String(error)}`);
      }
    }
  }

  /** 记一条被显式停掉的 utterance（带内存上界）。 */
  function markStopped(id: string): void {
    if (stopped.size >= STOPPED_LIMIT) stopped = new Set();
    stopped.add(id);
  }

  return {
    push(utteranceId, seq, payload) {
      // 不合法的帧（没有 id / seq 不是数）：丢掉而不是把队列搞乱。
      if (typeof utteranceId !== "string" || utteranceId === "") return "stopped";
      if (typeof seq !== "number" || !Number.isFinite(seq)) return "stopped";
      // 已经 `stop` 掉的 utterance：它的迟到尾巴不许复活。
      if (stopped.has(utteranceId)) return "duplicate";

      if (current !== utteranceId) {
        const known = order.get(utteranceId);
        // 旧 utterance 的迟到帧：**丢**。放它进来只有两种坏结果 ——
        // 把正在听的这句掐掉，或者排进队列、等下一段播完被翻出来念一遍。
        //
        // 判据是 `<=` 而不是 `<`：`reset()` 之后 `current` 归空但 `currentOrder`
        // 还留着，那条刚播完/刚被重置的 utterance 的尾巴仍然是"旧的"，一样要丢。
        if (known !== undefined && known <= currentOrder) return "duplicate";

        // 新的一条：**打断当前这条**（清队列 + onStop 掐掉真实音频）。
        // 这里不断言"新的就是对的" —— 真正的否决打断由宿主的 `ttsStop` 负责；
        // 这里只保证"新的一轮不会被静默丢掉"。
        if (current !== null) halt(current);
        if (known === undefined) {
          if (order.size >= STOPPED_LIMIT) {
            // 过线就整表清掉（只防内存）。清掉之后老 id 会被当"新"的 —— 需要
            // 512 条 utterance 才会走到这里，代价是可能的顺序错乱，不是静默。
            order = new Map();
            currentOrder = -1;
          }
          orderSeq += 1;
          order.set(utteranceId, orderSeq);
          currentOrder = orderSeq;
        } else {
          currentOrder = known;
        }
        current = utteranceId;
        received = new Set();
      }

      if (received.has(seq)) return "duplicate";
      received.add(seq);
      queue.set(seq, payload);

      if (playingSeq === null) {
        drain();
        return playingSeq === seq ? "playing" : "queued";
      }
      return "queued";
    },

    /**
     * 当前这个单元播完了 —— 交付下一个。
     *
     * 两个参数是**必须**的，不是装饰：播放层的兜底定时器（`onended` 不一定到）
     * 会晚于真实结束触发，那时队首可能已经换成下一段了。只认 `{utteranceId, seq}`
     * 就绝不会「帮别人收尾」——早到的兜底变成空操作，晚到的 onended 也一样。
     *
     * 幂等：`stop()` 之后迟到的调用无害（同一条 utterance 的同一段只收一次尾）。
     */
    complete(utteranceId: string, seq: number): void {
      if (playingSeq === null || seq !== playingSeq) return;
      if (current !== utteranceId) return;
      playingSeq = null;
      drain();
    },

    stop(utteranceId) {
      if (current !== utteranceId) return;
      halt(utteranceId);
      markStopped(utteranceId);
      // `current` 归空，让下一条 utterance 走正常的路径。
      current = null;
    },

    reset() {
      // 注意**不**清 `currentOrder`：刚播完那一条的迟到尾巴仍应算"旧的"。
      current = null;
      clear();
    },

    state() {
      const queued: number[] = [];
      for (const seq of queue.keys()) queued.push(seq);
      queued.sort((a, b) => a - b);
      return { current, playing: playingSeq, queued };
    },
  };
}

/**
 * 「念完一段，再念下一段」的播放队列。
 *
 * 与上面那个只差一条：**新的一条 utterance 不打断正在播的那条**，而是排到它后面。
 *
 * 为什么要第二个实现：`createPlaybackQueue` 的「新的打断旧的」是给「自动念回复」
 * 写的 —— 那种场景下新的一条总是更新的、更该听。放到**读一段话**上就反了：
 * 她刚开口，下一轮的话就到了，于是每一句都被掐掉半截，听起来像结巴。
 *
 * 打断这件事因此收归调用方：用户点哪一段，界面自己先 `stopAll()` 再送新的合成。
 * 换句话说 —— **打断只由人发起**。
 *
 * 排序仍是「先按 utterance 首见顺序，再按 seq」，所以同一条内部照旧按段序播；
 * 跨越 utterance 只是排队，不再互相掐。
 *
 * 这份实现同时在 TS 源码和打包产物里 —— 所以**刻意不写类型注解**，
 * 两边同一份文本，语义不会漂。
 */
export function createSerialPlaybackQueue(options) {
  const onPlay = options.onPlay;
  const onStop = options.onStop;
  const log = options.log ?? (() => {});

  /** 待播表：跨 utterance 的全局顺序，不再是「当前这条的 seq 集合」。 */
  let pending = [];
  /** 正在播的那条；空闲时 null。 */
  let playing = null;
  /** utterance 的首见顺序 —— 现在只用来**排序**，不再用来判断该不该打断。 */
  let order = new Map();
  let orderSeq = 0;
  /**
   * 被 `stopAll()` 划到线下的名次：落在它和它之前的 utterance，迟到的帧一律丢。
   *
   * 为什么需要这条线：宿主的合成是**一段一段串着推**的（一条 utterance 十段，
   * 就是十次云端请求，一次接一次）。`stopAll()` 清得掉已经排进待播表的，清不掉
   * **还在飞的** —— 那些帧会在接下来十几秒里陆续到达，一看队列空了就接上播。
   * 表现就是：点了一段，听到的却是别处的旧内容，而且点三次听到三个不同的开头。
   */
  let cutoffOrder = 0;
  /** 已收过的 `${id}#${seq}`。去重是跨 utterance 的，因为待播表也是。 */
  let received = new Set();
  const RECEIVED_LIMIT = 4096;

  const rankOf = (item) => (order.get(item.utteranceId) ?? 0) * 1e6 + item.seq;

  /** 交付待播表里最靠前的那条。只在空闲时调用。 */
  function drain() {
    if (playing !== null || pending.length === 0) return;
    let best = 0;
    for (let i = 1; i < pending.length; i += 1) {
      if (rankOf(pending[i]) < rankOf(pending[best])) best = i;
    }
    const item = pending.splice(best, 1)[0];
    playing = item;
    try {
      onPlay(item);
    } catch (error) {
      // 播放方抛错不该把队列卡死 —— 当成「播完了」推进。
      log(`onPlay 抛错（${item.utteranceId}#${item.seq}）：${String(error)}`);
      playing = null;
      drain();
    }
  }

  function fireStop(id) {
    if (onStop === undefined) return;
    try {
      onStop(id);
    } catch (error) {
      log(`onStop 抛错（${id}）：${String(error)}`);
    }
  }

  return {
    push(utteranceId, seq, payload) {
      if (typeof utteranceId !== "string" || utteranceId === "") return "stopped";
      if (typeof seq !== "number" || !Number.isFinite(seq)) return "stopped";
      const seen = order.get(utteranceId);
      if (seen !== undefined && seen <= cutoffOrder) return "duplicate";
      if (seen === undefined) {
        orderSeq += 1;
        order.set(utteranceId, orderSeq);
      }
      const key = `${utteranceId}#${seq}`;
      if (received.has(key)) return "duplicate";
      if (received.size >= RECEIVED_LIMIT) received = new Set();
      received.add(key);

      pending.push({ utteranceId, seq, payload });
      if (playing === null) {
        drain();
        if (playing !== null && playing.utteranceId === utteranceId && playing.seq === seq) {
          return "playing";
        }
      }
      return "queued";
    },

    complete(utteranceId, seq) {
      if (playing === null || playing.seq !== seq || playing.utteranceId !== utteranceId) return;
      playing = null;
      drain();
    },

    /** 摘掉一条 utterance：待播里的一起清，正在播的就掐掉。 */
    stop(utteranceId) {
      pending = pending.filter((it) => it.utteranceId !== utteranceId);
      if (playing === null || playing.utteranceId !== utteranceId) return;
      playing = null;
      fireStop(utteranceId);
      drain();
    },

    /**
     * 掐掉一切 —— 正在播的、以及所有待播的。
     *
     * **这是唯一会打断播放的入口**，而它只该由「用户点了某一段」来调。
     */
    stopAll() {
      const id = playing !== null ? playing.utteranceId : "";
      pending = [];
      playing = null;
      // 划线：此刻**已经见过**的 utterance 全部作废，它们的迟到帧不再放进来。
      // 点击之后才产生的那条是「没见过」的，名次更大，照常通过。
      cutoffOrder = orderSeq;
      // **无条件**叫这一声，空 id 也一样。队列只认得**它自己放过的**音频，
      // 而命中档案的那一段是直接送喇叭的、从没经过这里。把「手上没人」读成
      // 「没在响」，那段就会在下一次点击底下继续说 —— 听上去就是「它把旧的
      // 念完才轮到新的」。空 id 的含义归 onStop 那侧：停全部。
      fireStop(id);
    },

    reset() {
      pending = [];
      playing = null;
    },

    state() {
      const current =
        playing !== null ? playing.utteranceId : pending.length > 0 ? pending[0].utteranceId : null;
      return {
        current,
        playing: playing !== null ? playing.seq : null,
        queued: pending
          .filter((it) => it.utteranceId === current)
          .map((it) => it.seq)
          .sort((a, b) => a - b),
      };
    },
  };
}
