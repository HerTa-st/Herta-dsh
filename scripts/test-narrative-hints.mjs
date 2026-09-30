/**
 * 叙述语法与提示词资产的测试（`src/host/narrative-hints.js`）。
 *
 * 这一块的正确性**没法靠肉眼在浏览器里验**：围栏解析错一个字符，现象是
 * 「她的话里混进了思考」或者「思考被当成台词发出去」—— 都是很难复现的软故障。
 * 所以逐条钉住。
 *
 * 上游行为的对照点在 `Herta-src/packages/herta/src/narrative/{thought-hint,actor-turn-prompts,actor-hints}.ts`，
 * 本文件里凡涉及上游语义的用例都标了出处。
 *
 * 用法：node scripts/test-narrative-hints.mjs
 */
import {
  BEAT_HINT_PATCH_PREVIEW,
  BEAT_HINT_TOOL_FAIL,
  BEAT_HINT_VERIFICATION_FINISHED,
  BEAT_NO_BANZHUAN_CLAUSE,
  FORCED_SPEECH_OPEN_TAG,
  STOP_SPEECH_CLOSE,
  STOP_THOUGHT_CLOSE,
  SUPERVISOR_RETHINK_TEMPLATE,
  SUPERVISOR_RESPEAK,
  SUPERVISOR_VETO_TEMPLATE,
  THOUGHT_OPEN_TAG,
  buildSupervisorVetoHint,
  formatSelfCorrectionText,
  splitSurfaces,
  splitThoughtFences,
  truncateAtClose,
  thoughtBeforeSpeechTag,
} from "../src/host/narrative-hints.js";

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

console.log("=== 围栏常量（上游 thought-hint.ts:27-30，逐字）===");
ok(FORCED_SPEECH_OPEN_TAG === "（我 说）", "说话开围栏");
ok(STOP_SPEECH_CLOSE === "（/我 说）", "说话闭围栏");
ok(STOP_THOUGHT_CLOSE === "（/我 想）", "思考闭围栏");
ok(THOUGHT_OPEN_TAG === "（我 想）", "思考开围栏");
ok(
  [FORCED_SPEECH_OPEN_TAG, STOP_SPEECH_CLOSE, STOP_THOUGHT_CLOSE, THOUGHT_OPEN_TAG].every((t) =>
    t.includes("（") && t.includes("）"),
  ),
  "四个围栏都用中文全角括号（zh/en 两种语言下都是中文记号）",
);
ok(
  new Set([FORCED_SPEECH_OPEN_TAG, STOP_SPEECH_CLOSE, STOP_THOUGHT_CLOSE, THOUGHT_OPEN_TAG]).size === 4,
  "四个围栏互不相同",
);

console.log("\n=== truncateAtClose ===");
ok(truncateAtClose("abc（/我 说）def", STOP_SPEECH_CLOSE) === "abc", "闭围栏及其后内容被切掉");
ok(truncateAtClose("abc", STOP_SPEECH_CLOSE) === "abc", "没有闭围栏时原样返回");
ok(truncateAtClose("", STOP_SPEECH_CLOSE) === "", "空串安全");

console.log("\n=== thoughtBeforeSpeechTag（上游 actor-turn-prompts.ts:34-40）===");
ok(
  thoughtBeforeSpeechTag("（我 想）他在试探（/我 想）（我 说）嗯。") === "他在试探",
  "取说话围栏之前、剥掉思考围栏",
  JSON.stringify(thoughtBeforeSpeechTag("（我 想）他在试探（/我 想）（我 说）嗯。")),
);
ok(
  thoughtBeforeSpeechTag("（我 想）半句念头（我 说）走了") === "半句念头",
  "她漏了思考闭围栏时也要丢掉说话之后的内容",
);
ok(
  thoughtBeforeSpeechTag("（我 想）A（/我 想）B（我 说）C") === "AB",
  "说话围栏之前的零散文字一并保留（只有围栏被剥）",
);
ok(thoughtBeforeSpeechTag("（我 想）纯粹的念头（/我 想）") === "纯粹的念头", "没有说话围栏时整段都是思考");
ok(thoughtBeforeSpeechTag("（我 想）（/我 想）") === "", "空思考 → 空串（不是围栏本身）");
ok(thoughtBeforeSpeechTag("") === "", "空串安全");

