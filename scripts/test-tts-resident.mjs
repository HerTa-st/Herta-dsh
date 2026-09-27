/**
 * 常驻合成进程的**管理逻辑**单测 —— 不碰原生件、不需要真模型。
 *
 * `tts-runtime.js` 现在管一个长期存活的子进程（懒启动 / 空闲回收 / 崩溃重启 /
 * 卸载即杀），这四件事每一条都是失败模式，而它们与 sherpa 无关 —— 所以这里用一份
 * **行协议一致的假 worker**（`HERTA_TTS_WORKER` 指过去）把它们逐条钉住：
 *
 *   1. 第一次合成起一个进程，第二次**复用**它（加载只发生一次 —— 这就是加速的全部）
 *   2. 空闲 `HERTA_TTS_IDLE_MS` 之后自己退掉（不用本地语音的人不该白占 ~250 MB）
 *   3. 请求超时 → 这一句如实失败、进程被杀掉，下次请求重起（不挂在半空）
 *   4. 进程崩了 → 所有在飞请求当场失败，下一次请求重起
 *   5. 常驻起不来（ready 超时）→ **退回**一次性模式，这一句仍然会被说出来
 *   6. 模型没装 → 立刻如实失败，**不起任何进程**
 *   7. `warmUpLocalWorker()` 预热与 `disposeLocalWorker()` 卸载即杀
 *
 * 跑法：`node scripts/test-tts-resident.mjs`（零依赖、无网络、不需要构建产物 ——
 * 它直接 import `src/host/tts-runtime.js`）。
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "herta-tts-resident-"));
const spawnLog = join(dir, "spawns.log");
const modelRoot = join(dir, "model");
const fakeWorker = join(dir, "fake-worker.cjs");
writeFileSync(spawnLog, "", "utf8");
mkdirSync(modelRoot, { recursive: true });

/**
 * 假 worker：行协议与 `tts-worker.cjs` 的 `serve` 模式逐字一致，行为由 FAKE_TTS_*
 * 环境变量控制（子进程继承测试进程的 env，所以测试可以逐案开关）。
 */
writeFileSync(
  fakeWorker,
  `
const fs = require("node:fs");
const configPath = process.argv[2];
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const env = process.env;
const mode = config.mode;
if (env.FAKE_TTS_SPAWN_LOG) fs.appendFileSync(env.FAKE_TTS_SPAWN_LOG, mode + " " + process.pid + "\\n");
function reply(v) { process.stdout.write(JSON.stringify(v) + "\\n"); }
function writeWav(file, samples, sampleRate) {
  const bytes = samples * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + bytes, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(bytes, 40);
  fs.writeFileSync(file, buf);
}
function synthBody(text, out) {
  const samples = 24000;
  writeWav(out, samples, 24000);
  return { sampleRate: 24000, samples, durationMs: 1000, peak: 9000, meanAbs: 1200, wavBytes: 44 + samples * 2, out };
}
if (mode === "synth") {
  // 一次性模式（常驻起不来时的退路）也要能被这里驱动。
  if (env.FAKE_TTS_ONESHOT_FAIL) { reply({ ok: false, error: "假 worker：一次性模式按配置失败" }); process.exit(0); }
  reply(Object.assign({ ok: true, mode: "synth" }, synthBody(String(config.text), String(config.out))));
  process.exit(0);
}
if (mode !== "serve") { reply({ ok: false, error: "假 worker 只认 synth/serve" }); process.exit(0); }
if (env.FAKE_TTS_NO_READY === "1") {
  // 永不报 ready：父侧必须靠 ready 超时把它处理掉（并退回一次性模式）。
  setInterval(() => {}, 1000);
} else {
  const delay = Number(env.FAKE_TTS_READY_DELAY_MS || "0");
  setTimeout(() => reply({ ok: true, mode: "serve", ready: true, pid: process.pid, loadMs: 123 }), delay);
}
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  for (;;) {
    const at = buf.indexOf("\\n");
    if (at < 0) break;
    const line = buf.slice(0, at).trim();
    buf = buf.slice(at + 1);
    if (line === "") continue;
    const req = JSON.parse(line);
    if (req.op === "exit") { reply({ id: req.id, ok: true, bye: true }); process.exit(0); }
    if (env.FAKE_TTS_NEVER_ANSWER === "1") continue;             // 卡住不答（测超时）
    if (env.FAKE_TTS_CRASH_ON_SYNTH === "1") process.exit(3);    // 崩（测重启）
    reply(Object.assign({ id: req.id, ok: true, mode: "serve", synthMs: 1 }, synthBody(String(req.text), String(req.out))));
  }
});
`,
  "utf8",
);

