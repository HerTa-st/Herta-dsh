/**
 * 宿主接线的**端到端冒烟**（假 HTTP、假 webServer、假凭据，不起 DSH）：
 * 认领 → 按 `voiceEngine` 分发 → 合成 → SSE 帧落到浏览器侧那条连接上。
 *
 * ## 为什么值得单独一个脚本
 *
 * `test-minimax-pipeline.mjs` 钉的是状态机（帧进、PCM 帧出的**逻辑**），
 * 而这里钉的是"接谁"：凭据缝读得到密钥吗、启动认领会真的打 `/v1/get_voice` 吗、
 * 两条端点注册的形状对吗、状态快照里该有的字段都在吗、`herta_say` 走完是不是
 * 真的往 SSE 写了 `kind:"tts"`。这一段是**唯一**能把整条链路在 Node 里跑通的测试。
 *
 * 跑法（要借 DSH 运行时的 `node_modules` 解析 `@deepseek-ai/dsh-tools`）：
 *   node --import ./scripts/test-resolve-hook.mjs scripts/test-minimax-voice-route.mjs
 * 前置：`node scripts/build.mjs`（或 `build-minimax.mjs` + host 拷贝）。
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// **只隔离状态文件，不动 `DSH_HOME`**：认领记录默认落在
// `$DSH_HOME/dsh-herta-minimax.json`，不隔离的话这个测试会写进真实 home
// （第一次跑通过、第二次因为命中那条记录而不再打网络，且真实环境被留一条假记录）。
// 但也不能把 `DSH_HOME` 改到临时目录 —— 那会把离线模型（`$DSH_HOME/tts/...`）
// 一起挡掉，而第 7 组恰恰要验"云端不可用 → 回落本地模型"。
const fakeHome = mkdtempSync(join(tmpdir(), "herta-minimax-state-"));
process.env.DSH_HERTA_MINIMAX_STATE = join(fakeHome, "state.json");

const { PREVIEW_TEXT, hertaSayTool, installMiniMaxSpeech, installMiniMaxVoice, registerMiniMaxVoiceRoutes } = await import(
  "../lib/minimax-voice.js"
);

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

function hexOf(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => buf.writeInt16LE(v, i * 2));
  return buf.toString("hex");
}

const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

/** 假的全局 fetch：把两台平台的调用都记下来，按路径回可用的应答。 */
const httpCalls = [];
globalThis.fetch = async (url, init) => {
  httpCalls.push({ url, body: init?.body });
  if (String(url).includes("/v1/get_voice")) {
    return ok({
      base_resp: { status_code: 0 },
      voice_cloning: [{ voice_id: HER, created_time: "2026-09-12T04:26:02.136Z" }],
    });
  }
  if (String(url).includes("/v1/t2a_v2")) {
    return ok({
      base_resp: { status_code: 0 },
      data: { audio: hexOf([1, -2, 3]) },
      extra_info: { usage_characters: 5 },
    });
  }
  return { ok: false, status: 404, text: async () => "{}" };
};

/** 假的 webServer：只记录注册进来的路由。 */
const routes = [];
const webServer = { register: (route) => { routes.push(route); return () => {}; } };

/** 假的 ctx：凭据缝给一把密钥，事件订阅被记下来**并能被主动触发**。 */
const subscribed = [];
const handlers = new Map();
const ctx = {
  get(name) {
    if (name === "credentials") {
      return {
        resolve: async (ref) =>
          ref === "MINIMAX_API_KEY" ? { value: "sk-api-test", source: "file" } : undefined,
      };
    }
    if (name === "webServer") return webServer;
    return undefined;
  },
  on(event, handler) {
    subscribed.push(event);
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
    return () => {};
  },
};

/** 主动触发一个宿主事件（模拟 DSH 的分发）。 */
function fireHostEvent(event, payload) {
  for (const handler of handlers.get(event) ?? []) handler(payload);
}

/**
 * 分发配置。
 *
 * ⚠️ **按真机的形状造**：DSH 的 volatile 字段是包装对象（要 `.get()`）。早先这里用裸字符串，
 * 于是真机上"引擎是不是 minimax"永远为假（拿到 `[object Object]`）而测试全绿 ——
 * 这个形状差异正是 2026-09-27 那个真机 bug 的成因。
 */
const config = { voiceEngine: { get: () => "minimax" }, realtimeVoice: { get: () => true } };

