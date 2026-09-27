/**
 * `src/host/minimax/{state,voice}.ts` 的单测。
 *
 * 覆盖的是**本插件与上游不同的那部分**：只认领、不克隆；以及认领失败后的冷却、
 * 状态文件容错、`lastUsedAt` 节流。用例名一律写"认领"而不是"克隆"——这个区别
 * 正是这一组测试存在的理由。
 *
 * 跑法：先 `node scripts/build-minimax.mjs`（测试从**编译产物**导入，理由见该脚本：
 * 源码用 `./x.js` 说明符，而 Node 不会把 `./x.js` 解析回 `x.ts`）。
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MINIMAX_HOSTS } from "../lib/minimax/api.js";
import {
  ADOPT_COOLDOWN_MS,
  adoptCoolingDown,
  emptyState,
  readMiniMaxState,
  writeMiniMaxState,
} from "../lib/minimax/state.js";
import { LEGACY_REFERENCE_TAG, createMiniMaxVoiceService, isHertaVoiceId } from "../lib/minimax/voice.js";

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
const OTHER_HER = "herta-b1a43133-olderone";
const NOT_HER = "someone-else-abc123";

const iso = (ms) => new Date(ms).toISOString();

function voiceBody(clones, statusCode = 0, statusMsg = "") {
  return { base_resp: { status_code: statusCode, status_msg: statusMsg }, voice_cloning: clones };
}

function ok(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

/** 造一个注入式服务：状态走闭包，绝不碰 $DSH_HOME。 */
function makeService(opts) {
  const saved = [];
  const logs = [];
  let state = opts.initial ?? emptyState();
  const svc = createMiniMaxVoiceService({
    fetch: opts.fetch,
    key: opts.key ?? (async () => "sk-api-test"),
    planKey: opts.planKey,
    load: () => state,
    save: (next) => {
      state = next;
      saved.push(JSON.parse(JSON.stringify(next)));
    },
    now: opts.now ?? (() => Date.now()),
    hosts: opts.hosts,
    cooldownMs: opts.cooldownMs,
    log: (line) => logs.push(line),
    onChange: opts.onChange,
  });
  return { svc, saved, logs, state: () => state };
}

// ── 1. 认领：过滤掉不属于她的克隆，并在她的里面取最新 ────────────────────────
{
  let calls = 0;
  const clones = [
    { voice_id: OTHER_HER, created_time: "2026-09-01T00:00:00.000Z" },
    { voice_id: NOT_HER, created_time: "2026-09-25T00:00:00.000Z" },
    { voice_id: HER, created_time: "2026-09-12T04:26:02.136Z" },
  ];
  const { svc, saved } = makeService({
    fetch: async () => {
      calls += 1;
      return ok(voiceBody(clones));
    },
  });
  const out = await svc.prepare();
  check("认领结果 phase=ready", out.phase === "ready");
  check("取的是她的、且最新的那个克隆", out.voiceId === HER);
  check("host 是探测到的第一个平台", out.host === MINIMAX_HOSTS[0]);
  check("clonedAt 来自 created_time", out.clonedAt === "2026-09-12T04:26:02.136Z");
  check("adoptedTag 记下按哪个 tag 认领", saved.at(-1)?.adoptedTag === LEGACY_REFERENCE_TAG);
  check("一轮认领只打两次请求（探测 + 列表）", calls === 2);
  check("isHertaVoiceId 认她的 id", isHertaVoiceId(HER) === true);
  check("isHertaVoiceId 不认别人的 id", isHertaVoiceId(NOT_HER) === false);
}

// ── 2. 探测：第一个平台说"这 key 不是我家的"就换下一个 ──────────────────────
{
  const clones = [{ voice_id: HER, created_time: "2026-09-12T04:26:02.136Z" }];
  const seen = [];
  const { svc } = makeService({
    fetch: async (url) => {
      seen.push(url);
      if (url.startsWith("https://api.minimax.io")) {
        return ok(voiceBody([], 2049, "invalid api key"));
      }
      return ok(voiceBody(clones));
    },
  });
  const out = await svc.prepare();
  check("2049 之后换到中国站", out.host === MINIMAX_HOSTS[1]);
  check("两个平台都被试过", seen.length === 3 && seen[2].startsWith(MINIMAX_HOSTS[1]));
}

