/**
 * 语音分段与可发声文本 —— 上游 Herta 的忠实移植件（纯函数，无副作用）。
 *
 * 出处（逐段对照）：
 *   - `Herta-src/packages/app-server/src/voice/speakable-text.ts`（533 行）
 *   - `Herta-src/packages/core/src/text-sanitize.ts` 的 `stripDisplayUnsafe`
 *     —— 上游本文件唯一的非标准库依赖，已按上游实现**内联**在文件末尾
 *     （见 `stripDisplayUnsafe` 的注释），所以本模块一个相对导入都没有，
 *     自包含、可单独编译。
 *
 * 上游要解决的问题：她的话里混着代码 —— 围栏块、行内 `标识符`、shell 行、路径、
 * `@板砖`、markdown 强调 —— 而 TTS 前端会老老实实把每一个都念出来。本模块
 * 确定性地（不用模型）决定她**说**什么、只是**显示**什么：
 *   - 围栏代码块、表格行：只显示；
 *   - 行内代码：是「名字」（标识符/路径/文件名/`@板砖`）就念，是「表达式」或
 *     命令行（`PORT ?? 3000`、`node src/echo.mjs hello`）就跳过 —— 她绕着代码说，
 *     不是一个字符一个字符念代码；
 *   - markdown 脚手架（强调、标题、列表符、链接、引用）剥掉，里面的字留下；
 *   - 没有读音的符号（→ = | ~ ^ emoji）变成停顿或消失；
 *   - 中文会话里，过完上面所有清洗仍含拉丁字母的句子：只显示不发声。
 *
 * 声音里**绝不新增**内容：只做删除、切分，或给一个字形换一个读音
 * （文件名里的 `.` → 点/dot）。往她嘴里塞她没写的话，和把 `??` 念出来一样是错。
 *
 * 本文件两部分：
 *   - `segmentSpeechUnits`：把不断增长的缓冲区切成一个单元一个单元（整句，
 *     短的与下一句合并，长的在从句标点处切开）；
 *   - `toSpeakableText`：给出一个单元送进合成器的文本（或 "" = 静音单元）。
 */

                                     

/**
 * 一个合成单元：原文里的一段（**码点**索引，`end` 排他 —— 揭示动画就发这些
 * 字符）加上送进合成器的文本；`speak: ""` 表示静音单元（代码、表格、中文会话里
 * 的拉丁片段、清洗后没有可发声内容）。
 */
                             
                         
                       
                         
 

// ── 单元切分 ───────────────────────────────────────────────────────────────

/** 能闭合一个单元的句末符。CJK 的（。！？）无条件闭合；ASCII 的（. ! ?）
 *  只在后跟空白或输入结束时闭合 —— 这条闸门在 `scanSentence` 里，为的是
 *  `0.1.2`、`src/main.ts`、`node x.mjs` 不被当成句末。 */
const HARD_END                      = new Set([
  "。",
  "！",
  "？",
  ".",
  "!",
  "?",
]);
/** 长句允许切开的从句标点。 */
const CLAUSE_END                      = new Set([
  "，",
  "、",
  "；",
  "：",
  ",",
  ";",
  ":",
]);
/** 跟在句末符后面、仍属于该单元的收尾符（`。”` `？）`）—— 断句时一起吸入，
 *  免得收尾括号变成下一个单元开头的孤儿字符。 */
const TRAILING_CLOSER                      = new Set([
  "”",
  "’",
  "」",
  "』",
  "）",
  ")",
  "]",
  "］",
  "》",
  '"',
  "'",
]);

/**
 * 短于这个长度（**显示**文本的码点数）的句子不单独成单元：与后面那句合并，
 * 于是「嗯。我知道。」是一次发声而不是两次被切碎的。回复的最后一句无论如何
 * 都闭合。
 */
export const MIN_UNIT_CHARS = 10;
/** 一句话（或合并后的一串）长于这个长度就在从句标点处切开，每片最多这么长；
 *  比 MIN_UNIT_CHARS 还短的尾巴留在前一片里。 */
export const SOFT_MAX_UNIT_CHARS = 48;
/** 超过这个长度、又看不到句末符的一串就直接切 —— 在最后一个从句标点处，
 *  否则最后一个词边界处（Kokoro 的 510 token 上限远在这之上；这里限的是慢
 *  CPU 上单单元的合成延迟）。 */
