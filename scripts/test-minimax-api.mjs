/**
 * `lib/minimax/api.js`（`src/host/minimax/api.ts` 的编译产物）的单测 ——
 * 覆盖错误码映射表、host 探测的换站/聚合语义、克隆列表解析、合成请求体与
 * hex → Int16 解码、截止时间、取消与网络错误。
 *
 * **不联网**：fetch 一律注入假实现，探测用的 host 也是假的（`https://a` /
 * `https://b`）—— `MINIMAX_HOSTS` 只按常量断言，不产生任何请求。逐 host
 * 超时那几条用 20ms 的每 host 截止时间，不碰 30s 的真截止时间。
 */
import {
  MINIMAX_CONTROL_TIMEOUT_MS,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_HOSTS,
  MiniMaxError,
  classifyStatus,
  deadlineSignal,
  listClones,
  probeHost,
  synthesizePcm,
  withDeadline,
} from "../lib/minimax/api.js";

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 假 Response：只实现 call() 真正用到的 ok / status / text()。 */
function res(status, body, ok = status >= 200 && status < 300) {
  return { ok, status, text: async () => body };
}
/** 一个平台回答：HTTP 200 + base_resp。 */
function base(code, msg) {
  return res(200, JSON.stringify({ base_resp: { status_code: code, status_msg: msg ?? "" } }));
}
/** 抓住 reason（非 MiniMaxError 时给出可读的替代值）。 */
async function reasonOf(fn) {
  try {
    await fn();
    return "<no throw>";
  } catch (err) {
    return err instanceof MiniMaxError ? err.reason : `<${err?.name ?? typeof err}>`;
  }
}
/** 永远不回话的 fetch，直到 signal 中止；模拟被接受却没人应答的连接。 */
function hangingFetch() {
  return (url, init) =>
    new Promise((_, reject) => {
      const abort = () => reject(init.signal?.reason ?? new DOMException("aborted", "AbortError"));
      if (init.signal?.aborted === true) abort();
      else init.signal?.addEventListener("abort", abort, { once: true });
    });
}

console.log("minimax-api");

// ── 1. 常量 ────────────────────────────────────────────────────────────────
{
  check("MINIMAX_HOSTS = 国际站 + 中国站，顺序与上游一致",
    MINIMAX_HOSTS.length === 2 &&
    MINIMAX_HOSTS[0] === "https://api.minimax.io" &&
    MINIMAX_HOSTS[1] === "https://api.minimaxi.com");
  check("默认模型 speech-2.8-hd", MINIMAX_DEFAULT_MODEL === "speech-2.8-hd");
  check("控制面截止时间 30s", MINIMAX_CONTROL_TIMEOUT_MS === 30_000);
}

// ── 2. classifyStatus 完整映射表（上游每个分支一例） ─────────────────────
{
  const cases = [
    ["2049 → invalid_key", classifyStatus(2049, "invalid api key"), "invalid_key"],
    ["1004 → auth", classifyStatus(1004, "login fail"), "auth"],
    ["2054 → voice_missing", classifyStatus(2054, "voice id not exist"), "voice_missing"],
    ["1002 → rate", classifyStatus(1002, "rate limit"), "rate"],
    ["1039 → rate", classifyStatus(1039, "rate limit"), "rate"],
    ["1008 → quota", classifyStatus(1008, "insufficient balance"), "quota"],
    ["余额文案（无码）→ quota", classifyStatus(undefined, "Insufficient Balance"), "quota"],
    ["balance 文案 → quota", classifyStatus(2013, "your balance is not enough"), "quota"],
    ["insufficient 文案 → quota", classifyStatus(undefined, "insufficient fund"), "quota"],
    ["敏感文案 → sensitive", classifyStatus(undefined, "text is sensitive"), "sensitive"],
    ["含 voice 的文案 → voice_missing", classifyStatus(undefined, "voice id not exist"), "voice_missing"],
    ["2013（无文案）→ invalid", classifyStatus(2013, ""), "invalid"],
    ["未识别码 → other", classifyStatus(9999, "weird"), "other"],
    ["无码无文案 → other", classifyStatus(undefined, undefined), "other"],
  ];
  for (const [name, got, want] of cases) check(name, got === want);
  // 顺序本身是语义：sensitive 文案优先于泛指 voice 的文案；码 1004 优先于文案。
  check("sensitive 先于 voice 判定", classifyStatus(undefined, "sensitive voice content") === "sensitive");
  check("1004 码优先于 voice 文案", classifyStatus(1004, "voice login fail") === "auth");
  check("2013 + 无 voice 文案 → invalid", classifyStatus(2013, "invalid params") === "invalid");
}

