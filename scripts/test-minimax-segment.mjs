/**
 * `segment.ts` 的单测 —— 逐条覆盖上游 speakable-text.ts 的语义：
 *   1. 保留标点（码点切片 + 收尾括号吸入）
 *   2. 前缀稳定
 *   3. HARD_END：CJK 无条件断句；ASCII 的 . ! ? 要后跟空白/输入结束
 *   4. CLAUSE_END / TRAILING_CLOSER 两套集合
 *   5. 短句向后合并 / >48 在从句标点处切 / 无标点超长串在 80 处回退
 *   6. 行内反引号内的标点不算断句；未闭合跨度等更多输入
 *   7. 中文会话里含拉丁字母的句子 → 静音单元且不与邻句合并
 *   8. finished 如何影响收尾
 * 外加边界：空输入、只有标点、极短输入、纯中文长串、中英混排、超长无标点串、
 * 未闭合围栏跨越两次喂入；以及内联进来的 stripDisplayUnsafe。
 *
 * 从**编译产物**导入：先跑 `node scripts/build-minimax.mjs`。
 */
import {
  HARD_MAX_UNIT_CHARS,
  MIN_UNIT_CHARS,
  SOFT_MAX_UNIT_CHARS,
  isSpeakableCode,
  segmentSpeechUnits,
  stripDisplayUnsafe,
  toSpeakableText,
} from "../lib/minimax/segment.js";

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}${detail === "" ? "" : ` — ${detail}`}`);
  }
}

/** 按码点切开（与 segmentSpeechUnits 的索引约定一致）。 */
const cps = (text) => [...text];
function seg(text, finished, lang) {
  return segmentSpeechUnits(cps(text), finished, lang);
}
/** 单元覆盖的原文片段 —— 必须与原文逐码点相同。 */
function sliceOf(text, u) {
  return cps(text).slice(u.start, u.end).join("");
}
function show(units) {
  return JSON.stringify(units);
}
function sameUnit(a, b) {
  return (
    a !== undefined && b !== undefined &&
    a.start === b.start && a.end === b.end && a.speak === b.speak
  );
}
function checkOrder(label, text, units) {
  const ok = units.every(
    (u, i) =>
      u.start < u.end &&
      u.start >= 0 &&
      u.end <= cps(text).length &&
      (i === 0 || units[i - 1].end <= u.start),
  );
  check(`${label}：单元有序、非空、不重叠`, ok, show(units));
}

console.log("minimax-segment");

// ── 0. 常量 ────────────────────────────────────────────────────────────────
{
  check("MIN_UNIT_CHARS = 10", MIN_UNIT_CHARS === 10, String(MIN_UNIT_CHARS));
  check("SOFT_MAX_UNIT_CHARS = 48", SOFT_MAX_UNIT_CHARS === 48, String(SOFT_MAX_UNIT_CHARS));
  check("HARD_MAX_UNIT_CHARS = 80", HARD_MAX_UNIT_CHARS === 80, String(HARD_MAX_UNIT_CHARS));
}

// ── 1. 边界：空输入 / 只有空白 / 只有标点 / 极短 ─────────────────────────
{
  check("空输入 + finished", show(seg("", true)) === "[]", show(seg("", true)));
  check("空输入 + 未 finished", show(seg("", false)) === "[]", show(seg("", false)));

  const blank = seg("   ", true);
  check("只有空白：一个静音单元", blank.length === 1 && blank[0].speak === "" && blank[0].end === 3, show(blank));

  const punct = seg("。。。！？", true);
  check(
    "只有标点：合成一个静音单元（剥完无可发声内容）",
    punct.length === 1 && punct[0].start === 0 && punct[0].end === 5 && punct[0].speak === "",
    show(punct),
  );

  const tiny = seg("嗨。", true);
  check("极短输入：finished 时最后一句照样闭合", tiny.length === 1 && sameUnit(tiny[0], { start: 0, end: 2, speak: "嗨。" }), show(tiny));
  check("极短输入：未 finished 时不闭合", seg("嗨。", false).length === 0, show(seg("嗨。", false)));
}

// ── 2. 规则 1：保留标点（原文码点切片；句末符 + 收尾括号一起吸入）────────
{
  const text = "这是一句足够长的话。」下一句也更长啊。";
  const u = seg(text, true);
  checkOrder("收尾括号", text, u);
  check("保留标点：两个单元", u.length === 2, show(u));
  check(
    "保留标点：单元 1 是原文切片，止于 」 之后",
    sliceOf(text, u[0]) === "这是一句足够长的话。」" && u[0].end === 11,
    JSON.stringify(sliceOf(text, u[0])),
  );
  check("保留标点：发声文本剥掉 」 但留下 。", u[0].speak === "这是一句足够长的话。", u[0].speak);
  check("保留标点：单元 2", sameUnit(u[1], { start: 11, end: 19, speak: "下一句也更长啊。" }), show(u));

  const text2 = "这是一个很长的句子。）后面这句也够长了。";
  const u2 = seg(text2, true);
  check(
    "保留标点：） 同样被吸入（end = 11）",
    u2.length === 2 && u2[0].end === 11 && sliceOf(text2, u2[0]) === "这是一个很长的句子。）",
    show(u2),
  );
}

// ── 3. 规则 2：前缀稳定（已闭合的单元不随更多输入而变）──────────────────
{
  const p = "第一句够长了啊。第二句也够长啊。";
  const a = seg(p, true);
  const b = seg(p + "第三句也更长啊。", true);
  check("前缀稳定：前缀自身产出 1 个单元", a.length === 1, show(a));
  check("前缀稳定：加料后第一个单元逐字段不变", sameUnit(a[0], b[0]), `${show(a)} vs ${show(b)}`);
  check("前缀稳定：加料后多出第二个单元", b.length === 2 && sameUnit(b[1], { start: 16, end: 24, speak: "第三句也更长啊。" }), show(b));
  checkOrder("前缀稳定", p + "第三句也更长啊。", b);
}

// ── 4. 规则 3：HARD_END —— CJK 无条件，ASCII 要后跟空白/输入结束 ────────
{
  const cjk = "这是一个很长的句子。紧接着又是一句话。";
  const u = seg(cjk, true);
  check(
    "CJK 。：后面直接接下一句（无空白）也断句，边界在 10",
    u.length === 2 && u[0].end === 10 && sliceOf(cjk, u[0]) === "这是一个很长的句子。",
    show(u),
  );

  const en = "Hello world! This is more text.";
  const ue = seg(en, true, "en");
  check(
    "ASCII !：后跟空白才算句末，且空白吸进前一个单元",
    ue.length === 2 && ue[0].end === 13 && ue[0].speak === "Hello world!",
    show(ue),
  );

  const dec = seg("0.1.2", true, "en");
  check("ASCII .：0.1.2 不断句（一个单元）", dec.length === 1 && dec[0].speak === "0.1.2", show(dec));

  const path = seg("src/main.ts", true, "en");
  check(
    "ASCII .：src/main.ts 不断句，且裸路径按名字念（dot）",
    path.length === 1 && path[0].end === 11 && path[0].speak === "src main dot ts",
    show(path),
  );

  const mixed = seg("版本 0.1.2 发布了。", true);
  check(
    "ASCII .：中文句里的版本号不断句，整句照念",
    mixed.length === 1 && mixed[0].speak === "版本 0.1.2 发布了。",
    show(mixed),
  );

  // 上游已知形状：ASCII 句末符后面紧跟收尾符时**不算**句末（endsHere 为假），
  // 于是一路扫到下一个确认的句末 —— TRAILING_CLOSER 实际只在 CJK 句末符后起作用。
  const quirk = "This is a long sentence.) Next is longer.";
  const uq = seg(quirk, true, "en");
  check(
    "ASCII ：`.)` 不闭合（上游行为），整段是一个单元",
    uq.length === 1 && uq[0].end === quirk.length,
    show(uq),
  );
}

// ── 5. 规则 4：CLAUSE_END / TRAILING_CLOSER 的确切成员 ───────────────────
{
  // CLAUSE_END：50 个字 + 从句标点 + 20 个字 + 。，必须在标点处切成两片。
  const clauseMarks = ["，", "、", "；", "：", ",", ";", ":"];
  for (const m of clauseMarks) {
    const text = "a".repeat(50) + m + "b".repeat(20) + "。";
    const u = seg(text, true, "en");
    check(
      `CLAUSE_END：${JSON.stringify(m)} 处切开（end = 51）`,
      u.length === 2 && u[0].end === 51,
      show(u),
    );
  }

  // TRAILING_CLOSER：CJK 句末符后面每一个收尾符都被吸进同一单元。
  const closers = ["”", "’", "」", "』", "）", ")", "]", "］", "》", '"', "'"];
  for (const c of closers) {
    const text = "这是一句足够长的话。" + c + "下一句也更长啊。";
    const u = seg(text, true);
    check(
      `TRAILING_CLOSER：${JSON.stringify(c)} 被吸入（end = 11）`,
      u.length === 2 && u[0].end === 11 && sliceOf(text, u[0]).endsWith("。" + c),
      show(u),
    );
  }
}

// ── 6. 规则 5：短句合并 / 长串从句标点切 / 80 回退优先级 ─────────────────
{
  const merged = seg("嗯。我知道。", true);
  check(
    "短句合并：嗯。+ 我知道。合成一个单元",
    merged.length === 1 && sameUnit(merged[0], { start: 0, end: 6, speak: "嗯。我知道。" }),
    show(merged),
  );

  const chain = seg("嗯。好。我知道了。", true);
  check(
    "短句合并：三个短句一路并到最后一个句末",
    chain.length === 1 && chain[0].end === 9 && chain[0].speak === "嗯。好。我知道了。",
    show(chain),
  );

  check(
    "短句合并：后一句还没到齐时不产出（等）",
    seg("嗯。我知道。", false).length === 0,
    show(seg("嗯。我知道。", false)),
  );

  // >48 在从句标点处切：三片，边界 32 / 65（标点后的空白归前一片）。
  const longEn = "First part is fairly long here, second part is also fairly long, third part ends.";
  const ul = seg(longEn, true, "en");
  checkOrder("从句切分", longEn, ul);
  check(
    "从句切分：三片，且标点后的空白归前一片（32 / 65）",
    ul.length === 3 && ul[0].end === 32 && ul[1].start === 32 && ul[1].end === 65,
    show(ul),
  );
  check(
    "从句切分：每片都不超过软上限",
    ul.every((u) => u.end - u.start <= SOFT_MAX_UNIT_CHARS),
    show(ul),
  );

  // 尾巴短于 MIN_UNIT_CHARS → 不留被剪短的尾巴，跟上一片走。
  const tailShort = "x".repeat(50) + ", tail.";
  const uts = seg(tailShort, true, "en");
  check(
    "长句切分：6 字符的尾巴不单独成单元（并回前一片）",
    uts.length === 1 && uts[0].end === 57,
    show(uts),
  );
  const tailOk = "x".repeat(50) + ", tailvalue9!";
  const uto = seg(tailOk, true, "en");
  check(
    "长句切分：够长的尾巴自己成片（52 / 63）",
    uto.length === 2 && uto[0].end === 52 && uto[1].start === 52 && uto[1].end === 63,
    show(uto),
  );

  // 无标点超长串：80 处回退。
  const noPunct = seg("a".repeat(200), true, "en");
  check(
    "80 回退：无从句标点、无空格 → 原地硬切（80 / 160 / 200）",
    noPunct.length === 3 && noPunct[0].end === 80 && noPunct[1].end === 160 && noPunct[2].end === 200,
    show(noPunct),
  );

  const withSpace = seg("a".repeat(70) + " " + "b".repeat(30), true, "en");
  check(
    "80 回退：有空格 → 切在最后一个词边界（71）",
    withSpace.length === 2 && withSpace[0].end === 71,
    show(withSpace),
  );

  const withClause = seg("a".repeat(50) + "," + "b".repeat(100), true, "en");
  check(
    "80 回退：有从句标点 → 切在从句标点（51）",
    withClause[0].end === 51,
    show(withClause),
  );

  const clauseBeatsSpace = seg("a".repeat(60) + "," + "b".repeat(5) + " " + "c".repeat(30), true, "en");
  check(
    "80 回退优先级：从句标点(61) 优先于其后的空格(67)",
    clauseBeatsSpace[0].end === 61,
    show(clauseBeatsSpace),
  );

  const cjkLong = seg("中".repeat(200), true);
  check(
    "纯中文长串（无标点）：80 / 160 / 200，全部发声",
    cjkLong.length === 3 && cjkLong[0].end === 80 && cjkLong[1].end === 160 &&
      cjkLong[2].end === 200 && cjkLong.every((u) => u.speak !== ""),
    show(cjkLong.map((u) => ({ s: u.start, e: u.end, n: u.speak.length }))),
  );
}

// ── 7. 规则 6：反引号内的标点不算断句；未闭合跨度等更多输入 ─────────────
{
  const text = "他直接把那个 `A. B` 写在这里当成一整句话来读了。";
  const u = seg(text, true);
  check(
    "反引号：跨度内的 . 与空格不断句（整段一个单元）",
    u.length === 1 && u[0].end === cps(text).length,
    show(u),
  );
  check(
    "反引号：非名字的行内代码被跳过（不念 A. B）",
    u[0].speak === "他直接把那个 写在这里当成一整句话来读了。",
    u[0].speak,
  );

  const open = "他说 `PORT ?? 3000";
  check("未闭合跨度 + 未 finished：不产出任何单元（等）", seg(open, false).length === 0, show(seg(open, false)));
  const openFinished = seg(open, true);
  check(
    "未闭合跨度 + finished：闭合为一个静音单元（残留拉丁字母）",
    openFinished.length === 1 && openFinished[0].end === 16 && openFinished[0].speak === "",
    show(openFinished),
  );

  const closed = "他说 `PORT ?? 3000` 那个端口。";
  const uc = seg(closed, true);
  check(
    "跨度闭合后：整句一个单元，代码被跳过、句子照念",
    uc.length === 1 && uc[0].end === 23 && uc[0].speak === "他说 那个端口。",
    show(uc),
  );
  check(
    "跨度闭合后：前缀稳定（finished=true 与「又来了更多输入」产出同一单元）",
    sameUnit(uc[0], seg(closed + "然后呢", false)[0]),
    `${show(uc)} vs ${show(seg(closed + "然后呢", false))}`,
  );
}