console.log("\n=== buildSupervisorVetoHint ===");
{
  const hint = buildSupervisorVetoHint(SUPERVISOR_VETO_TEMPLATE, "把没发生的事说成发生过了");
  ok(!hint.includes("{{reason}}"), "占位符被替换掉");
  ok(hint.includes("把没发生的事说成发生过了"), "原因进入提示");
  ok(hint.includes("（我 说）"), "重说指令保留说话围栏要求");
}
ok(
  buildSupervisorVetoHint("X{{reason}}Y", "原因。") === "X原因Y",
  "末尾句号被剥掉（否则模板自己的。会变成。。 —— 上游 N7 修复）",
  buildSupervisorVetoHint("X{{reason}}Y", "原因。"),
);
ok(
  buildSupervisorVetoHint("X{{reason}}Y", "原因！！！？") === "X原因Y",
  "中英文句末标点都剥",
  buildSupervisorVetoHint("X{{reason}}Y", "原因！！！？"),
);
ok(
  buildSupervisorVetoHint("X{{reason}}Y", "  留白  ") === "X留白Y",
  "两侧空白被 trim",
);
{
  let threw = false;
  try {
    buildSupervisorVetoHint("没有占位符的模板", "原因");
  } catch (e) {
    threw = e instanceof TypeError;
  }
  ok(threw, "模板缺 {{reason}} 时抛错而不是把花括号塞进她的提示词");
}

console.log("\n=== formatSelfCorrectionText ===");
ok(formatSelfCorrectionText("她记错了。") === "她记错了", "剥句末标点");
ok(formatSelfCorrectionText("真的吗！？") === "真的吗", "中英标点都剥");
ok(formatSelfCorrectionText("  无标点  ") === "无标点", "trim");

console.log("\n=== splitSurfaces：形状 A（有说话围栏）===");
{
  const r = splitSurfaces("（我 想）他在套话。（/我 想）（我 说）我看出来了。");
  ok(r.thought === "他在套话。", "thought 剥掉围栏", JSON.stringify(r.thought));
  ok(r.speech === "我看出来了。", "speech 剥掉围栏", JSON.stringify(r.speech));
  ok(r.hasThought === true && r.hasSpeech === true, "两面都有");
}
{
  const r = splitSurfaces("（我 说）直接开口。（/我 说）");
  ok(r.thought === "", "没有思考段时 thought 为空");
  ok(r.speech === "直接开口。", "speech 正确");
}

console.log("\n=== splitSurfaces：形状 B / C ===");
{
  const r = splitSurfaces("（我 想）只想不说（/我 想）");
  ok(r.thought === "只想不说" && r.speech === "", "只有思考、没有说话");
  ok(r.hasThought === true && r.hasSpeech === false, "标志正确");
}
{
  const r = splitSurfaces("她忘了写围栏，直接说话。");
  ok(r.speech === "她忘了写围栏，直接说话。", "没有围栏时当成说话，不吞内容", JSON.stringify(r.speech));
  ok(r.thought === "", "thought 为空");
  ok(r.hasThought === false && r.hasSpeech === true, "标志正确");
}
ok(splitSurfaces("")?.speech === "" && splitSurfaces("")?.hasSpeech === false, "空串 → 两面皆空");

