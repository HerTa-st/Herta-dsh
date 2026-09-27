/**
 * 验收脚本：用**真的** MiniMax 密钥与**真的**网络合成一句话，落一个 wav。
 *
 * ## 为什么单独有它
 *
 * 端到端哑掉时，"合成对不对"与"最后一跳通不通"混在一起最难查。这个脚本只走
 * 前半段（认领 → 分段 → 合成 → 落盘），所以它是一个**分界线**：
 *   · 它出了声，问题就在后段（SSE / push("voice") / iframe 播放）；
 *   · 它没出声，问题就在前段（密钥 / 平台 / 认领 / 配额），宿主日志里会有原因。
 *
 * 它**不经过 DSH**：直接用 `lib/minimax/*`（那是插件里同一份代码），所以任何时候
 * 都能跑，也不需要重启桌面应用。
 *
 * 用法：
 *   node --disable-warning=ExperimentalWarning scripts/say-minimax-wav.mjs [文本] [输出路径]
 *
 * 密钥来源：优先 `$MINIMAX_API_KEY`，否则读 `$DSH_HOME/.credentials.yaml` 的
 * `MINIMAX_API_KEY`（就是设置页「密钥」那一行写进去的那一份）。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { MINIMAX_DEFAULT_MODEL, probeHost, synthesizePcm } from "../lib/minimax/api.js";
import { segmentSpeechUnits } from "../lib/minimax/segment.js";
import { createMiniMaxVoiceService } from "../lib/minimax/voice.js";

const DEFAULT_TEXT = "你好，我是黑塔。这一句是用我自己的声音说的。";

/** 从 `.credentials.yaml` 里抠出一把 ref 的值（没有 yaml 依赖，只认这一种形状）。 */
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

/** Int16 单声道 PCM → 最小合法 WAV。 */
function toWav(samples, sampleRate) {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const buf = Buffer.alloc(44 + data.length);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + data.length, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // 单声道
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(data.length, 40);
  data.copy(buf, 44);
  return buf;
}

const text = process.argv[2] ?? DEFAULT_TEXT;
const out = resolve(process.argv[3] ?? join(process.cwd(), "_minimax-say.wav"));

const key = process.env.MINIMAX_API_KEY ?? readCredential("MINIMAX_API_KEY");
if (key === null || key === undefined || key === "") {
  console.error("没有 MiniMax 密钥：设 $MINIMAX_API_KEY，或在 $DSH_HOME/.credentials.yaml 里写 MINIMAX_API_KEY");
  process.exit(2);
}
console.log(`密钥：${key.slice(0, 8)}…（${key.length} 字符）`);

// 认领：只列账号上已有的克隆（本插件不克隆）。状态文件仍用**真实**路径 ——
// 认领成功的结果正是插件自己也想要的那份缓存。
const voice = createMiniMaxVoiceService({
  fetch: (url, init) => fetch(url, init),
  key: async () => key,
  log: (line) => console.log(`[voice] ${line}`),
});
let readout = voice.readout();
if (readout.phase !== "ready") {
  readout = await voice.prepare();
}
if (readout.phase !== "ready") {
  console.error(`认领失败：${readout.lastError ?? "unknown"}${readout.retryAt === undefined ? "" : `（冷却到 ${readout.retryAt}）`}`);
  process.exit(3);
}
const target = voice.voice();
console.log(`认领到克隆：${readout.voiceId} @ ${readout.host}（clonedAt ${readout.clonedAt ?? "?"}）`);
if (target === null) {
  console.error("认领状态说 ready，但取不到 voiceId —— 状态文件不一致");
  process.exit(3);
}

// 分段：与插件用的是同一份移植件（10/48/80 三档）。
const units = segmentSpeechUnits(Array.from(text), true, "zh").filter((u) => u.speak.trim() !== "");
console.log(`文本 ${text.length} 字 → ${units.length} 个单元`);

const chunks = [];
let sampleRate = 24000;
let billed = 0;
for (const [i, unit] of units.entries()) {
  const body = unit.speak.trim();
  const started = Date.now();
  const pcm = await synthesizePcm((url, init) => fetch(url, init), target.host, key, {
    voiceId: target.voiceId,
    text: body,
    model: MINIMAX_DEFAULT_MODEL,
  });
  sampleRate = pcm.sampleRate;
  billed += pcm.billedChars;
  chunks.push(pcm.samples);
  console.log(
    `  单元 ${i + 1}/${units.length}：${body.length} 字 → ${(pcm.samples.length / pcm.sampleRate).toFixed(2)} s` +
      `（${Date.now() - started} ms，计费 ${pcm.billedChars} 字）`,
  );
}

const total = chunks.reduce((n, s) => n + s.length, 0);
const merged = new Int16Array(total);
let offset = 0;
for (const samples of chunks) {
  merged.set(samples, offset);
  offset += samples.length;
}
const peak = merged.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, toWav(merged, sampleRate));
voice.stampUsed();

console.log(
  `\n${text}\n→ ${out}\n` +
    `${(total / sampleRate).toFixed(2)} s / ${sampleRate} Hz / 峰值 ${peak} / 计费 ${billed} 字`,
);
if (peak === 0) {
  console.error("⚠️ 峰值是 0 —— 合成出来是静音，别拿它当成功。");
  process.exit(4);
}