/** 一条假的 SSE 响应。 */
function makeRes() {
  return {
    chunks: [],
    status: 0,
    headers: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(String(chunk));
    },
    end() {},
    frames() {
      return this.chunks
        .filter((c) => c.startsWith("data: "))
        .map((c) => JSON.parse(c.slice(6)));
    },
  };
}

/**
 * 一次假的 HTTP 请求。
 *
 * 必须像真的 `IncomingMessage` 那样**按事件**吐字节 —— `readJsonBody` 用的是
 * `req.on("data"/"end")`，早先这里只实现 async iterator，于是那个 Promise 永远
 * 不 settle（表现为顶层 await 卡住）。
 */
function makeReq(method, body) {
  const handlers = {};
  const req = {
    method,
    on(event, cb) {
      (handlers[event] ??= []).push(cb);
      return req;
    },
  };
  setImmediate(() => {
    if (body !== undefined) {
      for (const cb of handlers.data ?? []) cb(Buffer.from(JSON.stringify(body)));
    }
    for (const cb of handlers.end ?? []) cb();
  });
  return req;
}

function makeJsonRes() {
  return {
    status: 0,
    body: null,
    writeHead(status) {
      this.status = status;
    },
    end(payload) {
      this.body = JSON.parse(payload);
    },
  };
}

// ── 1. 挂载：订阅凭据变化，并立刻认领一次 ────────────────────────────────
const mini = installMiniMaxVoice(ctx, config);
check("installMiniMaxVoice 返回共享实例", mini !== null && typeof mini.snapshot === "function");
check(
  "volatile 包装的 voiceEngine 被正确解包（不是 [object Object]）",
  mini.snapshot().engine === "minimax",
);
check("订阅了凭据变化事件", subscribed.includes("credentials/reference-updated"));
await new Promise((r) => setTimeout(r, 30));
const snap = mini.snapshot();
check("启动认领打到了 /v1/get_voice", httpCalls.some((c) => c.url.includes("/v1/get_voice")));
check("认领到她的克隆", snap.voice.phase === "ready" && snap.voice.voiceId === HER);
check("状态里带着引擎与上限", snap.engine === "minimax" && snap.maxTurnChars === 800);
check("状态里带着密钥存在标志", snap.keyKnown === true);

// ── 2. 两条端点的注册形状 ────────────────────────────────────────────────
registerMiniMaxVoiceRoutes(ctx);
const events = routes.find((r) => r.path === "/herta-minimax-events");
const state = routes.find((r) => r.path === "/herta-minimax-state");
check("SSE 路由是 exact", events !== undefined && events.kind === "exact");
check("状态路由是 prefix", state !== undefined && state.kind === "prefix");

// ── 2b. preset 平面挂上之后，**不许**把宿主那份分发配置盖掉 ────────────────
// preset 平面那份 Config 是同一套 schema 的另一份实例，它的 voiceEngine 落在默认值
// `local` 上；要是"谁后挂谁赢"，配置里明明写着 minimax 也会一声不出。
{
  const before = mini.snapshot().engine;
  installMiniMaxSpeech(ctx); // 新签名只收 ctx —— 结构上就没法盖
  check("preset 平面挂上后引擎不变", mini.snapshot().engine === before && before === "minimax");
  check("preset 平面订阅了助手流与 turn 边界", handlers.has("agent/assistant-stream") && handlers.has("agent/turn-stopping"));
}

// ── 2c. realtimeVoice：关掉自动念回复，但 herta_say 照旧 ──────────────────
// 走**真格子**（假 ctx 记下的监听体）+ 真分段 + 假合成，验的是接线而不是纯逻辑。
{
  const repliesRes = makeRes();
  events.handler(makeReq("GET"), repliesRes);
  const AGENT = { id: "e2e-agent", session: { header: {} } };
  const LONG = "第一句话足够长了，这里早就超过十个字了。第二句话也同样足够长，同样超过十个字。";
  const drive = () => {
    fireHostEvent("agent/assistant-stream", { agent: AGENT, frame: { type: "start", attemptId: "e", revision: 1, turn: 1, step: 1 } });
    fireHostEvent("agent/assistant-stream", {
      agent: AGENT,
      frame: { type: "chunk", attemptId: "e", revision: 1, index: 0, time: 0, chunk: { type: "text-delta", index: 0, text: LONG } },
    });
    fireHostEvent("agent/assistant-stream", {
      agent: AGENT,
      frame: { type: "chunk", attemptId: "e", revision: 1, index: 1, time: 0, chunk: { type: "block-end", index: 0, block: {} } },
    });
    fireHostEvent("agent/assistant-stream", { agent: AGENT, frame: { type: "end", attemptId: "e", revision: 1, index: 9, outcome: { kind: "abandoned" } } });
  };
  const ttsCount = () => repliesRes.frames().filter((f) => f.kind === "tts").length;

  let replies = false;
  config.realtimeVoice = { get: () => replies };
  drive();
  await new Promise((r) => setTimeout(r, 30));
  check("realtimeVoice=false 时自动念回复不发声", ttsCount() === 0);

  replies = true;
  drive();
  await new Promise((r) => setTimeout(r, 60));
  check("realtimeVoice=true 时自动念回复出声", ttsCount() >= 1);

  const said = await hertaSayTool.execute({ text: "手动说一句。" });
  check("herta_say 不受 realtimeVoice 管", said.ok === true && said.engine === "minimax");
  // 这条假连接用完就摘掉，免得后面那条"客户端计数"的断言被它算进去。
  mini.bus.remove(repliesRes);
}

