/**
 * 本地 TTS 的**子进程**执行体（CommonJS）。
 *
 * ## 为什么必须是独立进程
 *
 * 三条理由，每条都是实打实踩过的：
 *
 * 1. **sherpa 的 espeak 构建在 Windows 上处理不了非 ASCII 的绝对路径**
 *    （上游 `tts-worker.cjs` 的原话）。而 DSH 的模型目录是
 *    `%USERPROFILE%\.dsh\tts\herta-best-e72` —— 用户名里有中文就中招。
 *    解法与上游一致：**把 cwd 设成模型根，传相对路径**。
 *    改 DSH 宿主进程的 cwd 会影响别的东西，所以只能放进子进程。
 * 2. **`generate()` 是同步阻塞的**：模型推理期间整个进程停住。
 *    放在宿主里就是把 DSH 卡死几十秒。
 * 3. **原生件在宿主里崩了就是宿主崩**。子进程死掉只丢一次合成。
 *
 * 用法（argv[2] 是一个 JSON 配置文件的路径，避免中文文本在命令行上被转义搞坏）：
 *
 *   node tts-worker.cjs <config.json>
 *
 * 配置：`{ runtimeDir, mode: "probe" | "synth" | "serve", modelRoot?, modelFile?, text?, out? }`
 * 输出：stdout 上一行 JSON —— `{ ok: true, ... }` 或 `{ ok: false, error }`。
 *
 * ## `mode: "serve"` —— 常驻（2026-09-28）
 *
 * `synth` 那种一次性模式**每句都要重新起进程、重新加载一遍 85 MB 模型**。本机实测：
 * 冷启动 2.7–4.4 s，其中模型加载 2.6–3.7 s；而真正的推理只有音频时长的 **0.28 倍**
 * （3.5 s 的音频约 1.0 s）。所以 `serve` 把「加载」与「合成」拆开：
 *
 *   1. 启动 → 加载 addon + 模型 → stdout 回一行 `{ ok:true, mode:"serve", ready:true, pid, loadMs }`
 *   2. 之后 stdin **一行一个请求**：`{ id, op:"synth", text, out }` → stdout 一行一个
 *      应答（形状与一次性模式相同，另加 `id` 与 `synthMs`）；`{ op:"exit" }` 退出。
 *   3. stdin 关掉（父进程没了）就自己退出 —— 不当孤儿进程。
 *
 * 这里只负责"加载一次、逐条应答"；**进程的生死由父侧管**
 * （`tts-runtime.js`：懒启动、空闲回收、崩溃重启、插件卸载时杀掉）。
 * 两种模式共用 `loadEngine` / `synthOnce`，避免两套 Kokoro 配置各自漂移。
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** 把绝对路径转成「相对 cwd 的正斜杠形式」；不在 cwd 之下就原样返回。 */
function nativePath(file) {
  const rel = path.relative(process.cwd(), file);
  const selected = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : file;
  return selected.split(path.sep).join("/");
}