export const HARD_MAX_UNIT_CHARS = 80;

/** 中文单元的**发声**文本里还剩拉丁字母：那不是她的声音。 */
const LATIN_RE = /[A-Za-z]/;

function isWhitespace(ch                    )          {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isFenceLine(line        )          {
  return /^\s*```/.test(line);
}

function isTableLine(line        )          {
  return /^\s*\|/.test(line);
}

/** 一次句子形状的扫描结果：在哪里结束（排他）、为什么结束、以及它内部从句
 *  标点的位置（排他端点，行内代码里的不算）。 */
                
                       
                                                
                                             
                                      
 

/**
 * 从 `from` 走到下一个句界。句子还开着就返回 null（还没有句末符，或者句末符
 * 后面可能还有收尾符而输入尚未结束）。
 */
function scanSentence(
  chars                   ,
  from        ,
  finished         ,
)              {
  const n = chars.length;
  const clauses           = [];
  let j = from;
  let lastClause = -1;
  /** 见过的最后一个词边界 —— 硬上限的兜底切点。 */
  let lastSpace = -1;
  /**
   * 是否在行内 `code` 跨度里。那里的标点是**代码**不是散文：在它上面断句会把
   * 反引号对拆到两个单元里，两半就都变成普通文本被念出来 —— `PORT ?? 3000`
   * 会被念成「不过 `PORT?」和「3000` 那个…」（voice lab 第一次跑就撞上了）。
   * 缓冲区结束时还没闭合的跨度等同于未闭合围栏：该单元等更多输入。
   */
  let inCode = false;
  const cap = ()       => ({
    // 优先从句标点，其次**词**边界，最后才原地切。词边界对英文很关键：一句
    // 很长的英文可以一个从句标点都没有，原地切会把 "war room" 切成 "…war" /
    // "room …"、把 "news?" 切成 "ews?"，两半各自被合成为一次发声（voice lab）。
    end: lastClause > from ? lastClause : lastSpace > from ? lastSpace : j + 1,
    kind: "cap",
    clauses,
  });
  while (j < n) {
    const ch = chars[j]          ;
    if (ch === "`") {
      inCode = !inCode;
      j += 1;
      continue;
    }
    if (ch === "\n") {
      // 换行结束单元，也结束任何行内跨度 —— 一个没配对的反引号绝不能把回复
      // 剩下的部分全吞掉。
      return { end: j + 1, kind: "line", clauses };
    }
    if (inCode) {
      // 仍然受硬上限约束，所以病态的未闭合跨度也长不出无限长的单元。
      if (j + 1 - from >= HARD_MAX_UNIT_CHARS) return cap();
      j += 1;
      continue;
    }
    if (HARD_END.has(ch)) {
      // 英文句末符需要后面跟空白/换行/输入结束（3.5、v0.1.2 —— 小数和版本号
      // 不是句末）。CJK 句末符不需要这个条件：中文句号后面直接接下一句是常态，
      // 要求空白就永远断不了句。
      const cjkEnder = ch === "。" || ch === "！" || ch === "？";
      const after = chars[j + 1];
      const endsHere =
        cjkEnder || isWhitespace(after) || (after === undefined && finished);
      if (endsHere) {
        // 先吸掉收尾符，再看一眼：必须**看到**下一个真实字符（或输入结束），
        // 句子才能闭合 —— 否则 `。”` 的 `”` 会漏进下一个单元。
        let k = j + 1;
        while (k < n && TRAILING_CLOSER.has(chars[k]          )) k += 1;
        if (k >= n && !finished) return null;
        return { end: k, kind: "sentence", clauses };
      }
    }
    if (CLAUSE_END.has(ch)) {
      lastClause = j + 1;
      clauses.push(j + 1);
    }
    if (isWhitespace(ch)) lastSpace = j + 1;
    if (j + 1 - from >= HARD_MAX_UNIT_CHARS) return cap();
    j += 1;
  }
  return null;
}

