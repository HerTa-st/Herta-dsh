# NOTICE —— 这包里的东西从哪来

本包（`dsh-theme-herta`）的**代码**是本项目的原创，按 `LICENSE`（MIT）授权。
但它**包含并移植了别人的东西**，那些部分的来源与条款如下。请一并遵守。

---

## 1. 开场动画（ASCII 开场）

`lib/opening/` 下这 10 个文件，**移植自上游项目**：

- 上游：`PersonaCLI/Herta` → `packages/gui/src/renderer/components/Opening/`
- 文件：
  `ascii-renderer.ts`、`opening-player.ts`、`glyph-sheet.ts`、`glyph-sheet-layout.ts`、
  `glyph-sheet-cache.ts`、`glyph-sheet.worker.ts`、`opening-draw.worker.ts`、
  `pick-opening-segment.ts`，以及 `lib/journey.ts`、`lib/launch-gate.ts`
- 移植方式：**类型擦除**（`node:module` 的 `stripTypeScriptTypes`），并改写了少数说明符
  （`.ts` → `.js`、worker 的 URL 字符串、`../../lib/` → `./lib/`）。
  重做移植的脚本在项目的工具目录里（`tools/port-opening.mjs`）。
- 开场数据 `lib/opening-segments/*.json` 同样来自上游的 `assets/openings/`。
- **上游的许可证：未标注标准许可证**（GitHub 读作 `NOASSERTION` / Other，2026-10-03 查）。
  也就是说**不能假定它是 MIT 或任何通用条款** —— 使用、再分发前请自行与上游确认，
  或只把 `lib/opening/` 当作"本机自用"的部分。这一条是必须知道的，别跳过。

## 2. 角色与美术素材

主题的**配色**取自角色原画，**背景图**由项目作者提供。
角色「黑塔」及其相关设定属于 **米哈游《崩坏：星穹铁道》**。

- 本项目是**非商业同人作品**，与米哈游、与 DeepSeek 官方**没有关系**；
- 请勿用于商业用途；
- 背景图与配色仅在本主题内使用；如需再分发，请自行确认权利。

## 3. 设计令牌的取值参考

`lib/theme.js` 里令牌（`--dsw-alias-*`）的**字段命名**与注入方式，参考了社区主题插件
`dsh-theme-firefly`（MIT）的公开做法 —— 只参考了**做法**，取值与配色是自算的。

原生标题栏那三个窗口键为什么会跟着主题变色：DSH 自己的 `preload-windows` 里有个隐藏
探针元素，它的 `background-color` / `color` 决定原生覆盖层的颜色 —— 这也是本主题能
在开机动画期间把它们"融掉"的原因（详见 `lib/theme.js` 里 `matchNativeCaption` 的注释）。
