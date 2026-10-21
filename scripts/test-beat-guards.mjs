/**
 * 分拍三道闸（A/B/C）的测试 —— `beatSkipReason` + 两个事件助手。
 *
 * 起因（2026-10-22 用户反馈）：新对话的第一句永远是「某一步失败了」的点评。
 * 根因是 `decideBeat` 对任何 isError 都触发，而她的开局动作（广域搜索/抓网页）
 * 在第一步就失败 —— 于是那句点评成了她的第一个输出。
 *
 * 三道闸：
 *   B turn === 1        → first-turn
 *   C step <= 1         → first-step
 *   A !spokeInTurn      → not-spoken
 *
 * 用法：node scripts/test-beat-guards.mjs
 */
import { beatSkipReason } from "../src/host/beat-policy.js";
import {
  hasAssistantTextInTurn,
  pickCurrentStepFromEvents,
} from "../src/host/session-surface.js";

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

/** 造一个只有 snapshotEvents 的假会话。 */
const fakeSession = (events) => ({ snapshotEvents: () => events });

const turnStart = (turn) => ({ type: "turn/start", seq: 0, time: 0, data: { turn } });
const stepStart = (step) => ({ type: "step/start", seq: 0, time: 0, data: { step } });
const assistantText = (turn, step, text) => ({
  type: "assistant/message",
  seq: 0,
  time: 0,
  data: { turn, step, message: { role: "assistant", content: [{ type: "text", text }] } },
});
const assistantToolCall = (turn, step) => ({
  type: "assistant/message",
  seq: 0,
  time: 0,
  data: {
    turn,
    step,
    message: { role: "assistant", content: [{ type: "tool-call", id: "c1", name: "grep", arguments: "{}" }] },
  },
});

console.log("=== B：第一轮完全不分拍 ===");
{
  ok(beatSkipReason({ turn: 1, step: 5, spokeInTurn: true }) === "first-turn", "turn 1 即使她已开口也压住");
  ok(beatSkipReason({ turn: 1, step: 1, spokeInTurn: false }) === "first-turn", "turn 1 + 第一步也压住");
}

console.log("=== C：第一步的失败不点评 ===");
{
  ok(beatSkipReason({ turn: 2, step: 1, spokeInTurn: true }) === "first-step", "turn 2 · step 1 压住");
  ok(beatSkipReason({ turn: 2, step: 0, spokeInTurn: true }) === "first-step", "step 0 也算第一步");
}

console.log("=== A：这一轮还没开口就不点评 ===");
{
  ok(beatSkipReason({ turn: 2, step: 3, spokeInTurn: false }) === "not-spoken", "没开过口 → 压住");
  ok(beatSkipReason({ turn: 2, step: 3, spokeInTurn: true }) === null, "开了口 + 非第一步 → 放行");
}

console.log("=== 边界：读不到 turn/step 时的取向 ===");
{
  ok(beatSkipReason({ turn: null, step: null, spokeInTurn: true }) === null, "turn/step 取不到但开过口 → 放行（不误伤）");
  ok(beatSkipReason({ turn: 3, step: null, spokeInTurn: true }) === null, "step 取不到 → 跳过 C 闸，不误伤");
  ok(beatSkipReason({ turn: 3, step: 2, spokeInTurn: undefined }) === "not-spoken", "spokeInTurn 缺失按“没开口”处理");
}

console.log("=== hasAssistantTextInTurn：只认文本块 ===");
{
  const s1 = fakeSession([turnStart(1), assistantText(1, 1, "先说结论：")]);
  ok(hasAssistantTextInTurn(s1, 1) === true, "有文本块 → true");

  const s2 = fakeSession([turnStart(1), assistantToolCall(1, 1)]);
  ok(hasAssistantTextInTurn(s2, 1) === false, "只有 tool-call 不算说话");

  const s3 = fakeSession([turnStart(1), assistantText(1, 1, "上一轮的话"), turnStart(2), assistantToolCall(2, 1)]);
  ok(hasAssistantTextInTurn(s3, 2) === false, "上一轮的话不算这一轮");

  const s4 = fakeSession([turnStart(2), assistantText(2, 2, "这一轮的")]);
  ok(hasAssistantTextInTurn(s4, 2) === true, "本轮文本块 → true");

  ok(hasAssistantTextInTurn(fakeSession([]), 1) === false, "空事件 → false");
  ok(hasAssistantTextInTurn({}, 1) === false, "没有 snapshotEvents → false");
  ok(hasAssistantTextInTurn(s1, null) === false, "turn 为 null → false");
}

console.log("=== pickCurrentStepFromEvents ===");
{
  ok(pickCurrentStepFromEvents(fakeSession([stepStart(1), stepStart(2), stepStart(3)])) === 3, "取最近的 step");
  ok(pickCurrentStepFromEvents(fakeSession([])) === null, "空事件 → null");
  ok(pickCurrentStepFromEvents({}) === null, "没有 snapshotEvents → null");
}

console.log("\n=== 结果：" + pass + " 通过 / " + fail + " 失败 ===");
process.exit(fail === 0 ? 0 : 1);
