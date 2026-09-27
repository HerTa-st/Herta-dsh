/**
 * `minimax/pipeline.ts` 的说话管线单测 —— 帧进、PCM 帧出，不起 DSH。
 *
 * 依赖注入是刻意的：`synthUnit` 是假的、`bus` 是数组、`engineOf` 是开关，
 * 所以这里能逐条钉住**这一段逻辑自己的行为**（什么时候念、念哪一段、被否决时
 * 丢不丢、到上限怎么办），而不需要连 MiniMax、也不需要浏览器。
 *
 * 跑法：`node scripts/build-minimax.mjs && node scripts/test-minimax-pipeline.mjs`
 * （管线是纯逻辑、零裸包导入，所以**不需要** resolve hook。）
 */
import { segmentSpeechUnits } from "../lib/minimax/segment.js";
import { createEventBus, createSpeechPipeline, isTopLevelAgent, speaksFor } from "../lib/minimax/pipeline.js";

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

const SAMPLES = Int16Array.from([1, -2, 3]);
/** 闭包 array 当 bus —— 管线只用 `send`。 */
function makeBus() {
  const frames = [];
  return { frames, send: (f) => frames.push(f), add() {}, remove() {}, count: () => 1, stop() {} };
}

function makeSynth(opts = {}) {
  const calls = [];
  const synthUnit = (req) => {
    calls.push(req);
    if (opts.defer === true) {
      return new Promise((resolve) => {
        opts.pending.push(() => resolve({ samples: SAMPLES, sampleRate: 24000, durationMs: 1, engine: "minimax" }));
      });
    }
    return Promise.resolve({ samples: SAMPLES, sampleRate: 24000, durationMs: 1, engine: "minimax" });
  };
  return { calls, synthUnit };
}

function makePipeline(overrides = {}) {
  const bus = makeBus();
  const pending = [];
  const { calls, synthUnit } = makeSynth({ defer: overrides.defer === true, pending });
  let engine = overrides.engine ?? "minimax";
  let replies = overrides.replies ?? true;
  const notes = [];
  const cancelled = [];
  const pipeline = createSpeechPipeline({
    bus,
    log: () => {},
    engineOf: () => engine,
    synthUnit,
    cancelUnit: (id) => cancelled.push(id),
    noteState: () => notes.push(1),
    maxTurnChars: overrides.maxTurnChars,
    isSpeakable: overrides.isSpeakable,
    repliesEnabled: () => replies,
  });
  return {
    pipeline,
    setReplies: (next) => {
      replies = next;
    },
    bus,
    calls,
    notes,
    cancelled,
    pending,
    setEngine: (next) => {
      engine = next;
    },
  };
}

const TOP = { id: "top" };
const CHILD = { id: "child", session: { header: { origin: "subagent", parentSession: "top" } } };

const frameStart = (turn = 1) => ({ type: "start", attemptId: "x", revision: 1, turn, step: 1 });
const frameDelta = (text, index = 0) => ({
  type: "chunk",
  attemptId: "x",
  revision: 1,
  index: 0,
  time: 0,
  chunk: { type: "text-delta", index, text },
});
const frameBlockEnd = (index = 0) => ({
  type: "chunk",
  attemptId: "x",
  revision: 1,
  index: 1,
  time: 0,
  chunk: { type: "block-end", index, block: {} },
});
const frameEnd = () => ({ type: "end", attemptId: "x", revision: 1, index: 9, outcome: { kind: "abandoned" } });

/** 一段会切出多个单元的中文。 */
const LONG = "第一句话足够长了，这里早就超过十个字了。第二句话也同样足够长，同样超过十个字。";

const speakableCount = (text, finished) =>
  segmentSpeechUnits(Array.from(text), finished, "zh").filter((u) => u.speak.trim() !== "").length;

/** 管线在**未收尾**时该念的单元数：整段切分后**丢掉最后一个**（它可能还在长）。 */
const closedSpeakableCount = (text) =>
  segmentSpeechUnits(Array.from(text), false, "zh")
    .slice(0, -1)
    .filter((u) => u.speak.trim() !== "").length;

const ttsFrames = (bus) => bus.frames.filter((f) => f.kind === "tts");
const stopFrames = (bus) => bus.frames.filter((f) => f.kind === "ttsStop");

