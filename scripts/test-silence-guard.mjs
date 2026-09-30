/**
 * 空轮护栏的测试（`src/host/silence-guard.js`）。
 *
 * 这一块的正确性同样没法靠肉眼在浏览器里验：判错的方向有两个，都很难现场复现 ——
 *   · 漏判（该提醒没提醒）→ 又变成一次「她突然不理我」，而这正是要治的病
 *   · 误判（不该提醒乱提醒）→ 正常的干活节奏里不断冒出通知
 * 所以逐条钉住：判据、配额、两种「看不见」的成因。
 *
 * 事件的 mock **照抄 `dsh-session` 的类型定义**（`assistant/message` 的 payload 在
 * `data`，消息在 `data.message`），不凭印象造 —— `session-surface.js` 的文件头
 * 记着上一次「测试和代码同错所以全绿」的教训。
 *
 * 用法：node scripts/test-silence-guard.mjs
 */
import {
  MAX_SILENCE_NOTICES_PER_TURN,
  SilenceBudget,
  buildSilentTurnNotice,
  inspectTurnActivity,
} from "../src/host/silence-guard.js";

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

/** 造一条 `assistant/message` 事件（形状照抄类型定义）。 */
const assistant = (turn, content, step = 1) => ({
  type: "assistant/message",
  seq: turn * 10 + step,
  time: 0,
  data: { turn, step, message: { role: "assistant", content } },
});

const text = (t) => ({ type: "text", text: t });
const reasoning = (t) => ({ type: "reasoning", text: t });
const toolCall = (name) => ({ type: "tool-call", id: "c1", name, arguments: "{}" });

console.log("=== inspectTurnActivity：这一轮用户看得见什么 ===");
{
  // 事故的原样：只有思考块（模型把回话整个写进了思考通道）。
  const events = [assistant(70, [reasoning("用户说：还在吗。动手。**（做。）** 在。")])];
  const r = inspectTurnActivity(events, 70);
  ok(r.found === true, "认得出这一轮有助手消息");
  ok(r.hasText === false, "没有 text 块");
  ok(r.silent === true, "判定为空轮", JSON.stringify(r.reason));
  ok(r.reason === "reasoning-only", "成因记作 reasoning-only");
}
{
  const events = [assistant(5, [reasoning("想一下"), text("（我 说）在。（/我 说）")])];
  const r = inspectTurnActivity(events, 5);
  ok(r.silent === false, "有正文 → 不是空轮");
  ok(r.visibleSpeech.includes("在。"), "可见正文取到了 speech 那一面", JSON.stringify(r.visibleSpeech));
}
{
  const events = [assistant(6, [reasoning("想一下"), toolCall("pwsh")])];
  const r = inspectTurnActivity(events, 6);
  ok(r.silent === false, "只调工具不说话不算空轮（结果卡片在界面上有痕迹）");
  ok(r.hasToolCall === true, "工具调用被记下");
}
{
  // 第二类静默：有 text 块，但整块都是思考围栏 —— 客户端会把它剥成空。
  const events = [assistant(8, [text("（我 想）复核说我宣称了记录里没有的事。（/我 想）")])];
  const r = inspectTurnActivity(events, 8);
  ok(r.hasText === true, "text 块确实存在");
  ok(r.visibleSpeech === "", "但 speech 为空 → 界面上仍然什么都没有");
  ok(r.silent === true && r.reason === "thought-only", "判成空轮，成因记作 thought-only", JSON.stringify(r.reason));
}
{
  // 混着的：一句正常发言 + 一段内心话 → 可见（修复后的 splitSurfaces 行为）。
  const events = [
    assistant(9, [text("A 生效了。\n（我 想）他多半会追问。（/我 想）")]),
  ];
  const r = inspectTurnActivity(events, 9);
  ok(r.silent === false, "围栏之外的正常发言算可见");
  ok(r.visibleSpeech === "A 生效了。", "speech 只剩围栏外的部分", JSON.stringify(r.visibleSpeech));
  ok(r.thoughtChars > 0, "思考字数单独记着");
}
{
  const events = [assistant(3, [text("这一轮的话"), text("第二块")])];
  const r = inspectTurnActivity(events, 3);
  ok(r.visibleSpeech.includes("这一轮的话") && r.visibleSpeech.includes("第二块"), "多块正文都算");
}
{
  const events = [assistant(11, [text("（我 说）空围栏（/我 说）")]), assistant(11, [reasoning("第二步只想了下")], 2)];
  const r = inspectTurnActivity(events, 11);
  ok(r.silent === false, "同一轮里任一 step 有正文就够（不是只查最后一步）");
}

