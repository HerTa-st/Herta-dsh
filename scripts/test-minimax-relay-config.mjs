/**
 * 「用中转站连不上」的**端到端配置矩阵** —— 一个假的中转站 + 宿主真实的装配。
 *
 * ## 为什么要有这一份（它测的是别的测试测不到的东西）
 *
 * 其余几个 minimax 测试各自测一层：api 测 HTTP 层、voice 测认领、synthesizer 测
 * 合成器、synth-registry 测路由。**而用户报的故障恰好横跨这几层**：地址对了、
 * 密钥对了、音色也填了，就是不出声 —— 因为"形状"那一格没跟着地址走。
 * 单层测试永远看不见它（每层自己都是对的）。
 *
 * 所以这份测试照**宿主真正的装配方式**拼一条链，只把网络换成假中转站：
 *
 * ```
 * createMiniMaxVoiceService + createMiniMaxSynthesizer + createSynthRouter
 *   + createMinimaxAdapter + 宿主的 describeUnavailable
 * ```
 *
 * 假中转站的形状照 2026-10-10 的联调实测：`/v1/tts/speech`、扁平 `voice_id`、
 * 裸 s16le PCM、假的 `content-type`、没有 `/v1/get_voice`、错误是
 * `{"error":{"message":"…"}}`（没有平台码）。
 *
 * 跑法：`node --import ./scripts/test-resolve-hook.mjs scripts/test-minimax-relay-config.mjs`
 * （要借 DSH 运行时的那几个包，因为这里导入的是 host 半侧的 `minimax-voice.js`。）
 * 先 `node scripts/build-minimax.mjs`。
 */
