/**
 * **真机**端到端：真密钥 + 真网络 + 真的宿主接线 + 假 ctx/假 SSE 连接。
 *
 * 这是"GUI 之前能做到的最强证据"：从 `agent/assistant-stream` 的帧进，
 * 到 SSE 连接上真正收到 `kind:"tts"` 的 PCM 帧（再把它们拼成一个 wav 落盘）。
 * 假的部分只有三样：ctx、webServer、SSE 响应对象 —— 网络、密钥、分段、合成、
 * 帧格式全都是真的。
 *
 * 用法（要网络与密钥；会真的计费，约几十个字符）：
 *   node --import ./scripts/test-resolve-hook.mjs scripts/test-minimax-live.mjs [文本]
 *
 * 前置：`node scripts/build.mjs`；密钥在 `$DSH_HOME/.credentials.yaml` 的
 * `MINIMAX_API_KEY`（或 `$MINIMAX_API_KEY`）。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// 状态文件隔离（**不动 DSH_HOME**：离线模型还在真实 home 里，回落要用它）。
const stateDir = mkdtempSync(join(process.env.TEMP ?? process.env.TMP ?? ".", "herta-minimax-live-"));
process.env.DSH_HERTA_MINIMAX_STATE = join(stateDir, "state.json");

const { installMiniMaxVoice, registerMiniMaxVoiceRoutes } = await import("../lib/minimax-voice.js");

function readCredential(ref) {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  try {
    const raw = readFileSync(join(home, ".credentials.yaml"), "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith(`${ref}:`));
    if (line === undefined) return null;
    const value = line.slice(line.indexOf(":") + 1).trim();
    return value === "" ? null : value;
  } catch {
    return null;
  }
}

const key = process.env.MINIMAX_API_KEY ?? readCredential("MINIMAX_API_KEY");
if (key === null) {
  console.error("没有 MiniMax 密钥（$DSH_HOME/.credentials.yaml 的 MINIMAX_API_KEY 或 $MINIMAX_API_KEY）");
  process.exit(2);
}

const text = process.argv[2] ?? "你好，我是黑塔。这句是从宿主接线里真出来的。";
const outPath = resolve(join(process.cwd(), "_minimax-live.wav"));

const routes = [];
const ctx = {
  get(name) {
    if (name === "credentials") {
      return { resolve: async (ref) => (ref === "MINIMAX_API_KEY" ? { value: key, source: "file" } : undefined) };
    }
    if (name === "webServer") return { register: (route) => { routes.push(route); return () => {}; } };
    return undefined;
  },
  on() {
    return () => {};
  },
};

const mini = installMiniMaxVoice(ctx, { voiceEngine: "minimax", realtimeVoice: true });
if (mini === null) {
  console.error("接线没挂上");
  process.exit(3);
}
registerMiniMaxVoiceRoutes(ctx);

/** 假的 SSE 连接：把每一帧记下来。 */
const res = {
  chunks: [],
  writeHead() {},
  write(chunk) {
    this.chunks.push(String(chunk));
  },
};
routes.find((r) => r.path === "/herta-minimax-events").handler({ method: "GET", on() {} }, res);

// 等启动认领落地（真网络，给足时间）。
for (let i = 0; i < 100 && mini.snapshot().voice.phase !== "ready"; i += 1) {
  const snap = mini.snapshot();
  if (snap.voice.phase === "failed") {
    console.error(`认领失败：${snap.voice.lastError}`);
    process.exit(4);
  }
  await new Promise((r) => setTimeout(r, 200));
}
const snap = mini.snapshot();
console.log(`认领：${snap.voice.phase} ${snap.voice.voiceId ?? ""} @ ${snap.voice.host ?? ""}`);

// 喂一段"助手流"：start → text-delta → end（帧形状取自内核类型定义）。
const agent = { id: "live-agent", session: { header: {} } };
const chunkFrame = (chunk) => ({ type: "chunk", attemptId: "a", revision: 1, index: 0, time: 0, chunk });
mini.pipeline.onStream({ agent, frame: { type: "start", attemptId: "a", revision: 1, turn: 1, step: 1 } });
mini.pipeline.onStream({ agent, frame: chunkFrame({ type: "text-delta", index: 0, text }) });
mini.pipeline.onStream({ agent, frame: chunkFrame({ type: "block-end", index: 0, block: {} }) });
mini.pipeline.onStream({ agent, frame: { type: "end", attemptId: "a", revision: 1, index: 3, outcome: { kind: "abandoned" } } });

// 等帧到齐（一个单元一次 HTTP，给足余量）。
let frames = [];
for (let i = 0; i < 150; i += 1) {
  frames = res.chunks.filter((c) => c.startsWith("data: ")).map((c) => JSON.parse(c.slice(6)));
  const tts = frames.filter((f) => f.kind === "tts");
  if (tts.length > 0 && tts.every((f) => f.seq < mini.snapshot().pipeline.utterances * 99)) {
    // 简单收敛判据：等到有帧、且再等一小会儿没有新帧
    await new Promise((r) => setTimeout(r, 800));
    const after = res.chunks.filter((c) => c.startsWith("data: ")).length;
    if (after === res.chunks.filter((c) => c.startsWith("data: ")).length) break;
  }
  await new Promise((r) => setTimeout(r, 100));
}

frames = res.chunks.filter((c) => c.startsWith("data: ")).map((c) => JSON.parse(c.slice(6)));
const tts = frames.filter((f) => f.kind === "tts").sort((a, b) => a.seq - b.seq);
console.log(`SSE 帧：${frames.length} 条（其中 tts ${tts.length} 条${frames.some((f) => f.kind === "state") ? "，另有 state" : ""}）`);
if (tts.length === 0) {
  console.error("❌ 一条 tts 帧都没有 —— 打印全部帧：");
  console.error(JSON.stringify(frames, null, 2).slice(0, 2000));
  rmSync(stateDir, { recursive: true, force: true });
  process.exit(5);
}

// 拼 wav + 统计
const decoded = tts.map((f) => {
  const raw = Buffer.from(f.samplesB64, "base64");
  return new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1);
});
const total = decoded.reduce((n, s) => n + s.length, 0);
const merged = new Int16Array(total);
let offset = 0;
for (const s of decoded) {
  merged.set(s, offset);
  offset += s.length;
}
const sampleRate = tts[0].sampleRate;
const peak = merged.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
if (sampleRate !== 24000) console.log(`（注意：采样率是 ${sampleRate}，不是 24000）`);

const data = Buffer.from(merged.buffer, merged.byteOffset, merged.byteLength);
const wav = Buffer.alloc(44 + data.length);
wav.write("RIFF", 0, "ascii");
wav.writeUInt32LE(36 + data.length, 4);
wav.write("WAVE", 8, "ascii");
wav.write("fmt ", 12, "ascii");
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36, "ascii");
wav.writeUInt32LE(data.length, 40);
data.copy(wav, 44);
writeFileSync(outPath, wav);

console.log(
  `${tts.length} 段 / ${(total / sampleRate).toFixed(2)} s / 峰值 ${peak} / 引擎 ${tts[0].engine}\n→ ${outPath}`,
);
console.log(`文本：${text}`);
rmSync(stateDir, { recursive: true, force: true });
process.exit(peak > 0 && tts[0].engine === "minimax" ? 0 : 6);