/**
 * 把 `chars`（不断增长的码点缓冲）切成**已闭合**的单元，按顺序。
 * 前缀稳定：一个单元一旦闭合，后面来再多文本它也不变 —— 增量调用方可以边闭合
 * 边合成。单元的形状是句子：
 *   - 句末符后面跟一个不是收尾符的字符时闭合（于是 `。”` 保持完整），
 *     `finished` 时输入结束也算；
 *   - 短于 MIN_UNIT_CHARS 的句子与后一句合并（它要等后一句）；回复最后一句
 *     照原样闭合；
 *   - 句子（或合并后的一串）长于 SOFT_MAX_UNIT_CHARS 时在从句标点（以及内部的
 *     句末）处切成不超过该长度的片，绝不留一条短于 MIN_UNIT_CHARS 的尾巴；
 *   - 换行无条件结束单元（每行一个单元；空行并入前一个单元的尾部）；
 *   - 围栏块是**一个**静音单元，表格行也是；
 *   - 没有句末符、又越过 HARD_MAX_UNIT_CHARS 的一串，在最后一个从句标点或词
 *     边界处切；
 *   - 中文会话里，发声文本仍含拉丁字母的句子是它自己的**静音**单元 —— 从不与
 *     邻居合并，所以它前面那句短句照样能发声；
 *   - 输入结束会闭合所有挂起的东西。
 * 句末符后面的尾随空白吸进已结束的那个单元，下一个单元从真实字符开始。
 */
