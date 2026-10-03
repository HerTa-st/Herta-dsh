/**
 * `synth-registry.js` 的**行为**测试（候选 #3：让测试穿过 interface，而不是抓源码文本）。
 *
 * ## 为什么用假 adapter
 *
 * router 的规则是"行为"：谁回落谁不回落、取消转发给谁、`available()` 会不会被缓存。
 * 这些用**源码文本断言**测不出来（候选 #1 之前那两条就是这么写的 —— 删掉旧链之后
 * 它们立刻红，因为匹配的那段文本没了，而**行为根本没变**）。
 * 所以这里造四个假 adapter，只看 router 的输入输出。
 *
 * 覆盖的规则（来源：架构审查 candidate #1 的交接）：
 *   · Q1  minimax 不可用/失败 → 回落 local；fish / local / mimo **不回落**
 *   · Q9  cancel 转发给**所有**带 cancel 的 adapter（老代码硬接 minimax，是个 bug 苗子）
 *   · Q13 失败只给机器可读的 code；原文留在 status()
 *   · Q28 每结束一次合成统一 noteState()
 *   · Q29 available() 是**活开关**：每次重新问，不缓存
 *   · Q30 status() 收集各档片段
 *   · Q6  mimo 注册但恒不可用
 *   · Q18 fish 的 available() = 密钥在不在（不测网络）
 *
 * 纯 Node、无 DSH 依赖 —— 不需要 `DSH_MODULES`，任何机器都能跑。
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SYNTH_CODES,
  createFishAdapter,
  createLocalAdapter,
  createMinimaxAdapter,
  createMimoAdapter,
  createSynthRouter,
  synthFail,
  synthOk,
} from "../src/host/synth-registry.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
void root;

let pass = 0;
let fail = 0;
function eq(name, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}  —— 期望 ${String(want)}，得到 ${String(got)}`);
  }
}

const audio = (tag) => ({ samples: Int16Array.from([1, 2]), sampleRate: 24000, durationMs: 10, tag });
/** 造假 adapter：可用性与成败都由参数决定；记下收到的取消。 */
function makeAdapter(name, { available = true, gives = "ok" } = {}) {
  return {
    name,
    cancelledIds: [],
    available: () => available,
    synthesize: async () => (gives === "ok" ? synthOk(name, audio(name)) : synthFail(name, gives)),
    status: () => ({ [name]: "s" }),
    cancel(id) {
      this.cancelledIds.push(id);
    },
  };
}
function build(engine, override = {}) {
  const local = override.local ?? makeAdapter("local");
  const minimax = override.minimax ?? makeAdapter("minimax", { available: false });
  const fish = override.fish ?? makeAdapter("fish", { gives: SYNTH_CODES.network });
  const mimo = makeAdapter("mimo", { available: false });
  let notes = 0;
  const router = createSynthRouter({
    adapters: { local, minimax, fish, mimo },
    engineOf: () => engine,
    noteState: () => {
      notes += 1;
    },
  });
  return { router, local, minimax, fish, getNotes: () => notes };
}
const req = { text: "你好", utteranceId: "u1", seq: 1, lang: "zh" };

console.log("synth-registry（行为）");

// ── Q1：回落规则 ───────────────────────────────────────────────────────────
const a = build("minimax");
eq("Q1 minimax 不可用 → 出声的是 local", (await a.router.synthesize(req))?.engine, "local");
eq("Q1 云端那条原因留住了", a.router.lastCode().code, SYNTH_CODES.unavailable);
eq("Q28 结束时报了状态", a.getNotes() > 0, true);

const b = build("fish");
eq("Q1 fish 失败 → 没有音频", await b.router.synthesize(req), null);
eq("Q1 fish 失败 → **不回落**（local 没被叫）", b.local.cancelledIds.length, 0);
eq("Q1 fish 的 code 是 network", b.router.lastCode().code, SYNTH_CODES.network);

const c = build("local", { local: makeAdapter("local", { gives: SYNTH_CODES.localFailed }) });
eq("Q1 local 失败 → 没有音频", await c.router.synthesize(req), null);
eq("Q1 local 的 code 是 local_failed", c.router.lastCode().code, SYNTH_CODES.localFailed);

