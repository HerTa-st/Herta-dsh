/**
 * A：中转站拿不到克隆列表时，按作者那个克隆的**已知 id** 落地（2026-10-17）。
 *
 * 为什么要测：中转站的形状 `supportsVoiceList = false`，认领时永远拿不到候选 ——
 * 以前这里直接 `fail("no_clone_key")`，于是中转站用户永远接不上、还得自己去填音色 id。
 * 现在改成先按 `KNOWN_DEFAULT_VOICE_ID` 试一次（透明转发的中转站上它是有效的）。
 *
 * 这条测试**完全离线**：钉住地址省掉探测、形状由我们指定、fetch 一旦被调用就算失败。
 * 跑法：node scripts/test-minimax-relay-voice.mjs
 */
import {
  KNOWN_DEFAULT_VOICE_ID,
  LEGACY_REFERENCE_TAG,
  createMiniMaxVoiceService,
} from "../lib/minimax/voice.js";
import { endpointShapeOf } from "../lib/minimax/endpoint.js";

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    fail++;
    console.log("  ✗ " + label + (detail ? "  —— " + detail : ""));
  }
};

const RELAY_HOST = "https://relay.example.test";

console.log("=== 中转站：不能列克隆 → 按已知 id 落地 ===");
{
  const saved = [];
  let fetched = 0;
  const svc = createMiniMaxVoiceService({
    fetch: async () => {
      fetched++;
      throw new Error("不该发请求：钉住地址 + relay 形状，认领不需要网络");
    },
    key: async () => "sk-test",
    shape: () => endpointShapeOf("relay"),
    pin: () => ({ baseUrl: RELAY_HOST }),
    load: () => ({ version: 1 }),
    save: (state) => saved.push(state),
    now: () => 1_700_000_000_000,
    log: () => {},
  });

  const readout = await svc.prepare();
  ok(saved.length === 1, "认领之后落了一条状态", "实际 " + saved.length + " 条");
  ok(saved[0]?.voiceId === KNOWN_DEFAULT_VOICE_ID, "落的是作者那个克隆的已知 id", "实得 " + JSON.stringify(saved[0]?.voiceId));
  ok(saved[0]?.host === RELAY_HOST, "host 记的是用户钉的中转站地址", "实得 " + JSON.stringify(saved[0]?.host));
  ok(saved[0]?.adoptedTag === LEGACY_REFERENCE_TAG, "adoptedTag 仍是那个标记（日志/状态里分得清来历）");
  ok(saved[0]?.adoptFailure === undefined, "不留下失败标记（以前这里会是 no_clone_key）");
  ok(fetched === 0, "全程没有发网络请求", "实际 " + fetched + " 次");
  ok(readout?.voiceId === KNOWN_DEFAULT_VOICE_ID, "readout 里也已经是这条音色", JSON.stringify(readout));
}

console.log("=== 官方形状：列不到克隆时**仍然**是终局失败（不瞎猜）===");
{
  const saved = [];
  const svc = createMiniMaxVoiceService({
    // 官方形状会列克隆：给它一个"列表为空"的应答
    fetch: async () =>
      new Response(JSON.stringify({ voice_clones: [], base_resp: { status_code: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    key: async () => "sk-test",
    shape: () => endpointShapeOf("official"),
    pin: () => ({ baseUrl: "https://api.minimaxi.com" }),
    load: () => ({ version: 1 }),
    save: (state) => saved.push(state),
    now: () => 1_700_000_000_000,
    log: () => {},
  });
  const readout = await svc.prepare();
  const failed = saved.some((s) => s.adoptFailure === "no_clone_key") || readout?.adoptFailure === "no_clone_key";
  ok(failed, "官方形状上仍报 no_clone_key（那是真的被删了）", JSON.stringify(saved.slice(-1)) + " / " + JSON.stringify(readout));
  ok(!saved.some((s) => s.voiceId === KNOWN_DEFAULT_VOICE_ID), "官方形状不会把已知 id 硬塞进去");
}

console.log("\n=== 结果：" + pass + " 通过 / " + fail + " 失败 ===");
process.exit(fail === 0 ? 0 : 1);
