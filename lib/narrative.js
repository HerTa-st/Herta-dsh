/**
 * 她的记忆货架：读 `<workspace>/.herta/narrative/`，过滤、把关、拼成 prompt 段。
 *
 * 这一层是**忠实移植** `Herta-src/packages/herta/src/narrative/static-prefix.ts`
 * 与 `few-shot-guard.ts` 的规则，理由：
 *
 * 1. **共用同一份货架**。路径与文件命名规则和 Herta 本体完全一致，所以你在
 *    Herta 里聊出来的废案，切到 DSH 里她照样记得 —— 真的是「同一个她」。
 * 2. **格式门必须照搬**。这些文件来自工作区目录，是普通文件，外人也能往里写。
 *    没有这道门，一个手写的文件就能**拼接**提示词：留一个没关的对话栅栏，
 *    后面的正文就会被读成在栅栏里面（Herta 原文档 BL3 就是记这个事故的）。
 *
 * 门检查的是**结构**不是词汇：对话栅栏必须平衡、不嵌套、到 EOF 全关；
 * 正文不得以截断的栅栏开头结尾；首行必须是 `### 废案` / `### 记录` 头。
 *
 * 依赖被刻意做成零：`@herta/core` 是 Herta 仓库里的 workspace 包，
 * profile 的 node_modules 里没有它，运行时 import 会直接失败。
 * 所以下面两个纯函数是从 `@herta/core` 逐字搬来的（出处见各自注释）。
 */
import { readFile, readdir } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 从 `@herta/core/text-sanitize` 逐字移植。
 *
 * 去掉控制字符、双向覆盖符与零宽字符。**先跑它、再检查**，否则一个用零宽
 * 字符夹带的栅栏能骗过扫描、再在提示词里重新拼起来。
 *
 * ZWJ（U+200D）刻意保留：去掉它会拆散合法的 emoji 组合序列。
 */
const DISPLAY_UNSAFE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 去掉控制字符正是本模块的职责
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u2028-\u202E\u2060-\u2064\u2066-\u2069\uD800-\uDFFF\uFEFF\u{E0000}-\u{E007F}]/gu;

/** 见上。对普通文本、CJK、emoji 是恒等变换。 */
export function stripDisplayUnsafe(text) {
  return text.replace(DISPLAY_UNSAFE, "");
}

/**
 * 从 `@herta/core/text/estimate-prompt-tokens` 逐字移植。
 *
 * CJK 感知的估算：每个非 ASCII 码点算 1 token，ASCII 连续段算 ÷4。
 * 用来给单个样本文件设上限 —— 静态前缀是缓存稳定、每次补全都付钱的，
 * 一个超大文件就是永久税。
 */
export function estimatePromptTokens(text) {
  let tokens = 0;
  let asciiRun = 0;
  const n = text.length;
  for (let i = 0; i < n; i += 1) {
    const cu = text.charCodeAt(i);
    if (cu > 0x7f) {
      tokens += Math.ceil(asciiRun / 4);
      asciiRun = 0;
      tokens += 1;
      // 高代理项的低半是同一个码点，跳过
      if (cu >= 0xd800 && cu <= 0xdbff && i + 1 < n) {
        const lo = text.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) i += 1;
      }
    } else {
      asciiRun += 1;
    }
  }
  return tokens + Math.ceil(asciiRun / 4);
}

/** 货架文件的命名前缀。与 static-prefix.ts 一致（不含冒号，兼容带编号与不带编号两种写法）。 */
const NARRATIVE_FILE_PREFIXES = ["### 废案", "### 记录"];

/** 一个对话栅栏：`（我 说）` / `（开拓者 说）` / `（我 想）` 开，`（/我 说）` 关。说话人自由，空格与全角括号斜线是语法。 */
const FENCE_RE = /（(\/?)([^（）/\n]{1,16}) (说|想)）/g;

/** 正文以半个栅栏结尾会把前缀后面拼的东西一起吞进去。 */
const TRUNCATED_TAIL_RE = /（\/?[^（）]{0,24}$/;

/** 单个样本的上限（估算 token）。原版的注释：最大的种子锚点约 8.7k，这道门挡的是失控文件。 */
const MAX_BODY_TOKENS = 10_000;

/**
 * 栅栏平衡检查。语法只有一层：开一个、它自己的关收掉，不许嵌套。
 * @returns 平衡时返回 null，否则返回原因。
 */