console.log("\n=== inspectTurnActivity：判不了就别乱提醒 ===");
{
  const r = inspectTurnActivity([], 12);
  ok(r.found === false && r.silent === false, "没有助手消息 → 不判空轮");
  ok(r.reason === "no-assistant-message", "给出 no-assistant-message");
}
{
  const r = inspectTurnActivity(null, 12);
  ok(r.reason === "no-events" && r.silent === false, "事件数组取不到时安全返回");
}
{
  const events = [assistant(20, [reasoning("只在别的轮里")])];
  const r = inspectTurnActivity(events, 21);
  ok(r.found === false, "只清点指定 turn，不认别人轮里的消息");
}
{
  const events = [assistant(30, [text("   ")])];
  const r = inspectTurnActivity(events, 30);
  ok(r.hasText === false, "空白 text 块不算正文");
  ok(r.silent === true, "全空 → 空轮");
}

console.log("\n=== buildSilentTurnNotice：通知既给人看、也给她下指令 ===");
{
  const notice = buildSilentTurnNotice({ turn: 70, attempt: 1 });
  ok(notice.includes("第 70 轮"), "报出轮号（用户要知道是哪一轮）", notice.slice(0, 40));
  ok(notice.includes("空轮"), "带得出「空轮」这个记号");
  ok(notice.includes("（我 说）") && notice.includes("（/我 说）"), "重说指令要求说话围栏");
  ok(notice.includes("这一条不是开拓者说的"), "说清这不是用户发言（同 steer 的 user 角色）");
  ok(notice.includes("开一个新会话") === false, "第一次提醒不劝人换会话");
  const second = buildSilentTurnNotice({ turn: 70, attempt: 2 });
  ok(second.includes("开一个新会话"), "第二次提醒才给出「换个会话」这句给人看的话");
  ok(buildSilentTurnNotice({ turn: 1 }).includes("第 1 轮"), "缺 attempt 时按第一次算");
  ok(buildSilentTurnNotice()?.length > 0, "什么参数都不给也不炸");
}

console.log("\n=== SilenceBudget：每个 turn 的硬闸 ===");
{
  const b = new SilenceBudget();
  ok(b.max === MAX_SILENCE_NOTICES_PER_TURN, "默认上限来自常量");
  ok(b.canNotice(1) === true, "第一次可以提醒");
  ok(b.record(1) === 1, "记账返回累计次数");
  ok(b.canNotice(1) === true, "第二次仍可以");
  b.record(1);
  ok(b.canNotice(1) === false, "到顶后不再提醒（steer 会让 turn 继续，必须停下来）");
  ok(b.canNotice(2) === true, "配额按 turn 独立");
  ok(b.canNotice("x") === false, "turn 号不是数字时不放行");
  b.clear();
  ok(b.canNotice(1) === true, "clear 之后重新开始");
}
{
  const b = new SilenceBudget(1, 2);
  b.record(1);
  b.record(2);
  b.record(3);
  ok(b.used.size === 2, "只保留最近 keepTurns 个 turn 的账", String(b.used.size));
  ok(b.used.has(1) === false, "最旧的账被清掉");
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