// ── 3. 状态端点：GET 快照 / POST adopt、reset / 未知动作 400 ─────────────
{
  const res = makeJsonRes();
  await state.handler(makeReq("GET"), res);
  check("GET 状态 200", res.status === 200);
  check("GET 快照里有 voice/synth/pipeline", res.body.voice !== undefined && res.body.synth !== undefined && res.body.pipeline !== undefined);
  check(
    "GET 快照里有常驻合成进程的事实（设置页那行靠它显示预热状态）",
    res.body.localWorker !== undefined && typeof res.body.localWorker.state === "string",
  );
}
{
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "reset" }), res);
  check("POST reset 清掉记录", res.status === 200 && res.body.voice.phase === "absent");
}
{
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "adopt" }), res);
  check("POST adopt 重新认领回来", res.status === 200 && res.body.voice.phase === "ready");
}
{
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "bogus" }), res);
  check("未知动作 400 且列出允许值", res.status === 400 && Array.isArray(res.body.allowed));
}

// ── 3b. 试听动作：固定台词走当前引擎，回执拼在快照里 ──────────────────────
// 设置页那颗「试听」按钮打的就是这条：宿主自己持有台词，界面只发一个动作名；
// PCM 仍走 SSE，回执只用来给界面一句话（成功 / 为什么没声）。
{
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "preview" }), res);
  check("POST preview 200 且带 preview 回执", res.status === 200 && res.body.preview !== undefined);
  check("试听回报成功与引擎", res.body.preview.ok === true && res.body.preview.engine === "minimax");
  check(
    "试听用的是宿主持有的固定台词（与 PREVIEW_TEXT 逐字一致）",
    typeof res.body.preview.text === "string" && res.body.preview.text === PREVIEW_TEXT && PREVIEW_TEXT.length > 0,
  );
  check("回执里同时带状态快照（界面一次拿两样）", res.body.engine === "minimax" && res.body.pipeline !== undefined);
}
{
  // mimo 档：试听不发声，但必须说清原因（那一档在选择器里点得动）。
  let engine = "mimo";
  config.voiceEngine = { get: () => engine };
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "preview" }), res);
  check(
    "引擎=mimo 时试听如实失败并说明原因",
    res.body.preview.ok === false && res.body.preview.note.includes("尚未接线"),
  );
  engine = "minimax";
  config.voiceEngine = { get: () => engine };
}
{
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "bogus" }), res);
  check("允许动作清单里现在也有 preview", Array.isArray(res.body.allowed) && res.body.allowed.includes("preview"));
  check("允许动作清单里也有 warm", res.body.allowed.includes("warm"));
}

// ── 3c. warm：预热常驻合成进程（设置页切到「本地模型」时打的那一条）──────
{
  const res = makeJsonRes();
  await state.handler(makeReq("POST", { action: "warm" }), res);
  check(
    "POST warm 200 且带回执",
    res.status === 200 && res.body.warm !== undefined && typeof res.body.warm.state === "string",
  );
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const realHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  const modelReady = existsSync(join(realHome, "tts", "herta-best-e72", "manifest.json"));
  check(
    modelReady ? "装了模型 → 预热真的就绪（state=running）" : "没装模型 → 预热如实回报 absent",
    modelReady ? res.body.warm.ok === true && res.body.warm.state === "running" : res.body.warm.state === "absent",
  );
}
{
  const res = makeJsonRes();
  await state.handler(makeReq("DELETE"), res);
  check("非 GET/POST → 405", res.status === 405);
}

