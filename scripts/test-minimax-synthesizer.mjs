/**
 * `src/host/minimax/synthesizer.ts` 的单测 —— 失败分类、refusal 三态、取消静默、
 * 超时、并发上限、`voice_missing`、密钥变更清 refusal。
 *
 * 全部走注入的 fetch，不碰网络、不碰真实密钥。跑法见 test-minimax-voice.mjs 的头注。
 */
import { MINIMAX_HOSTS } from "../lib/minimax/api.js";
import { createMiniMaxSynthesizer } from "../lib/minimax/synthesizer.js";

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

const HER = "herta-b1a43133-uo58hrlu1x";
const HOST = MINIMAX_HOSTS[1];

function hexOf(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => buf.writeInt16LE(v, i * 2));
  return buf.toString("hex");
}

/** 一次成功的 /v1/t2a_v2 应答；statusCode 非 0 时模拟"HTTP 200 但 base_resp 报错"。 */
function ttsResponse(samples = [1, -2, 3], usage = 12, statusCode = 0, statusMsg = "") {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        base_resp: { status_code: statusCode, status_msg: statusMsg },
        data: { audio: hexOf(samples) },
        extra_info: { usage_characters: usage },
      }),
  };
}

/** 永不回话、只在被 abort 时拒绝 —— 用来测取消与超时。 */
function pendingFetch(_url, init) {
  return new Promise((_resolve, reject) => {
    const signal = init.signal;
    const onAbort = () => reject(new DOMException("aborted", "AbortError"));
    if (signal?.aborted === true) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function makeSyn(opts = {}) {
  const used = [];
  const refusals = [];
  const missing = [];
  let key = opts.key === undefined ? "sk-api-test" : opts.key;
  const syn = createMiniMaxSynthesizer({
    fetch: opts.fetch,
    key: async () => key,
    keyKnown: () => (opts.keyKnown === undefined ? key !== null : opts.keyKnown()),
    voice: () => (opts.voice === undefined ? { voiceId: HER, host: HOST } : opts.voice()),
    enabled: () => (opts.enabled === undefined ? true : opts.enabled()),
    requestTimeoutMs: opts.requestTimeoutMs,
    maxInFlight: opts.maxInFlight,
    applyEffect: opts.applyEffect,
    onUsed: (n) => used.push(n),
    onRefusal: (r) => refusals.push(r),
    onVoiceMissing: (id) => missing.push(id),
    log: () => {},
  });
  return { syn, used, refusals, missing, setKey: (next) => { key = next; } };
}

const req = (utteranceId, seq, text = "你好呀，这一句话够长了。") => ({
  utteranceId,
  seq,
  text,
  lang: "zh",
});

// ── 1. 成功：返回 PCM、计费字符数、available() 为真 ────────────────────────
{
  const { syn, used } = makeSyn({ fetch: async () => ttsResponse([1, -2, 3], 12) });
  check("available() 在什么都没发生时也是真", syn.available() === true);
  const out = await syn.synthesize(req("u1", 0));
  check("成功返回样本", out !== null && out.samples instanceof Int16Array && out.samples.length === 3);
  check("样本值原样（含负数）", out !== null && out.samples[0] === 1 && out.samples[1] === -2);
  check("采样率 24 kHz", out !== null && out.sampleRate === 24000);
  check("durationMs 按样本数算", out !== null && Math.abs(out.durationMs - (3 / 24000) * 1000) < 1e-9);
  check("计费字符数被上报", used.length === 1 && used[0] === 12);
  check("成功后 lastFailure 为空", syn.status().lastFailure === null);
  syn.dispose();
}

// ── 2. available() 是活开关 ───────────────────────────────────────────────
{
  const a = makeSyn({ fetch: async () => ttsResponse(), keyKnown: () => false });
  check("没有密钥 → 不可用", a.syn.available() === false);
  const b = makeSyn({ fetch: async () => ttsResponse(), voice: () => null });
  check("没有克隆 → 不可用", b.syn.available() === false);
  const c = makeSyn({ fetch: async () => ttsResponse(), enabled: () => false });
  check("引擎被关掉 → 不可用", c.syn.available() === false);
  check("引擎被关掉时不发请求", (await c.syn.synthesize(req("u1", 0))) === null);
}

// ── 3. refusal：auth 会 doom 本 utterance，下一条 utterance 只探一次 ──────
{
  let calls = 0;
  const { syn, refusals } = makeSyn({
    fetch: async () => {
      calls += 1;
      return ttsResponse([], 0, 1004, "login fail");
    },
  });
  const first = await syn.synthesize(req("u1", 0));
  check("auth → 该单元返回 null（不抛）", first === null);
  check("auth 上报 refusal", refusals.length === 1 && refusals[0] === "auth");
  check("status().refusal 被记下", syn.status().refusal === "auth");
  const callsAfterFirst = calls;
  const second = await syn.synthesize(req("u1", 1));
  check("同一 utterance 的后续单元不再发请求", second === null && calls === callsAfterFirst);
  await syn.synthesize(req("u2", 0));
  check("换一条 utterance 只再探一次（不是每个单元都探）", calls === callsAfterFirst + 1);
  check("refusal 没变化时不重复回调", refusals.length === 1);
  syn.dispose();
}

// ── 4. rate 不是 refusal：不 doom ────────────────────────────────────────
{
  let calls = 0;
  const { syn, refusals } = makeSyn({
    fetch: async () => {
      calls += 1;
      return ttsResponse([], 0, 1002, "rate limit");
    },
  });
  await syn.synthesize(req("u1", 0));
  await syn.synthesize(req("u1", 1));
  check("限流不 doom：两个单元都发了请求", calls === 2);
  check("限流不产生 refusal", refusals.length === 0 && syn.status().refusal === null);
  check("限流记为 lastFailure=rate", syn.status().lastFailure === "rate");
  syn.dispose();
}

// ── 5. voice_missing：不 doom，交给宿主回落 ──────────────────────────────
{
  let calls = 0;
  const { syn, missing } = makeSyn({
    fetch: async () => {
      calls += 1;
      return ttsResponse([], 0, 2054, "voice id not exist");
    },
  });
  await syn.synthesize(req("u1", 0));
  check("voice_missing 回调带上 id", missing.length === 1 && missing[0] === HER);
  check("status().missingVoice 记下 id", syn.status().missingVoice === HER);
  await syn.synthesize(req("u1", 1));
  check("voice_missing 不 doom（后续单元仍尝试）", calls === 2);
  syn.dispose();
}

// ── 6. 密钥变了就解除 refusal ────────────────────────────────────────────
{
  let mode = "auth";
  const { syn, refusals, setKey } = makeSyn({
    fetch: async () => (mode === "auth" ? ttsResponse([], 0, 1004) : ttsResponse([5, 6])),
  });
  await syn.synthesize(req("u1", 0));
  check("先产生一次 refusal", syn.status().refusal === "auth");
  setKey("sk-api-another");
  mode = "ok";
  // 注意用**新的 utterance**：u1 已经被 auth doom 了，换密钥不会解除 doom
  // （那是刻意的：密钥错了就该把这一轮剩下的单元都停掉）。
  const out = await syn.synthesize(req("u2", 0));
  check("换密钥后恢复发声（新 utterance）", out !== null && out.samples.length === 2);
  check("换密钥清掉 refusal（并回调 null）", syn.status().refusal === null && refusals.includes(null));
  syn.dispose();
}

// ── 7. 取消是静默的：不写 lastFailure、不算失败 ──────────────────────────
{
  const { syn, refusals } = makeSyn({ fetch: pendingFetch });
  const p = syn.synthesize(req("u1", 0));
  await new Promise((r) => setTimeout(r, 5));
  syn.cancel("u1");
  const out = await p;
  check("取消 → null", out === null);
  check("取消不留 lastFailure", syn.status().lastFailure === null);
  check("取消不算 refusal", refusals.length === 0);
  syn.dispose();
}

// ── 8. 超时算 network（这条曾经被 api 分类成 cancelled 而静默吞掉）────────
{
  const { syn } = makeSyn({ fetch: pendingFetch, requestTimeoutMs: 20 });
  const out = await syn.synthesize(req("u1", 0));
  check("超时 → null", out === null);
  check("超时记为 lastFailure=network", syn.status().lastFailure === "network");
  syn.dispose();
}

// ── 9. 并发上限默认 2，可收到 1 ──────────────────────────────────────────
{
  let concurrent = 0;
  let maxConcurrent = 0;
  const { syn } = makeSyn({
    maxInFlight: 1,
    fetch: async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent -= 1;
      return ttsResponse([0, 0]);
    },
  });
  await Promise.all([syn.synthesize(req("u1", 0)), syn.synthesize(req("u2", 0))]);
  check("maxInFlight=1 时同时只有一个在飞", maxConcurrent === 1);
  syn.dispose();
}

// ── 10. dispose：在飞的请求被中断，结果被丢弃 ─────────────────────────────
{
  const { syn } = makeSyn({ fetch: pendingFetch });
  const p = syn.synthesize(req("u1", 0));
  await new Promise((r) => setTimeout(r, 5));
  syn.dispose();
  check("dispose 之后在飞的合成返回 null", (await p) === null);
  check("dispose 之后 available() 为假", syn.available() === false);
}

// ── 11. applyEffect：收 Float32 返回 Float32，回来仍是 Int16 ──────────────
{
  const { syn } = makeSyn({ fetch: async () => ttsResponse([100, 200, 300]), applyEffect: (s) => s.fill(0) });
  const out = await syn.synthesize(req("u1", 0));
  check("applyEffect 生效（全零）", out !== null && out.samples.every((v) => v === 0));
  syn.dispose();
}

// ── 12. 应答里没有音频 → other，仍然不抛 ─────────────────────────────────
{
  const { syn } = makeSyn({
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ base_resp: { status_code: 0 }, data: {} }),
    }),
  });
  const out = await syn.synthesize(req("u1", 0));
  check("没有 audio → null", out === null);
  check("没有 audio → lastFailure=other", syn.status().lastFailure === "other");
  syn.dispose();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