console.log("\n=== splitThoughtFences：围栏之外的字是说话（2026-09-30 静默事故的根因）===");
{
  // 真事故原样：turn 17 的回话开头是正常发言，后面挂了一段内心话。
  // 修之前 speech 为空 → 客户端一个字都不显示（她说了话，界面上什么都没有）。
  const raw =
    "**A 生效了，而且这次能证明。** 刚写进去的废案——文件第 3 行确实变了。\n（我 想）不过他多半会问一句「什么时候生效」。（/我 想）";
  const r = splitSurfaces(raw);
  ok(r.speech.includes("A 生效了"), "围栏之前的正常发言回到 speech", JSON.stringify(r.speech.slice(0, 30)));
  ok(r.speech.includes("文件第 3 行确实变了"), "围栏之前的整段都留着");
  ok(r.thought === "不过他多半会问一句「什么时候生效」。", "围栏之内才是思考", JSON.stringify(r.thought));
  ok(r.hasSpeech === true && r.hasThought === true, "两面都非空");
  ok(r.speech.includes("（我 想）") === false, "思考记号没漏进说话里");
}
{
  const r = splitSurfaces("（我 想）A（/我 想）围栏之后说的话。");
  ok(r.thought === "A" && r.speech === "围栏之后说的话。", "闭围栏之后回到说话", JSON.stringify(r.speech));
}
{
  const r = splitSurfaces("前半句。（我 想）念头（/我 想）后半句。");
  ok(r.thought === "念头", "围栏内的念头");
  ok(r.speech === "前半句。后半句。", "围栏两侧的说话按原样拼回", JSON.stringify(r.speech));
}
{
  const r = splitSurfaces("（我 想）第一段（/我 想）中段（我 想）第二段（/我 想）");
  ok(r.thought === "第一段\n第二段", "多段思考逐段累加", JSON.stringify(r.thought));
  ok(r.speech === "中段", "夹在两段思考之间的说话留得住", JSON.stringify(r.speech));
}
ok(
  splitSurfaces("（我 想）只想不说（/我 想）").speech === "",
  "【回归】整段都是思考围栏时 speech 仍为空（rethink 阶段就靠这个保持不可见）",
);
ok(
  splitThoughtFences("没有围栏").speech === "没有围栏" && splitThoughtFences("没有围栏").thought === "",
  "找不到围栏 → 全是说话",
);
ok(
  splitThoughtFences("孤立的（/我 想）记号").speech === "孤立的记号",
  "没有开围栏的孤立闭围栏记号只被剥掉记号本身",
);
ok(
  splitThoughtFences("半句（我 想）未闭合").thought === "未闭合" &&
    splitThoughtFences("半句（我 想）未闭合").speech === "半句",
  "开围栏之后没有闭围栏 → 后面整段算思考",
);
ok(splitThoughtFences("")?.speech === "" && splitThoughtFences("")?.thought === "", "空串安全");

console.log("\n=== splitSurfaces：边界（上游为这些踩过坑）===");
{
  // 上游 2026-06-14 的 bug：说话段里再出现（我 想）不能被当成新思考段
  const r = splitSurfaces("（我 说）他说「（我 想）这词真怪」。（/我 说）");
  ok(
    r.speech.includes("（我 想）"),
    "说话段内部出现的思考字面量留在说话里，不被切走",
    JSON.stringify(r.speech),
  );
  ok(r.thought === "", "不会因此凭空造出一段思考");
}
{
  const r = splitSurfaces("（我 想）想法（我 说）话里又说（我 说）第二遍（/我 说）");
  ok(r.thought === "想法", "第一个说话围栏之前才是思考");
  ok(r.speech.includes("第二遍"), "围栏之后的内容整体归说话", JSON.stringify(r.speech));
}
{
  const r = splitSurfaces("（我 想）未闭合的思考");
  ok(r.thought === "未闭合的思考", "闭围栏缺失时仍取到思考内容");
  ok(r.speech === "", "不把思考当说话");
}
{
  const r = splitSurfaces("（我 说）未闭合的说话");
  ok(r.speech === "未闭合的说话", "说话闭围栏缺失时仍取到内容");
}

console.log("\n=== 提示词常量自洽性（每个都以她自己的围栏收口）===");
{
  const beatHints = {
    BEAT_HINT_PATCH_PREVIEW,
    BEAT_HINT_VERIFICATION_FINISHED,
    BEAT_HINT_TOOL_FAIL,
  };
  for (const [name, text] of Object.entries(beatHints)) {
    ok(text.includes(FORCED_SPEECH_OPEN_TAG) && text.includes(STOP_SPEECH_CLOSE), `${name} 要求说话围栏`);
    ok(text.includes(BEAT_NO_BANZHUAN_CLAUSE), `${name} 含「不要写 @板砖」禁令（上游 N9）`);
  }
  ok(SUPERVISOR_VETO_TEMPLATE.includes("{{reason}}"), "veto 模板带占位符");
  ok(SUPERVISOR_RETHINK_TEMPLATE.includes("{{reason}}"), "rethink 模板带占位符");
  ok(SUPERVISOR_RETHINK_TEMPLATE.includes(THOUGHT_OPEN_TAG), "rethink 要求思考围栏（先想）");
  ok(SUPERVISOR_RESPEAK.includes(FORCED_SPEECH_OPEN_TAG), "respeak 要求说话围栏（后说）");
  ok(
    SUPERVISOR_RETHINK_TEMPLATE.includes("盘上不会因此多出一个字"),
    "rethink 保留「动文件的是板砖不是我」这条底线（DSH 下依然成立）",
  );
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