// 假 worker 只认这三个旋钮；其余都走宿主自己的环境变量。
process.env.HERTA_TTS_WORKER = fakeWorker;
process.env.FAKE_TTS_SPAWN_LOG = spawnLog;

const { disposeLocalWorker, localWorkerStatus, probeTtsRuntime, synthesize, warmUpLocalWorker } = await import(
  "../src/host/tts-runtime.js"
);

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}${detail === "" ? "" : `  —— ${detail}`}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const spawns = () => readFileSync(spawnLog, "utf8").trim().split("\n").filter(Boolean);
const outPath = (name) => join(dir, `${name}.wav`);
const setEnv = (name, value) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

console.log("tts-runtime 常驻进程（假 worker）");

// ── 1. 懒启动 + 复用：第一次起进程，第二次共用它 ──────────────────────────
{
  setEnv("HERTA_TTS_IDLE_MS", "60000");
  check("一开始没有常驻进程（懒启动）", localWorkerStatus().state === "stopped");
  check("查询状态不会把它叫起来", spawns().length === 0, spawns().join(","));

  const first = await synthesize("第一句。", { modelRoot, out: outPath("a") });
  check("第一次合成成功", first.ok === true, first.error ?? "");
  check("第一次合成真的写了 wav", existsSync(outPath("a")));
  check("第一次合成起了且只起了一个进程", spawns().length === 1, spawns().join(","));
  check("进程起的是 serve 模式（不是一次性）", spawns()[0]?.startsWith("serve "), spawns()[0] ?? "");
  const pidAfterFirst = localWorkerStatus().pid;
  const stateAfterFirst = localWorkerStatus().state;
  check("状态是 running", stateAfterFirst === "running", stateAfterFirst);
  check("状态里带着模型加载耗时（那是被省掉的那部分）", localWorkerStatus().warmMs === 123);

  const second = await synthesize("第二句。", { modelRoot, out: outPath("b") });
  check("第二次合成成功", second.ok === true, second.error ?? "");
  check("第二次合成**复用**同一个进程（没有再起）", spawns().length === 1, spawns().join(","));
  check("pid 没变", localWorkerStatus().pid === pidAfterFirst);
  check("两次的 wav 各自落盘", existsSync(outPath("a")) && existsSync(outPath("b")));
}

// ── 2. 空闲回收：到点自己退掉，下次要用再起 ───────────────────────────────
{
  const before = spawns().length;
  setEnv("HERTA_TTS_IDLE_MS", "300");
  // 上一次合成结束时装的还是 60s 的定时器，所以这里再合成一次让新值生效。
  await synthesize("把空闲定时器重置成 300ms。", { modelRoot, out: outPath("c") });
  check("这一句仍复用同一个进程", spawns().length === before, spawns().join(","));
  await sleep(1200);
  check("空闲之后进程被回收", localWorkerStatus().state === "stopped");
  check("回收不是「多起了一个」（进程总数没变）", spawns().length === before, spawns().join(","));
  const after = await synthesize("回收之后再用一次。", { modelRoot, out: outPath("d") });
  check("回收之后再合成会重起一个进程", after.ok === true && spawns().length === before + 1, spawns().join(","));
  setEnv("HERTA_TTS_IDLE_MS", "60000");
}

// ── 3. 请求超时：如实失败 + 杀掉卡住的进程 ────────────────────────────────
// 故障注入的每一例都要**先停掉当前进程**：假 worker 的开关是 spawn 时从 env 继承的，
// 已经热着的那个进程不会知道刚改的开关（这正是"懒启动 + 复用"的真实语义）。
{
  disposeLocalWorker();
  setEnv("FAKE_TTS_NEVER_ANSWER", "1");
  setEnv("HERTA_TTS_SYNTH_TIMEOUT_MS", "400");
  const before = spawns().length;
  const started = Date.now();
  const res = await synthesize("这一句不会有人回答。", { modelRoot, out: outPath("e") });
  const secs = (Date.now() - started) / 1000;
  check("超时后如实失败（不是假装成功）", res.ok === false, JSON.stringify(res));
  check("错误里说清是超时", /超时/.test(String(res.error ?? "")), String(res.error ?? ""));
  check("超时确实是按配置的时间到的（< 5s）", secs < 5, `${secs.toFixed(2)}s`);
  check("卡住的进程被杀掉了", localWorkerStatus().state === "stopped");
  check("这次调用只起了一个进程（没有偷偷重试）", spawns().length === before + 1, spawns().join(","));

  // 事后把开关关掉：下一次请求应该重新起进程并成功。
  setEnv("FAKE_TTS_NEVER_ANSWER", undefined);
  const back = await synthesize("恢复之后这一句要成功。", { modelRoot, out: outPath("f") });
  check("恢复后重新起进程并成功", back.ok === true && spawns().length === before + 2, back.error ?? "");
  setEnv("HERTA_TTS_SYNTH_TIMEOUT_MS", undefined);
}

