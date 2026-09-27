/**
 * MiniMax 语音 API 的 HTTP 层 —— 上游
 * `Herta-src/packages/gui/src/main/tts/minimax-api.ts` 的忠实移植件，只保留
 * 云端语音真正用到的那部分：认领已有克隆（`get_voice`）、探测 key 属于哪个平台、
 * 把一单元文本合成成 raw PCM。
 *
 * **没有移植**的部分（用户决策：只认领已有克隆，不做上传/克隆）：
 * `uploadReference`、`cloneVoice`、`makeVoiceId` / `defaultRandom`，以及只服务于
 * 它们的 `MINIMAX_UPLOAD_TIMEOUT_MS`。
 *
 * 本文件**自包含**：上游从 `@herta/core` 借的 `errorMessage` / `isAbortError`
 * 在这里按上游语义内联（见下方两个函数），其余只依赖 Node 全局
 * （`Buffer` / `fetch` / `AbortController` / `DOMException`）。一个相对导入都没有 ——
 * 这样编译产物里不会留下任何运行时导入，不会在 ESM 链接期炸。
 *
 * 两个平台用同一个 key 格式答同一套 API：国际站与中国站。一个 key 只属于其中
 * 一个，另一个回 2049 "invalid api key"；`probeHost` 用一次便宜的鉴权调用试两边，
 * 记住哪个通了。
 */

export const MINIMAX_HOSTS: readonly string[] = [
  "https://api.minimax.io",
  "https://api.minimaxi.com",
];

export const MINIMAX_DEFAULT_MODEL = "speech-2.8-hd";

/** 控制面（probe / list / clone）的截止时间。没有它时，一个被接受却永不回话的
 *  连接（门户劫持、吞请求的代理）会让调用永远挂着（上游 2026-09-10 的教训）。
 *  上游还有一份给 ~8 MB 参考音频上传用的 `MINIMAX_UPLOAD_TIMEOUT_MS` —— 那属于
 *  没移植的上传路径，这里刻意不带。 */
export const MINIMAX_CONTROL_TIMEOUT_MS = 30_000;

export type MiniMaxFailure =
  | "no_key"
  | "invalid_key"
  | "auth"
  | "rate"
  | "quota"
  | "sensitive"
  | "voice_missing"
  | "invalid"
  | "network"
  | "http"
  | "cancelled"
  | "other";

/** 上游用构造函数参数属性（`constructor(readonly reason: ...)`）—— strip 模式
 *  明确不支持，所以这里改成显式字段声明 + 赋值，运行期语义完全相同。 */
export class MiniMaxError extends Error {
  readonly reason: MiniMaxFailure;
  readonly statusCode: number | undefined;

  constructor(reason: MiniMaxFailure, message: string, statusCode?: number) {
    super(message);
    this.name = "MiniMaxError";
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

export type FetchLike = (
  url: string,
  init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string | FormData;
    readonly signal?: AbortSignal;
  },
) => Promise<Response>;

interface BaseResp {
  readonly status_code?: number;
  readonly status_msg?: string;
}

/** 内联自上游的 `@herta/core`：未知抛出值的可读消息。 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 内联自上游的 `@herta/core`：**那一个**中断判定。宽口径 —— `name ===
 *  "AbortError"`（DOMException / fetch 中断 / harness 自造的错误）或
 *  `code === "ABORT_ERR"`（undici 某些中断换了名字）。刻意不要求
 *  `instanceof Error`：另一个 realm（测试里的 jsdom、worker）来的 DOMException
 *  不是 Error，但它带的仍然是中断。 */
function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; code?: unknown };
  return e.name === "AbortError" || e.code === "ABORT_ERR";
}

/** MiniMax 的状态码，按上游当天实测的范围：2049 这个 key 不属于本平台；
 *  1004 鉴权失败；1002/1039 限流；1008 余额；2054 "voice id not exist"
 *  （2026-09-08 实测）；2013 参数非法 —— 旧版回答也用 2013 表示音色不存在，
 *  只能靠文案区分，所以文案分支必须排在 2013 之前。
 *
 *  判定顺序是这套映射的全部内容：码优先于文案（1008 与任何含 balance /
 *  insufficient 的文案同归一档），sensitive 文案优先于泛指 voice 的文案。 */
export function classifyStatus(
  code: number | undefined,
  msg: string | undefined,
): MiniMaxFailure {
  const m = (msg ?? "").toLowerCase();
  if (code === 2049) return "invalid_key";
  if (code === 1004) return "auth";
  if (code === 2054) return "voice_missing";
  if (code === 1002 || code === 1039) return "rate";
  if (code === 1008 || m.includes("balance") || m.includes("insufficient")) {
    return "quota";
  }
  if (m.includes("sensitive")) return "sensitive";
  if (m.includes("voice")) return "voice_missing";
  if (code === 2013) return "invalid";
  return "other";
}

