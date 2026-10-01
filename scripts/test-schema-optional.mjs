/**
 * 回归守卫：**入口在没有 `@deepseek-ai/schemastery` 的环境里也必须能加载。**
 *
 * ## 它防的是什么
 *
 * 用户侧真实事故：装完最新版后
 *
 *     dsh: warning: 1 entry did not activate herta (dsh-herta): failed to import
 *
 * 根因是入口里那行**静态**导入 `import z from "@deepseek-ai/schemastery";`——本包不声明
 * 任何依赖，运行时不给这个包时，模块在**解析阶段**就抛，静态导入没法 try/catch，
 * 插件整个起不来。改成兼容层（动态导入 + 兜底）之后，这里要钉住这条不变量。
 *
 * ## 它为什么这样搭环境（而不是「干净目录直接 import」）
 *
 * 入口还 import 了 `@deepseek-ai/dsh-tools` 与 `@deepseek-ai/dsh-llm`——那两样**运行时是
 * 给得出来的**（用户那台机器上它们都在，只有 schemastery 不在）。所以这里给它们造最小
 * 替身，**唯独不给 schemastery**：这正是要复现的那个环境。
 *
 * usage: node scripts/test-schema-optional.mjs [--lib=某目录]
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const flag = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit === undefined ? d : hit.split("=").slice(1).join("=");
};
const libDir = flag("lib", join(here, "..", "lib"));

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

if (!existsSync(libDir)) {
  console.error(`找不到 lib 目录：${libDir}`);
  process.exit(2);
}
console.log(`# 被测 lib：${libDir}`);

const root = mkdtempSync(join(tmpdir(), "herta-schema-"));
const pkg = join(root, "pkg");
mkdirSync(pkg, { recursive: true });
cpSync(libDir, join(pkg, "lib"), { recursive: true });

// 只造运行时**确实会提供**的那两个替身；schemastery 默认故意不造。
// 传 --with-schemastery 时**连真的那些一起造**——用来验「正常路径没被改坏」。
const withSchemastery = process.argv.includes("--with-schemastery");
const STUBS = { "@deepseek-ai/dsh-tools": ["defineTool"], "@deepseek-ai/dsh-llm": ["BlockAssembler", "createUserMessage"] };
if (withSchemastery) STUBS["@deepseek-ai/schemastery"] = ["Schema"];
const nm = join(pkg, "node_modules", "@deepseek-ai");
mkdirSync(nm, { recursive: true });
for (const [name, exports] of Object.entries(STUBS)) {
  const dir = join(nm, name.split("/")[1]);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "0.0.0", type: "module", main: "index.js" }));
  // schemastery 的替身要**像真的**：默认导出得是个可链式调用的 schema 工厂。
  // 否则兼容层那句「没有 .object 就当它不可用、退兜底」会正当触发，测出来的就不是真库那条路。
  const body =
    name === "@deepseek-ai/schemastery"
      ? [
          "const chain = new Proxy(function () {}, { get: (t, p) => (typeof p === 'symbol' || p === 'then' || p === 'toJSON') ? undefined : () => chain, apply: () => ({}) });",
          "const z = { object: () => chain, string: () => chain, number: () => chain, boolean: () => chain,",
          "  union: () => chain, literal: () => chain, array: () => chain, any: () => chain };",
          "export const Schema = chain;",
          "export default z;",
          "",
        ].join("\n")
      : exports.map((e) => `export const ${e} = new Proxy(function () {}, { get: () => () => {}, apply: () => ({}) });\n`).join("") + "export default {};\n";
  writeFileSync(join(dir, "index.js"), body);
}
console.log(`# 临时环境：${pkg}（有 dsh-tools / dsh-llm${withSchemastery ? "、**也有** schemastery" : "，**没有** schemastery"}）\n`);

console.log("=== 1) 入口必须能加载 ===");
let entry = null;
try {
  entry = await import(pathToFileURL(join(pkg, "lib", "index.js")).href);
  ok(true, "import lib/index.js 成功");
} catch (e) {
  ok(false, "import lib/index.js 成功", `${e?.code ?? ""} ${String(e?.message ?? e).split("\n")[0].slice(0, 140)}`);
}

console.log("\n=== 2) Config 要存在（拿宽容 schema 也要建得出来）===");
ok(entry?.Config !== undefined && entry.Config !== null, "导出了 Config");
ok(entry?.name === "herta", "导出了插件名 name=herta", String(entry?.name));

console.log("\n=== 3) 兜底/真库：必须是「该用谁就用谁」 ===");
try {
  const compat = await import(pathToFileURL(join(pkg, "lib", "schema-compat.js")).href);
  const expectFallback = !withSchemastery;
  ok(
    compat.usingFallbackSchema === expectFallback,
    `usingFallbackSchema === ${expectFallback}（${withSchemastery ? "有真库时不该走兜底" : "没真库时必须走兜底"}）`,
    String(compat.usingFallbackSchema),
  );
  const z = compat.default;
  const chained = z.object({ a: z.boolean().default(true).volatile(), b: z.union([1, 2]).default(1), c: z.number().min(0).max(9).default(1), d: z.string().default("x") });
  ok(chained !== undefined && chained !== null, "链式调用不抛（object/boolean/union/number/string + default/min/max/volatile）");
  ok(typeof chained.then === "undefined", "schema 节点不是 thenable（不会被 await 挂住）");
} catch (e) {
  ok(false, "兼容层可加载", String(e?.message ?? e).slice(0, 140));
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
console.log("（这条钉的是：**入口不依赖运行时的 schemastery 也能进来**。）");
process.exit(fail === 0 ? 0 : 1);
