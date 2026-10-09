/**
 * MiniMax 的**请求形状**：官方原生 `/v1/t2a_v2`，以及第三方中转站唯一认的那种
 * 自家形状（`/v1/tts/speech`）。
 *
 * ## 为什么形状要单独一个模块
 *
 * 官方与中转站的差别**不止换一个 host**（2026-10-10 联调实测）：
 *
 * | 差异 | 官方 native | 中转站 relay |
 * | --- | --- | --- |
 * | 路径 | `/v1/t2a_v2` | `/v1/tts/speech` |
 * | 音色字段 | 嵌套 `voice_setting.voice_id` | **扁平** `voice_id`（嵌套写法回 502） |
 * | `format` 必填 | `"pcm"` | `"pcm"` —— 不给会回 mp3 流或 wav 容器 |
 * | 回体 | JSON，音频是 `data.audio`（hex 字符串） | **裸 s16le PCM**，`content-type: audio/mpeg` 是假的 |
 *
 * 这四件事**同源**（都源于"它上游是 MiniMax，但它自己的网关重写了形状"），所以把
 * 它们收进同一个对象，而不是让 `api.ts` 里长出第二个 `if (relay)` —— 否则加第三种
 * 形状（OpenAI 那类 `/v1/audio/speech`）就得在 `synthesizePcm` 里再插一条腿。
 *
 * **`api.ts` 只认识这个 interface**：加一档形状 = 在这里加一条 `ENDPOINT_SHAPES`
 * 记录，`api.ts` 一行不改（那条形状自己的解码与错误分类也都住在这里）。
 *
 * ## 判形状按字节，不按头
 *
 * relay 那家回 PCM 时的 `content-type` 写的是 `audio/mpeg`（字节却是 `00 00` 开头的
 * 裸 PCM），而它报错时回的又是 JSON。所以 `decodeRelayResponse` **两条都试**：
 * 先按 JSON 解析，解析不动才算 PCM —— 反过来（按头判）会把正常音频当 mp3 丢掉。
 */
import type { FetchLike, MiniMaxFailure } from "./api.js";
import { MiniMaxError, abortedAs, classifyStatus, isAbortError } from "./api.js";

/** 形状自己的解码结果（`api.ts` 只负责把它翻成 `SynthesizedPcm`）。 */
export interface DecodedAudio {
  readonly samples: Int16Array;
  readonly sampleRate: number;
  /** 平台自己报的计费字符数；它不报就是 `0`（relay 实测不报）。 */
  readonly billedChars: number;
  /** 回体一共多少字节。**给"这次到底答出东西没有"用的** —— 裸 PCM 可能少到
   *  只剩一个字节（`samples` 为空），那也说明对面是活的，与"空体"不是一回事。 */
  readonly rawBytes: number;
}

/** 一次 HTTP 应答的公共部分（形状自己决定怎么解释它）。 */
export interface EndpointResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly contentType: string;
  /** JSON 应答的原文；不是 JSON 就是 `null`（不抛 —— 形状要自己决定读不读它）。 */
  readonly json: unknown | null;
  /** 正文原文（错误信息里要带上，形状自己取用）。 */
  readonly text: string;
  readonly bytes: Uint8Array;
}

export interface EndpointRequest {
  readonly voiceId: string;
  readonly text: string;
  readonly model: string;
  readonly sampleRate: number;
  readonly key: string;
  readonly signal?: AbortSignal;
}

/** 一种请求形状要回答的全部问题。`ENDPOINT_SHAPES` 里的每条记录就是一份实现。 */
export interface EndpointShape {
  /** 写进设置的那个值（`minimaxApi` 的取值域）。 */
  readonly name: string;
  /** 探测 key 属于哪个 host 用的路径（认领前的第一步）。 */
  readonly probePath: string;
  /** 探测请求体（官方是"列克隆"，中转站只关心鉴权）。 */
  readonly probeBody: Record<string, unknown>;
  /** 有没有"列出账号克隆"这种事（官方有；中转站没有这个接口）。 */
  readonly supportsVoiceList: boolean;
  /** 「这个音色在不在」能不能离线回答（官方能：账号里列出来一比就知道）。
   *  中转站不能 —— 只能真发一次合成，所以认领时走一次最便宜的合成调用。 */
  readonly canVerifyVoice: boolean;
  /** 这条形状在这个地址上发合成请求。 */
  synthesizeUrl(host: string): string;
  synthesizeBody(req: EndpointRequest): string;
  decodeSynthesis(res: EndpointResponse): DecodedAudio;
}