// ── 2b. 非 JSON 体 → http ─────────────────────────────────────────────────
{
  const reason = await reasonOf(() =>
    listClones(async () => res(200, "<html>captive portal</html>"), "https://h", "sk-x"));
  check("HTTP 200 + 非 JSON 体 → http", reason === "http");
  const reason500 = await reasonOf(() =>
    listClones(async () => res(500, "boom"), "https://h", "sk-x"));
  check("HTTP 500 + 非 JSON 体 → http", reason500 === "http");
}

// ── 3. probeHost ──────────────────────────────────────────────────────────
{
  const seen = [];
  const ok = await probeHost(async (url, init) => {
    seen.push(url);
    check("探测请求带 Bearer auth", init.headers.Authorization === "Bearer sk-test");
    check("探测请求是 JSON", init.headers["Content-Type"] === "application/json");
    check("探测请求体 voice_type=voice_cloning",
      JSON.parse(init.body).voice_type === "voice_cloning");
    return base(0, "success");
  }, "sk-test", undefined, ["https://a", "https://b"]);
  check("命中第一个 host 就返回它", ok === "https://a");
  check("命中后不再试下一个", seen.length === 1);
}
{
  const seen = [];
  const hit = await probeHost(async (url) => {
    seen.push(url);
    // 上游是 `new URL(...) === host`；这里按前缀判 host。
    return url.startsWith("https://a/")
      ? base(2049, "invalid api key")
      : base(0, "success");
  }, "sk-intl", undefined, ["https://a", "https://b"]);
  check("2049 → 换下一个 host", hit === "https://b" && seen.length === 2);
}
{
  const seen = [];
  let hit = null;
  let thrown = null;
  try {
    hit = await probeHost(async (url) => {
      seen.push(url);
      return base(1004, "login fail");
    }, "sk-nobody", undefined, ["https://a", "https://b"]);
  } catch (err) {
    thrown = err;
  }
  check("1004 不被当成通过（上游 2026-09-08 的教训）", seen.length === 2 && hit === null);
  check("两个 host 都 1004 → invalid_key", thrown instanceof MiniMaxError && thrown.reason === "invalid_key");
}
{
  const hit = await probeHost(async () => base(2013, "invalid params"), "sk", undefined, ["https://a"]);
  check("2013 = 已鉴权，只是参数不合口味 → 就认这个 host", hit === "https://a");
}
{
  const seen = [];
  const reason = await reasonOf(() =>
    probeHost(async (url) => {
      seen.push(url);
      throw new Error("ECONNREFUSED");
    }, "sk", undefined, ["https://a", "https://b"]));
  check("两个 host 都网络失败 → network", reason === "network" && seen.length === 2);
}
{
  const reason = await reasonOf(() =>
    probeHost(async () => res(502, "bad gateway"), "sk", undefined, ["https://a", "https://b"]));
  check("两个 host 都非 JSON 的 HTTP 错误 → 抛最后一个 http", reason === "http");
}
{
  const reason = await reasonOf(() =>
    probeHost(async () => base(2049, "invalid api key"), "sk", undefined, ["https://a", "https://b"]));
  check("lastNetwork 为空时兜底 invalid_key（全 2049）", reason === "invalid_key");
}
{
  // 每个 host 都不回话 → 逐 host 超时，继续下一个；最后抛 network。
  const t0 = Date.now();
  const reason = await reasonOf(() =>
    probeHost(hangingFetch(), "sk", undefined, ["https://a", "https://b"], 20));
  const elapsed = Date.now() - t0;
  check("逐 host 超时 → 继续下一个 host，最后抛 network", reason === "network");
  check("探测确实用了每 host 截止时间（≈ 40ms，非 30s）", elapsed < 2000);
}
{
  // 取消：外层的 signal 在探测途中中止 → 原样抛 cancelled（不换站、不重试）。
  const ac = new AbortController();
  let calls = 0;
  const p = probeHost((url, init) => {
    calls += 1;
    return new Promise((_, reject) => {
      const abort = () => reject(init.signal?.reason ?? new DOMException("aborted", "AbortError"));
      if (init.signal?.aborted === true) abort();
      else init.signal?.addEventListener("abort", abort, { once: true });
    });
  }, "sk", ac.signal, ["https://a", "https://b"], 5000);
  await sleep(10);
  ac.abort(new DOMException("cancelled", "AbortError"));
  const reason = await reasonOf(() => p);
  check("途中取消 → cancelled", reason === "cancelled");
  check("取消后不再试下一个 host", calls === 1);
}
{
  // 已经中止的 signal：一样是 cancelled。
  const ac = new AbortController();
  ac.abort(new DOMException("cancelled", "AbortError"));
  const reason = await reasonOf(() => probeHost(hangingFetch(), "sk", ac.signal, ["https://a"]));
  check("进来前就已中止 → cancelled", reason === "cancelled");
}