// ── 8. 规则 7：中文会话里的拉丁字母 → 静音单元，且不与邻句合并 ───────────
{
  const text = "这句话够长了。OK then. 后面这句也很长啊。";
  const u = seg(text, true);
  checkOrder("拉丁静音", text, u);
  check("拉丁静音：三个单元（前句 / 拉丁句 / 后句）", u.length === 3, show(u));
  check("拉丁静音：前一句照常发声", sameUnit(u[0], { start: 0, end: 7, speak: "这句话够长了。" }), show(u));
  check("拉丁静音：拉丁句是静音单元", sameUnit(u[1], { start: 7, end: 16, speak: "" }), show(u));
  check("拉丁静音：后一句照常发声", sameUnit(u[2], { start: 16, end: 25, speak: "后面这句也很长啊。" }), show(u));

  const shortLatin = "这句话够长了。OK. 后面这句也很长啊。";
  const us = seg(shortLatin, true);
  check(
    "拉丁静音：即使短于 MIN（OK.）也不与后句合并",
    us.length === 3 && us[1].start === 7 && us[1].end === 11 && us[1].speak === "",
    show(us),
  );

  const en = seg(text, true, "en");
  check(
    "同一段文本在 en 会话里：拉丁规则不适用，合并为两个发声单元",
    en.length === 2 && en[0].end === 16 && en[0].speak.includes("OK then."),
    show(en),
  );

  const cjkLatin = "她把 README 文件读了一遍然后继续说了很久。";
  const uc = seg(cjkLatin, true);
  check(
    "中英混排：一句里还留着拉丁字母 → 整句静音",
    uc.length === 1 && uc[0].speak === "",
    show(uc),
  );
}

