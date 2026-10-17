/**
 * 映射逻辑的测试（`src/shared/mapping.js`）。
 *
 * 这一块之前埋在客户端里、**只能靠浏览器验证**；抽成纯函数后可以在 Node 里
 * 直接跑，覆盖那些浏览器里很难构造的情况（11 种节点各来一份）。
 *
 * 用法：node scripts/test-mapping.mjs
 */
import { isoOf, textOf, toBubbles } from "../src/shared/mapping.js";

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

const AT = 1_789_000_000_000;

console.log("=== 取文本 ===");
ok(textOf([{ type: "text", text: "甲" }, { type: "text", text: "乙" }]) === "甲\n乙", "多个文本块用换行连接");
ok(textOf([{ type: "image", attachment: {} }]) === "", "纯图片块取不到文本");
ok(textOf(undefined) === "" && textOf(null) === "", "非数组安全返回空串");
ok(textOf([{ type: "text" }, { type: "text", text: 5 }]) === "", "缺 text 或 text 非字符串都被跳过");

console.log("\n=== 时间戳 ===");
ok(isoOf(AT)?.startsWith("2026-") === true, "数字 → ISO", String(isoOf(AT)));
ok(isoOf(undefined) === undefined && isoOf("x") === undefined, "非数字 → undefined（她的气泡会隐藏时间而不是伪造）");

console.log("\n=== 节点 → 气泡 ===");
{
  const r = toBubbles([
    { kind: "user", seq: 1, time: AT, content: [{ type: "text", text: "你好" }] },
    { kind: "steering", seq: 2, time: AT, content: [{ type: "text", text: "插一句" }] },
    {
      kind: "assistant",
      seq: 3,
      time: AT,
      blocks: [
        { kind: "reasoning", text: "想一想" },
        { kind: "text", text: "她说的话" },
      ],
    },
    { kind: "assistant", seq: 4, time: AT, blocks: [{ kind: "reasoning", text: "只有思考" }] },
    { kind: "application", seq: 5, time: AT },
  ]);
  ok(r.bubbles.length === 3, "user / steering / assistant 各出一个气泡", `实际 ${r.bubbles.length}`);
  ok(r.bubbles[0].role === "user" && r.bubbles[2].role === "herta", "角色正确");
  ok(r.bubbles[2].text === "她说的话", "只取 text 块，丢掉 reasoning", r.bubbles[2].text);
  ok(r.dropped.total === 2, "只有 reasoning 的那条与未知节点计入 dropped", String(r.dropped.total));
  ok(r.dropped.kinds.includes("application"), "未知节点如实记下 kind");
  ok(typeof r.bubbles[0].at === "string", "带上 ISO 时间");
  ok(r.voiceCues.length === 0, "没有发声工具结果时不产出 cue");
}

console.log("\n=== herta_speak 的 cue 抽取 ===");
{
  const r = toBubbles([
    {
      kind: "tool-result",
      seq: 42,
      time: AT,
      call: { name: "herta_speak" },
      meta: { hertaVoice: { url: "/herta-voice/particle/%E5%97%AF/01.opus", clip: "particle/嗯/01.opus", category: "particle" } },
    },
    { kind: "tool-result", seq: 43, time: AT, call: { name: "read" }, meta: {} },
    { kind: "tool-result", seq: 44, time: AT, call: { name: "herta_speak" } },
  ]);
  ok(r.voiceCues.length === 1, "只有带 hertaVoice 的工具结果产出 cue", String(r.voiceCues.length));
  ok(r.voiceCues[0].seq === 42, "cue 记下 seq（客户端按它去重）");
  ok(r.voiceCues[0].url.includes("/herta-voice/"), "cue 带上可直接播放的 URL");
  ok(r.dropped.total === 3, "工具结果仍如实计入 dropped（它们不成气泡）", String(r.dropped.total));
}

console.log("\n=== 思考围栏必须被剥掉（2026-09-19 用户报的真 bug）===");
{
  // 她按原版语法把内心话写在 （我 想） 里、发言写在 （我 说） 里。
  // 不剥的话整段思考会被当成她的发言显示出来 —— 实际发生过。
  const r = toBubbles([
    {
      kind: "assistant",
      seq: 1,
      time: AT,
      blocks: [{ kind: "text", text: "（我 想）内心话（/我 想）（我 说）说出口的。（/我 说）" }],
    },
  ]);
  ok(r.bubbles.length === 1, "一条气泡");
  ok(r.bubbles[0].text === "说出口的。", "只保留说话部分", JSON.stringify(r.bubbles[0].text));
  ok(!r.bubbles[0].text.includes("内心话"), "思考内容没有进气泡");
}
{
  // 她没写围栏时（早期对话 / 没按语法来）→ 整段当说话，不吞内容
  const r = toBubbles([
    { kind: "assistant", seq: 1, time: AT, blocks: [{ kind: "text", text: "没写围栏的一句话。" }] },
  ]);
  ok(r.bubbles.length === 1 && r.bubbles[0].text === "没写围栏的一句话。", "没有围栏时整段都是说话（不吞内容）");
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
