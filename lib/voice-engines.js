/**
 * 四档语音引擎的**唯一声明**（候选 #4：取值域只写一遍，别处派生）。
 *
 * ## 为什么单独一个文件
 *
 * 有**两边**的模块要取它，而两边的体质要求不同：
 *   · **宿主**：`settings-schema.js`（自称纯数据、无 import）、`minimax/pipeline.ts`
 *     （`speaksFor` 判"会不会出声"）、`synth-registry.js`（回落规则的内容）；
 *   · **客户端**：`voice-settings-shared.js` 会被 esbuild 打进 client bundle
 *     （`src/client/index.tsx` 用它归一化拿回来的引擎值）。
 *
 * 所以这里**只有常量**：没有 IO、没有依赖、没有副作用 —— 谁 import 它都不会被拖进
 * 多余的东西（尤其是别把 641 行的字段表拖进客户端包）。
 *
 * 加一档时**只动这里** + 写一个 adapter 工厂；别再在第四个文件里抄第二遍。
 */

/** 取值域：`voiceEngine` 能出现的全部值（顺序即设置页里的顺序）。 */
export const VOICE_ENGINES = Object.freeze(["local", "minimax", "fish", "mimo"]);

/**
 * 哪几档**真的会出声** —— 这是行为，不是偏好。
 *
 * `mimo` 不在里面：它的合成器尚未接线（`mimo-tts.js` 在 `synth-registry.js` 里
 * 以一个 `available(): false` 的 adapter 注册着，Q6）。接上它 = 把它挪进这一行。
 */
export const SPEAKING_ENGINES = Object.freeze(["local", "minimax", "fish"]);

/**
 * 回落表：这一档失败之后换哪一档；**表里没有的档就是不回落**。
 *
 * 规则住在 router 里（ADR-0005），这张表只是"规则的内容"：
 *   · `minimax` → `local`：云端优先，云端不可用时显式回落本地模型（原因照样留住）；
 *   · `fish` / `local` / `mimo` 缺席：`fish` 是用户明确选了这一档（换个声音比没声音更糟），
 *     `local` 与 `mimo` 本来就没有下一档。
 */
export const ENGINE_FALLBACK = Object.freeze({ minimax: "local" });