// ── 3. 账号上没有她的克隆 → no_clone_key，且进冷却（不再重复打网络）─────────
{
  let calls = 0;
  const { svc } = makeService({
    fetch: async () => {
      calls += 1;
      return ok(voiceBody([{ voice_id: NOT_HER, created_time: "2026-09-25T00:00:00.000Z" }]));
    },
  });
  const first = await svc.prepare();
  check("没有可认领的克隆 → failed", first.phase === "failed" && first.lastError === "no_clone_key");
  check("失败给了冷却到期时间", typeof first.retryAt === "string");
  const callsAfterFirst = calls;
  const second = await svc.prepare();
  check("冷却期内不再打网络", calls === callsAfterFirst);
  check("冷却期内仍报同一个失败原因", second.lastError === "no_clone_key");
}

// ── 4. 冷却判定是纯函数，边界可测 ─────────────────────────────────────────
{
  const t0 = Date.parse("2026-09-27T00:00:00.000Z");
  const failed = { version: 1, adoptAttemptAt: iso(t0), adoptFailure: "network" };
  check("9 分钟时仍在冷却", adoptCoolingDown(failed, t0 + 9 * 60_000) === true);
  check("11 分钟时冷却结束", adoptCoolingDown(failed, t0 + 11 * 60_000) === false);
  check("没有失败记录就没有冷却", adoptCoolingDown(emptyState(), t0) === false);
  check("冷却常量是 10 分钟", ADOPT_COOLDOWN_MS === 10 * 60_000);
}

// ── 5. 没填密钥 → no_key，而且**不进冷却**（否则填完还要干等 10 分钟）──────
{
  const { svc, saved } = makeService({ fetch: async () => ok(voiceBody([])), key: async () => null });
  const out = await svc.prepare();
  check("没有密钥 → failed/no_key", out.phase === "failed" && out.lastError === "no_key");
  check("没有密钥不写冷却", out.retryAt === undefined && saved.length === 0);
}

// ── 6. 已经认领过 → 不再打网络 ────────────────────────────────────────────
{
  let calls = 0;
  const initial = {
    version: 1,
    voiceId: HER,
    host: MINIMAX_HOSTS[0],
    clonedAt: "2026-09-12T04:26:02.136Z",
    adoptedTag: LEGACY_REFERENCE_TAG,
  };
  const { svc } = makeService({
    fetch: async () => {
      calls += 1;
      return ok(voiceBody([]));
    },
    initial,
  });
  const out = await svc.prepare();
  check("已有记录时 prepare 直接 ready", out.phase === "ready" && out.voiceId === HER);
  check("已有记录时不打网络", calls === 0);
  check("voice() 给出发声要用的两件东西", svc.voice()?.voiceId === HER && svc.voice()?.host === MINIMAX_HOSTS[0]);
}

// ── 7. 并发 prepare 共享同一次认领 ────────────────────────────────────────
{
  let calls = 0;
  const clones = [{ voice_id: HER, created_time: "2026-09-12T04:26:02.136Z" }];
  const { svc } = makeService({
    fetch: async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return ok(voiceBody(clones));
    },
  });
  const [a, b] = await Promise.all([svc.prepare(), svc.prepare()]);
  check("并发 prepare 都拿到 ready", a.phase === "ready" && b.phase === "ready");
  check("并发 prepare 只打了一轮请求", calls === 2);
}

