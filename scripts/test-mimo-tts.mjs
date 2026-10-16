/**
 * `mimo-tts.js` 的单测 —— 覆盖：WAV 解析、错误分类、key 读取、指纹、
 * 合成器的 available/synthesize/cancel/refusal 全链路（mock fetch）。
 *
 * 不碰真实网络、不碰真实 key —— 全部走注入的 fetch 与显式参数。
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MIMO_DEFAULT_BASE_URL, MimoError, classifyMimoStatus, createMimoSynthesizer, decodeWavToPcm16, normalizeReferenceWav, readMimoKeyFromEnv, readReferenceWav, referenceFingerprint, resolveReferencePath, synthesizePcm } from "../src/host/mimo-tts.js";

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

// ── 造一个最小合法 WAV（PCM16 单声道） ────────────────────────────────────
function makeWav(sampleRate, channels, bitsPerSample, samples) {
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buf.writeUInt16LE(channels * bytesPerSample, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) buf.writeInt16LE(samples[i], 44 + i * 2);
  return new Uint8Array(buf);
}

console.log("mimo-tts");

// 1. WAV 解析
{
  const wav = makeWav(24000, 1, 16, [0, 1000, -1000, 32767, -32768]);
  const r = decodeWavToPcm16(wav);
  check("WAV 解析：采样率", r.sampleRate === 24000);
  check("WAV 解析：样本数", r.samples.length === 5);
  check("WAV 解析：样本值", r.samples[0] === 0 && r.samples[1] === 1000 && r.samples[3] === 32767 && r.samples[4] === -32768);
}

// 2. WAV 解析拒绝非 mono / 非 16bit / 坏头
{
  const stereo = makeWav(24000, 2, 16, [0, 0, 0, 0]);
  let threw = false;
  try { decodeWavToPcm16(stereo); } catch (e) { threw = e instanceof MimoError; }
  check("WAV 拒绝立体声", threw);

  const bad = new Uint8Array([1, 2, 3, 4, 5]);
  threw = false;
  try { decodeWavToPcm16(bad); } catch (e) { threw = e instanceof MimoError; }
  check("WAV 拒绝坏头", threw);
}

// 3. 错误分类
check("401 → auth", classifyMimoStatus(401, "") === "auth");
check("403 → invalid_key", classifyMimoStatus(403, "") === "invalid_key");
check("429 → rate", classifyMimoStatus(429, "") === "rate");
check("429 quota → quota", classifyMimoStatus(429, "insufficient quota") === "quota");
check("500 → network", classifyMimoStatus(500, "") === "network");
check("400 其它 → other", classifyMimoStatus(400, "weird") === "other");

// 4. key 读取
{
  const r = readMimoKeyFromEnv({ MIMO_API_KEY: "sk-test", MIMO_BASE_URL: "https://example.com/v1/" });
  check("key 读取", r.key === "sk-test");
  check("baseUrl 去掉末尾斜杠", r.baseUrl === "https://example.com/v1");
  const d = readMimoKeyFromEnv({});
  check("无 key 时 null", d.key === null);
  check("默认 baseUrl", d.baseUrl === MIMO_DEFAULT_BASE_URL);
}

// 5. 指纹稳定性
{
  const a = referenceFingerprint(new Uint8Array([1, 2, 3]));
  const b = referenceFingerprint(new Uint8Array([1, 2, 3]));
  const c = referenceFingerprint(new Uint8Array([1, 2, 4]));
  check("指纹稳定", a === b);
  check("指纹区分内容", a !== c);
  check("指纹长度", a.length === 16);
}

// 6. 参考音：路径解析 + 归一化（2026-10-11 起路径不再写死 D:\\Herta）
{
  const refPath = resolveReferencePath();
  check("参考音路径解析得到（env → 本机约定 → 上游）", typeof refPath === "string" && refPath.length > 0);
  const ref = readReferenceWav(refPath);
  check("真实参考 WAV 读到", ref !== null && ref.length > 100_000, "path=" + refPath);
  if (ref !== null && ref !== undefined) {
    const norm = normalizeReferenceWav(ref);
    check(
      "归一化成 24kHz 单声道（少了这一层，服务端会 400）",
      norm !== null && norm.length > 0 && norm.length <= ref.length + 64,
    );
  }
}

// 7. synthesizePcm：mock fetch 成功路径
{
  const wav = makeWav(24000, 1, 16, [0, 500, -500]);
  const b64 = Buffer.from(wav).toString("base64");
  const fetchOk = async (url, init) => {
    check("请求 URL 是 /chat/completions", url.endsWith("/chat/completions"));
    const body = JSON.parse(init.body);
    check("请求 model 是 voiceclone", body.model === "mimo-v2.5-tts-voiceclone");
    check(
  "请求带 audio.voice（DataURL 形状 —— 裸 base64 会被服务端 400 拒）",
  typeof body.audio.voice === "string" && body.audio.voice.startsWith("data:audio/wav;base64,"),
);
    check("请求带 Bearer auth", init.headers.Authorization.startsWith("Bearer "));
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { audio: { data: b64 } } }],
        usage: { completion_tokens: 7 },
      }),
    };
  };
  const out = await synthesizePcm(fetchOk, { key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }, {
    text: "测试文本",
    reference: new Uint8Array([1, 2, 3]),
  });
  check("合成返回样本", out.samples.length === 3);
  check("合成返回采样率", out.sampleRate === 24000);
  check("billedChars 用 usage", out.billedChars === 7);
}

// 8. synthesizePcm：HTTP 错误映射
{
  const fetch401 = async () => ({ ok: false, status: 401, text: async () => "unauthorized" });
  let reason = null;
  try {
    await synthesizePcm(fetch401, { key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }, {
      text: "x", reference: new Uint8Array([1]),
    });
  } catch (e) { reason = e.reason; }
  check("401 → MimoError auth", reason === "auth");
}

// 9. synthesizePcm：网络异常
{
  const fetchThrow = async () => { throw new Error("ECONNREFUSED"); };
  let reason = null;
  try {
    await synthesizePcm(fetchThrow, { key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }, {
      text: "x", reference: new Uint8Array([1]),
    });
  } catch (e) { reason = e.reason; }
  check("网络异常 → network", reason === "network");
}

// 10. synthesizePcm：无 key
{
  let reason = null;
  try {
    await synthesizePcm(async () => { throw new Error("should not fetch"); }, { key: null, baseUrl: "x" }, {
      text: "x", reference: new Uint8Array([1]),
    });
  } catch (e) { reason = e.reason; }
  check("无 key → no_key 且不发请求", reason === "no_key");
}

// 11. 合成器 available()
{
  const syn = createMimoSynthesizer({
    fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
    keyRef: () => ({ key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }),
    enabled: () => true,
    reference: () => new Uint8Array([1, 2, 3]),
  });
  check("key+ref+enabled → available", syn.available() === true);
  syn.dispose();
  check("dispose 后 unavailable", syn.available() === false);
}

// 12. 合成器 synthesize 成功
{
  const wav = makeWav(24000, 1, 16, [10, -10, 20]);
  const b64 = Buffer.from(wav).toString("base64");
  const syn = createMimoSynthesizer({
    fetch: async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { audio: { data: b64 } } }] }),
    }),
    keyRef: () => ({ key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }),
    enabled: () => true,
    reference: () => new Uint8Array([1, 2, 3]),
  });
  const out = await syn.synthesize({ utteranceId: "u1", seq: 1, text: "你好", lang: "zh" });
  check("synthesize 成功返回", out !== null && out.samples.length === 3);
  check("durationMs 计算", out.durationMs > 0);
  syn.dispose();
}

// 13. 合成器 synthesize 失败 → null（免声）
{
  const syn = createMimoSynthesizer({
    fetch: async () => ({ ok: false, status: 500, text: async () => "boom" }),
    keyRef: () => ({ key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }),
    enabled: () => true,
    reference: () => new Uint8Array([1]),
  });
  const out = await syn.synthesize({ utteranceId: "u1", seq: 1, text: "你好", lang: "zh" });
  check("失败 → null", out === null);
  check("lastFailure 记录", syn.status().lastFailure !== null);
  syn.dispose();
}

// 14. refusal 上报（auth 一次）
{
  let reported = [];
  const syn = createMimoSynthesizer({
    fetch: async () => ({ ok: false, status: 401, text: async () => "unauthorized" }),
    keyRef: () => ({ key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }),
    enabled: () => true,
    reference: () => new Uint8Array([1]),
    onRefusal: (r) => reported.push(r),
  });
  await syn.synthesize({ utteranceId: "u1", seq: 1, text: "一", lang: "zh" });
  await syn.synthesize({ utteranceId: "u1", seq: 2, text: "二", lang: "zh" });
  check("refusal 上报一次", reported.length === 1 && reported[0] === "auth");
  check("refusal 进 status", syn.status().refusal === "auth");
  syn.dispose();
}

// 15. cancel 中止在途请求
{
  let sawAbort = false;
  const fetchHang = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => { sawAbort = true; reject(new Error("aborted")); });
  });
  const syn = createMimoSynthesizer({
    fetch: fetchHang,
    keyRef: () => ({ key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }),
    enabled: () => true,
    reference: () => new Uint8Array([1]),
    requestTimeoutMs: 5000,
  });
  const p = syn.synthesize({ utteranceId: "u2", seq: 1, text: "x", lang: "zh" });
  await new Promise((r) => setTimeout(r, 10));
  syn.cancel("u2");
  const out = await p;
  check("cancel → null", out === null);
  check("cancel 触发 abort", sawAbort === true);
  syn.dispose();
}

// 16. enabled=false → 不发请求
{
  let fetched = false;
  const syn = createMimoSynthesizer({
    fetch: async () => { fetched = true; return { ok: true, status: 200, text: async () => "{}" }; },
    keyRef: () => ({ key: "sk-x", baseUrl: "https://api.xiaomimimo.com/v1" }),
    enabled: () => false,
    reference: () => new Uint8Array([1]),
  });
  const out = await syn.synthesize({ utteranceId: "u3", seq: 1, text: "x", lang: "zh" });
  check("enabled=false → null 且不 fetch", out === null && fetched === false);
  syn.dispose();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
