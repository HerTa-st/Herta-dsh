/**
 * 工具的**形状声明**必须覆盖它的返回值（2026-09-30 补）。
 *
 * ## 为什么需要它
 *
 * 当天真事故：我给记忆清单加了「因预算落选项」，`execute` 开始返回 `skipped`、
 * 渲染也开始用它，却忘了在 `output.schema.properties` 里声明 —— 而那个形状是
 * `additionalProperties: false`，于是 DSH 校验返回值时判非法，**整个工具每次都失败**。
 *
 * 单测抓不到：`test-narrative.mjs` 测的是门算得对不对，形状校验只在真实运行里发生。
 * 这条测试把「声明」与「用到」对一遍，纯静态、不用跑 DSH。
 *
 * ## 它凭什么算证据
 *
 * 不猜源码文本，而是取**函数自己的源码**（`String(fn)`）：`render` 里凡是
 * `value.xxx` 用到的字段，必须已经在 `schema.properties` 里声明；`execute` 里
 * `return {...}` / `return withX({...})` 的顶层键同理。
 *
 * 最后有一段**负例自检**：拿一个故意「用了没声明」的假工具跑同一个检查函数，
 * 必须报出来 —— 否则这条测试自己就是坏的（「我的尺子」那条教训）。
 *
 * 用法（要 DSH 包可解析，仓库里这样跑）：
 *   node --import ./scripts/test-resolve-hook.mjs scripts/test-tool-schema.mjs
 */
import { hertaDreamTool } from "../src/host/dream.js";
import { hertaSpeakTool } from "../src/host/voice.js";
import { HERTA_TOOLS } from "../src/host/tools.js";

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

/** 已声明的字段。 */
const declaredOf = (tool) => new Set(Object.keys(tool?.output?.schema?.properties ?? {}));

/** `render` 里读到的字段（`value.xxx`）。 */
function readInRender(tool) {
  const src = String(tool?.output?.render ?? "");
  return new Set([...src.matchAll(/value\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
}

/** `execute` 里顶层 `return {...}` / `return withX({...})` 的键（按行 + 括号深度）。 */
function returnedInExecute(tool) {
  const src = String(tool?.execute ?? "");
  const lines = src.split("\n");
  const keys = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    if (!/return\s+(?:\w+\()?\{/.test(lines[i]) && !/=>\s*\(\{/.test(lines[i])) continue;
    let depth = 0;
    for (let j = i; j < lines.length; j += 1) {
      const line = lines[j];
      if (j === i) depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      else {
        // 只有在 depth === 1 时收集 `key:`；收集完再更新深度。
        if (depth === 1) {
          const m = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
          if (m !== null) keys.add(m[1]);
        }
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      }
      if (depth <= 0) break;
    }
  }
  return keys;
}

/** 检查一个工具：返回没声明的字段（用到的与声明的差集）。 */
function undeclared(tool) {
  const declared = declaredOf(tool);
  const used = new Set([...readInRender(tool), ...returnedInExecute(tool)]);
  return [...used].filter((k) => !declared.has(k));
}

console.log("=== 负例自检：这个检查必须抓得住「用了没声明」 ===");
{
  const bad = {
    name: "fixture",
    output: {
      schema: { type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
      render: () => `x${value.b}`,
    },
    execute: () => ({ a: "1", c: 2 }),
  };
  const got = undeclared(bad);
  ok(got.includes("b"), "render 里读了没声明的字段 → 报出来", got.join(","));
  ok(got.includes("c"), "execute 返回了没声明的字段 → 报出来", got.join(","));
  ok(undeclared({ output: { schema: { properties: { a: {} } }, render: () => value.a }, execute: () => ({ a: 1 }) }).length === 0, "全都声明了 → 不报");
}

console.log("\n=== 真实工具：声明与使用必须一致 ===");
const tools = [...HERTA_TOOLS, hertaDreamTool, hertaSpeakTool].filter(Boolean);
ok(tools.length >= 4, `登记在册的工具 ${tools.length} 个`);
for (const tool of tools) {
  const missing = undeclared(tool);
  ok(missing.length === 0, `${tool.name}：没有未声明的字段`, missing.join(", "));
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
