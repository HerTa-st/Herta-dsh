/**
 * 本地 TTS 的**运行时**：探测 + 合成入口（宿主侧）。
 *
 * 运行时本体（sherpa-onnx 1.13.6 的原生件 + JS glue，22 MB）随包分发在
 * `assets/tts-runtime/`，来源与授权见 `THIRD-PARTY.md` 与那里的 `LICENSES/`。
 *
 * ## `runtime` 这个标志必须是**证明出来的**，不能写死
 *
 * 设置面板把两件事都 gate 在它上面：
 *   · 「下载模型」按钮        `disabled={!runtime}`
 *   · 「实时语音」开关        `canSpeak = bundle && runtime && !failed`
 *
 * 写死成 true 的代价是仓库别处已经吃过一次的教训：面板显示「已就绪」，
 * 而她一个音也发不出来。所以这里走**真的探测** —— 拉一个子进程把 addon 加载起来，
 * 拿到版本号才算数。探测结果缓存（进程内一次）。
 *
 * 探测与合成都在**子进程**里跑，理由见 `tts-worker.cjs` 的文件头
 * （非 ASCII 路径 / 同步阻塞 / 原生件崩溃隔离）。
 *
 * ## 合成走**常驻进程**（2026-09-28）
 *
 * 一次性模式（每句一个进程）每句都要重载 85 MB 模型。本机直接量过：
 * 冷启动 2.7–4.4 s、其中**模型加载 2.6–3.7 s**；而推理只有音频时长的 **0.28 倍**
 * （3.5 s 音频约 1.0 s，短句约 0.25 s）。所以合成默认走 `tts-worker.cjs` 的
 * `serve` 模式：进程加载一次，之后按行协议逐条应答。
 *
 * 进程的生死由这里管，四条是硬要求（每条都对应一个失败模式）：
 *   · **懒启动** —— 不在插件挂载时起，不用本地语音的人不该白占 ~250 MB；
 *   · **空闲回收** —— `HERTA_TTS_IDLE_MS`（默认 10 分钟）没有请求就退掉；
 *   · **崩溃/超时** —— 进程死了或某条请求超时，所有在飞请求当场失败而不是挂在
 *     半空，下一次请求重新起一个；
 *   · **卸载即杀** —— 宿主卸载插件时调 `disposeLocalWorker()`，否则热重载会留下
 *     一个 250 MB 的 node 孤儿进程。
 *
 * 常驻那条路**起不来**时（脚本缺失、spawn 报错、ready 超时）自动退回一次性模式：
 * 慢，但这一句仍会被说出来。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TTS_MODEL_FILE } from "./tts-release.js";
import { voiceModelPaths, voiceModelStoreRoot } from "./voice-model.js";
import { TTS_BUNDLE_ID } from "./tts-release.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * 运行时目录。两种布局都要认：
 *   · 部署后：`lib/` 与 `assets/` 同级 → `lib/../assets/tts-runtime`
 *   · 源码里：`src/host/` 往上两层才是包根 → `<repo>/assets/tts-runtime`
 * 取第一个真实存在的；都不在就返回部署布局那条（让错误信息指向预期位置）。
 */
