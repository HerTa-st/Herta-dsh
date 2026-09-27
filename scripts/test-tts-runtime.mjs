/**
 * 本地 TTS 运行时（随包分发的 sherpa-onnx）的真机验证。
 *
 * 默认不跑 —— 它需要**一份真实的模型 bundle**（下载来的，或 Herta 桌面应用已经
 * 下过的那份）：
 *
 *   $env:HERTA_TTS_MODEL_ROOT = "$env:APPDATA\Herta\tts\herta-best-e72"
 *   node scripts/test-tts-runtime.mjs
 *
 * 验的三件事（都是「证明」，不是「检查文件在不在」）：
 *   1. **运行时能被加载** —— 拉子进程 require 原生 addon，拿到版本号
 *   2. **真的能合成出声音** —— 24 kHz、非静音、时长与文本长度相称
 *   3. **WAV 是一份合法可播的文件** —— RIFF/WAVE 头 + 采样数与字节数自洽
 *
 * 为什么第 2 条不能省：设置面板把「下载模型」按钮与「实时语音」开关都 gate 在
 * `runtime` 上。如果只证明「dll 文件存在」，那正是仓库别处修过的假绿。
 *
 * 顺带覆盖一个真实的坑：模型与运行时所在的路径**含中文**
 * （`E:\deepseek工作区\…`），而上游明确说过 sherpa 的 espeak 构建在 Windows 上
 * 处理不了非 ASCII 的绝对路径 —— 所以 worker 必须 `chdir` 到模型根再传相对路径。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TTS_RUNTIME_DIR,
  disposeLocalWorker,
  localWorkerStatus,
  probeTtsRuntime,
  synthesize,
} from "../src/host/tts-runtime.js";

const MODEL_ROOT = process.env.HERTA_TTS_MODEL_ROOT;
if (MODEL_ROOT === undefined || MODEL_ROOT === "") {
  console.error('需要 $env:HERTA_TTS_MODEL_ROOT=<真实模型 bundle 目录>（例如 %APPDATA%\\Herta\\tts\\herta-best-e72）');
  process.exit(2);
}

let pass = 0;
let fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}${detail === "" ? "" : `  —— ${detail}`}`);
  }
};

console.log("tts-runtime（真机）");
console.log(`运行时: ${TTS_RUNTIME_DIR}`);
console.log(`模型  : ${MODEL_ROOT}\n`);

// ── 1. 运行时能被加载 ───────────────────────────────────────────────────
const t0 = Date.now();
const probe = await probeTtsRuntime({ force: true });
const probeSecs = (Date.now() - t0) / 1000;
console.log(`探测（${probeSecs.toFixed(1)}s）: ${JSON.stringify(probe)}`);
check("运行时目录存在", existsSync(TTS_RUNTIME_DIR));
check("原生 addon 能被加载（available=true）", probe.available === true, probe.error ?? "");
check("拿到了 sherpa-onnx 版本号", typeof probe.version === "string" && probe.version.length > 0);
check("拿到了 onnxruntime 版本号", typeof probe.onnxruntime === "string" && probe.onnxruntime.length > 0);

if (!probe.available) {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

// ── 2. 真的能合成 ───────────────────────────────────────────────────────
const TEXT = "你好。我是黑塔，天才俱乐部第八十三号。";
const outDir = mkdtempSync(join(tmpdir(), "herta-tts-test-"));
const out = join(outDir, "speech.wav");
const t1 = Date.now();
const r = await synthesize(TEXT, { modelRoot: MODEL_ROOT, out });
const synthSecs = (Date.now() - t1) / 1000;
console.log(`\n合成（${synthSecs.toFixed(1)}s）: ${JSON.stringify({ ...r, out: "<tmp>" })}`);
check("合成成功", r.ok === true, r.error ?? "");
if (r.ok !== true) {
  rmSync(outDir, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}
check("采样率是 24 kHz", r.sampleRate === 24000, String(r.sampleRate));
check("有实际采样", r.samples > 24000, `${r.samples} samples`);
check("时长与这句话相称（1–30 s）", r.durationMs > 1000 && r.durationMs < 30000, `${(r.durationMs / 1000).toFixed(2)}s`);
check("**不是静音**（峰值足够高）", r.peak > 3000, `peak=${r.peak}`);
check("**不是静音**（平均绝对值足够高）", r.meanAbs > 200, `meanAbs=${r.meanAbs.toFixed(0)}`);
check("峰值没有削顶（< 32767）", r.peak < 32767, `peak=${r.peak}`);

// ── 3. WAV 文件本身合法 ─────────────────────────────────────────────────
const wav = readFileSync(out);
check("文件真的写出来了", existsSync(out));
check("RIFF 魔数", wav.subarray(0, 4).toString("ascii") === "RIFF");
check("WAVE 魔数", wav.subarray(8, 12).toString("ascii") === "WAVE");
check("格式块是 16 字节 PCM", wav.readUInt32LE(16) === 16 && wav.readUInt16LE(20) === 1);
check("单声道", wav.readUInt16LE(22) === 1);
check("采样率字段 = 24000", wav.readUInt32LE(24) === 24000);
check("位深 16", wav.readUInt16LE(34) === 16);
check("RIFF 长度与文件长度自洽", wav.readUInt32LE(4) === wav.length - 8, `${wav.readUInt32LE(4)} vs ${wav.length - 8}`);
check("data 块长度与采样数自洽", wav.readUInt32LE(40) === r.samples * 2);
check("文件大小与返回的 wavBytes 一致", statSync(out).size === r.wavBytes);

// 波形不该是一条平线：把整段切成 10 份，至少要有几份能量明显不同。
const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, r.samples);
const seg = Math.floor(pcm.length / 10);
const energies = [];
for (let s = 0; s < 10; s += 1) {
  let sum = 0;
  for (let i = s * seg; i < (s + 1) * seg; i += 1) sum += Math.abs(pcm[i]);
  energies.push(sum / seg);
}
const minE = Math.min(...energies);
const maxE = Math.max(...energies);
check("波形有起伏（不是一条平线）", maxE > minE * 2, `min=${minE.toFixed(0)} max=${maxE.toFixed(0)}`);

// ── 4. 常驻进程：模型只该加载一次（2026-09-28 那次加速的真机证据）──────────
const st1 = localWorkerStatus();
check("第一次合成之后常驻进程是热的", st1.state === "running", JSON.stringify(st1));
check("状态里带着模型加载耗时（那是被省掉的那部分）", typeof st1.warmMs === "number" && st1.warmMs > 0, String(st1.warmMs));

const out2 = join(outDir, "speech2.wav");
const t2 = Date.now();
const r2 = await synthesize("第二句，验证它复用了同一个进程。", { modelRoot: MODEL_ROOT, out: out2 });
const warmSecs = (Date.now() - t2) / 1000;
console.log(`热合成（${warmSecs.toFixed(2)}s）`);
check("热合成成功", r2.ok === true, r2.error ?? "");
check("复用同一个进程（pid 没变）", localWorkerStatus().pid === st1.pid);
check(
  "热合成明显快于冷启动（省掉的正是那 2.6–3.7 s 的模型加载）",
  warmSecs * 3 < synthSecs,
  `冷 ${synthSecs.toFixed(2)}s vs 热 ${warmSecs.toFixed(2)}s`,
);

const t3 = Date.now();
const r3 = await synthesize("有事吗？没事我就走了", { modelRoot: MODEL_ROOT, out: join(outDir, "speech3.wav") });
const previewSecs = (Date.now() - t3) / 1000;
console.log(`试听台词（热，${previewSecs.toFixed(2)}s）`);
check(
  "热的试听台词 2 秒内出来（这是设置页按下去要等的真实时间）",
  r3.ok === true && previewSecs < 2,
  `${previewSecs.toFixed(2)}s`,
);

// 真模型常驻占 ~250 MB：测试收尾必须杀掉它，否则开发机上会留一个孤儿 node 进程。
disposeLocalWorker();
check("disposeLocalWorker 之后进程没了", localWorkerStatus().state === "stopped");

rmSync(outDir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
