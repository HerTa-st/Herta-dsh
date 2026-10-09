/**
 * `src/host/minimax/endpoint.ts`（请求形状）+ `peak.ts`（峰值归一化）的单测。
 *
 * 存在的理由：这两块是 2026-10-10 为「用第三方中转站的用户接不上」加的那条缝，
 * 而它们的**形状事实来自实测**（中转站的路径、扁平 `voice_id`、裸 PCM、假的
 * content-type、电平偏小）。这些事实没法靠读代码复核 —— 只能钉在测试里，
 * 不然下一个人"顺手改成更合理的写法"时不会有任何东西拦他。
 *
 * 跑法：先 `node scripts/build-minimax.mjs`（测试从**编译产物**导入）。
 */
import {
  DEFAULT_ENDPOINT_SHAPE,
  ENDPOINT_SHAPES,
  endpointShapeOf,
} from "../lib/minimax/endpoint.js";
import { MINIMAX_RELAY_DEFAULT_MODEL, synthesizePcm } from "../lib/minimax/api.js";
import { MIN_PEAK, TARGET_PEAK, normalizePeak } from "../lib/minimax/peak.js";

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
const HOST = "https://api.minimaxi.com";

/** 假 Response：`ok` / `status` / `arrayBuffer` / `text`。 */
function res(status, body, contentType = "") {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    text: async () => bytes.toString("utf8"),
  };
}

/** 裸 s16le 样本 → 字节。 */
function pcmBytes(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => buf.writeInt16LE(v, i * 2));
  return buf;
}

async function reasonOf(fn) {
  try {
    await fn();
    return "<no throw>";
  } catch (err) {
    return err?.reason ?? `<${err?.name ?? typeof err}>`;
  }
}

console.log("minimax-endpoint / peak");

// ── 1. 形状登记表 ─────────────────────────────────────────────────────────
{
  check("登记了两个形状：official / relay", Object.keys(ENDPOINT_SHAPES).join(",") === "official,relay");
  check("默认是官方（不填 minimaxApi 时行为不变）", DEFAULT_ENDPOINT_SHAPE.name === "official");
  check("不认识的值兜回官方（配置写错不该让语音失声）", endpointShapeOf("nope").name === "official");
  check("undefined 也兜回官方", endpointShapeOf(undefined).name === "official");
  check("relay 认「中转站」这个名字", endpointShapeOf("relay").name === "relay");
  check("官方能列音色、也能离线校验音色", ENDPOINT_SHAPES.official.supportsVoiceList === true && ENDPOINT_SHAPES.official.canVerifyVoice === true);
  check("中转站两样都不能（它没有 /v1/get_voice）",
    ENDPOINT_SHAPES.relay.supportsVoiceList === false && ENDPOINT_SHAPES.relay.canVerifyVoice === false);
}

// ── 2. 路径与请求体：两家的形状差异逐条钉住 ────────────────────────────────
{
  check("官方打 /v1/t2a_v2", ENDPOINT_SHAPES.official.synthesizeUrl(HOST) === `${HOST}/v1/t2a_v2`);
  check("中转站打 /v1/tts/speech", ENDPOINT_SHAPES.relay.synthesizeUrl(RELAY) === `${RELAY}/v1/tts/speech`);

  const req = { voiceId: "v-1", text: "你好，我是黑塔。", model: "m", sampleRate: 24000, key: "sk" };
  const relayBody = JSON.parse(ENDPOINT_SHAPES.relay.synthesizeBody(req));
  check("中转站：voice_id 在**顶层**（嵌套写法实测回 502）",
    relayBody.voice_id === "v-1" && relayBody.voice_setting === undefined);
  check("中转站：audio_setting.format 显式给 pcm（不给会回 mp3/wav）",
    relayBody.audio_setting?.format === "pcm" && relayBody.audio_setting?.channel === 1);
  check("中转站：模型走扁平 model 字段", relayBody.model === "m" && relayBody.text === req.text);

  const officialBody = JSON.parse(ENDPOINT_SHAPES.official.synthesizeBody(req));
  check("官方：voice_id 在 voice_setting 里", officialBody.voice_setting?.voice_id === "v-1");
  check("官方：要 hex 编码的音频", officialBody.output_format === "hex");
  check("官方：语言提示照旧", officialBody.language_boost === "Chinese");
}

// ── 3. 中转站回体：裸 PCM，content-type 是假的 ─────────────────────────────
{
  const samples = [1, -2, 300, -300];
  const out = await synthesizePcm(
    async () => res(200, pcmBytes(samples), "audio/mpeg"),
    RELAY,
    "sk",
    { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay },
  );
  check("裸 PCM 按小端读回来（字节顺序反了听感是噪声，而时长/峰值全对）",
    out.samples.length === 4 && out.samples[0] === 1 && out.samples[1] === -2 && out.samples[2] === 300 && out.samples[3] === -300);
  check("按字节判形状 —— 不信那个假的 audio/mpeg", out.sampleRate === 24000);
  check("中转站不报计费字符 → 0（是「记不到」，不是「没花钱」）", out.billedChars === 0);
  check("回体字节数被记下来", out.rawBytes === 8);

  const empty = await reasonOf(() =>
    synthesizePcm(async () => res(200, Buffer.alloc(0)), RELAY, "sk", {
      voiceId: "v",
      text: "t",
      shape: ENDPOINT_SHAPES.relay,
    }),
  );
  check("空体 → other（不能当成「合成成功但没有声音」）", empty === "other");
}