// ── 4. deadlineSignal / withDeadline ──────────────────────────────────────
{
  let fired = 0;
  const d = deadlineSignal(10);
  d.signal.addEventListener("abort", () => { fired += 1; });
  await sleep(40);
  check("到点后 signal 中止", d.signal.aborted === true);
  check("reason 是 TimeoutError", d.signal.reason?.name === "TimeoutError");
  d.clear();
  await sleep(20);
  check("只中止一次", fired === 1);
}
{
  const d = deadlineSignal(50);
  d.clear();
  await sleep(80);
  check("clear() 之后不再触发", d.signal.aborted === false);
}
{
  const ac = new AbortController();
  const d = deadlineSignal(5000, ac.signal);
  ac.abort(new DOMException("cancelled", "AbortError"));
  check("outer 中止 → 立即跟着中止", d.signal.aborted === true);
  check("outer 的 reason 被转发", d.signal.reason?.name === "AbortError");
  d.clear();
}
{
  const ac = new AbortController();
  ac.abort(new DOMException("cancelled", "AbortError"));
  const d = deadlineSignal(5000, ac.signal);
  check("outer 已经中止 → 同步跟着中止", d.signal.aborted === true);
  d.clear();
}
{
  // withDeadline 自身把 TimeoutError 原样抛出（映射成 network 是 call() 的活）。
  let raw = null;
  try {
    await withDeadline(20, undefined, (signal) => hangingFetch()("u", { signal }));
  } catch (err) {
    raw = err;
  }
  check("withDeadline 到点 → 抛 TimeoutError（DOMException）", raw?.name === "TimeoutError");
  // 经过 call() 之后，截止时间才是 network，而不是 cancelled。
  const reason = await reasonOf(() =>
    withDeadline(20, undefined, (signal) =>
      synthesizePcm(hangingFetch(), "https://h", "sk-x", { voiceId: "v", text: "t", signal })));
  check("截止时间经 call() → network（不是 cancelled）", reason === "network");
}

// ── 5. listClones ─────────────────────────────────────────────────────────
{
  let body = null;
  const clones = await listClones(async (url, init) => {
    check("listClones 打 /v1/get_voice", url === "https://api.minimax.io/v1/get_voice");
    body = JSON.parse(init.body);
    return res(200, JSON.stringify({
      voice_cloning: [
        { voice_id: "herta-abc-1", created_time: "2026-09-08" },
        { voice_id: "herta-def-2" },
        { voice_id: 12345, created_time: "x" }, // 非字符串 id → 丢弃
        null,
      ],
    }));
  }, "https://api.minimax.io", "sk-x");
  check("请求体 voice_type=voice_cloning", body?.voice_type === "voice_cloning");
  check("解析出两条克隆", clones.length === 2);
  check("voiceId 原样", clones[0].voiceId === "herta-abc-1" && clones[1].voiceId === "herta-def-2");
  check("createdTime 原样", clones[0].createdTime === "2026-09-08");
  check("createdTime 缺省 → 空串", clones[1].createdTime === "");
}
{
  const empty = await listClones(async () => res(200, JSON.stringify({ voice_cloning: [] })), "https://h", "sk-x");
  check("空账号（[]）→ 空数组", Array.isArray(empty) && empty.length === 0);
  const missing = await listClones(async () => res(200, JSON.stringify({ base_resp: { status_code: 0 } })), "https://h", "sk-x");
  check("没有 voice_cloning 字段 → 空数组", missing.length === 0);
}
{
  // base_resp 非 0 但 HTTP 200 → 按码映射。
  const reason = await reasonOf(() =>
    listClones(async () => base(2054, "voice id not exist"), "https://h", "sk-x"));
  check("HTTP 200 + 2054 → voice_missing", reason === "voice_missing");
}

