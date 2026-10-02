/**
 * 开场段落的惰性加载器。
 *
 * **这一处是手改的（非上游）**：上游用的是 Vite 专有的
 * `import.meta.glob("../../assets/openings/*.json", { import: "default" })`。
 * 浏览器里没有 `import.meta.glob` —— 这个文件一直没人 import 所以没炸过，
 * 但只要有人 import 它，模块求值当场 TypeError。
 * 改成显式清单：四个段落与 `lib/opening-segments/` 里的文件一一对应，
 * 用 fetch 取（和客户端驱动 `client.js` 取段落的同一条路，不需要打包器，
 * 也不需要 JSON 模块的 import attributes）。
 *
 * 重跑 `tools/port-opening.mjs` 会把这里覆盖回 glob 版（那个脚本自己会打印提醒）。
 */

/** 段落文件名 —— 与 `lib/opening-segments/` 目录内容对应。 */
export const OPENING_SEGMENT_NAMES = ["b-0.json", "b-1.json", "c-0.json", "c-1.json"];

/** 相对**本文件**的基准地址：段落资源与本文件同在包内。 */
const SEGMENTS_BASE = new URL("../opening-segments/", import.meta.url);

const SEGMENT_LOADERS = Object.fromEntries(
  OPENING_SEGMENT_NAMES.map((name) => [
    name,
    async () => {
      const res = await fetch(new URL(name, SEGMENTS_BASE));
      if (!res.ok) throw new Error(`取 ${name} 失败：HTTP ${res.status}`);
      return res.json();
    },
  ]),
);

/**
 * Pick a random one of the opening segment loaders. `loaders`/`rng` are
 * injectable for tests; production uses the real list + Math.random.
 */
export function pickOpeningSegment(loaders = SEGMENT_LOADERS, rng = Math.random) {
  const keys = Object.keys(loaders).sort();
  if (keys.length === 0) {
    throw new Error("no opening segment assets found");
  }
  const index = Math.min(keys.length - 1, Math.floor(rng() * keys.length));
  return loaders[keys[index]];
}


//# sourceURL=packages__gui__src__renderer__components__Opening__pick-opening-segment.ts