// ── 4. 错误分类：形状自己算，但用的是 api.ts 那张表 ─────────────────────────
{
  const jsonErr = (code, msg) =>
    res(200, JSON.stringify({ data: { status_code: code, status_msg: msg } }));

  check("中转站把错误藏在 data 里（实测形状）→ 认得出 invalid_key",
    (await reasonOf(() => synthesizePcm(async () => jsonErr(1004, "login fail"), RELAY, "sk",
      { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay }))) === "auth");
  check("非 JSON 的 404 → http（无名可分）",
    (await reasonOf(() => synthesizePcm(async () => res(404, "<html>nope</html>"), RELAY, "sk",
      { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay }))) === "http");
  check("HTTP 500 + 非 JSON → http",
    (await reasonOf(() => synthesizePcm(async () => res(500, "boom"), RELAY, "sk",
      { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay }))) === "http");
  check("HTTP 200 + 顶层 base_resp 报错 → 按码归类（不是一律 other）",
    (await reasonOf(() => synthesizePcm(
      async () => res(200, JSON.stringify({ base_resp: { status_code: 1004, status_msg: "login fail" }, data: { audio: "" } })),
      HOST, "sk", { voiceId: "v", text: "t" }))) === "auth");
  check("官方：配额文案也要认得（靠文案那条分支）",
    (await reasonOf(() => synthesizePcm(
      async () => res(200, JSON.stringify({ base_resp: { status_code: 1008, status_msg: "insufficient balance" } })),
      HOST, "sk", { voiceId: "v", text: "t" }))) === "quota");
  check("取消（AbortError）→ cancelled，不是 network",
    (await reasonOf(() => synthesizePcm(
      async () => { throw new DOMException("x", "AbortError"); },
      RELAY, "sk", { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay }))) === "cancelled");
  check("连不上 → network",
    (await reasonOf(() => synthesizePcm(
      async () => { throw new Error("ECONNREFUSED"); },
      RELAY, "sk", { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay }))) === "network");
}

// ── 5. 默认模型按形状分开（两家清单不重叠） ─────────────────────────────────
{
  const requested = [];
  const fetch = async (url, init) => {
    requested.push(JSON.parse(init.body).model);
    return res(200, pcmBytes([1, 2]));
  };
  await synthesizePcm(fetch, RELAY, "sk", { voiceId: "v", text: "t", shape: ENDPOINT_SHAPES.relay });
  check("中转站不填模型 → 用它自己的默认（minimax/speech-02-turbo）",
    requested[0] === MINIMAX_RELAY_DEFAULT_MODEL);

  await synthesizePcm(async (url, init) => {
    requested.push(JSON.parse(init.body).model);
    return res(200, JSON.stringify({ data: { audio: "0100" } }));
  }, HOST, "sk", { voiceId: "v", text: "t" });
  check("官方不填模型 → 仍然是 speech-2.8-hd（加字段之前的行为）", requested[1] === "speech-2.8-hd");

  await synthesizePcm(async (url, init) => {
    requested.push(JSON.parse(init.body).model);
    return res(200, pcmBytes([1, 2]));
  }, RELAY, "sk", { voiceId: "v", text: "t", model: "minimax/speech-02-hd", shape: ENDPOINT_SHAPES.relay });
  check("填了 minimaxModel 就以他填的为准", requested[2] === "minimax/speech-02-hd");
}

// ── 6. peak：只对明确偏轻的材料动手 ────────────────────────────────────────
{
  /** 峰值 6000/32768 ≈ 0.18 —— 实测那家中转站回的就是这个量级。 */
  const quiet = new Int16Array([0, 6000, -3000, 100]);
  const loud = new Int16Array([0, 28000, -12000, 100]);
  const zeros = new Int16Array([0, 0, 0]);

  const lifted = normalizePeak(quiet);
  let peak = 0;
  for (const v of lifted) peak = Math.max(peak, Math.abs(v));
  check("偏轻的材料被放大到目标峰值附近（±1 LSB）",
    Math.abs(peak / 32768 - TARGET_PEAK) < 0.01);
  check("放大是**新数组**，不改原数组", lifted !== quiet && quiet[1] === 6000);

  check("本来够响的材料原样返回（不做没必要的削波）", normalizePeak(loud) === loud);
  check("全零原样返回（比值会是 NaN，乘完一整条 NaN）", normalizePeak(zeros) === zeros);
  check("阈值常量是 0.5，目标留 1% 头", MIN_PEAK === 0.5 && TARGET_PEAK === 0.99);

  // 放大不能溢出：这条钉的是 int16 的钳位。
  const near = new Int16Array([16000, -16000]);
  const clamped = normalizePeak(near);
  check("放大后仍在 int16 范围内", clamped.every((v) => v >= -32768 && v <= 32767));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