/**
 * 把官方那套 `base_resp.status_code` + 文案翻成 `MiniMaxFailure`。
 *
 * 它是 `classifyStatus` 的**双包裹**：官方有时把状态码藏在 `data.base_resp` 里
 * （中转站更是直接藏在 `data` 里，实测 `{"data":{"status_code":1004,...}}`），
 * 而 `api.ts` 的 `call()` 只看顶层 `base_resp` —— 于是这种错误会被当成"成功"，
 * 再在"没有音频"那一步变成一句没有原因的 `other`。
 *
 * ## 顺序与"只在错误时看 data"都是有意的
 *
 * 顶层 `base_resp` **优先**：官方成功应答里 `data` 是个对象（`{audio, …}`），
 * 把它当作状态来源读，会把一次成功当成失败 —— 这正是早先这版犯的错。
 * `data` 只在**顶层没有状态码**时才看（中转站那家的错误就长这样）。
 */
function baseRespOf(json: unknown): {
  code: number | undefined;
  msg: string | undefined;
} {
  if (typeof json !== "object" || json === null) return { code: undefined, msg: undefined };
  const record = json as Record<string, unknown>;
  const top = asNode(record.base_resp);
  if (top !== null && typeof top.status_code === "number") {
    return { code: top.status_code, msg: messageOf(top) };
  }
  const nested = asNode(asNode(record.data)?.base_resp);
  const inner = nested ?? asNode(record.data);
  if (inner !== null && typeof inner.status_code === "number") {
    return { code: inner.status_code, msg: messageOf(inner) };
  }
  return { code: undefined, msg: top === null ? undefined : messageOf(top) };
}