// ── 4. 进程崩了：在飞请求当场失败，下次重起 ───────────────────────────────
{
  disposeLocalWorker();
  setEnv("FAKE_TTS_CRASH_ON_SYNTH", "1");
  const before = spawns().length;
  const res = await synthesize("这句会把进程搞崩。", { modelRoot, out: outPath("g") });
  check("崩了之后如实失败（不挂在半空）", res.ok === false, JSON.stringify(res));
  check("状态回到 stopped", localWorkerStatus().state === "stopped");
  setEnv("FAKE_TTS_CRASH_ON_SYNTH", undefined);
  const back = await synthesize("崩过之后重起一个。", { modelRoot, out: outPath("h") });
  check("下一次请求重起进程并成功", back.ok === true && spawns().length === before + 2, back.error ?? "");
}

// ── 5. 常驻起不来 → 退回一次性模式（慢，但话仍说出来）────────────────────
{
  disposeLocalWorker();
  setEnv("FAKE_TTS_NO_READY", "1");
  setEnv("HERTA_TTS_READY_TIMEOUT_MS", "400");
  const before = spawns().length;
  const res = await synthesize("常驻起不来时这一句也不能哑。", { modelRoot, out: outPath("i") });
  check("ready 超时后仍合成成功（走了退路）", res.ok === true, res.error ?? "");
  check("确实试过常驻、并把 wav 写出来了", existsSync(outPath("i")));
  check("退路用的是一次性模式（每句一个进程）", spawns().slice(before).some((s) => s.startsWith("synth ")), spawns().slice(before).join(","));
  setEnv("FAKE_TTS_NO_READY", undefined);
  setEnv("HERTA_TTS_READY_TIMEOUT_MS", undefined);
  disposeLocalWorker();
}

// ── 6. 模型没装：立刻如实失败，**不起任何进程** ───────────────────────────
{
  const before = spawns().length;
  const res = await synthesize("模型不在就别起进程。", { modelRoot: join(dir, "没有这个目录") });
  check("模型缺失时失败", res.ok === false && /模型还没装/.test(String(res.error ?? "")), JSON.stringify(res));
  check("一个进程都没起", spawns().length === before, spawns().join(","));
  const warm = await warmUpLocalWorker({ modelRoot: join(dir, "没有这个目录") });
  check("预热在模型缺失时如实回报 absent", warm.ok === false && warm.state === "absent", JSON.stringify(warm));
  check("预热也不会起进程", spawns().length === before);
}

// ── 7. 预热与卸载即杀 ────────────────────────────────────────────────────
{
  const before = spawns().length;
  const warm = await warmUpLocalWorker({ modelRoot });
  check("预热成功", warm.ok === true && warm.state === "running", JSON.stringify(warm));
  check("预热起了恰好一个进程", spawns().length === before + 1, spawns().join(","));
  const warmAgain = await warmUpLocalWorker({ modelRoot });
  check("重复预热不会重起", warmAgain.ok === true && spawns().length === before + 1, spawns().join(","));

  const res = await synthesize("预热之后这一句不该再加载模型。", { modelRoot, out: outPath("j") });
  check("预热过的进程被合成复用", res.ok === true && spawns().length === before + 1, res.error ?? "");

  disposeLocalWorker();
  check("disposeLocalWorker 之后状态是 stopped", localWorkerStatus().state === "stopped");
  check("卸载之后再调一次也不抛（幂等）", (() => { try { disposeLocalWorker(); return true; } catch { return false; } })());
}

// ── 8. 探测缓存不受常驻影响（探测仍走一次性 probe）──────────────────────
{
  const probe = await probeTtsRuntime();
  check("probe 在没有真运行时时如实报不可用（假 worker 不认 probe）", probe.available === false, JSON.stringify(probe));
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
