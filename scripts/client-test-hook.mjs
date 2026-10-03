/**
 * 测试用的 ESM resolve hook：把客户端 module 需要、而仓库里没有的包指到桩。
 *
 * ## 为什么需要它
 *
 * #2 拆出四个客户端 module（`machine` / `voice` / `ui` / `settings`）之后，候选 #3
 * 才有得做：断言不必再读源码文本，可以直接 import 那个 module 断言它的返回值。
 * 但裸 Node 加载它们会停在三个包上：
 *
 * - `react` / `react-dom/client` —— 仓库刻意不带 node_modules
 * - `@gui/*` —— 上游 Herta 的整机组件与样式，住在 Herta-src
 *
 * 这个 hook 把这三类指到 `scripts/test-stubs/` 下的最小桩。**不是生产路径**：
 * DSH 真正加载插件时走的是 esbuild 打好的 `lib/client.js`。
 *
 * ## 用法
 *
 * ```powershell
 * node --import ./scripts/client-test-hook.mjs scripts/test-xxx.mjs
 * ```
 *
 * 与 `test-resolve-hook.mjs` 分开是故意的：那份要找本机 DSH 运行时、找不到就抛错，
 * 而客户端侧的断言不需要那份运行时。
 */
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const stub = (name) => pathToFileURL(join(here, "test-stubs", name)).href;

const REACT = stub("react.mjs");
const REACT_DOM_CLIENT = stub("react-dom-client.mjs");
const GUI = stub("gui.mjs");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "react") return { url: REACT, shortCircuit: true };
    if (specifier === "react-dom/client") return { url: REACT_DOM_CLIENT, shortCircuit: true };
    if (specifier.startsWith("@gui/")) return { url: GUI, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
