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
 * 所以这里把不变量钉死：host 半侧**每一处** source 字面量都必须是
 * 非空、非 "plugin" 的 kind。
 *
 * ## 为什么是源码级检查而不是跑一遍运行时
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
  const re = /\bsource\s*:\s*\{|\bPLUGIN_SOURCE\s*=\s*\{/g;
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

// 需要被检查的模块：所有真会构造消息的 host 模块。
// `narrative-layer.js` 的四处是**必须**存在的（复核否决 + 分拍 + 空轮提醒 + 它的
// 退回注入各一条）；少了说明它被改成了别处构造，应当同步更新本测试。
const EXPECTED = new Map([
  ["narrative-layer.js", 4],
  ["supervisor-llm.js", 1],
  ["dream-distill-llm.js", 1],
]);

console.log("=== 会话 v4 source kind：host 半侧字面量 ===");

const hostFiles = readdirSync(hostDir).filter((name) => name.endsWith(".js"));
const seen = new Map();

for (const name of hostFiles) {
  const text = readFileSync(join(hostDir, name), "utf8");
  const literals = sourceLiterals(text);
  if (literals.length === 0) continue;
  seen.set(name, literals.length);
  for (const { line, literal } of literals) {
    // 只取 kind 字段——其余字段（plugin / form / summary）在 v4 下已不存在。
    const kindMatch = literal.match(/\bkind\s*:\s*(?:"([^"]*)"|'([^']*)')/);
    const kind = kindMatch === null ? null : (kindMatch[1] ?? kindMatch[2]);
    // v4 退役了 `plugin` 这个**字段名**（来源身份改由 kind 承担），所以只允许
    // 出现 kind 一个字段。注意别把 kind 的**值**（`plugin:dsh-herta` 前缀，
    // 正是合法形状）误判成字段名：要求 `plugin` 后面紧跟冒号，且前面是
    // `{`、`,` 或空白，不能是引号内部的字符。
    const hasPluginField = /(?:^|[{,\s])plugin\s*:/.test(literal);
    const ok = kind !== null && kind.length > 0 && kind !== "plugin" && !hasPluginField;
    check(
      ok,
      `${name}:${line}  ${literal.replace(/\s+/g, " ")}`,
    );
  }
}

console.log("=== 覆盖面：每个该有 source 的模块都在 ===");
for (const [name, expected] of EXPECTED) {
  const actual = seen.get(name) ?? 0;
  check(actual === expected, `${name} 有 ${actual} 处 source 字面量（期望 ${expected}）`);
}

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