function fenceImbalance(body) {
  let open = null;
  /**
   * 打印成「（ 我 说 ）」——**中间留空格**是刻意的：不留的话这段说明本身就是一个
   * 合法栅栏，回喂给模型时会自己把自己绕进去。
   */
  const show = (s, k) => `（ ${s} ${k} ）`;
  for (const m of body.matchAll(FENCE_RE)) {
    const closing = m[1] === "/";
    const speaker = m[2];
    const kind = m[3];
    if (closing) {
      if (open === null) return `这里多了一个收尾 ${show(speaker, kind)}，前面没有对应的开口`;
      if (open.speaker !== speaker || open.kind !== kind) {
        return `收尾对不上：${show(speaker, kind)} 想关掉的是 ${show(open.speaker, open.kind)}`;
      }
      open = null;
    } else {
      if (open !== null) {
        return `栅栏不能嵌套：${show(speaker, kind)} 开在 ${show(open.speaker, open.kind)} 里面，而它还没关`;
      }
      open = { speaker, kind };
    }
  }
  if (open !== null) return `${show(open.speaker, open.kind)} 没有收尾`;
  return null;
}

/**
 * 校验一份从磁盘读来的样本。移植自 `checkFewShot`。
 *
 * 拒绝时**同时**给两样东西（2026-09-30 体检后加的）：
 *   · `code`   —— 稳定的机器码（`empty` / `too-long` / `fence` / `truncated` / `no-header`），
 *                 测试与调用方按它分支，改措辞不会碰坏断言；
 *   · `reason` —— 给人看的中文一句话。它会被渲染进工具结果、也会被回喂给模型，
 *                 所以以前那些 `unbalanced fences: nested open …` 是不合格的。
 *
 * @returns `{ ok, code?, reason?, body }`，`body` 是清洗过的正文（仅 ok 时有意义）。
 */
export function checkFewShot(name, raw) {
  const body = stripDisplayUnsafe(raw);

  if (body.trim().length === 0) {
    return { ok: false, code: "empty", reason: "正文是空的", body };
  }

  const estTokens = estimatePromptTokens(body);
  if (estTokens > MAX_BODY_TOKENS) {
    return {
      ok: false,
      code: "too-long",
      reason: `太长了：约 ${estTokens} token，上限 ${MAX_BODY_TOKENS}`,
      body,
    };
  }

  const imbalance = fenceImbalance(body);
  if (imbalance !== null) {
    return { ok: false, code: "fence", reason: `对话栅栏不配对：${imbalance}`, body };
  }

  if (TRUNCATED_TAIL_RE.test(body.trimEnd())) {
    return { ok: false, code: "truncated", reason: "正文末尾是一个没写完的栅栏（像是被截断了）", body };
  }

  // 文件名过滤只保证「可能是样本」；再对着内容重复一遍 —— 一个叫
  // `### 废案_03：…` 的文件里可以什么都没有，而**头**才是让正文读起来
  // 像她自己丢弃的稿子而不是一段漂浮文本的东西。
  const firstLine = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  if (!/^###\s*(废案|记录)/.test(firstLine.trim())) {
    return {
      ok: false,
      code: "no-header",
      reason: "正文开头缺少标题行（要用「### 废案…」或「### 记录…」开头）",
      body,
    };
  }

  return { ok: true, body };
}

/** 货架目录相对工作区的路径（与 Herta 本体一致）。 */
export const NARRATIVE_REL = join(".herta", "narrative");

/**
 * 默认 prompt 预算（估算 token）。
 *
 * 为什么要预算：实测她真实的货架是 **16 份 / 56649 字符 ≈ 47445 tokens**。
 * Herta 桌面版把全部样本注进静态前缀——那是她的设计（缓存稳定，且靠货架容量
 * 上限 27 兜底）。但在 DSH 里 47k tokens 会吃掉大半个上下文窗口，不可接受。
 *
 * 12000 的取值依据：足够装下她近期自写的记忆（14–18 号合计约 6.3k），
 * 再留出余量给更早的几份；同时远小于人格 prefix 之外的正常会话预算。
 */
export const DEFAULT_MAX_TOKENS = 12_000;

/**
 * 默认挑选顺序。
 *
 * `newest-first`：先装**最近写的**。理由是这一层的职责是「记忆」而不是「语气」——
 * 语气已经由 A 层的人格前缀（自传正本）负责；而她近期自己写下的那几份
 * （做梦产物，通常 900–1900 tokens）才是「她记得的事」。
 * 种子锚点（00/02/09 这些，单份就有 4k–8k tokens）体量太大，靠工具按需读。
 */
export const DEFAULT_ORDER = "newest-first";

/**
 * 按预算从「已过门」的样本里挑选，并返回拼装顺序（升序）的结果。
 *
 * 抽出来是因为异步与同步两个入口必须**共用同一套挑选与拼装规则** ——
 * 否则 prompt 段（同步）与工具（异步）看到的内容会不一致。
 *
 * @param passed - 已过格式门的样本，按文件名升序。
 * @param maxTokens - token 预算。
 * @param order - 挑选顺序。
 * @returns 选中的样本（升序）、因预算落选的明细、以及合计 token。
 */