// ── 9. 规则 8：finished 只影响收尾 ────────────────────────────────────────
{
  const text = "你好。";
  check("finished=true：最后一段闭合", seg(text, true).length === 1, show(seg(text, true)));
  check("finished=false：最后一段还开着 → 不产出", seg(text, false).length === 0, show(seg(text, false)));

  const unclosedFence = "```\ncode\n";
  check("未闭合围栏 + 未 finished：不产出", seg(unclosedFence, false).length === 0, show(seg(unclosedFence, false)));
  const uf = seg(unclosedFence, true);
  check(
    "未闭合围栏 + finished：整块一个静音单元",
    uf.length === 1 && uf[0].start === 0 && uf[0].end === 9 && uf[0].speak === "",
    show(uf),
  );

  // 未闭合围栏跨越两次喂入（前缀稳定 + 静音单元边界）。
  const prefix = "开场白够长了啊。\n```\ncode here";
  const up = seg(prefix, false);
  check(
    "未闭合围栏：前一句已闭合、围栏在等（只有一个发声单元）",
    up.length === 1 && sameUnit(up[0], { start: 0, end: 9, speak: "开场白够长了啊。" }),
    show(up),
  );
  const full = prefix + "\n```\n结尾也够长了吧。";
  const ufl = seg(full, true);
  check("未闭合围栏：补上闭合围栏后共三个单元", ufl.length === 3, show(ufl));
  check("未闭合围栏：第一个单元逐字段不变（前缀稳定）", sameUnit(up[0], ufl[0]), `${show(up)} vs ${show(ufl)}`);
  check(
    "未闭合围栏：围栏块是静音单元，连闭合行的换行一起",
    ufl[1].speak === "" && sliceOf(full, ufl[1]) === "```\ncode here\n```\n",
    JSON.stringify(sliceOf(full, ufl[1])),
  );
  check("未闭合围栏：闭合围栏之后照常发声", sameUnit(ufl[2], { start: 27, end: 35, speak: "结尾也够长了吧。" }), show(ufl));
}