// ── 1. 边写边念：只有**已闭合**的单元先出声，最后一段等下一帧 ──────────────
{
  const { pipeline, bus } = makePipeline();
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  await new Promise((r) => setTimeout(r, 5));
  const closed = closedSpeakableCount(LONG);
  check("未收尾时只念已闭合的单元", ttsFrames(bus).length === closed);
  check("闭合单元数少于全部（最后一段还在长）", closed < speakableCount(LONG, true));

  pipeline.onStream({ agent: TOP, frame: frameBlockEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("block-end 之后把尾段也念出来", ttsFrames(bus).length === speakableCount(LONG, true));
  check("seq 从 1 起单调递增", ttsFrames(bus).every((f, i) => f.seq === i + 1));
  check("同一 utterance 共用一个 id", new Set(ttsFrames(bus).map((f) => f.utteranceId)).size === 1);
}

// ── 2. PCM 确实是 Int16 原样编码过来的 ────────────────────────────────────
{
  const { pipeline, bus } = makePipeline();
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameBlockEnd() });
  pipeline.onStream({ agent: TOP, frame: frameEnd() });
  await new Promise((r) => setTimeout(r, 5));
  const frame = ttsFrames(bus)[0];
  // 注意：`Buffer.from()` 可能是**池化**分配，`.buffer` 的 byteOffset 不为 0，
  // 所以必须带上 byteOffset —— 少写它会在池偏移恰好为 0 时"碰巧通过"。
  const raw = Buffer.from(frame.samplesB64, "base64");
  const decoded = new Int16Array(raw.buffer, raw.byteOffset, 3);
  check("帧里带引擎名", frame.engine === "minimax");
  check("帧里带采样率", frame.sampleRate === 24000);
  check("samplesB64 解回 Int16 原值", decoded[0] === 1 && decoded[1] === -2 && decoded[2] === 3);
  check("帧里带文本（便于排查）", typeof frame.text === "string" && frame.text.length > 0);
}

// ── 3. 正常收尾之后，turn 边界**不要**掐掉正在播的尾音 ─────────────────────
{
  const { pipeline, bus } = makePipeline();
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameEnd() });
  pipeline.onTurnStopping({ agent: TOP, turn: 1 });
  await new Promise((r) => setTimeout(r, 5));
  check("正常收尾后不发 ttsStop", stopFrames(bus).length === 0);
  check("正常收尾后音频照旧推出去", ttsFrames(bus).length === speakableCount(LONG, true));
}

// ── 4. 还在流式时被 turn 边界打断 → 掐掉，且在飞的结果一律丢弃 ─────────────
{
  const { pipeline, bus, pending, cancelled } = makePipeline({ defer: true });
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameBlockEnd() });
  await new Promise((r) => setTimeout(r, 5));
  const before = ttsFrames(bus).length;
  pipeline.onTurnStopping({ agent: TOP, turn: 1 });
  check("打断时发了一条 ttsStop", stopFrames(bus).length === 1);
  check("打断时通知合成器取消", cancelled.length === 1);
  for (const resolve of pending) resolve();
  await new Promise((r) => setTimeout(r, 5));
  check("被掐掉的单元即使合成完成也不推给界面", ttsFrames(bus).length === before);
}

