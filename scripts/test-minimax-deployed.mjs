/**
 * **部署副本**的真机冒烟：直接加载 profile 里那份 `dsh-herta`（不是仓库里的 `lib/`），
 * 用假 ctx/假 SSE + **真**密钥跑一次 `herta_say`。
 *
 * 存在的理由很具体：重启 DSH 之前，我想先确定"宿主将加载的那份代码"能起来、
 * 能认领、能合成、能把 PCM 写进 SSE —— 而不是只验仓库里的产物。重启是有代价的
 * （会中断正在进行的会话），所以这一步值得。
 *
 * 用法：
 *   node --import ./scripts/test-resolve-hook.mjs scripts/test-minimax-deployed.mjs
 * 环境：`DSH_PROFILE_DIR`（默认桌面 profile）、密钥在 `$DSH_HOME/.credentials.yaml`。
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const profileDir =
  process.env.DSH_PROFILE_DIR ??
  join(
    process.env.DSH_HOME ?? join(homedir(), ".dsh"),
    "profiles",
    process.env.DSH_PROFILE ?? "desktop",
  );
const entry = join(profileDir, "node_modules", "dsh-herta", "lib", "minimax-voice.js");

const stateDir = mkdtempSync(join(process.env.TEMP ?? ".", "herta-deployed-"));
process.env.DSH_HERTA_MINIMAX_STATE = join(stateDir, "state.json");

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

function readCredential(ref) {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  try {
    const raw = readFileSync(join(home, ".credentials.yaml"), "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith(`${ref}:`));
    return line === undefined ? null : line.slice(line.indexOf(":") + 1).trim() || null;
  } catch {
    return null;
  }
}

const key = process.env.MINIMAX_API_KEY ?? readCredential("MINIMAX_API_KEY");

console.log(`部署副本：${entry}`);
const mod = await import(pathToFileURL(entry).href);
check("部署副本能加载", typeof mod.installMiniMaxVoice === "function");
check("导出齐全", ["installMiniMaxSpeech", "registerMiniMaxVoiceRoutes", "hertaSayTool"].every((k) => mod[k] !== undefined));

const routes = [];
const ctx = {
  get(name) {
    if (name === "credentials") {
      return { resolve: async (ref) => (ref === "MINIMAX_API_KEY" && key !== null ? { value: key, source: "file" } : undefined) };
    }
    if (name === "webServer") return { register: (route) => { routes.push(route); return () => {}; } };
    return undefined;
  },
  on() {
    return () => {};
  },
};

// 按真机形状给配置：DSH 的 volatile 字段是包装对象（要 .get()）。
// 早先这里给裸字符串，于是真机上 "引擎是不是 minimax" 永远为假而这份冒烟照样全绿。
const mini = mod.installMiniMaxVoice(ctx, {
  voiceEngine: { get: () => "minimax" },
  realtimeVoice: { get: () => true },
});
check("接线挂上", mini !== null);
check("volatile 包装被正确解包", mini.snapshot().engine === "minimax");
mod.registerMiniMaxVoiceRoutes(ctx);
check("两条端点都注册了", routes.some((r) => r.path === "/herta-minimax-events") && routes.some((r) => r.path === "/herta-minimax-state"));

const res = { chunks: [], writeHead() {}, write(c) { this.chunks.push(String(c)); } };
routes.find((r) => r.path === "/herta-minimax-events").handler({ method: "GET", on() {} }, res);

if (key === null) {
  console.log("（没有密钥，只验到「能加载、能挂端点」；认领与合成跳过）");
} else {
  for (let i = 0; i < 60 && mini.snapshot().voice.phase !== "ready"; i += 1) {
    const s = mini.snapshot();
    if (s.voice.phase === "failed") {
      console.error(`  认领失败：${s.voice.lastError}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const snap = mini.snapshot();
  check("用真密钥认领成功", snap.voice.phase === "ready");
  console.log(`     ${snap.voice.voiceId ?? "?"} @ ${snap.voice.host ?? "?"}`);

  const out = await mod.hertaSayTool.execute({ text: "部署副本冒烟：我是黑塔。" });
  check("herta_say 成功", out.ok === true);
  check("用的是 MiniMax", out.engine === "minimax");
  const tts = res.chunks.filter((c) => c.startsWith("data: ")).map((c) => JSON.parse(c.slice(6))).filter((f) => f.kind === "tts");
  check("SSE 上收到了 PCM 帧", tts.length >= 1);
  if (tts.length >= 1) {
    const raw = Buffer.from(tts[0].samplesB64, "base64");
    const samples = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1);
    const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    check("PCM 不是静音", peak > 0);
    console.log(`     ${tts.length} 段 / 采样率 ${tts[0].sampleRate} / 峰值 ${peak}`);
  }
}

rmSync(stateDir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