function resolveRuntimeDir() {
  const candidates = [
    join(HERE, "..", "assets", "tts-runtime"),
    join(HERE, "..", "..", "assets", "tts-runtime"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export const TTS_RUNTIME_DIR = resolveRuntimeDir();

/**
 * 子进程执行体。`build.mjs` 会把 `.cjs` 一起拷进 `lib/`。
 *
 * `HERTA_TTS_WORKER` 可覆盖 —— `scripts/test-tts-resident.mjs` 用一份**假 worker**
 * （同样的行协议、不碰原生件）来驱动常驻管理逻辑；真机上不该设置这个变量。
 */
function workerScript() {
  const override = process.env.HERTA_TTS_WORKER;
  return typeof override === "string" && override !== "" ? override : join(HERE, "tts-worker.cjs");
}

/** 合成超时：模型加载 + 一句话推理，给足分钟级余量。 */
const SYNTH_TIMEOUT_FALLBACK_MS = 180_000;
/** 探测超时：只加载 addon，不该慢。 */
const PROBE_TIMEOUT_MS = 60_000;
/** 常驻进程报 ready 的超时（= 加载模型的最坏时间）。 */
const READY_TIMEOUT_FALLBACK_MS = 120_000;

/**
 * 一个以环境变量覆盖、否则用兜底值的超时。
 *
 * 存在唯一理由是**可测**：超时路径（合成卡住 / 常驻报不出 ready）必须能被单测在
 * 几百毫秒内验掉，而真机上的兜底值都是分钟级。见 `scripts/test-tts-resident.mjs`。
 */
function timeoutMs(envName, fallback) {
  const raw = Number(process.env[envName] ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const synthTimeoutMs = () => timeoutMs("HERTA_TTS_SYNTH_TIMEOUT_MS", SYNTH_TIMEOUT_FALLBACK_MS);
const readyTimeoutMs = () => timeoutMs("HERTA_TTS_READY_TIMEOUT_MS", READY_TIMEOUT_FALLBACK_MS);

/** 空闲多久回收常驻进程。测试用 `HERTA_TTS_IDLE_MS` 调小。 */
function idleTimeoutMs() {
  const raw = Number(process.env.HERTA_TTS_IDLE_MS ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 10 * 60 * 1000;
}

/** 宿主日志前缀与插件其余部分保持一致，便于从启动日志里认出来。 */
function log(line) {
  console.log(`[dsh-herta] ${line}`);
}

/**
 * 拉一次子进程跑 worker（**一次性模式**：加载、合成、退出）。
 *
 * 配置走**临时 JSON 文件**而不是命令行参数：合成文本是中文，命令行转义在
 * Windows 上很容易被搞坏（而且会进进程列表）。
 *
 * @param {object} config - worker 的 JSON 配置。
 * @param {number} timeoutMs - 超时。
 * @returns {Promise<object>} worker 回的那一行 JSON。
 */
function runWorker(config, timeoutMs) {
  return new Promise((resolve) => {
    const script = workerScript();
    if (!existsSync(script)) {
      resolve({ ok: false, error: `找不到 worker：${script}` });
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "herta-tts-"));
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, `${JSON.stringify(config)}\n`, "utf8");

    const child = spawn(process.execPath, [script, configPath], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let out = "";
    let err = "";
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      rmSync(dir, { recursive: true, force: true });
      resolve(value);
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      finish({ ok: false, error: `worker 超时（${timeoutMs} ms）` });
    }, timeoutMs);

    child.stdout.on("data", (c) => {
      out += c;
    });
    child.stderr.on("data", (c) => {
      err += c;
    });
    child.on("error", (e) => finish({ ok: false, error: String(e?.message ?? e) }));
    child.on("close", () => {
      // worker 正常时 stdout 恰好一行 JSON；异常时可能一行都没有。
      const line = out.trim().split("\n").filter(Boolean).pop();
      if (line === undefined) {
        finish({ ok: false, error: `worker 没有输出${err === "" ? "" : `：${err.trim().slice(0, 300)}`}` });
        return;
      }
      try {
        finish(JSON.parse(line));
      } catch {
        finish({ ok: false, error: `worker 输出不是 JSON：${line.slice(0, 200)}` });
      }
    });
  });
}

// ── 常驻合成进程 ───────────────────────────────────────────────────────────
//
// `resident` 是进程内单例。它绑在**一个模型**上（`key = modelRoot|modelFile`）：
// 换了模型就重启它 —— 常驻的代价正是"模型的加载只发生一次"。

/** @type {null | {key: string, child: import("node:child_process").ChildProcess, dir: string, buf: string, stderr: string, dead: boolean, nextId: number, pending: Map<number, {resolve: (v: object) => void, timer: any}>, ready: Promise<boolean>, readyDone: boolean, readySettled: boolean, readyResolve: ((v: boolean) => void) | null, readyTimer: any, idleTimer: any, warmMs: number | null}} */
let resident = null;

/** ready 这个 Promise 只允许结算一次（进程可能在 ready 之前就死了）。 */
function settleReady(state, value) {
  if (state.readySettled) return;
  state.readySettled = true;
  state.readyResolve?.(value);
}

/** 重新计时「空闲回收」。定时器 unref：它不该把宿主进程吊着不退出。 */
function armIdle(state) {
  if (state.idleTimer !== null) clearTimeout(state.idleTimer);
  const ms = idleTimeoutMs();
  state.idleTimer = setTimeout(() => {
    if (resident === state) {
      log(`常驻合成进程空闲 ${ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)} 秒`}，回收（下次要用时再起）`);
    }
    disposeResident(state, "空闲回收");
  }, ms);
  state.idleTimer.unref?.();
}

/** 停掉一个常驻进程：在飞请求当场失败、临时目录清掉、子进程杀掉。 */
function disposeResident(state, why) {
  if (state === null || state === undefined) return;
  if (resident === state) resident = null;
  if (state.dead === true) return;
  state.dead = true;
  if (state.idleTimer !== null) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  if (state.readyTimer !== null) {
    clearTimeout(state.readyTimer);
    state.readyTimer = null;
  }
  for (const [, slot] of state.pending) {
    clearTimeout(slot.timer);
    slot.resolve({ ok: false, error: `常驻合成进程被回收（${why}）` });
  }
  state.pending.clear();
  settleReady(state, false);
  try {
    state.child.stdin?.end?.();
  } catch {
    /* 管道可能已经断了 */
  }
  try {
    state.child.kill();
  } catch {
    /* 已经死了 */
  }
  rmSync(state.dir, { recursive: true, force: true });
  if (why !== "空闲回收") log(`常驻合成进程已停止（${why}）`);
}

/** 进程自己死了（崩溃/被杀）：把原因分给所有在飞请求，状态清空，下次重起。 */
function failResident(state, message) {
  if (state.dead === true) return;
  log(message);
  disposeResident(state, "进程退出");
  settleReady(state, false);
}

/** 常驻进程的一行 stdout。两种：ready 那一行，和带 id 的应答。 */
function handleResidentLine(state, line) {
  let msg = null;
  try {
    msg = JSON.parse(line);
  } catch {
    log(`常驻合成进程吐出非 JSON：${line.slice(0, 200)}`);
    return;
  }
  if (msg !== null && typeof msg === "object" && msg.ready === true) {
    state.readyDone = true;
    state.warmMs = typeof msg.loadMs === "number" ? msg.loadMs : null;
    if (state.readyTimer !== null) {
      clearTimeout(state.readyTimer);
      state.readyTimer = null;
    }
    log(
      `常驻合成进程就绪（pid=${String(msg.pid ?? state.child.pid)}，模型加载 ${state.warmMs === null ? "?" : state.warmMs} ms）`
      + " —— 之后每句只付推理",
    );
    armIdle(state);
    settleReady(state, true);
    return;
  }
  const id = msg !== null && typeof msg === "object" && typeof msg.id === "number" ? msg.id : null;
  const slot = id === null ? undefined : state.pending.get(id);
  if (slot === undefined) {
    log(`常驻合成进程回了一条对不上的应答：${line.slice(0, 200)}`);
    return;
  }
  state.pending.delete(id);
  clearTimeout(slot.timer);
  armIdle(state);
  slot.resolve(msg);
}

/**
 * 起一个常驻进程。**同步返回**（不等 ready —— 加载要几秒，那是调用方 await 的事）。
 *
 * @returns {object|null} `null` = 起不来（脚本不在 / spawn 抛错）→ 调用方退回一次性模式。
 */
function spawnResident(key, modelRoot, modelFile) {
  const script = workerScript();
  if (!existsSync(script)) {
    log(`常驻合成进程起不来：找不到 worker（${script}）`);
    return null;
  }
  const dir = mkdtempSync(join(tmpdir(), "herta-tts-serve-"));
  const configPath = join(dir, "config.json");
  writeFileSync(
    configPath,
    `${JSON.stringify({ runtimeDir: TTS_RUNTIME_DIR, mode: "serve", modelRoot, modelFile })}\n`,
    "utf8",
  );

  let child;
  try {
    child = spawn(process.execPath, [script, configPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    log(`常驻合成进程起不来：${String(error?.message ?? error)}`);
    return null;
  }

  const state = {
    key,
    child,
    dir,
    buf: "",
    stderr: "",
    dead: false,
    nextId: 0,
    pending: new Map(),
    ready: Promise.resolve(false),
    readyDone: false,
    readySettled: false,
    readyResolve: null,
    readyTimer: null,
    idleTimer: null,
    warmMs: null,
  };
  state.ready = new Promise((resolve) => {
    state.readyResolve = resolve;
  });
  state.readyTimer = setTimeout(() => {
    log(`常驻合成进程 ${readyTimeoutMs()} ms 内没报 ready（模型加载卡住？），杀掉`);
    disposeResident(state, "ready 超时");
  }, readyTimeoutMs());
  state.readyTimer.unref?.();

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    state.buf += chunk;
    for (;;) {
      const at = state.buf.indexOf("\n");
      if (at < 0) break;
      const line = state.buf.slice(0, at).trim();
      state.buf = state.buf.slice(at + 1);
      if (line !== "") handleResidentLine(state, line);
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    state.stderr = `${state.stderr}${chunk}`.slice(-500);
  });
  child.on("error", (error) => {
    failResident(state, `常驻合成进程出错：${String(error?.message ?? error)}`);
  });
  child.on("exit", (code, signal) => {
    const tail = state.stderr.trim();
    failResident(
      state,
      `常驻合成进程退出（code=${String(code)} signal=${String(signal)}）${tail === "" ? "" : `：${tail}`}`,
    );
  });
  return state;
}

/** 取（或建）与这个模型匹配的常驻进程；模型换了就重启。 */
function ensureResident(key, modelRoot, modelFile) {
  if (resident !== null && resident.dead !== true) {
    if (resident.key === key) return resident;
    log("本地模型换了，重启常驻合成进程");
    disposeResident(resident, "换模型");
  }
  const state = spawnResident(key, modelRoot, modelFile);
  if (state !== null) resident = state;
  return state;
}

/** 发一条合成请求，等它自己那一行应答（应答按 id 配对）。 */
function requestSynth(state, text, out) {
  return new Promise((resolve) => {
    if (state.dead === true) {
      resolve({ ok: false, error: "常驻合成进程已退出" });
      return;
    }
    const id = (state.nextId += 1);
    const timer = setTimeout(() => {
      state.pending.delete(id);
      resolve({ ok: false, error: `常驻合成超时（${synthTimeoutMs()} ms）` });
      // 超时 = 这个进程多半卡住了（这个模型不该有分钟级抖动）→ 杀掉，下次重起。
      disposeResident(state, "合成超时");
    }, synthTimeoutMs());
    timer.unref?.();
    state.pending.set(id, { resolve, timer });
    try {
      state.child.stdin.write(`${JSON.stringify({ id, op: "synth", text, out })}\n`);
    } catch (error) {
      clearTimeout(timer);
      state.pending.delete(id);
      resolve({ ok: false, error: `发不出去（常驻合成进程没了）：${String(error?.message ?? error)}` });
    }
  });
}

/**
 * 常驻进程的当前状态 —— **只读**，不会把它叫起来。
 *
 * 设置页那一行用它显示「合成进程：已预热 / 启动中 / 未启动」，这样"选本地模型之后
 * 第一次要等几秒"这件事在界面上是先说好的，而不是一个谜。
 *
 * @returns {{state: "stopped"|"starting"|"running", pid?: number|null, warmMs?: number|null}}
 */
export function localWorkerStatus() {
  if (resident === null) return { state: "stopped" };
  return {
    state: resident.readyDone === true ? "running" : "starting",
    pid: resident.child.pid ?? null,
    warmMs: resident.warmMs ?? null,
  };
}

/**
 * 预热：把常驻进程叫起来并等它加载完模型。
 *
 * 设置页在「引擎切到本地模型」时调它 —— 把那 3 秒挪到用户还在选的那几秒里。
 * 引擎已经是本地、或用户从来不点，就不该有进程常驻（见文件头「懒启动」）。
 *
 * @param {{modelRoot?: string, modelFile?: string}} [options]
 * @returns {Promise<{ok: boolean, state: string, warmMs?: number|null, error?: string}>}
 */
export async function warmUpLocalWorker(options = {}) {
  const modelRoot = options.modelRoot ?? voiceModelPaths(voiceModelStoreRoot(), TTS_BUNDLE_ID).final;
  const modelFile = options.modelFile ?? TTS_MODEL_FILE;
  if (!existsSync(modelRoot)) return { ok: false, state: "absent", error: `模型还没装：${modelRoot}` };
  const state = ensureResident(`${modelRoot}|${modelFile}`, modelRoot, modelFile);
  if (state === null) return { ok: false, state: "unavailable", error: "常驻合成进程起不来（看宿主日志）" };
  const ready = await state.ready;
  return {
    ok: ready === true,
    state: localWorkerStatus().state,
    warmMs: ready === true ? (state.warmMs ?? null) : null,
    ...(ready === true ? {} : { error: "常驻合成进程没能在超时内就绪" }),
  };
}

/** 插件卸载时调：杀掉常驻进程。不调就会在热重载后留下孤儿 node 进程。 */
export function disposeLocalWorker() {
  disposeResident(resident, "插件卸载");
  resident = null;
}

/** 探测结果缓存 —— 进程内一次，之后零成本。 */
let probeCache = null;

/**
 * 探测运行时可用性。**不是查文件在不在，是真的把它加载起来。**
 *
 * @param {{force?: boolean}} [options] - `force` 绕过缓存。
 * @returns {Promise<{available: boolean, version?: string|null, onnxruntime?: string|null, error?: string, dir: string}>}
 */
export async function probeTtsRuntime(options = {}) {
  if (probeCache !== null && options.force !== true) return probeCache;

  if (!existsSync(TTS_RUNTIME_DIR)) {
    probeCache = { available: false, dir: TTS_RUNTIME_DIR, error: "运行时没有随包分发" };
    return probeCache;
  }
  const res = await runWorker({ runtimeDir: TTS_RUNTIME_DIR, mode: "probe" }, PROBE_TIMEOUT_MS);
  probeCache =
    res.ok === true
      ? {
          available: true,
          dir: TTS_RUNTIME_DIR,
          version: res.version ?? null,
          onnxruntime: res.onnxruntime ?? null,
        }
      : { available: false, dir: TTS_RUNTIME_DIR, error: String(res.error) };
  return probeCache;
}

/**
 * 用本地模型合成一段语音。
 *
 * 默认走**常驻进程**（见文件头）；常驻起不来时退回一次性模式（每句一个进程）。
 * 两条路的返回形状一致：`{ok:true, sampleRate, samples, durationMs, peak, meanAbs,
 * wavBytes, out}` —— `samples` 是**样本个数（number）**，音频在 `out` 那个 wav 里
 * （消费方 `minimax-voice.js` 的 `createLocalQueue` 依赖这一点）。
 *
 * @param {string} text - 要说的话。
 * @param {{modelRoot?: string, modelFile?: string, out?: string}} [options] -
 *   `modelRoot` 默认 `$DSH_HOME/tts/<bundle id>`。
 * @returns {Promise<object>} 成功时 `{ok:true, sampleRate, samples, durationMs, peak, wavBytes, out}`。
 */
export async function synthesize(text, options = {}) {
  const modelRoot = options.modelRoot ?? voiceModelPaths(voiceModelStoreRoot(), TTS_BUNDLE_ID).final;
  if (!existsSync(modelRoot)) {
    return { ok: false, error: `模型还没装：${modelRoot}` };
  }
  const modelFile = options.modelFile ?? TTS_MODEL_FILE;
  const out = options.out ?? join(mkdtempSync(join(tmpdir(), "herta-wav-")), "speech.wav");

  const state = ensureResident(`${modelRoot}|${modelFile}`, modelRoot, modelFile);
  if (state !== null && (await state.ready) === true) {
    const res = await requestSynth(state, text, out);
    return { ...res, out };
  }

  // 退路：与 2026-09-28 之前的行为一致 —— 每句一个进程。慢，但这一句仍会被说出来。
  if (state !== null) log("常驻合成进程没就绪，改用一次性 worker（每句重新加载模型）");
  return runWorker(
    { runtimeDir: TTS_RUNTIME_DIR, mode: "synth", modelRoot, modelFile, text, out },
    synthTimeoutMs(),
  );
}