// ── 10. 表格行（上游同款：只显示不发声）─────────────────────────────────
{
  const text = "| 列 | 值 |\n后续足够长的句子。";
  const u = seg(text, true);
  check(
    "表格行：整行一个静音单元（含换行），后面照念",
    u.length === 2 && sliceOf(text, u[0]) === "| 列 | 值 |\n" && u[0].speak === "" &&
      u[1].speak === "后续足够长的句子。",
    show(u),
  );
  check("表格行：未 finished 且行还没到齐时不产出", seg("| 列 | 值 |", false).length === 0, show(seg("| 列 | 值 |", false)));
  const uc = seg("```\ncode\n```\n后续足够长的句子。", true);
  check(
    "已闭合围栏：静音块 + 后续发声",
    uc.length === 2 && uc[0].speak === "" && sliceOf("```\ncode\n```\n后续足够长的句子。", uc[0]) === "```\ncode\n```\n",
    show(uc),
  );
}

// ── 11. toSpeakableText / isSpeakableCode ────────────────────────────────
{
  check("isSpeakableCode：文件名 → true", isSpeakableCode("parser.ts") === true);
  check("isSpeakableCode：@板砖 → true", isSpeakableCode("@板砖") === true);
  check("isSpeakableCode：表达式 → false", isSpeakableCode("PORT ?? 3000") === false);
  check("isSpeakableCode：命令行 → false", isSpeakableCode("node src/echo.mjs hello") === false);
  check("isSpeakableCode：空 → false", isSpeakableCode("   ") === false);
  check("isSpeakableCode：超 48 字符 → false", isSpeakableCode("a".repeat(49)) === false);

  check("toSpeakableText：markdown 强调剥掉", toSpeakableText("**你好**，世界。") === "你好，世界。", toSpeakableText("**你好**，世界。"));
  check("toSpeakableText：粗体/删除线剥掉", toSpeakableText("__好__~~吧~~") === "好吧", toSpeakableText("__好__~~吧~~"));
  check(
    "toSpeakableText：裸路径按名字念（中文用 点）",
    toSpeakableText("请读 src/main.ts 吧。") === "请读 src main 点 ts 吧。",
    toSpeakableText("请读 src/main.ts 吧。"),
  );
  check(
    "toSpeakableText：行内代码是名字才念",
    toSpeakableText("用 `parser.ts` 解析。") === "用 parser 点 ts 解析。",
    toSpeakableText("用 `parser.ts` 解析。"),
  );
  check("toSpeakableText：引号与 CJK 括号消失", toSpeakableText("她喊道「喂」！") === "她喊道喂！", toSpeakableText("她喊道「喂」！"));
  check("toSpeakableText：@板砖 只留名字", toSpeakableText("@板砖 去查。") === "板砖 去查。", toSpeakableText("@板砖 去查。"));
  check("toSpeakableText：围栏块形状 → 空", toSpeakableText("```\ncode\n```") === "");
  check("toSpeakableText：表格行形状 → 空", toSpeakableText("| a | b |") === "");
  check("toSpeakableText：无字母数字 → 空", toSpeakableText("……——") === "", JSON.stringify(toSpeakableText("……——")));
  check(
    "toSpeakableText：对普通散文幂等",
    toSpeakableText(toSpeakableText("你好，世界。")) === toSpeakableText("你好，世界。"),
  );
  check("toSpeakableText：不新增内容（纯删除/替换）", toSpeakableText("你好，世界。") === "你好，世界。", toSpeakableText("你好，世界。"));
}