/** 一个终止于自身 signal 的请求：调用方的取消是 `cancelled`；截止时间
 *  （`deadlineSignal`，其 reason 是 TimeoutError）意味着平台没回话 ——
 *  `network`，才是用户能采取行动的那种。按 reason 的**名字**判定而不是类：
 *  DOMException 可能来自另一个 realm。 */
function abortedAs(init: Parameters<FetchLike>[1]): MiniMaxFailure {
  const reason = init.signal?.reason as { name?: unknown } | undefined;
  return reason?.name === "TimeoutError" ? "network" : "cancelled";
}

/**
 * 一个在 `ms` 之后以 TimeoutError 中止的 signal，或者 `outer` 中止时立刻以
 * `outer` 的 reason 中止。之所以用 AbortController + setTimeout 手搭，而不是
 * `AbortSignal.timeout` / `AbortSignal.any`，是为了同一份代码在 Electron 的 Node
 * 与测试环境的 DOM 下都能跑。`clear` 在调用落地后释放定时器。
 */
export function deadlineSignal(
  ms: number,
  outer?: AbortSignal,
): { readonly signal: AbortSignal; readonly clear: () => void } {
  const ac = new AbortController();
  const timer = setTimeout(() => {
    ac.abort(new DOMException(`no answer within ${ms} ms`, "TimeoutError"));
  }, ms);
  const forward = (): void => ac.abort(outer?.reason);
  if (outer?.aborted === true) forward();
  else outer?.addEventListener("abort", forward, { once: true });
  return {
    signal: ac.signal,
    clear: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forward);
    },
  };
}

/** 在一条崭新的截止时间下跑一次平台调用。 */
export async function withDeadline<T>(
  ms: number,
  outer: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const d = deadlineSignal(ms, outer);
  try {
    return await run(d.signal);
  } finally {
    d.clear();
  }
}

/** 一次平台调用：非 2xx 或 base_resp.status_code 非 0 都翻成 MiniMaxError。
 *  等价的 JSON 体是**先决条件** —— 连 body 都不是 JSON 时无名可分，只能给
 *  `http`（哪怕 HTTP 状态是 200）。 */
async function call(
  fetch: FetchLike,
  url: string,
  init: Parameters<FetchLike>[1],
): Promise<{ readonly json: Record<string, unknown>; readonly text: string }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new MiniMaxError(
      isAbortError(err) || init.signal?.aborted === true
        ? abortedAs(init)
        : "network",
      errorMessage(err),
    );
  }
  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    throw new MiniMaxError(
      isAbortError(err) || init.signal?.aborted === true
        ? abortedAs(init)
        : "network",
      errorMessage(err),
    );
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new MiniMaxError("http", `HTTP ${res.status}: non-JSON body`);
  }
  const base = (json.base_resp ?? {}) as BaseResp;
  if (!res.ok) {
    throw new MiniMaxError(
      classifyStatus(base.status_code, base.status_msg),
      `HTTP ${res.status} ${base.status_msg ?? ""}`.trim(),
      base.status_code,
    );
  }
  if (base.status_code !== undefined && base.status_code !== 0) {
    throw new MiniMaxError(
      classifyStatus(base.status_code, base.status_msg),
      `${base.status_code} ${base.status_msg ?? ""}`.trim(),
      base.status_code,
    );
  }
  return { json, text };
}

