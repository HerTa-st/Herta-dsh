/**
 * `src/host/minimax/*.ts` → `lib/minimax/*.js`。
 *
 * ## 为什么需要这一步
 *
 * host 半侧的其余模块都是**手写 JS、逐字节拷贝**（见 build.mjs），但 MiniMax
 * 这一组模块是**移植件**：上游是 TypeScript，且形状复杂到值得留类型。于是
 * 这里给这一组单独开一条编译缝 —— 别的模块不受影响，拷贝仍是拷贝。
 *
 * ## 为什么不用 esbuild / tsc
 *
 * 本机没有独立安装 esbuild（build.mjs 得去 Herta 仓库的 pnpm store 里翻），
 * 也没有 typescript。而这一组源码只用了**类型标注**（无 enum / namespace /
 * 参数属性 / decorator），Node 自带的 `module.stripTypeScriptTypes` 就够了：
 * 零依赖、毫秒级、且与 `node --experimental-strip-types` 跑测试时的语义一致。
 *
 * ## 两条必须守住的约定（写新模块的人看这里）
 *
 *  1. **类型只能用 `import type` 引**。`strip` 模式只删类型语法；写成普通
 *     `import { SomeType }` 会被留成运行时导入，而那个名字在对面是**类型、不是
 *     导出值** —— ESM 链接期直接抛 SyntaxError（"does not provide an export"）。
 *  2. **相对导入写 `./x.js`**（NodeNext 风格）。源码里磁盘上只有 `x.ts`，但
 *     产物里就是 `x.js`，所以运行时解析得到；反过来（写 `.ts`）产物会指向
 *     不存在的文件。（Node 自己也不会把 `./x.js` 解析回 `x.ts`，实测过。）
 *
 * 产物与源码的对应关系是**增量但不留残骸**的：源码里删掉的模块，产物里也会删。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const srcDir = join(root, "src", "host", "minimax");
const outDir = join(root, "lib", "minimax");

if (!existsSync(srcDir)) {
  console.log("没有 src/host/minimax/，跳过（未编译任何模块）");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

const entries = readdirSync(srcDir).filter((name) => name.endsWith(".ts"));
const keep = new Set(entries.map((name) => name.replace(/\.ts$/, ".js")));

let removed = 0;
for (const name of readdirSync(outDir)) {
  if (keep.has(name)) continue;
  rmSync(join(outDir, name), { force: true });
  console.log(`lib/minimax/${name} 已删除（源码里没有这个模块了）`);
  removed += 1;
}

for (const name of entries) {
  const source = readFileSync(join(srcDir, name), "utf8");
  let js;
  try {
    js = stripTypeScriptTypes(source, { mode: "strip", sourceUrl: name });
  } catch (err) {
    throw new Error(
      `编译 src/host/minimax/${name} 失败：${err instanceof Error ? err.message : String(err)}\n` +
        "提示：这里只支持类型标注（无 enum / namespace / 参数属性 / decorator）。",
    );
  }
  writeFileSync(join(outDir, name.replace(/\.ts$/, ".js")), js);
}

console.log(
  `lib/minimax/ 已生成（${entries.length} 个模块：${entries.join(", ")}${removed > 0 ? `；清掉 ${removed} 个陈旧产物` : ""}）`,
);