function reply(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function loadSherpa(runtimeDir) {
  const entry = path.join(runtimeDir, "sherpa-onnx-node", "sherpa-onnx.js");
  if (!fs.existsSync(entry)) throw new Error(`找不到运行时入口：${entry}`);
  return require(entry);
}

/** 按上游 `tts-worker.cjs` 的 Kokoro 配置建实例（字段逐个照抄）。 */
function createTts(sherpa, modelRoot, modelFile) {
  const frontend = path.join(modelRoot, "frontend");
  return new sherpa.OfflineTts({
    model: {
      kokoro: {
        model: nativePath(path.join(modelRoot, modelFile)),
        voices: nativePath(path.join(modelRoot, "voices.bin")),
        tokens: nativePath(path.join(frontend, "tokens.txt")),
        dataDir: nativePath(path.join(frontend, "espeak-ng-data")),
        lexicon: [
          nativePath(path.join(frontend, "lexicon-us-en.txt")),
          nativePath(path.join(frontend, "lexicon-zh.txt")),
        ].join(","),
      },
      debug: false,
      numThreads: Math.max(1, Math.min(4, os.availableParallelism())),
      provider: "cpu",
    },
    ruleFsts: ["phone-zh.fst", "date-zh.fst", "number-zh.fst"]
      .map((name) => nativePath(path.join(frontend, name)))
      .join(","),
    maxNumSentences: 1,
  });
}

function toInt16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** 写一个 16-bit 单声道 WAV。 */
function writeWav(file, int16, sampleRate) {
  const dataBytes = int16.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  Buffer.from(int16.buffer, int16.byteOffset, dataBytes).copy(buf, 44);
  fs.writeFileSync(file, buf);
}

/** 一次合成：文本 → Int16 PCM + 统计量。**一次性与常驻两种模式共用这一份。** */
function synthOnce(tts, gc, text) {
  const started = Date.now();
  const audio = tts.generate({
    text,
    generationConfig: gc,
    // Electron 的 V8 拒收 EXTERNAL ArrayBuffer；普通 Node 也一并用这个更安全的开关。
    enableExternalBuffer: false,
  });
  const int16 = toInt16(audio.samples);
  let peak = 0;
  let energy = 0;
  for (let i = 0; i < int16.length; i += 1) {
    const v = Math.abs(int16[i]);
    if (v > peak) peak = v;
    energy += v;
  }
  return {
    synthMs: Date.now() - started,
    sampleRate: audio.sampleRate,
    int16,
    samples: int16.length,
    durationMs: (audio.samples.length / audio.sampleRate) * 1000,
    peak,
    meanAbs: int16.length === 0 ? 0 : energy / int16.length,
  };
}

/**
 * 加载 addon + 模型 + generationConfig。
 *
 * `process.chdir(modelRoot)` 是**必须**的：`nativePath` 的相对化全靠它
 * （见文件头第 1 条理由：sherpa 的 espeak 构建在 Windows 上吃不下非 ASCII 绝对路径）。
 */
function loadEngine(runtimeDir, modelRoot, modelFile) {
  process.chdir(modelRoot);
  const sherpa = loadSherpa(runtimeDir);
  const tts = createTts(sherpa, process.cwd(), modelFile);
  const gc = new sherpa.GenerationConfig({
    sid: 0,
    speed: 1.0,
    // sherpa 默认 0.2 会把每处停顿砍掉（上游实测：5.0 s 的渲染里削掉 1.0 s 停顿，
    // 听感被判定为「明显变差」）。1.0 = 模型的原始输出。
    silenceScale: 1.0,
  });
  return { sherpa, tts, gc };
}

/** 一条常驻请求 → 一行应答。**逐条同步处理**：`generate()` 本来就是阻塞的。 */
function serveOne(line, tts, gc) {
  let req = null;
  try {
    req = JSON.parse(line);
  } catch {
    reply({ id: null, ok: false, error: "请求不是 JSON" });
    return;
  }
  const id = req !== null && typeof req.id === "number" ? req.id : null;
  try {
    if (req.op === "exit") {
      reply({ id, ok: true, bye: true });
      process.exit(0);
    }
    if (req.op !== "synth") {
      reply({ id, ok: false, error: `未知 op：${String(req.op)}` });
      return;
    }
    if (typeof req.out !== "string" || req.out === "") {
      reply({ id, ok: false, error: "缺少 out 路径" });
      return;
    }
    const r = synthOnce(tts, gc, typeof req.text === "string" ? req.text : "");
    writeWav(req.out, r.int16, r.sampleRate);
    reply({
      id,
      ok: true,
      mode: "serve",
      synthMs: r.synthMs,
      sampleRate: r.sampleRate,
      samples: r.samples,
      durationMs: r.durationMs,
      peak: r.peak,
      meanAbs: r.meanAbs,
      wavBytes: 44 + r.samples * 2,
      out: req.out,
    });
  } catch (error) {
    // 一条请求失败不该杀掉常驻进程（原生层真崩了的话进程就没了，父侧会重启它）。
    reply({ id, ok: false, error: String(error && error.message ? error.message : error) });
  }
}

/** 常驻循环：stdin 逐行收请求，stdout 逐行回应答。 */
function serveLoop(tts, gc) {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const at = buffer.indexOf("\n");
      if (at < 0) break;
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (line !== "") serveOne(line, tts, gc);
    }
  });
  // 父进程走了（stdin 关了）就是没人要我们了。退出，别留孤儿进程占着 250 MB。
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));
}

function main() {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const { runtimeDir, mode } = config;

  // probe：只证明「这个运行时能被加载」，不碰模型。
  if (mode === "probe") {
    const sherpa = loadSherpa(runtimeDir);
    reply({
      ok: true,
      mode: "probe",
      version: typeof sherpa.version === "string" ? sherpa.version : null,
      onnxruntime: typeof sherpa.onnxruntimeVersion === "string" ? sherpa.onnxruntimeVersion : null,
      hasOfflineTts: typeof sherpa.OfflineTts === "function",
    });
    return;
  }

  const { modelRoot, modelFile } = config;

  // serve：加载一次，之后逐条应答（进程生死由父侧 tts-runtime.js 管）。
  if (mode === "serve") {
    const t0 = Date.now();
    const { tts, gc } = loadEngine(runtimeDir, modelRoot, modelFile);
    reply({ ok: true, mode: "serve", ready: true, pid: process.pid, loadMs: Date.now() - t0 });
    serveLoop(tts, gc);
    return;
  }

  if (mode !== "synth") throw new Error(`未知 mode：${mode}`);

  const { text, out } = config;
  const t0 = Date.now();
  const { tts, gc } = loadEngine(runtimeDir, modelRoot, modelFile);
  const loadMs = Date.now() - t0;
  const r = synthOnce(tts, gc, text);
  writeWav(out, r.int16, r.sampleRate);
  reply({
    ok: true,
    mode: "synth",
    loadMs,
    synthMs: r.synthMs,
    sampleRate: r.sampleRate,
    samples: r.samples,
    durationMs: r.durationMs,
    peak: r.peak,
    meanAbs: r.meanAbs,
    wavBytes: 44 + r.samples * 2,
    out,
  });
}

try {
  main();
} catch (error) {
  reply({ ok: false, error: String(error && error.message ? error.message : error) });
  process.exitCode = 1;
}