// ── 6. synthesizePcm 请求体 + hex 解码 ────────────────────────────────────
{
  // 小端样本 [0x1234, -2] → 字节 34 12 fe ff → hex。
  const raw = Buffer.alloc(4);
  raw.writeInt16LE(0x1234, 0);
  raw.writeInt16LE(-2, 2);
  const evenHex = raw.toString("hex");
  const oddHex = evenHex + "9"; // 5 个字符：落单的半个字节被丢掉

  const run = async (hex, opts) => {
    let body = null;
    const out = await synthesizePcm(async (url, init) => {
      check("synthesizePcm 打 /v1/t2a_v2", url === "https://api.minimax.io/v1/t2a_v2");
      check("合成请求带 Bearer auth", init.headers.Authorization === "Bearer sk-x");
      body = JSON.parse(init.body);
      return res(200, JSON.stringify({
        data: { audio: hex },
        extra_info: { usage_characters: 42 },
      }));
    }, "https://api.minimax.io", "sk-x", { voiceId: "herta-abc-1", text: "黑塔在此", ...opts });
    return { body, out };
  };

  const { body, out } = await run(evenHex, {});
  check("请求 model 用默认值", body.model === MINIMAX_DEFAULT_MODEL);
  check("请求 text 原样", body.text === "黑塔在此");
  check("请求 voice_setting.voice_id", body.voice_setting.voice_id === "herta-abc-1");
  check("请求 voice_setting speed/vol/pitch", body.voice_setting.speed === 1 && body.voice_setting.vol === 1 && body.voice_setting.pitch === 0);
  check("请求 audio_setting 采样率 24000", body.audio_setting.sample_rate === 24000);
  check("请求 audio_setting format=pcm, channel=1", body.audio_setting.format === "pcm" && body.audio_setting.channel === 1);
  check("请求 output_format=hex", body.output_format === "hex");
  check("请求 language_boost=Chinese", body.language_boost === "Chinese");
  check("hex → Int16Array 长度（偶数字节）", out.samples instanceof Int16Array && out.samples.length === 2);
  check("hex → 小端解码 [0x1234, -2]", out.samples[0] === 0x1234 && out.samples[1] === -2);
  check("sampleRate 回填 24000", out.sampleRate === 24000);
  check("usage_characters → billedChars", out.billedChars === 42);

  const odd = await run(oddHex, {});
  check("奇数长度 hex：样本数按 >>1 向下取整", odd.out.samples.length === 2);
  check("奇数长度 hex：落单的半个字节被丢弃，样本不受影响", odd.out.samples[0] === 0x1234 && odd.out.samples[1] === -2);

  const custom = await run(evenHex, { sampleRate: 32000, model: "speech-2.6-turbo" });
  check("sampleRate 可覆盖", custom.body.audio_setting.sample_rate === 32000 && custom.out.sampleRate === 32000);
  check("model 可覆盖", custom.body.model === "speech-2.6-turbo");

  const negHex = Buffer.alloc(2);
  negHex.writeInt16LE(-32768, 0);
  const neg = await run(negHex.toString("hex"), {});
  check("小端 -32768 解码正确", neg.out.samples.length === 1 && neg.out.samples[0] === -32768);
}
{
  // 没有 audio / 空 audio → other
  const noAudio = await reasonOf(() =>
    synthesizePcm(async () => res(200, JSON.stringify({ data: {} })), "https://h", "sk-x", { voiceId: "v", text: "t" }));
  check("缺 data.audio → other", noAudio === "other");
  const emptyAudio = await reasonOf(() =>
    synthesizePcm(async () => res(200, JSON.stringify({ data: { audio: "" } })), "https://h", "sk-x", { voiceId: "v", text: "t" }));
  check("data.audio 空串 → other", emptyAudio === "other");
  const noUsage = await synthesizePcm(async () => res(200, JSON.stringify({ data: { audio: "3412" } })), "https://h", "sk-x", { voiceId: "v", text: "t" });
  check("缺 usage_characters → billedChars 0", noUsage.billedChars === 0);
}