// ── 5. 子代理的文字不念 ───────────────────────────────────────────────────
{
  const { pipeline, bus } = makePipeline({ isSpeakable: isTopLevelAgent });
  pipeline.onStream({ agent: CHILD, frame: frameStart() });
  pipeline.onStream({ agent: CHILD, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: CHILD, frame: frameBlockEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("子代理：一个字都不念", ttsFrames(bus).length === 0);
  check("子代理：三帧都被计数跳过", pipeline.stats().ignoredFrames === 3);
  check("isTopLevelAgent 认顶层会话", isTopLevelAgent(TOP) === true);
  check("isTopLevelAgent 认子代理（origin）", isTopLevelAgent(CHILD) === false);
  check("isTopLevelAgent 认子代理（只有 parentSession）", isTopLevelAgent({ session: { header: { parentSession: "top" } } }) === false);
  check("isTopLevelAgent 读不到 header 时放行", isTopLevelAgent({}) === true);
}

// ── 6. reasoning / tool-call 的增量不念 ───────────────────────────────────
{
  const { pipeline, bus } = makePipeline();
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({
    agent: TOP,
    frame: {
      type: "chunk",
      attemptId: "x",
      revision: 1,
      index: 0,
      time: 0,
      chunk: { type: "reasoning-delta", index: 0, text: "（这是思考过程，不该被念出来，但它足够长足够长。）" },
    },
  });
  pipeline.onStream({ agent: TOP, frame: frameEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("思考增量不发声", ttsFrames(bus).length === 0);
}

// ── 7. 引擎分发：local 会念、mimo 不念（2026-09-28 的用户决策）─────────────
// 这条原来写的是「voiceEngine=local 时不发声」—— 那时 local 只在云端失败时被
// **回落**调用，选它等于静音。现在 local 直连本地模型，所以整条管线必须照念；
// 真正"整条静默"的那一档换成了 mimo（合成器尚未接线）。
{
  check("speaksFor：local 与 minimax 会出声", speaksFor("local") === true && speaksFor("minimax") === true);
  check("speaksFor：mimo 与未知值不出声", speaksFor("mimo") === false && speaksFor("") === false && speaksFor("gpt") === false);

  const { pipeline, bus } = makePipeline({ engine: "local" });
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("voiceEngine=local 时照常发声", ttsFrames(bus).length === speakableCount(LONG, true));

  const silent = makePipeline({ engine: "mimo" });
  silent.pipeline.onStream({ agent: TOP, frame: frameStart() });
  silent.pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  silent.pipeline.onStream({ agent: TOP, frame: frameEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("voiceEngine=mimo 时整条管线静默", ttsFrames(silent.bus).length === 0);
  check(
    "静默**不**计入 mutedFrames（引擎的选择 ≠ 被 realtimeVoice 关掉）",
    silent.pipeline.stats().mutedFrames === 0,
  );
}

// ── 8. 每轮字符上限：到顶就只显示不发声，并让状态可见 ─────────────────────
{
  const { pipeline, bus, notes } = makePipeline({ maxTurnChars: 12 });
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameBlockEnd() });
  await new Promise((r) => setTimeout(r, 5));
  const spoken = ttsFrames(bus).reduce((n, f) => n + f.text.length, 0);
  check("到上限后不再发声", spoken <= 12);
  check("上限触发被记数", pipeline.stats().cappedUtterances === 1);
  check("上限触发让状态可见（noteState 被调）", notes.length >= 1);
}

// ── 8b. realtimeVoice=false：自动念回复关掉，但 herta_say 仍能说 ──────────
// 这条钉的是"关掉它 = 不再自动花合成钱"，而不是"把语音能力整个关掉"。
{
  const { pipeline, bus, setReplies } = makePipeline({ replies: false });
  pipeline.onStream({ agent: TOP, frame: frameStart() });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("关掉之后自动念回复不发声", ttsFrames(bus).length === 0);
  check("关掉之后被压住的帧有计数（能区分「关了」与「坏了」）", pipeline.stats().mutedFrames > 0);
  const said = await pipeline.sayText("这句是明确要求说的。");
  check("herta_say 不受这个开关管", said !== null && ttsFrames(bus).length >= 1);
  setReplies(true);
  pipeline.onStream({ agent: TOP, frame: frameStart(2) });
  pipeline.onStream({ agent: TOP, frame: frameDelta(LONG) });
  pipeline.onStream({ agent: TOP, frame: frameEnd() });
  await new Promise((r) => setTimeout(r, 5));
  check("开关打开后自动念回复立刻恢复（volatile 的活开关语义）", ttsFrames(bus).length >= 2);
}

// ── 9. herta_say：整段切分、立刻念完，并回报用了哪条引擎 ─────────────────
{
  const { pipeline, bus } = makePipeline();
  const out = await pipeline.sayText("你好呀，我是黑塔，这句话足够长了。");
  check("sayText 回报引擎", out !== null && out.engine === "minimax");
  check("sayText 真的推了帧", ttsFrames(bus).length >= 1);
  const empty = await pipeline.sayText("   ");
  check("sayText 空文本返回 null", empty === null);
  const { pipeline: localPipe, bus: localBus } = makePipeline({ engine: "local" });
  const localOut = await localPipe.sayText("用本地模型说一句。");
  check("sayText 在 local 引擎下照常合成", localOut !== null && ttsFrames(localBus).length >= 1);
  const { pipeline: mimoPipe } = makePipeline({ engine: "mimo" });
  check("sayText 在 mimo 引擎下返回 null（合成器尚未接线）", (await mimoPipe.sayText("喂")) === null);
}

// ── 10. 事件总线：接入即握手、广播、断开即移除 ───────────────────────────
{
  const lines = [];
  const res = {
    written: [],
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    write(chunk) {
      lines.push(chunk);
      this.written.push(chunk);
    },
  };
  const bus = createEventBus(() => {});
  bus.add(res);
  check("SSE 响应头正确", res.status === 200 && String(res.headers["Content-Type"]).includes("text/event-stream"));
  check("接入即握手", res.written[0] === ": connected\n\n");
  bus.send({ kind: "ttsStop", utteranceId: "u1" });
  check("广播成 SSE 帧", res.written.some((c) => c.startsWith("data: ") && c.endsWith("\n\n")));
  check("客户端计数", bus.count() === 1);
  bus.remove(res);
  check("断开即移除", bus.count() === 0);
  bus.stop();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