import { createMiniMaxSynthesizer } from "../lib/minimax/synthesizer.js";
import { createMiniMaxVoiceService } from "../lib/minimax/voice.js";
import { endpointShapeOf } from "../lib/minimax/endpoint.js";
import { MINIMAX_HOSTS } from "../lib/minimax/api.js";
import { emptyState } from "../lib/minimax/state.js";
import {
  SYNTH_CODES,
  createMinimaxAdapter,
  createSynthRouter,
} from "../lib/synth-registry.js";

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}`);
  }
}

const RELAY = "https://relay.example.com";
const VOICE = "relay-voice-001";
const WRONG_VOICE = "wrong-voice";

/** 假中转站：只认它自己那两个接口，别的路径一律 404（真那家就是这样）。 */
function makeRelay(log) {
  const pcm = Buffer.alloc(4800 * 2);
  for (let i = 0; i < 4800; i += 1) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 8)), i * 2);

  return async (url, init) => {
    log.push(`${init?.method ?? "GET"} ${url}`);
    const body = init?.body === undefined ? {} : JSON.parse(init.body);

    if (url.endsWith("/v1/get_voice")) {
      // 中转站**没有**这个接口 —— 真那家回 404。这是 `b1a43133` tag 认领对它无效的根源。
      return bytesRes(404, Buffer.from("<html>not found</html>"), "text/html");
    }
    if (url.endsWith("/v1/tts/speech")) {
      if (body.voice_id !== VOICE) {
        return jsonRes(404, { error: { message: `voice not found: ${body.voice_id}` } });
      }
      // 成功：裸 s16le PCM，content-type **故意是假的**（实测那家写 audio/mpeg）。
      return bytesRes(200, pcm, "audio/mpeg");
    }
    return jsonRes(404, { error: { message: "no such path" } });
  };
}

function jsonRes(status, obj) {
  const bytes = Buffer.from(JSON.stringify(obj), "utf8");
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    text: async () => bytes.toString("utf8"),
  };
}

function bytesRes(status, bytes, type) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => type },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    text: async () => bytes.toString("binary"),
  };
}

/** 照宿主的装配方式拼一条链（配置读取用 volatile 那一套）。 */
function makeChain(config, log) {
  const liveValue = (raw) =>
    raw !== null && typeof raw === "object" && typeof raw.get === "function" ? raw.get() : raw;
  const field = (name, fallback) => {
    const v = liveValue(config[name]);
    return typeof v === "string" ? v : fallback;
  };
  const pin = () => {
    const voiceId = field("minimaxVoiceId", "");
    const baseUrl = field("minimaxBaseUrl", "");
    return { ...(voiceId === "" ? {} : { voiceId }), ...(baseUrl === "" ? {} : { baseUrl }) };
  };
  const shapeOf = () => endpointShapeOf(field("minimaxApi", "official"));
  // 宿主的口径：填了自定义地址、又不是官方那两条 → 第三方。
  const isThirdParty = (host) => field("minimaxBaseUrl", "") !== "" && !MINIMAX_HOSTS.includes(host);

  const fetchImpl = makeRelay(log);
  let state = emptyState();
  const voice = createMiniMaxVoiceService({
    fetch: fetchImpl,
    key: async () => "sk-relay",
    load: () => state,
    save: (next) => { state = next; },
    log: () => {},
    pin,
    shape: shapeOf,
    hosts: MINIMAX_HOSTS,
    isThirdParty,
  });
  const synthesizer = createMiniMaxSynthesizer({
    fetch: fetchImpl,
    key: async () => "sk-relay",
    keyKnown: () => true,
    voice: () => voice.voice(),
    enabled: () => true,
    log: () => {},
    model: field("minimaxModel", "") || undefined,
    shape: shapeOf,
    officialHosts: MINIMAX_HOSTS,
    isThirdParty,
    onUsed: (billed) => voice.stampUsed(billed),
    onVoiceMissing: (id) => voice.markMissing(id),
  });
  const router = createSynthRouter({
    engineOf: () => "minimax",
    log: () => {},
    adapters: {
      minimax: createMinimaxAdapter({
        synthesizer,
        // 宿主的 `describeUnavailable`（拿不到 mini 对象，这里照它的口径重述一遍）。
        describe: () => {
          const out = voice.readout();
          if (out.phase === "failed") {
            if (out.lastError === "no_host") return "没填 MiniMax 地址（no_host：中转站用户必填那一格）";
            return `认领失败（${out.lastError ?? "unknown"}）`;
          }
          const s = synthesizer.status();
          if (s.refusal !== null) return `MiniMax 拒绝（${s.refusal}）`;
          if (s.lastFailure === "voice_missing") return "音色在服务端不存在（voice_missing：音色 id 填错了，或那个音色被删了）";
          if (s.lastFailure !== null) return `MiniMax 失败（${s.lastFailure}）`;
          return "MiniMax 不可用";
        },
      }),
    },
  });

  return { voice, synthesizer, router };
}

/** 跑一格：返回 `{phase, lastError, audio, code, urls}`。 */
async function runCase(config) {
  const urls = [];
  const { voice, router } = makeChain(config, urls);
  const prepared = await voice.prepare();
  const audio = await router.synthesize({ utteranceId: "u1", seq: 0, text: "有事吗？没事我就走了", lang: "zh" });
  return { prepared, audio, code: router.lastCode().code, urls };
}

console.log("minimax-relay-config（端到端配置矩阵）");

// ── 1. 用户报的那件事：地址 + 音色 id 都填了，形状那一格留着默认 ──────────────
//
// 这是"每个模型都连不上"的完整样子：配置看起来齐了，路径却打在官方那条上、
// 中转站回 404，而 `prepare()` 仍然报 ready（它走的是"第三方地址按合成验"）。
{
  const out = await runCase({ minimaxBaseUrl: RELAY, minimaxVoiceId: VOICE });
  check("形状那格没改时仍然出声（形状跟着地址归正）", out.audio !== null && out.audio.samples.length > 0);
  check("打的是中转站那条路径，不是 /v1/t2a_v2",
    out.urls.some((u) => u.endsWith(`${RELAY}/v1/tts/speech`)) && !out.urls.some((u) => u.includes("/v1/t2a_v2")));
  check("一次都没试官方那两条（用户要的是那个网关了）",
    !out.urls.some((u) => MINIMAX_HOSTS.some((h) => u.startsWith(h))));
}

// ── 2. 三格都填对（形状显式选「中转站」）—— 预期也是出声 ─────────────────────
{
  const out = await runCase({ minimaxBaseUrl: RELAY, minimaxApi: "relay", minimaxVoiceId: VOICE });
  check("显式选了中转站形状也出声", out.audio !== null && out.code === SYNTH_CODES.ok);
  check("出声时引擎标签是 minimax", out.audio?.engine === "minimax");
}

// ── 3. 音色 id 填错 —— 必须说清是音色问题，而不是"失败" ────────────────────
//
// 中转站报的是 `{"error":{"message":"voice not found: …"}}`（没有平台码）。
// 不认这句话，用户看到的就是一句"失败"，而它明明写着原因。
{
  const out = await runCase({ minimaxBaseUrl: RELAY, minimaxApi: "relay", minimaxVoiceId: WRONG_VOICE });
  check("音色 id 填错 → 没有音频", out.audio === null);
  check("code 是 voice_missing（不是 other）", out.code === SYNTH_CODES.voiceMissing);
}

// ── 4. 选了「中转站」形状却没填地址 —— 直说缺哪一格，不去试官方 ──────────────
//
// 中转站形状的路径在官方站点上不存在，而 404 在 `probeShape` 里算"地址活着"
// （那是给中转站地址定的规矩）—— 于是会"探通"一个根本发不出声的官方地址。
{
  const out = await runCase({ minimaxApi: "relay", minimaxVoiceId: VOICE });
  check("选了中转站形状却没填地址 → failed / no_host",
    out.prepared.phase === "failed" && out.prepared.lastError === "no_host");
  check("这种组合一次网络都不打（不去猜官方）", out.urls.length === 0);
  check("仍然不会出声", out.audio === null);
}

// ── 5. 一个字段都不填 —— 官方那条路，行为与加这四个字段之前相同 ───────────────
{
  const out = await runCase({});
  check("不填任何新字段时，走的还是官方那套（打 /v1/get_voice 探平台）",
    out.urls.some((u) => u.endsWith("/v1/get_voice")));
  check("官方地址上不会用中转站那条路径", !out.urls.some((u) => u.includes("/v1/tts/speech")));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
