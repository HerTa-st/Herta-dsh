# 构建产物只经 build 生成，不可手工修补

`lib/`、`preset/herta.patch.yml` 等产物随提交进仓库，曾经存在第二条生成路径：
`scripts/reapply-*.mjs` 那批对 `lib/client.js` 做**字符串锚点补丁**的脚本
（锚点对不上就「不猜，放弃」静默漏改）。它们存在的前提是「机器上没有 esbuild、
来不及重建」，代价已经付过两次 —— 只改产物没回填源码的**双向漂移**让
`npm run build` 静默回退过 8 处已生效的界面文案（`f65dea8`），`.bak` 备份也进过
npm tarball（`package.json` 的 `files` 收了整个 `lib/`）。

决定（2026-10-03）：**产物只经 `npm run build` 生成，esbuild 固定 0.25.12，
不存在手工修补路径。** 三条腿：

1. **固定工具链** —— `build.mjs` 与 `build-herta-ui.mjs` 只认 esbuild 0.25.12，
   候选列表删除；换版本必须显式改脚本 + 重建产物 + 过守卫，不允许静默漂移。
2. **提交时强制** —— `.husky/pre-commit` 跑 `npm run build && git diff --exit-code -- lib`：
   「产物 = 构建输出」在每次提交时被字节级验证。
3. **删掉旧路径** —— 8 个 `reapply-*.mjs` 整体删除，bundle 文本断言
   （解码 substring）一并删除：它们等于断言 esbuild 的转义风格，换版本就误报
   （2026-10-01 `label: "Fish 代理"` 变 `\u4EE3\u7406` 红过一次）。

**为什么不是只加守卫**：守卫只能拦住漂移，拦不住「有人为了赶时间再写一个补丁脚本」。
把可补丁性从工具链里删掉，下一个人才没有现成的错误示范（deletion test：
删「可补丁性」后 8 个脚本、`.bak` 断言、定点 substring 断言全部消失，复杂度归零）。

**代价与边界**：没有 esbuild 的机器不能再出产物（必须先备好 Herta-src 的
pnpm store 或设 `HERTA_SRC`）；`test-artifact-sync` 的「发布目录无 `.bak`」检查
保留 —— 它防的是「任何脚本把备份写进 npm 包」这个通用事件，不只当年的 reapply。