export function pickWithinBudget(passed, maxTokens, order) {
  const byPickOrder = order === "oldest-first" ? passed : [...passed].reverse();
  const selected = new Set();
  const skipped = [];
  let tokens = 0;
  for (const item of byPickOrder) {
    if (tokens + item.tokens > maxTokens) {
      // 装不下就跳过，继续看后面更小的 —— 而不是就此停下
      skipped.push({ name: item.name, tokens: item.tokens });
      continue;
    }
    selected.add(item.name);
    tokens += item.tokens;
  }
  // 拼装顺序回到升序：必须与挑选顺序无关，否则同样的货架会产出不同的前缀，打散 KV 缓存
  return { chosen: passed.filter((item) => selected.has(item.name)), skipped, tokens };
}

/** 把一批已过门的样本文本按升序拼成 prompt 段。 */
function composeNarrative(chosen) {
  return chosen.map((item) => item.body).join("\n\n");
}

/**
 * 读一整个货架，并按 token 预算挑选。
 *
 * 三步，顺序不能换：
 *  1. 按前缀筛候选、按文件名升序（种子编号零填充，字典序即编号序）
 *  2. 逐份过格式门 —— **先过门再挑**，否则坏文件会占掉预算
 *  3. 按挑选顺序装入预算，装完**把选中的排回升序**再拼装
 *
 * @param workspaceRoot - 会话的工作区根目录。
 * @param options - `maxTokens`（估算 token 预算）、`order`（`newest-first` | `oldest-first`）。
 * @returns 拼好的正文，以及参与/被拦/因预算落选的文件明细。
 */
export async function readNarrative(workspaceRoot, options = {}) {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const order = options.order ?? DEFAULT_ORDER;
  const dir = join(workspaceRoot, NARRATIVE_REL);

  let names;
  try {
    names = await readdir(dir);
  } catch (error) {
    // 货架还没建起来是正常状态（首次运行、或用户从没用过记忆），不是错误。
    if (error.code === "ENOENT") {
      return { text: "", files: [], dropped: [], selected: [], skipped: [], tokens: 0, items: [] };
    }
    throw error;
  }

  const candidates = names
    .filter((name) => NARRATIVE_FILE_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();

  const passed = [];
  const dropped = [];
  for (const name of candidates) {
    let raw;
    try {
      raw = await readFile(join(dir, name), "utf8");
    } catch (error) {
      // 与 static-prefix.ts 的 safeRead 一致：ENOENT 视为空样本，其余错误上抛。
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const check = checkFewShot(name, raw);
    if (check.ok) passed.push({ name, body: check.body, tokens: estimatePromptTokens(check.body) });
    else dropped.push({ name, reason: check.reason });
  }

  const { chosen, skipped, tokens } = pickWithinBudget(passed, maxTokens, order);
  const inPrompt = new Set(chosen.map((item) => item.name));
  return {
    text: composeNarrative(chosen),
    files: candidates,
    dropped,
    selected: chosen.map((item) => item.name),
    skipped,
    tokens,
    // 逐份明细 —— 工具要如实报告「哪份进了提示词、各占多少 token」
    items: passed.map((item) => ({ name: item.name, tokens: item.tokens, inPrompt: inPrompt.has(item.name) })),
  };
}

/**
 * `readNarrative` 的同步版本。
 *
 * **为什么必须有它**：DSH 的 `systemPrompt.section({ text })` 的 `text` 只能是
 * 字符串或**同步**函数 —— 没有异步 prompt provider（源码里
 * `text: string | ((context) => string)`，组装时直接调用、不 await）。
 * 所以 prompt 段只能走这条同步路径。挑选与拼装规则与异步版共用，保证一致。
 *
 * @param workspaceRoot - 会话的工作区根目录。
 * @param options - 同 `readNarrative`。
 * @returns 同 `readNarrative`。
 */
export function readNarrativeSync(workspaceRoot, options = {}) {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const order = options.order ?? DEFAULT_ORDER;
  const dir = join(workspaceRoot, NARRATIVE_REL);

  let names;
  try {
    names = readdirSync(dir);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { text: "", files: [], dropped: [], selected: [], skipped: [], tokens: 0, items: [] };
    }
    throw error;
  }

  const candidates = names
    .filter((name) => NARRATIVE_FILE_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();

  const passed = [];
  const dropped = [];
  for (const name of candidates) {
    let raw;
    try {
      raw = readFileSync(join(dir, name), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const check = checkFewShot(name, raw);
    if (check.ok) passed.push({ name, body: check.body, tokens: estimatePromptTokens(check.body) });
    else dropped.push({ name, reason: check.reason });
  }

  const { chosen, skipped, tokens } = pickWithinBudget(passed, maxTokens, order);
  const inPrompt = new Set(chosen.map((item) => item.name));
  return {
    text: composeNarrative(chosen),
    files: candidates,
    dropped,
    selected: chosen.map((item) => item.name),
    skipped,
    tokens,
    items: passed.map((item) => ({ name: item.name, tokens: item.tokens, inPrompt: inPrompt.has(item.name) })),
  };
}