// ── 12. 内联进来的 stripDisplayUnsafe（ANSI / 控制符 / 双向符 / 零宽）────
{
  check("stripDisplayUnsafe：剥 ESC（ANSI 起手）", stripDisplayUnsafe("\u001b[31m红\u001b[0m") === "[31m红[0m", JSON.stringify(stripDisplayUnsafe("\u001b[31m红\u001b[0m")));
  check("stripDisplayUnsafe：剥 C1（CSI 单字符形式）", stripDisplayUnsafe("a\u009bb") === "ab");
  check("stripDisplayUnsafe：剥 CR", stripDisplayUnsafe("x\ry\n") === "xy\n", JSON.stringify(stripDisplayUnsafe("x\ry\n")));
  check("stripDisplayUnsafe：保留 \\n \\t", stripDisplayUnsafe("a\nb\tc") === "a\nb\tc");
  check("stripDisplayUnsafe：剥 ZWSP", stripDisplayUnsafe("a\u200bb") === "ab");
  check("stripDisplayUnsafe：剥 BOM/ZWNBSP", stripDisplayUnsafe("a\ufeffb") === "ab");
  check("stripDisplayUnsafe：剥双向覆盖 RLO", stripDisplayUnsafe("a\u202eb") === "ab");
  check("stripDisplayUnsafe：剥方向标记 LRM/RLM", stripDisplayUnsafe("a\u200e\u200fb") === "ab");
  check("stripDisplayUnsafe：剥行分隔符 U+2028", stripDisplayUnsafe("a\u2028b") === "ab");
  check("stripDisplayUnsafe：剥 Tag 块", stripDisplayUnsafe("a\udb40\udc01b") === "ab");
  check("stripDisplayUnsafe：保留 ZWJ（emoji 序列不能被拆）", stripDisplayUnsafe("a\u200db") === "a\u200db");
  check("stripDisplayUnsafe：普通中英文恒等", stripDisplayUnsafe("你好 world!") === "你好 world!");

  const ansi = toSpeakableText("\u001b[31m你好世界啊\u001b[0m。");
  check("toSpeakableText 里也不留 ESC", ansi.includes("\u001b") === false, JSON.stringify(ansi));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