// ── 8. markMissing：克隆被服务端删掉 → 清记录 + 冷却（等她自己重克隆）──────
{
  const initial = {
    version: 1,
    voiceId: HER,
    host: MINIMAX_HOSTS[0],
    clonedAt: "2026-09-12T04:26:02.136Z",
    adoptedTag: LEGACY_REFERENCE_TAG,
  };
  const { svc, state } = makeService({ fetch: async () => ok(voiceBody([])), initial });
  check("markMissing 之前有声音", svc.voice() !== null);
  svc.markMissing("另一个 id 不算");
  check("id 对不上时 markMissing 是空操作", svc.voice() !== null);
  svc.markMissing(HER);
  const out = svc.readout();
  check("markMissing 之后没有声音（等宿主回落）", svc.voice() === null);
  check("markMissing 记录为 failed/voice_missing", out.phase === "failed" && out.lastError === "voice_missing");
  check("markMissing 写进冷却", typeof out.retryAt === "string");
  check("状态文件里的记录被清掉", state().voiceId === undefined);
}

// ── 9. reset：手动重认领的前半步 ──────────────────────────────────────────
{
  const initial = { version: 1, voiceId: HER, host: MINIMAX_HOSTS[0], adoptedTag: LEGACY_REFERENCE_TAG };
  const { svc } = makeService({ fetch: async () => ok(voiceBody([])), initial });
  const out = svc.reset();
  check("reset 之后没有声音", svc.voice() === null);
  check("reset 之后是 absent（不是 failed）", out.phase === "absent" && out.lastError === undefined);
}

// ── 10. lastUsedAt 节流：10 分钟内只写一次 ────────────────────────────────
{
  let t = Date.parse("2026-09-27T00:00:00.000Z");
  const initial = { version: 1, voiceId: HER, host: MINIMAX_HOSTS[0], adoptedTag: LEGACY_REFERENCE_TAG };
  const { svc, saved } = makeService({ fetch: async () => ok(voiceBody([])), initial, now: () => t });
  svc.stampUsed();
  const afterFirst = saved.length;
  check("首次 stampUsed 落盘", afterFirst === 1 && saved[0].lastUsedAt === iso(t));
  svc.stampUsed();
  check("同一分钟内第二次被节流掉", saved.length === afterFirst);
  t += 11 * 60_000;
  svc.stampUsed();
  check("过了节流窗口后再次落盘", saved.length === afterFirst + 1 && saved.at(-1).lastUsedAt === iso(t));
}

// ── 11. 状态文件：坏文件一律当"没有记录"，绝不抛 ───────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), "herta-minimax-state-"));
  try {
    const missing = join(dir, "nope.json");
    check("文件不存在 → 空状态", readMiniMaxState(missing).voiceId === undefined);

    const garbage = join(dir, "garbage.json");
    writeFileSync(garbage, "{ 这不是 JSON", "utf8");
    check("坏 JSON → 空状态", readMiniMaxState(garbage).voiceId === undefined);

    const half = join(dir, "half.json");
    writeFileSync(half, JSON.stringify({ version: 1, voiceId: HER }), "utf8");
    check("只有 voiceId 没有 host → 不当成可用记录", readMiniMaxState(half).voiceId === undefined);

    const future = join(dir, "future.json");
    writeFileSync(future, JSON.stringify({ version: 99, voiceId: HER, host: MINIMAX_HOSTS[0] }), "utf8");
    check("未来版本号 → 不按当前语义解释", readMiniMaxState(future).voiceId === undefined);

    const round = join(dir, "round.json");
    const wrote = writeMiniMaxState(
      { version: 1, voiceId: HER, host: MINIMAX_HOSTS[0], adoptedTag: LEGACY_REFERENCE_TAG },
      round,
    );
    const back = readMiniMaxState(round);
    check("写读回环一致", wrote === true && back.voiceId === HER && back.host === MINIMAX_HOSTS[0]);
    check("不会留下 .tmp 残留", readMiniMaxState(`${round}.tmp`).voiceId === undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 12. 状态变化回调：宿主靠它推 SSE ─────────────────────────────────────
{
  const seen = [];
  const clones = [{ voice_id: HER, created_time: "2026-09-12T04:26:02.136Z" }];
  const { svc } = makeService({
    fetch: async () => ok(voiceBody(clones)),
    onChange: (out) => seen.push(out.phase),
  });
  await svc.prepare();
  check("认领成功后回调里出现 ready", seen.includes("ready"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