// ── 7. 取消 / 网络 / HTTP 错误映射 ────────────────────────────────────────
{
  const ac = new AbortController();
  const p = synthesizePcm(hangingFetch(), "https://h", "sk-x", { voiceId: "v", text: "t", signal: ac.signal });
  await sleep(10);
  ac.abort(new DOMException("cancelled", "AbortError"));
  check("abort → cancelled", (await reasonOf(() => p)) === "cancelled");
}
{
  const ac = new AbortController();
  ac.abort(new DOMException("cancelled", "AbortError"));
  const reason = await reasonOf(() =>
    synthesizePcm(hangingFetch(), "https://h", "sk-x", { voiceId: "v", text: "t", signal: ac.signal }));
  check("进来前就已中止 → cancelled", reason === "cancelled");
}
{
  const reason = await reasonOf(() =>
    synthesizePcm(async () => { throw new Error("ECONNREFUSED"); }, "https://h", "sk-x", { voiceId: "v", text: "t" }));
  check("fetch 抛错 → network", reason === "network");
}
{
  // fetch 抛的 AbortError 但没有 signal → 仍按 cancelled（isAbortError 宽口径）
  const reason = await reasonOf(() =>
    synthesizePcm(async () => { throw new DOMException("aborted", "AbortError"); }, "https://h", "sk-x", { voiceId: "v", text: "t" }));
  check("fetch 抛 AbortError → cancelled", reason === "cancelled");
}
{
  const reason = await reasonOf(() =>
    synthesizePcm(async () => { const e = new Error("x"); e.code = "ABORT_ERR"; throw e; }, "https://h", "sk-x", { voiceId: "v", text: "t" }));
  check("code=ABORT_ERR（undici 形状）→ cancelled", reason === "cancelled");
}
{
  // 读取 body 时抛错 → network
  const reason = await reasonOf(() =>
    synthesizePcm(async () => ({ ok: true, status: 200, text: async () => { throw new Error("socket reset"); } }),
      "https://h", "sk-x", { voiceId: "v", text: "t" }));
  check("读 body 抛错 → network", reason === "network");
}
{
  const table = [
    ["HTTP 401（非 JSON）+ 无码 → http", res(401, "unauthorized"), "http"],
    ["HTTP 403 + 2049 → invalid_key", res(403, JSON.stringify({ base_resp: { status_code: 2049, status_msg: "invalid api key" } })), "invalid_key"],
    ["HTTP 429 + 1002 → rate", res(429, JSON.stringify({ base_resp: { status_code: 1002, status_msg: "rate limit" } })), "rate"],
    ["HTTP 402 + 1008 → quota", res(402, JSON.stringify({ base_resp: { status_code: 1008, status_msg: "insufficient balance" } })), "quota"],
    ["HTTP 500 + 无码 → other", res(500, JSON.stringify({ base_resp: {} })), "other"],
  ];
  for (const [name, response, want] of table) {
    const got = await reasonOf(() =>
      synthesizePcm(async () => response, "https://h", "sk-x", { voiceId: "v", text: "t" }));
    check(name, got === want);
  }
}
{
  // statusCode 会被带上（上游的第三个构造参数）
  let statusCode = null;
  try {
    await synthesizePcm(async () => res(403, JSON.stringify({ base_resp: { status_code: 2049, status_msg: "invalid api key" } })),
      "https://h", "sk-x", { voiceId: "v", text: "t" });
  } catch (err) { statusCode = err.statusCode; }
  check("MiniMaxError.statusCode 带上是平台码 2049", statusCode === 2049);
  let nonJsonStatus = null;
  try {
    await synthesizePcm(async () => res(500, "boom"), "https://h", "sk-x", { voiceId: "v", text: "t" });
  } catch (err) { nonJsonStatus = err.statusCode; }
  check("非 JSON 体时 statusCode 为 undefined", nonJsonStatus === undefined);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);