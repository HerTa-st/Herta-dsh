/**
 * 会话表面提取的测试（`src/host/session-surface.js`）。
 *
 * 这两件事的边界情况在 lab 里几乎没法构造（要造出「工具结果排在她说的话后面」
 * 「表面为空」「事件 seq 缺失」这些局面），但在测试里都是几行数据。而它们判错的
 * 后果很实在 —— 拿工具输出当她的台词送去做复核。
 *
 * 用法：node scripts/test-session-surface.mjs
 */
import { isSubagentAgent, pickCandidate, pickCurrentTurn, pickRecent } from "../src/host/session-surface.js";

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${label}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
  }
};

/** 造一个事件表 + eventAt。 */
function makeWorld(events) {
  const table = new Map();
  for (const e of events) table.set(e.seq, e);
  return {
    nodes: events.map((e) => e.seq),
    eventAt: (seq) => table.get(seq),
    events,
  };
}

const user = (seq, text) => ({
  seq,
  type: "user/message",
  data: { message: { role: "user", content: [{ type: "text", text }] } },
});
const herta = (seq, text) => ({
  seq,
  type: "assistant/message",
  data: { message: { role: "assistant", content: [{ type: "text", text }] } },
});
const toolResult = (seq, text) => ({
  seq,
  type: "tool/result",
  data: { message: { role: "user", content: [{ type: "text", text }] } },
});

console.log("=== pickCandidate ===");
{
  const w = makeWorld([user(1, "记一下：明天有事"), herta(2, "记下了。")]);
  const c = pickCandidate({ nodes: w.nodes, eventAt: w.eventAt });
  ok(c?.text === "记下了。", "找到最后一条 assistant 回话", JSON.stringify(c));
  ok(c?.seq === 2, "带上 seq（用于取上下文与记账）");
}
{
  // 关键边界：工具结果排在她的话后面
  const w = makeWorld([
    user(1, "跑一下测试"),
    herta(2, "行。"),
    toolResult(3, "3 passed"),
  ]);
  const c = pickCandidate({ nodes: w.nodes, eventAt: w.eventAt });
  ok(c?.text === "行。", "跳过排在后面的工具结果，取的是她说的话", JSON.stringify(c));
  ok(c?.seq === 2, "而且 seq 指向她的话，不是工具结果");
}
{
  const w = makeWorld([user(1, "在吗"), user(2, "还在吗")]);
  ok(pickCandidate({ nodes: w.nodes, eventAt: w.eventAt }) === null, "表面里没有 assistant 回话 → null");
}
ok(pickCandidate({ nodes: [], eventAt: () => undefined }) === null, "空表面 → null");
ok(pickCandidate({ nodes: null, eventAt: () => undefined }) === null, "nodes 为 null → null");
{
  // 事件缺失（表面引用了不存在的 seq）
  const w = makeWorld([user(1, "在吗"), herta(2, "在。")]);
  const c = pickCandidate({ nodes: [1, 2, 99], eventAt: w.eventAt });
  ok(c?.text === "在。", "表面里有失效 seq 时仍能取到（跳过它）");
}
{
  // 多段文本块
  const e = {
    seq: 5,
    type: "assistant/message",
    data: { message: { content: [{ type: "text", text: "第一句" }, { type: "text", text: "第二句" }] } },
  };
  const c = pickCandidate({ nodes: [5], eventAt: () => e });
  ok(c?.text === "第一句\n第二句", "多个文本块用换行连接", JSON.stringify(c?.text));
}
{
  // 只有 reasoning 不算回话（她的内心不是台词）
  const e = {
    seq: 6,
    type: "assistant/message",
    data: { message: { content: [{ type: "reasoning", text: "心里想想" }] } },
  };
  ok(pickCandidate({ nodes: [6], eventAt: () => e }) === null, "只有 reasoning 的消息不算候选回话");
}
{
  // deriveMessage 优先
  const e = { seq: 7, type: "assistant/message", data: { message: { content: [{ type: "text", text: "原始" }] } } };
  const c = pickCandidate({
    nodes: [7],
    eventAt: () => e,
    deriveMessage: () => ({ content: [{ type: "text", text: "派生后" }] }),
  });
  ok(c?.text === "派生后", "优先用 session.deriveEventMessage 的结果（它管内容重写）");
}
{
  // deriveMessage 抛错要退回
  const e = { seq: 8, type: "assistant/message", data: { message: { content: [{ type: "text", text: "兜底" }] } } };
  const c = pickCandidate({
    nodes: [8],
    eventAt: () => e,
    deriveMessage: () => {
      throw new Error("boom");
    },
  });
  ok(c?.text === "兜底", "deriveMessage 抛错时退回直接读事件");
}
{
  // eventAt 抛错要跳过
  const w = makeWorld([herta(1, "你好。")]);
  const c = pickCandidate({
    nodes: [99, 1],
    eventAt: (seq) => {
      if (seq === 99) throw new Error("boom");
      return w.eventAt(seq);
    },
  });
  ok(c?.text === "你好。", "eventAt 抛错时跳过该 seq 继续往前");
}