function auth(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

/**
 * 这个 key 属于哪个平台。每个 host 一次便宜的鉴权调用；说"invalid api key"
 * （2049）的 host 是错的那个，说"login fail"（1004）的 host 根本没认下这个 key ——
 * 不属于任何平台的 key 会从**两个** host 都拿到 1004（2026-09-08 实测；早先的
 * 写法把这当成通过，于是把错的 key 存成了已连接）。其它任何回答 —— 成功，或者
 * 只是抱怨参数 —— 都证明 key 在这里认下来了。两边都不认时抛 `invalid_key`。
 */
export async function probeHost(
  fetch: FetchLike,
  key: string,
  signal?: AbortSignal,
  hosts: readonly string[] = MINIMAX_HOSTS,
  /** 每 host 的截止时间；一个永不回话的 host 对该 host 是一次 `network`
   *  失败，探测继续往下走（2026-09-10）。 */
  perHostTimeoutMs?: number,
): Promise<string> {
  let lastNetwork: MiniMaxError | null = null;
  for (const host of hosts) {
    try {
      const ask = (sig: AbortSignal | undefined): Promise<unknown> =>
        call(fetch, `${host}/v1/get_voice`, {
          method: "POST",
          headers: { ...auth(key), "Content-Type": "application/json" },
          body: JSON.stringify({ voice_type: "voice_cloning" }),
          signal: sig,
        });
      if (perHostTimeoutMs === undefined) await ask(signal);
      else await withDeadline(perHostTimeoutMs, signal, ask);
      return host;
    } catch (err) {
      if (!(err instanceof MiniMaxError)) throw err;
      // 这两个码恰好是「这个 host 不是它家 / 它不认这个 key」—— 换下一个试。
      if (err.reason === "invalid_key" || err.reason === "auth") continue;
      // 调用方自己的取消必须原样上抛，不能被"换下一个"变成静默重试。
      if (err.reason === "cancelled") throw err;
      // 网络/HTTP 层失败不代表 key 不对，记下来；全失败时抛出的是最后这个。
      if (err.reason === "network" || err.reason === "http") {
        lastNetwork = err;
        continue;
      }
      // 认下来了，剩下的毛病是什么都随它 —— 就是它家。
      return host;
    }
  }
  throw (
    lastNetwork ??
    new MiniMaxError("invalid_key", "no platform accepted the key")
  );
}

export interface ClonedVoice {
  readonly voiceId: string;
  /** 平台怎么报就怎么留 —— 一个日期字符串；缺省时是空串。 */
  readonly createdTime: string;
}

/** 账号里的克隆音色，就是 `get_voice` 列出来的那些。只有至少开口说过一次的
 *  音色才会出现（2026-09-08 实测：全新的、没用过的克隆不列出）—— 而这恰好是
 *  首用费已经付过的那一批，所以认领一个不花钱。账号下任何 key 都能列出它们。 */
export async function listClones(
  fetch: FetchLike,
  host: string,
  key: string,
  signal?: AbortSignal,
): Promise<ClonedVoice[]> {
  const { json } = await call(fetch, `${host}/v1/get_voice`, {
    method: "POST",
    headers: { ...auth(key), "Content-Type": "application/json" },
    body: JSON.stringify({ voice_type: "voice_cloning" }),
    signal,
  });
  const raw = Array.isArray(json.voice_cloning) ? json.voice_cloning : [];
  const out: ClonedVoice[] = [];
  for (const v of raw as { voice_id?: unknown; created_time?: unknown }[]) {
    if (typeof v?.voice_id !== "string") continue;
    out.push({
      voiceId: v.voice_id,
      createdTime: typeof v.created_time === "string" ? v.created_time : "",
    });
  }
  return out;
}

export interface SynthesizeOptions {
  readonly voiceId: string;
  readonly text: string;
  readonly model?: string;
  readonly sampleRate?: number;
  readonly signal?: AbortSignal;
}

export interface SynthesizedPcm {
  readonly samples: Int16Array;
  readonly sampleRate: number;
  /** MiniMax 为这次调用计费的字符数（≈ 字符数的 1.8 倍）。 */
  readonly billedChars: number;
}

/** 一单元 raw 24 kHz 单声道 PCM —— Herta 有声揭示要播的形状。 */
export async function synthesizePcm(
  fetch: FetchLike,
  host: string,
  key: string,
  opts: SynthesizeOptions,
): Promise<SynthesizedPcm> {
  const sampleRate = opts.sampleRate ?? 24000;
  const { json } = await call(fetch, `${host}/v1/t2a_v2`, {
    method: "POST",
    headers: { ...auth(key), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? MINIMAX_DEFAULT_MODEL,
      text: opts.text,
      voice_setting: { voice_id: opts.voiceId, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: sampleRate, format: "pcm", channel: 1 },
      language_boost: "Chinese",
      output_format: "hex",
    }),
    signal: opts.signal,
  });
  const data = (json.data ?? {}) as { audio?: unknown };
  if (typeof data.audio !== "string" || data.audio.length === 0) {
    throw new MiniMaxError("other", "no audio in the response");
  }
  // hex 是**字节**的十六进制：两个字符一个字节，样本再按小端 16 位读回来。
  // 奇数长度时最后那个落单的字符被 Buffer 丢掉，样本数按 `>> 1` 向下取整。
  const pcm = Buffer.from(data.audio, "hex");
  const samples = new Int16Array(pcm.length >> 1);
  for (let i = 0; i < samples.length; i += 1)
    samples[i] = pcm.readInt16LE(i * 2);
  const extra = (json.extra_info ?? {}) as { usage_characters?: unknown };
  return {
    samples,
    sampleRate,
    billedChars:
      typeof extra.usage_characters === "number" ? extra.usage_characters : 0,
  };
}
