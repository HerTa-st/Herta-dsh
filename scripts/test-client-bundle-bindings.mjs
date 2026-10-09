/**
 * **跨模块绑定的回归检查** —— 钉住 issue #14 那一类错（模块边界上少一行 import）。
 *
 * ## 为什么要单独一份
 *
 * 0.1.8 拆 region 时 `src/client/voice.ts` 漏了从 `./ui.ts` 引进
 * `rememberSpokenAudio` / `awaitingSpokenTexts`。esbuild 把未绑定标识符**当全局变量**，
 * 编译期一声不吭，于是打出的包里是"2 个调用点、0 个定义"：
 *
 *   · 每一帧 tts 都在 `onMiniMaxPcm` 抛 `ReferenceError` → 音频进不了播放队列；
 *   · 抛在 `markMinimax("minimaxAudioPlays", …)` **之前** → 连诊断标记都不留；
 *   · 症状就是"点了没反应"，而且**与引擎无关**（三档的音频都走同一个 `onMiniMaxPcm`）。
 *
 * 仓库自己的单测**照不到这里**：它们直接 import 各模块，源码里那个函数确实在 ——
 * 只是住在另一个模块里。所以这份检查的判据是**成对的**：
 *
 *   定义方必须 `export` → 使用方必须 `import` → 产物里必须真的有定义；
 *   而"产物里被调用却没有定义"就是那个错本身。
 *
 * 与 `test-client-bundle-bindings*.mjs` 的关系：**就这一份**。早先试过按模块边界做
 * 通用词法检查，噪声大到不可用（对象字面量的键、CSS 片段都会被当成标识符）——
 * 判据要窄，窄到只钉这一件事，它才是确定性的。
 *
 * 跑法：`node scripts/test-client-bundle-bindings.mjs`（前置：`npm run build`）
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const ui = read("src/client/ui.ts");
const voice = read("src/client/voice.ts");
const bundle = read("lib/client.js");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}`);
  }
}

/** 从 `import { a, b } from "./ui.ts"` 里取出名字（只认具名导入）。 */
function namedImportsFrom(source, moduleSpec) {
  const out = new Set();
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${moduleSpec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "g");
  for (const m of source.matchAll(re)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name !== "") out.add(name);
    }
  }
  return out;
}

console.log("client-bundle-bindings（跨模块绑定：issue #14 那一类）");

// ── 1. 定义方：两个符号都必须 export ────────────────────────────────────────
for (const name of ["rememberSpokenAudio", "awaitingSpokenTexts"]) {
  const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|var)\\s+${name}\\b`).test(ui);
  check(`${name} 在 ui.ts 里是 export 的`, exported);
  check(`${name} 在 ui.ts 里确实有定义`, new RegExp(`(?:function|const|let|var)\\s+${name}\\b`).test(ui));
}

// ── 2. 使用方：必须从 ./ui 具名导入（esbuild 的未绑定标识符就是这样漏出来的）──
{
  const imported = namedImportsFrom(voice, "./ui.ts");
  check("voice.ts 从 ./ui.ts 导入了 rememberSpokenAudio", imported.has("rememberSpokenAudio"));
  check("voice.ts 从 ./ui.ts 导入了 awaitingSpokenTexts", imported.has("awaitingSpokenTexts"));
  check("voice.ts 里确实用到了它们（不然这条导入会被 lint 删掉）",
    /rememberSpokenAudio\s*\(/.test(voice) && /awaitingSpokenTexts\b/.test(voice));
}

// ── 3. 产物：定义必须在，调用点也必须在 ─────────────────────────────────────
//
// 产物是 CJS + esbuild 的内联，`import` 已经消失 —— 所以这里查的是**结果**：
// 那个名字在包里到底有没有一个 `function` / `var` 定义。
{
  const defs = {
    rememberSpokenAudio: /function\s+rememberSpokenAudio\s*\(/.test(bundle),
    awaitingSpokenTexts: /(?:var|let|const)\s+awaitingSpokenTexts\s*=/.test(bundle),
  };
  for (const [name, hasDef] of Object.entries(defs)) {
    check(`产物里 ${name} 有定义（issue #14 的正式判据：不能只有调用点）`, hasDef);
  }
  const calls = (bundle.match(/rememberSpokenAudio\s*\(/g) ?? []).length;
  check(`产物里 rememberSpokenAudio 的调用点还在（≥3 处：1 定义 + 2 调用）`, calls >= 3);
}

// ── 4. 反向：产物里"被调用却全文件无定义"的名字，一个都不许有 ───────────────
//
// 只看**这一对**已知会炸的形态，不做通用静态分析（那需要 parser，而且噪声很大）。
// 判据是确定的：这个函数要么在包里被定义，要么没有。
{
  const suspects = [];
  for (const name of ["rememberSpokenAudio", "awaitingSpokenTexts", "recallSpokenAudio", "spokenAudio"]) {
    const used = new RegExp(`(?<![\\w$.])${name}\\s*[(.[]`).test(bundle);
    const defined = new RegExp(`(?:function|var|let|const)\\s+${name}\\b`).test(bundle);
    if (used && !defined) suspects.push(name);
  }
  check("没有「被用到、却没有定义」的客户端符号", suspects.length === 0);
  if (suspects.length > 0) console.error(`      未绑定：${suspects.join(", ")}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
