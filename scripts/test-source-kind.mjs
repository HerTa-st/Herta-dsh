/**
 * 回归测试：会话格式 v4 的「生产者自有 source kind」。
 *
 * ## 这个测试防的是什么
 *
 * DSH 0.1.7-rc.2 的会话格式 v4 把消息来源从
 *
 *     { kind: "plugin", plugin: "dsh-herta" }      ← 0.1.5 时代的写法
 *     { kind: "plugin:dsh-herta" }                 ← 现在唯一合法的形状
 *
 * 改了过来。旧形状在**写入会话的那一刻**就会被拒：
 *
 *     releasedV4SessionFormatCodec.encodeEvent(event)
 *       → assertV4RowAdmission(row)
 *         → assertV4SourceRowAdmission(row)
 *           → throw SessionFormatError(
 *               "format v4 message requires a producer-owned source kind")
 *
 * 症状极难定位：插件里 `agent.steer(...)` 抛出的异常让**整轮 turn 失败**
 * （GUI 渲染成「本轮运行失败」），而被拒的事件根本没进日志 —— 事后翻会话
 * 文件是干净的，只有界面上的红字。实测踩过一次（v0.1.3）。
 *
 * 所以这里把不变量钉死：host 半侧的 source kind **只有一处定义**
 * （`src/host/plugin-source.js` 的 `PLUGIN_SOURCE`），其余模块一律 import 它 ——
 * 而且它必须是非空、非 "plugin" 的 kind。
 *
 * ## 2026-10-03：从「数字面量个数」改成「断言 interface」
 *
 * 原先这里维护一张 `EXPECTED = { narrative-layer.js: 4, supervisor-llm.js: 1,
 * dream-distill-llm.js: 1 }` 的期望表，数每个文件里有几个 `source: {` 字面量 ——
 * 于是**任何一次正常重构（把字面量提成常量、调整注入路径）都会让测试变红**，
 * 而它守的东西（kind 的形状）其实没变。
 *
 * 现在改成：import 那个常量、断言它的形状（行为层），再加一条「别人不许自写
 * 字面量」（结构层）。加一个 source 注入点、或把字面量提成常量，都不再误报。
 *
 * ## 为什么仍是源码级检查而不是跑一遍运行时
 *
 * 校验函数在 `@deepseek-ai/dsh-session-format-v3-to-v4` 里，那是宿主的运行时
 * 模块（打包在 app.asar 内），测试环境拿不到 —— 硬造一个替身只会测到替身。
 * 而这条规则的判定面极小（就是两个字段的形状），源码级断言既精确又没有依赖。
 *
 * 用法：node scripts/test-source-kind.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGIN_SOURCE } from "../src/host/plugin-source.js";

const here = dirname(fileURLToPath(import.meta.url));
const hostDir = resolve(here, "..", "src", "host");

let passed = 0;
let failed = 0;

function check(ok, label) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

/**
 * 取出一个 JS 对象字面量的文本（从 `{` 到配对的 `}`，跳字符串与注释）。
 *
 * @param {string} text - 整份源码。
 * @param {number} open - `{` 的下标。
 * @returns {string | null} 字面量文本；不配对时 null。
 */
function sliceObject(text, open) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      if (nl < 0) return null;
      i = nl;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) return null;
      i = end + 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * 取一份源码里**代码位置**（非注释、非字符串里的说明文字）的 source 字面量。
 *
 * 用逐行剥离注释的方式定位，再交给 sliceObject 取完整对象 —— 这样多行字面量
 * 与 `// kind: "plugin"` 这类说明都不会误判。
 *
 * @param {string} text - 整份源码。
 * @returns {{line: number, literal: string}[]} 找到的字面量。
 */
function sourceLiterals(text) {
  const found = [];
  // `Object.freeze({...})` 也认 —— 定义处是冻结的常量（见 plugin-source.js）。
  const re = /\bsource\s*:\s*\{|\bPLUGIN_SOURCE\s*=\s*(?:Object\.freeze\()?\s*\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = text.indexOf("{", m.index);
    const literal = sliceObject(text, open);
    if (literal !== null) {
      found.push({ line: text.slice(0, m.index).split("\n").length, literal });
    }
  }
  return found;
}

/** 常量本体住这里（唯一定义处）。 */
const DEFINITION_FILE = "plugin-source.js";

console.log("=== 常量本身：形状必须合法（v4 只认生产者自有 kind）===");
{
  const kind = PLUGIN_SOURCE?.kind;
  check(typeof kind === "string" && kind.length > 0, `PLUGIN_SOURCE.kind 非空（实得 ${JSON.stringify(kind)}）`);
  check(kind !== "plugin", "kind 不是裸 \"plugin\"（v4 已退役这个值）");
  check(
    !Object.prototype.hasOwnProperty.call(PLUGIN_SOURCE, "plugin"),
    "没有 `plugin` 字段（v4 退役了这个字段名，来源身份由 kind 承担）",
  );
  check(Object.isFrozen(PLUGIN_SOURCE), "常量是冻结的（它会被塞进会话事件）");
}

console.log("\n=== 结构：定义只有一处，其余模块一律 import ===");

const hostFiles = readdirSync(hostDir).filter((name) => name.endsWith(".js"));
let definitionSites = 0;

for (const name of hostFiles) {
  const text = readFileSync(join(hostDir, name), "utf8");
  const literals = sourceLiterals(text);
  if (name === DEFINITION_FILE) {
    definitionSites = literals.length;
    for (const { line, literal } of literals) {
      const kindMatch = literal.match(/\bkind\s*:\s*(?:"([^"]*)"|'([^']*)')/);
      const kind = kindMatch === null ? null : (kindMatch[1] ?? kindMatch[2]);
      check(
        kind !== null && kind.length > 0 && kind !== "plugin",
        `${name}:${line} 定义处的 kind 合法：${literal.replace(/\s+/g, " ")}`,
      );
    }
    continue;
  }
  // 其它模块**不许自己声明 kind** —— 要么 `source: PLUGIN_SOURCE`，要么
  // `source: { ...PLUGIN_SOURCE, form, summary }`（展开常量、只加自己的字段）。
  // 所以判据是「字面量里有没有 kind 键」，不是「有没有出现 `source: {`」：
  // 展开常量那种写法也要放行。
  const inlineKind = literals.filter(({ literal }) => /\bkind\s*:/.test(literal));
  check(
    inlineKind.length === 0,
    `${name}：没有自写的 kind 字面量（改从 plugin-source.js import）` +
      (inlineKind.length === 0 ? "" : ` —— 发现 ${inlineKind.length} 处，如 :${inlineKind[0].line}`),
  );
}

check(definitionSites === 1, `${DEFINITION_FILE} 里只有 1 处定义（实得 ${definitionSites}）`);

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