function asNode(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** 错误文案：几个平台把它写成 `status_msg` / `message` / `msg` 的都见过。 */
function messageOf(node: Record<string, unknown>): string | undefined {
  for (const key of ["status_msg", "message", "msg"]) {
    const value = node[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

/** 一个错误 body 都读不出状态码时给哪个档。`classifyStatus` 在 `code` 与 `msg`
 *  都空时返回 `other` —— 这里与它保持一致，不再自定一套。 */
const FALLBACK_FAILURE: MiniMaxFailure = "other";

/** 官方形状：`/v1/t2a_v2` + 嵌套 `voice_setting` + `hex` 编码的 `data.audio`。 */
const official: EndpointShape = {
  name: "official",
  probePath: "/v1/get_voice",
  probeBody: { voice_type: "voice_cloning" },
  supportsVoiceList: true,
  canVerifyVoice: true,

  synthesizeUrl: (host) => `${host}/v1/t2a_v2`,

  synthesizeBody: (req) => JSON.stringify({
    model: req.model,
    text: req.text,
    voice_setting: { voice_id: req.voiceId, speed: 1, vol: 1, pitch: 0 },
    audio_setting: { sample_rate: req.sampleRate, format: "pcm", channel: 1 },
    language_boost: "Chinese",
    output_format: "hex",
  }),

  decodeSynthesis(res) {
    const json = (res.json ?? {}) as Record<string, unknown>;
    const data = (json.data ?? {}) as Record<string, unknown>;
    const hex = data.audio;
    if (typeof hex !== "string" || hex.length === 0) {
      // 「HTTP 200 但平台上报了错」也走这条路 —— 所以原因必须**归类**，不能一律
      // 记成 `other`：那会把 `auth` / `quota` / `voice_missing` 全糊成一团，
      // 而 synthesizer 正是按这几个码决定要不要 doom 整个 utterance 的。
      const { code, msg } = baseRespOf(json);
      throw new MiniMaxError(classifyByCode(code, msg), msg ?? "no audio in the response", code);
    }
    // hex 是**字节**的十六进制：两个字符一个字节，样本再按小端 16 位读回来。
    // 奇数长度时最后那个落单的字符被 Buffer 丢掉，样本数按 `>> 1` 向下取整。
    const bytes = Buffer.from(hex, "hex");
    const samples = new Int16Array(bytes.length >> 1);
    for (let i = 0; i < samples.length; i += 1) samples[i] = bytes.readInt16LE(i * 2);
    const extra = (json.extra_info ?? {}) as Record<string, unknown>;
    const billed = extra.usage_characters;
    return {
      samples,
      sampleRate: 24000,
      billedChars: typeof billed === "number" ? billed : 0,
      rawBytes: bytes.length,
    };
  },
};

/**
 * 中转站形状：`/v1/tts/speech` + **扁平** `voice_id` + 裸 s16le PCM。
 *
 * 三个实测得来的硬约束（都是"换个别家就会踩的"）：
 *   1. `voice_id` 必须扁平 —— 写成官方的 `voice_setting.voice_id` 会回 502；
 *   2. `audio_setting.format` 必须显式 `"pcm"` —— 不给或给 `wav`/`mp3` 回的是容器；
 *   3. 回 PCM 时 `content-type` 是**假的** `audio/mpeg`，所以按字节判（见文件头）。
 *
 * `billedChars` 恒为 `0`：它不报这个数。这不是"没花钱"，是"这一档的账只能记在
 * 用户自己那边"—— 所以状态页那一行在 relay 下不会显示计费字符（别把它当成 0 花销）。
 */
const relay: EndpointShape = {
  name: "relay",
  probePath: "/v1/tts/speech",
  probeBody: {},
  supportsVoiceList: false,
  canVerifyVoice: false,

  synthesizeUrl: (host) => `${host}/v1/tts/speech`,

  synthesizeBody: (req) => JSON.stringify({
    model: req.model,
    text: req.text,
    voice_id: req.voiceId,
    audio_setting: { sample_rate: req.sampleRate, format: "pcm", channel: 1 },
  }),

  decodeSynthesis(res) {
    const bytes = res.bytes;
    // 裸 PCM 至少要有一个完整样本；空体按失败处理（否则会静默"合成成功但没有声音"）。
    if (bytes.length >= 2 && !looksLikeJson(bytes)) {
      const count = bytes.length >> 1;
      const samples = new Int16Array(count);
      for (let i = 0; i < count; i += 1) {
        const lo = bytes[i * 2] ?? 0;
        const hi = bytes[i * 2 + 1] ?? 0;
        // 小端：低字节在前。写成 `(hi << 8) | lo` 就是把每个样本的低高字节颠倒，
        // 听感是刺啦的噪声，而样本数、时长、峰值全都正常 —— 最难查的那种。
        samples[i] = ((lo | (hi << 8)) << 16) >> 16;
      }
      return { samples, sampleRate: 24000, billedChars: 0, rawBytes: bytes.length };
    }
    const { code, msg } = baseRespOf(res.json);
    throw new MiniMaxError(classifyByCode(code, msg), msg ?? `HTTP ${res.status}: no audio`, code);
  },
};

/** 设置里 `minimaxApi` 的取值 → 形状。**这是取值域的唯一声明**（与 `voiceEngine` 同规矩）。 */
export const ENDPOINT_SHAPES: Readonly<Record<string, EndpointShape>> = Object.freeze({
  official,
  relay,
});

/** 默认形状：官方原生（不填 `minimaxApi` 时行为与加这个字段之前逐字相同）。 */
export const DEFAULT_ENDPOINT_SHAPE = official;

/** 取一个形状；不认识的值兜回默认（配置写错不该让语音整个失声）。 */
export function endpointShapeOf(name: string | undefined): EndpointShape {
  if (name === undefined) return DEFAULT_ENDPOINT_SHAPE;
  return ENDPOINT_SHAPES[name] ?? DEFAULT_ENDPOINT_SHAPE;
}

/** body 前几个非空白字节是不是 JSON 的开口 —— 用来把"错误 JSON"与"裸 PCM"分开。 */
function looksLikeJson(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length && i < 16; i += 1) {
    const byte = bytes[i] ?? 0;
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    return byte === 0x7b || byte === 0x5b; // `{` / `[`
  }
  return false;
}

/**
 * 发一次合成请求，按形状解码回 samples。
 *
 * `call` 的等价语义（非 2xx / 平台码非 0 都翻成 `MiniMaxError`）在这里重写了一遍
 * 而不是复用 `api.ts` 的 `call()` —— 因为 relay 的**成功**应答不是 JSON，而
 * `call()` 的契约是"等价的 JSON 体是先决条件"。硬把裸字节塞进那条路，等于在
 * `call()` 里给一个形状开口子。
 */
export async function requestSynthesis(
  fetch: FetchLike,
  shape: EndpointShape,
  host: string,
  req: EndpointRequest,
): Promise<DecodedAudio> {
  const res = await request(fetch, shape.synthesizeUrl(host), shape.synthesizeBody(req), req.key, req.signal);
  if (!res.ok) {
    // 非 JSON 的失败体**无名可分** —— 与 `api.ts` 的 `call()` 同一档（`http`）：
    // 连正文都不是 JSON 时，状态码是没有意义的（门户劫持、网关 HTML 错误页都是这样）。
    if (res.json === null) {
      throw new MiniMaxError("http", `HTTP ${res.status}: non-JSON body`);
    }
    const { code, msg } = baseRespOf(res.json);
    throw new MiniMaxError(classifyByCode(code, msg), msg ?? `HTTP ${res.status}`, code);
  }
  return shape.decodeSynthesis(res);
}

/**
 * 探测 key 在这个 host 上认不认（用形状自己的探测路径）。
 *
 * ⚠️ relay 的探测会**故意失败**：中转站没有 `/v1/get_voice`，那家实测回 404。
 * 所以 relay 的探测只能看"有没有被明确拒"（1004 / 2049）——
 * 404 这类"它不认这个路径"恰恰说明**地址是活的**，该算通过。
 */
export async function probeShape(
  fetch: FetchLike,
  shape: EndpointShape,
  host: string,
  key: string,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${host}${shape.probePath}`;
  const body = JSON.stringify(shape.probeBody);
  let res: EndpointResponse;
  try {
    res = await request(fetch, url, body, key, signal);
  } catch (err) {
    // `request` 只在网络层抛（MiniMaxError("network")），原样上抛。
    if (err instanceof MiniMaxError) throw err;
    throw new MiniMaxError("network", String(err));
  }
  if (res.ok) return;
  const { code, msg } = baseRespOf(res.json);
  const failure = classifyByCode(code, msg);
  // 明确说"key 不对"才是失败；"没有这个接口"（http）说明地址能通 —— 算认了。
  if (failure === "invalid_key" || failure === "auth") {
    throw new MiniMaxError(failure, msg ?? `HTTP ${res.status}`, code);
  }
}

/** 平台码 + 文案 → `MiniMaxFailure`。**复用 `api.ts` 的 `classifyStatus`**（同一张
 *  表、同一条判定顺序），不在这里另写一份 —— 早先这里只按码归类，于是"HTTP 500 +
 *  没有状态码"被归成了 `http`（那张表里根本没有这一档），而 `auth` / `quota` 这类
 *  **靠文案**区分的分支也全丢了。 */
function classifyByCode(code: number | undefined, msg: string | undefined): MiniMaxFailure {
  return classifyStatus(code, msg);
}

/** 发一次请求，把应答拆成"形状自己能解释"的那几块。 */
async function request(
  fetch: FetchLike,
  url: string,
  body: string,
  key: string,
  signal?: AbortSignal,
): Promise<EndpointResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
      signal,
    });
  } catch (err) {
    // 取消 / 超时 / 真网络错 —— **判定归 `api.ts`**（`isAbortError` + `abortedAs`），
    // 这里只调用。早先这里一律写 `network`，于是调用方取消一次会被记成一次网络失败。
    throw new MiniMaxError(classifyTransport(err, signal), errorMessage(err));
  }
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(res);
  } catch (err) {
    throw new MiniMaxError(classifyTransport(err, signal), errorMessage(err));
  }
  const text = new TextDecoder().decode(bytes);
  let json: unknown | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, contentType: res.headers?.get("content-type") ?? "", json, text, bytes };
}

/** 取原始字节。
 *
 *  优先 `arrayBuffer()`（唯一不会在二进制上出错的读法）；没有它时退回 `text()` 再
 *  编码回字节 —— 那条路只有**只实现了 `text()` 的假 Response**会走（本仓的两个单测
 *  就是），解析回来的 UTF-8 文本与原文逐字节相同，所以对它们没损失。真实 `fetch`
 *  永远走第一条。 */
async function readBytes(res: Response): Promise<Uint8Array> {
  if (typeof res.arrayBuffer === "function") return new Uint8Array(await res.arrayBuffer());
  return new TextEncoder().encode(await res.text());
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 一次传输层失败该记成哪一档 —— 与 `api.ts` 的 `call()` **逐字同一套判定**。 */
function classifyTransport(err: unknown, signal: AbortSignal | undefined): MiniMaxFailure {
  return isAbortError(err) || signal?.aborted === true
    ? abortedAs({ signal })
    : "network";
}