const d = build("从未见过的引擎");
eq("未知引擎 → 不发声", await d.router.synthesize(req), null);
eq("未知引擎 → 也不回落，code 说不可用", d.router.lastCode().code, SYNTH_CODES.unavailable);

// ── Q9：取消转发给所有 adapter ─────────────────────────────────────────────
const e = build("local");
e.router.cancel("u9");
eq("Q9 cancel 到 local", e.local.cancelledIds[0], "u9");
eq("Q9 cancel 到 fish", e.fish.cancelledIds[0], "u9");
eq("Q9 cancel 到 minimax", e.minimax.cancelledIds[0], "u9");

// ── Q29：available() 是活开关 ──────────────────────────────────────────────
let live = false;
const f = createSynthRouter({
  adapters: {
    local: { name: "local", available: () => live, synthesize: async () => synthOk("local", audio("l")) },
  },
  engineOf: () => "local",
});
eq("Q29 一开始不可用", f.available(), false);
live = true;
eq("Q29 翻成可用后立刻读到（没有缓存）", f.available(), true);

// ── Q30：status() 收集各档 ────────────────────────────────────────────────
const g = build("local");
eq("Q30 收到 local 的片段", g.router.status().local?.local, "s");
eq("Q30 四档都在", Object.keys(g.router.status()).length, 4);

// ── 工厂各自的行为（Q6 / Q18 / Q13）────────────────────────────────────────
let keyPresent = false;
const fishAdapter = createFishAdapter({
  load: async () => ({ trySynthesizePcm: async () => null, getLastFailure: () => "网络不通" }),
  params: () => ({ fishRef: "r" }),
  keyPresent: () => keyPresent,
});
eq("Q18 fish：available 跟密钥走（没密钥→不可用）", fishAdapter.available(), false);
keyPresent = true;
eq("Q18 fish：填了密钥立刻可用（活开关）", fishAdapter.available(), true);
const fishOut = await fishAdapter.synthesize(req);
eq("Q13 fish：失败给 audio:null", fishOut.audio, null);
eq("Q13 fish：原因归成 network", fishOut.code, SYNTH_CODES.network);
eq("Q30 fish：原文留在 status", fishAdapter.status().reason, "网络不通");

const mimoAdapter = createMimoAdapter({ synthesizer: null });
eq("Q6 mimo：恒不可用", mimoAdapter.available(), false);
eq("Q6 mimo：合成给 not_wired", (await mimoAdapter.synthesize(req)).code, SYNTH_CODES.notWired);

const localAdapter = createLocalAdapter({ queue: async () => null, getFailure: () => "模型没装" });
eq("local：失败给 local_failed", (await localAdapter.synthesize(req)).code, SYNTH_CODES.localFailed);

const minimaxNoKey = createMinimaxAdapter({
  synthesizer: { available: () => false, synthesize: async () => null },
  describe: () => "没有 MiniMax 密钥",
});
eq("minimax：不可用时归 no_key", (await minimaxNoKey.synthesize(req)).code, SYNTH_CODES.no_key);
const minimaxRefused = createMinimaxAdapter({
  synthesizer: { available: () => true, synthesize: async () => null },
  describe: () => "MiniMax 拒绝（quota）",
});
eq("minimax：拒绝归 refused", (await minimaxRefused.synthesize(req)).code, SYNTH_CODES.refused);
const minimaxOk = createMinimaxAdapter({
  synthesizer: { available: () => true, synthesize: async () => audio("mm") },
  describe: () => "",
});
eq("minimax：成功时带音频", (await minimaxOk.synthesize(req)).audio?.tag, "mm");


// ── Q18：鱼档没密钥时，router 报的是 no_key（不该糊成 unavailable）────────
{
  const noKey = createSynthRouter({
    adapters: {
      fish: createFishAdapter({
        load: async () => ({ trySynthesizePcm: async () => null }),
        params: () => ({}),
        keyPresent: () => false,
      }),
    },
    engineOf: () => "fish",
  });
  eq("Q18 fish 没密钥 → 不发声", await noKey.synthesize(req), null);
  eq("Q18 fish 没密钥 → code = no_key", noKey.lastCode().code, SYNTH_CODES.no_key);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