console.log("\n=== pickRecent ===");
{
  const w = makeWorld([
    user(1, "记一下：明天有事"),
    herta(2, "记下了。"),
    user(3, "那你明天忙吗"),
  ]);
  const recent = pickRecent({ nodes: w.nodes, eventAt: w.eventAt, beforeSeq: 3 });
  ok(recent.includes("开拓者：记一下：明天有事"), "角色标注为「开拓者」", JSON.stringify(recent));
  ok(recent.includes("黑塔：记下了。"), "角色标注为「黑塔」");
  ok(!recent.includes("那你明天忙吗"), "beforeSeq 之后的内容不进摘要");
  ok(recent.indexOf("开拓者：记一下") < recent.indexOf("黑塔：记下了"), "按时间正序拼接");
}
{
  const w = makeWorld([toolResult(1, "3 passed"), user(2, "好"), herta(3, "嗯。")]);
  const recent = pickRecent({ nodes: w.nodes, eventAt: w.eventAt, beforeSeq: 99 });
  ok(!recent.includes("3 passed"), "工具结果不进摘要（只取 user/assistant 消息）");
}
{
  const many = [];
  for (let i = 1; i <= 20; i += 1) many.push(user(i, `第${i}条`));
  const w = makeWorld(many);
  const recent = pickRecent({ nodes: w.nodes, eventAt: w.eventAt, beforeSeq: 99, maxMessages: 3 });
  const count = recent.split("\n").length;
  ok(count === 3, "maxMessages 限制条数", String(count));
  ok(recent.includes("第20条"), "取的是最近的几条");
}
{
  const w = makeWorld([user(1, "x".repeat(500)), user(2, "y".repeat(500))]);
  const recent = pickRecent({ nodes: w.nodes, eventAt: w.eventAt, beforeSeq: 99, maxChars: 100 });
  ok(recent.length <= 100, "maxChars 截断", String(recent.length));
}
ok(pickRecent({ nodes: [], eventAt: () => undefined }) === "", "空表面 → 空串");
ok(pickRecent({}) === "", "无参数安全");
ok(pickRecent({ nodes: [1], eventAt: () => undefined }) === "", "事件取不到 → 空串");

console.log("\n=== pickCurrentTurn ===");
{
  const w = makeWorld([{ seq: 1, type: "turn/start", data: { turn: 1 } }, user(2, "问"), herta(3, "答")]);
  ok(pickCurrentTurn({ nodes: w.nodes, eventAt: w.eventAt }) === 1, "找到当前 turn 号");
}
{
  const w = makeWorld([
    { seq: 1, type: "turn/start", data: { turn: 1 } },
    herta(2, "第一轮"),
    { seq: 3, type: "turn/start", data: { turn: 2 } },
    herta(4, "第二轮"),
  ]);
  ok(pickCurrentTurn({ nodes: w.nodes, eventAt: w.eventAt }) === 2, "取最近的那个 turn（不是第一个）");
}
{
  const w = makeWorld([user(1, "还没开始")]);
  ok(pickCurrentTurn({ nodes: w.nodes, eventAt: w.eventAt }) === null, "表面里没有 turn/start → null");
}
ok(pickCurrentTurn({ nodes: [], eventAt: () => undefined }) === null, "空表面 → null");
ok(pickCurrentTurn({ nodes: null, eventAt: () => undefined }) === null, "nodes 为 null → null");
{
  const w = makeWorld([{ seq: 1, type: "turn/start", data: {} }]);
  ok(pickCurrentTurn({ nodes: w.nodes, eventAt: w.eventAt }) === null, "data 里没有 turn → null（不猜）");
}
{
  const w = makeWorld([{ seq: 1, type: "turn/start", data: { turn: "3" } }]);
  ok(pickCurrentTurn({ nodes: w.nodes, eventAt: w.eventAt }) === null, "turn 是字符串 → null（不隐式转型）");
}
{
  const w = makeWorld([{ seq: 5, type: "turn/start", data: { turn: 7 } }]);
  const got = pickCurrentTurn({
    nodes: [99, 5],
    eventAt: (seq) => {
      if (seq === 99) throw new Error("boom");
      return w.eventAt(seq);
    },
  });
  ok(got === 7, "eventAt 抛错时跳过该 seq 继续往前");
}

console.log("\n=== isSubagentAgent：叙述层该对谁说话（2026-09-30 实测形状）===");
{
  // 本机实测：子代理的会话头是 { parentSession, origin: "subagent", delegationDepth: 1 }
  const sub = { session: { header: { id: "x", parentSession: "p", origin: "subagent", delegationDepth: 1, agentPreset: "herta" } } };
  ok(isSubagentAgent(sub) === true, "origin=subagent → 是子代理");
  ok(
    isSubagentAgent({ session: { header: { origin: "subagent" } } }) === true,
    "只凭 origin 也认得（delegationDepth 缺失）",
  );
  ok(
    isSubagentAgent({ session: { header: { delegationDepth: 1 } } }) === true,
    "只凭 delegationDepth>0 也认得（origin 缺失的老格式）",
  );
  const host = { session: { header: { id: "x", isSeeded: false, delegationDepth: 0, agentPreset: "herta" } } };
  ok(isSubagentAgent(host) === false, "人机会话（delegationDepth 0、无 origin）→ 不是子代理");
  ok(isSubagentAgent({ session: { header: {} } }) === false, "两个字段都读不到 → 当人机（默认服务她）");
  ok(isSubagentAgent({ session: {} }) === false, "没有 header → false");
  ok(isSubagentAgent({}) === false, "空 agent → false");
  ok(isSubagentAgent(null) === false, "null → false");
  ok(isSubagentAgent(undefined) === false, "undefined → false");
  ok(
    isSubagentAgent({ session: { header: { origin: "main", delegationDepth: 0 } } }) === false,
    "显式 origin=main → false",
  );
  ok(
    isSubagentAgent({ session: { header: { delegationDepth: "1" } } }) === false,
    "delegationDepth 是字符串 → 不认（不隐式转型）",
  );
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