export function segmentSpeechUnits(
  chars                   ,
  finished         ,
  lang             = "zh",
)               {
  const units               = [];
  const n = chars.length;
  const push = (start        , end        , silent = false)       => {
    if (end <= start) return;
    const raw = chars.slice(start, end).join("");
    units.push({
      start,
      end,
      speak: silent ? "" : toSpeakableText(raw, lang),
    });
  };
  /** 把 [start, end) 作为一个单元推出；过长时按从句标点切成几片。 */
  const flush = (
    start        ,
    end        ,
    clauses                   ,
  )       => {
    if (end - start <= SOFT_MAX_UNIT_CHARS) {
      push(start, end);
      return;
    }
    const cuts           = [];
    let pieceStart = start;
    let lastGood = -1;
    for (const c of clauses) {
      if (c <= pieceStart || c >= end) continue;
      if (c - pieceStart > SOFT_MAX_UNIT_CHARS && lastGood > pieceStart) {
        cuts.push(lastGood);
        pieceStart = lastGood;
      }
      lastGood = c;
    }
    if (end - pieceStart > SOFT_MAX_UNIT_CHARS && lastGood > pieceStart) {
      cuts.push(lastGood);
      pieceStart = lastGood;
    }
    // 不留被剪短的尾巴：短于最小长度的余量跟着前一片走，哪怕那片因此略微
    // 超过软上限。
    if (cuts.length > 0 && end - pieceStart < MIN_UNIT_CHARS) cuts.pop();
    let from = start;
    for (const cut of cuts) {
      // 从句标点后面的空白属于结束的那一片（否则下一片以空白开头）。
      let to = cut;
      while (to < end && isWhitespace(chars[to])) to += 1;
      push(from, to);
      from = to;
    }
    push(from, end);
  };

  let i = 0;
  /** 挂起单元的起点 —— 有短句在等后一句时，它比 `i` 小。 */
  let unitStart = 0;
  /** 挂起单元内部的从句标点与内部句末。 */
  let clauses           = [];
  while (i < n) {
    // 行形状的单元：围栏块或表格行，只在行首判断（换行会闭合一切单元，
    // 所以走到这里没有挂起的东西）。
    if (unitStart === i && (i === 0 || chars[i - 1] === "\n")) {
      const lineEnd = indexOfLineEnd(chars, i);
      const line = chars.slice(i, lineEnd).join("");
      if (isFenceLine(line)) {
        // 找闭合围栏那一行。没闭合 → 只有输入结束时才闭合（揭示动画也这样等）。
        let j = lineEnd;
        let closed = false;
        while (j < n) {
          if (chars[j] !== "\n") {
            j += 1;
            continue;
          }
          const nextEnd = indexOfLineEnd(chars, j + 1);
          const next = chars.slice(j + 1, nextEnd).join("");
          if (/^\s*```\s*$/.test(next)) {
            j = nextEnd < n ? nextEnd + 1 : nextEnd; // 连它的换行一起
            closed = true;
            break;
          }
          j += 1;
        }
        if (!closed) {
          if (!finished) break;
          j = n;
        }
        push(i, j, true);
        i = j;
        unitStart = i;
        continue;
      }
      if (isTableLine(line)) {
        if (lineEnd >= n && !finished) break;
        const end = lineEnd < n ? lineEnd + 1 : n;
        push(i, end, true);
        i = end;
        unitStart = i;
        continue;
      }
    }
    // 散文：下一句。
    let scan = scanSentence(chars, i, finished);
    if (scan === null) {
      if (!finished) break; // 还开着 —— 等更多输入
      scan = { end: n, kind: "sentence", clauses: [] };
    }
    // 中文会话里的拉丁片段：这句只显示不发声 —— 而且是**独立**一个单元，
    // 这样它前面挂起的短句仍然能拿到自己的声音。
    const latin =
      lang === "zh" &&
      LATIN_RE.test(toSpeakableText(chars.slice(i, scan.end).join(""), lang));
    if (latin) {
      if (unitStart < i) flush(unitStart, i, clauses);
      let end = scan.end;
      while (end < n && isWhitespace(chars[end])) end += 1;
      if (end >= n && !finished && scan.end < n) break; // 挂起（见下）
      push(i, end, true);
      i = end;
      unitStart = i;
      clauses = [];
      continue;
    }
    clauses.push(...scan.clauses);
    const closes =
      scan.kind !== "sentence" ||
      scan.end - unitStart >= MIN_UNIT_CHARS ||
      (scan.end >= n && finished);
    if (!closes) {
      // 太短，不能单独站：与后面那句合并。
      if (scan.end >= n) break; // 后面还没有东西 —— 等
      clauses.push(scan.end);
      i = scan.end;
      continue;
    }
    // 吸掉尾随空白，让下一个单元从字符开始 —— 但只吸**已知**的；还没到齐的
    // 尾巴要等输入。
    let end = scan.end;
    while (end < n && isWhitespace(chars[end])) end += 1;
    if (end >= n && !finished && scan.end < n) {
      // 尾随空白一直顶到开放端：等我们知道后面是什么再动（可能还有换行要来）。
      break;
    }
    flush(unitStart, end, clauses);
    i = end;
    unitStart = i;
    clauses = [];
  }
  return units;
}

function indexOfLineEnd(chars                   , from        )         {
  let k = from;
  while (k < chars.length && chars[k] !== "\n") k += 1;
  return k;
}

// ── 可发声文本变换 ──────────────────────────────────────────────────────────

/** 整块的 `〔…〕` 提示脚手架和散落的叙述标签：从来不是她的声音
 *  （见上游 @herta/herta 的 block-shape / strip-stray-open-tags）。 */
const SCAFFOLDING_RE = /〔[^〕]*〕/gu;
const STRAY_TAG_RE = /（\/?(?:我 说|我 想|开拓者 说)）/gu;

/** 行内代码里她**会念**的内容：一个像名字的 token —— 标识符、文件名、路径、
 *  带点或连字符的、或 `@板砖` 这个名字 —— 没有空格、没有运算符。 */
const NAME_LIKE_RE = /^@?[\p{L}\p{N}_$.\-/\\:]{1,48}$/u;
/** 反引号之外的裸路径/文件名（`scripts/merge_sort.py`、`parser.ts`、
 *  `src/main.ts`）。必须有分隔符或像一个已知扩展名，普通单词才不会中招。 */
const BARE_PATH_RE =
  /(?<![\p{L}\p{N}_./\\-])(?:[\w.-]+(?:[/\\][\w.-]+)+|[\w-]+\.(?:[a-z]{1,5}))(?![\p{L}\p{N}_./\\-])/gu;
const URL_RE = /\bhttps?:\/\/\S+/giu;
const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/gu;
const LINK_RE = /\[([^\]]+)\]\([^)]*\)/gu;
/** emoji 及其它符号，连同后面的变体选择符。写成**择一**而不是字符类：
 *  U+FE0F 是组合字符，放进字符类会与前一个成员拼成一个新字符。
 *  （上游把两个 U+FE0F 写成字面量，这里用 `\uFE0F` 转义，语义相同。） */
const PICTOGRAPH_RE = /(?:[\p{Extended_Pictographic}\p{So}]\uFE0F?|\uFE0F)/gu;

/** 念一个像名字的 token：分隔符变空格，扩展名前的点读出来（点 / dot），
 *  camelCase 拆开，好让 espeak 拿到单词。 */
function pronounceName(token        , lang            )         {
  const dot = lang === "zh" ? " 点 " : " dot ";
  // 开头的 `@`（`@板砖` 的分发名）、`$`、`.` 没有读音。
  let t = token.replace(/^[@$.]+/, "");
  // 开头的 `./` `../` 没有读音。
  t = t.replace(/^(?:\.{1,2}[/\\])+/, "");
  t = t.replace(/[/\\:]+/g, " ");
  t = t.replace(/_+/g, " ");
  t = t.replace(/-+/g, " ");
  // 词字符之间的 `a.b` → a 点 b；末尾孤零零的点消失。
  t = t.replace(/(?<=[\p{L}\p{N}])\.(?=[\p{L}\p{N}])/gu, dot);
  t = t.replace(/\.+/g, " ");
  // camelCase / PascalCase → camel Case（只针对 ASCII —— CJK 没有大小写）。
  t = t.replace(/([a-z\d])([A-Z])/g, "$1 $2");
  return t.replace(/\s+/g, " ").trim();
}

/** 行内代码的内容该被念出来（是个名字）而不是跳过（是表达式/命令）时为 true。 */
export function isSpeakableCode(body        )          {
  const b = body.trim();
  if (b.length === 0) return false;
  return NAME_LIKE_RE.test(b);
}

/**
 * 一个单元送进合成器的文本；没有可发声内容时是 ""。纯函数；对普通散文
 * （寻常中英文句子）幂等 —— 除了空白折叠原样返回。拉丁片段那条规则在**分段器**
 * 里，不在这里：这里保留被念出来的名字，分段器才能看见它并把整句静音。
 */
export function toSpeakableText(raw        , lang             = "zh")         {
  let t = stripDisplayUnsafe(raw).replace(/\r\n?/g, "\n");
  // 整块的非语音形状，先处理。
  if (/^\s*```/.test(t) || /^\s*\|/.test(t)) return "";
  t = t.replace(SCAFFOLDING_RE, " ").replace(STRAY_TAG_RE, " ");
  // 图片消失；链接保留文字；URL 消失。
  t = t.replace(IMAGE_RE, " ").replace(LINK_RE, "$1").replace(URL_RE, " ");
  // 行内代码：名字念出来，表达式跳过。
  t = t.replace(/`([^`\n]*)`/g, (_m, body        ) =>
    isSpeakableCode(body) ? ` ${pronounceName(body.trim(), lang)} ` : " ",
  );
  // 分发符号不念，名字要念。
  t = t.replace(/@(板砖|Brick)/g, "$1");
  // markdown 脚手架，逐行处理。
  t = t
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, ""),
    )
    .join("\n");
  t = t.replace(/\*\*|__|~~/g, "").replace(/\*/g, "");
  // 散文里的裸路径/文件名按名字念。
  t = t.replace(BARE_PATH_RE, (m) => ` ${pronounceName(m, lang)} `);
  // `#E-207` → E-207（井号是版式）；孤立的井号消失。
  t = t.replace(/#(?=[\p{L}\p{N}])/gu, "").replace(/#/g, " ");
  // 箭头给停顿；其余运算符集合不给声音。
  t = t.replace(/[→⇒➜↦]/g, lang === "zh" ? "，" : ", ");
  t = t.replace(/[←⇐]/g, " ");
  t = t.replace(/[=<>|~^&+*$]/g, " ");
  t = t.replace(/\//g, " ");
  // 熬过行内代码那一趟的反引号是**没配对**的（模型没闭合的跨度）。防御性：
  // 分段器会保住成对的，但落单的那个绝不能念出来。
  t = t.replace(/`/g, " ");
  // 引号和 CJK 括号连同里面的内容一起消失 —— 但字母之间的撇号是缩写，属于
  // 单词本身，必须留：剥掉会把 "didn't" 变成 "didnt"，更糟的是把 "I'll" 变成
  // "Ill"（voice lab，英文转写），espeak 会念成形容词。撇号只在两个字母**之间**
  // 保留，下面两条择一覆盖其它所有位置（开引号、闭引号、词尾所有格）。
  t = t.replace(/(?<![\p{L}])['’]|['’](?![\p{L}])/gu, "");
  t = t.replace(/[“”‘"「」『』【】《》〈〉]/g, "");
  t = t.replace(PICTOGRAPH_RE, "");
  // 重复的记号折叠：模型读一次停顿，不是结巴。
  t = t
    .replace(/…{2,}/g, "…")
    .replace(/\.{3,}/g, "…")
    .replace(/([。！？!?])\1+/g, "$1")
    .replace(/——+/g, "——");
  // 空白：换行变成一个带停顿的空格；连续空白折叠。
  t = t.replace(/\s+/g, " ").trim();
  // 丢了开头内容的单元不留一个悬空的从句标点。
  t = t
    .replace(/^[，、；：,;:\s]+/, "")
    .replace(/\s+([，。！？；：、,.!?;:])/g, "$1");
  // CJK 标点后面不需要空格（行内代码、箭头 → ，这些替换可能引入了一个）。
  // ASCII 标点保留它后面的空格，英文单词才不会被粘在一起。
  //
  // 破折号有意**不在**这个集合里：中英两种文字都用它，折叠它后面的空格会把
  // 英文单词焊在一起（"room — Did" → "room —Did"，voice lab）；中文本来就写
  // 不带空格的 ——，留着不折叠也不亏。
  t = t.replace(/([，。！？；：、…])\s+/g, "$1");
  // 没有可发声内容 → 静音（一行 "……"，一行纯括号）。
  if (!/[\p{L}\p{N}]/u.test(t)) return "";
  return t;
}

// ── 内联件：stripDisplayUnsafe ─────────────────────────────────────────────
//
// 出处：`Herta-src/packages/core/src/text-sanitize.ts`（62 行）的
// `stripDisplayUnsafe` 与 `DISPLAY_UNSAFE`，按上游逐字内联（上游本模块通过
// `@herta/core/text-sanitize` 子路径导入它）。这样本文件不需要任何相对导入。
//
// 剥掉的是什么、为什么（上游注释的要点）：
//   - C0 控制符（除 `\n` `\t`）、DEL 与 C1 块（U+007F-U+009F）：把 ANSI 转义的
//     发起者 ESC/OSC/CSI 从源头去掉，模型输出永远别想给终端上色或写终端控制；
//     `\r` 也去掉（CRLF 归一成 LF）。
//   - 双向覆盖与隔离符（U+202A-U+202E、U+2066-U+2069）加不可见的方向标记
//     LRM/RLM（U+200E-U+200F）：模型文本里一个 RLO 就能在视觉上反转其后的一切，
//     经典显示欺骗（"evil.ts deleted" 读成 "deleted st.live"）。
//   - 行/段分隔符（U+2028-U+2029）：渲染成换行却不是 `\n`，于是基于行的扫描和
//     视觉表面会在「一行从哪开始」上分歧。
//   - 零宽字符：ZWSP（U+200B）、ZWNJ（U+200C）、BOM/ZWNBSP（U+FEFF）、词连接符
//     与不可见运算符（U+2060-U+2064）—— 不可见字符会打穿字面子串扫描器，让
//     看起来一样的字符串互不相等。ZWJ（U+200D）**有意保留**：剥掉它会破坏合法
//     的 emoji 序列（三个由 ZWJ 连接的码点渲染成一个家庭 emoji）。
//   - 落单代理项（U+D800-U+DFFF）：下游编码器会搞坏的畸形文本。`u` 标志让这个
//     类只匹配**未配对**的一半 —— 合法的一对是一个星体码点，永不匹配。
//   - Unicode Tag 块（U+E0000-U+E007F）：不可见地重编码 ASCII，是一条通往提示词
//     的隐藏指令通道。有意的取舍：emoji 标签序列（英格兰/苏格兰/威尔士旗）会
//     丢掉标签字符、退回基础黑旗 —— 可以接受。
//
// 字符类写成转义序列，源码本身保持可打印 ASCII（字面 NUL 会让 git 和某些编辑器
// 把文件当二进制）。
const DISPLAY_UNSAFE =
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u2028-\u202E\u2060-\u2064\u2066-\u2069\uD800-\uDFFF\uFEFF\u{E0000}-\u{E007F}]/gu;

/** 去掉控制符、双向覆盖符与零宽字符（确切集合与 ZWJ 例外见上）。对正常散文、
 *  CJK 和 emoji 是恒等变换 —— 每次渲染都做也安全。 */
export function stripDisplayUnsafe(text        )         {
  return text.replace(DISPLAY_UNSAFE, "");
}


//# sourceURL=segment.ts