// ── 4. SSE：接入即握手，帧落到这条连接上 ────────────────────────────────
{
  const res = makeRes();
  events.handler(makeReq("GET"), res);
  check("SSE 响应头是事件流", res.status === 200 && String(res.headers["Content-Type"]).includes("text/event-stream"));
  check("接入即握手", res.chunks[0] === ": connected\n\n");
  check("客户端计数为 1", mini.bus.count() === 1);
}

// ── 5. herta_say：整条走通（凭据 → 合成 → SSE 帧）────────────────────────
{
  const res = makeRes();
  events.handler(makeReq("GET"), res);
  const out = await hertaSayTool.execute({ text: "你好呀，我是黑塔，这句话足够长了。" });
  check("herta_say 报告成功", out.ok === true);
  check("herta_say 用的是 MiniMax", out.engine === "minimax");
  const tts = res.frames().filter((f) => f.kind === "tts");
  check("SSE 上收到了 tts 帧", tts.length >= 1);
  check("帧里带 utteranceId 与 seq", tts.length >= 1 && typeof tts[0].utteranceId === "string" && tts[0].seq === 1);
  const raw = tts.length >= 1 ? Buffer.from(tts[0].samplesB64, "base64") : Buffer.alloc(0);
  check(
    "帧里 PCM 能解回 Int16",
    tts.length >= 1 && new Int16Array(raw.buffer, raw.byteOffset, 3)[1] === -2,
  );
  check("真的打了 /v1/t2a_v2", httpCalls.filter((c) => c.url.includes("/v1/t2a_v2")).length >= 1);
}

// ── 6. 引擎分发：mimo 明确说不出话，local 直连本地模型 ────────────────────
// 这一组原来断言的是「voiceEngine=local 时拒绝合成」—— 那时 local 只在云端失败时
// 被**回落**调用，选它等于静音。2026-09-28 起 local 真的会念，所以"拒绝"的那一档
// 换成了 mimo（合成器尚未接线）。
{
  // 换的是 volatile 包装里的值（真机就是这种：loader 把新值提交进同一个引用）。
  let engine = "mimo";
  config.voiceEngine = { get: () => engine };
  const out = await hertaSayTool.execute({ text: "喂喂喂。" });
  check("voiceEngine=mimo 时 herta_say 拒绝合成", out.ok === false && out.note.includes("mimo"));
  check("拒绝时不会把对象塞进文案", !out.note.includes("[object"));
  check("拒绝的理由写清了「尚未接线」，不是含糊的失败", out.note.includes("尚未接线"));

  // local 那条要真的落到本地模型上：本机装了模型就该出声（引擎报 local），
  // 没装就如实失败。两种都不许"假装成功"（与第 7 组同口径）。
  engine = "local";
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const realHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  const modelReady = existsSync(join(realHome, "tts", "herta-best-e72", "manifest.json"));
  const localOut = await hertaSayTool.execute({ text: "用本地模型说一句。" });
  if (modelReady) {
    check("voiceEngine=local 时 herta_say 走本地模型并出声", localOut.ok === true && localOut.engine === "local");
  } else {
    check("没装离线模型时 local 如实失败并说明原因", localOut.ok === false && localOut.note.length > 0);
  }

  engine = "minimax";
  check("同一个引用改值后立刻生效（volatile 的活开关语义）", mini.snapshot().engine === "minimax");
}

// ── 7. 云端不可用 → 显式回落本地模型 ─────────────────────────────────────
// 断言随**本机有没有装离线模型**而分叉：装了就该真的回落成功（引擎报 local），
// 没装就该如实报"模型还没装"。两者都不能是"假装成功"。
{
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const realHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  const modelReady = existsSync(join(realHome, "tts", "herta-best-e72", "manifest.json"));

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  const out = await hertaSayTool.execute({ text: "这句话云端说不出来。" });
  globalThis.fetch = realFetch;

  if (modelReady) {
    check("装了离线模型 → 回落成功且引擎报 local", out.ok === true && out.engine === "local");
  } else {
    check("没装离线模型 → 如实失败并说明原因", out.ok === false && out.note.length > 0);
  }
}

// 本地那两条（第 6、7 组）会拉起**常驻合成进程**（真模型，~250 MB）。测试结束必须
// 杀掉它 —— 父进程退出不会带走子进程，否则开发机上会留一个孤儿 node。
const { disposeLocalWorker, localWorkerStatus } = await import("../lib/tts-runtime.js");
disposeLocalWorker();
check("测试收尾：常驻合成进程已被杀掉（不留孤儿）", localWorkerStatus().state === "stopped");

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(fakeHome, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
