# CONTEXT.md

本仓库的共享词汇：两位开发者与 agent 在讨论、提交信息、PR 描述里用同一个词指同一件事。
**这里只放术语，不放实现细节**；改动纪律见 [`AGENTS.md`](AGENTS.md)，发版见 [`RELEASING.md`](RELEASING.md)。

## 产品四层（Herta 装进 DSH 后的分层，README 同款）

**身份（A 层）**：
`HertaBio.txt` 逐字作人格前缀 + 为 DSH 改写的处境与纪律，落在 agent preset。
_Avoid_: 人设层、persona 层

**记忆（B 层）**：
记忆货架（`.herta/narrative/`）作动态提示词段，加四个记忆/做梦工具，落在 preset 行。
_Avoid_: 知识库（知识层按计划推迟，当前实现是记忆）

**语音（C 层）**：
80 条她本人的 `.opus`（开场白/语气词/自我收回/彩蛋）+ 发声工具，落在静态路由与 client。
_Avoid_: TTS 层（TTS 只是 C 层里发声的机制之一）

**界面（D 层）**：
用她的展示组件渲染 DSH 会话（乙），或 iframe 装下她的整机（甲），落在 `conversation.view` ×2。
_Avoid_: UI 层（在本仓库 UI 特指 herta-ui 那块代码）

## 分工四域（两位开发者的模块边界）

**界面与发布域**：
`src/herta-ui/`、`preset/`、`locale/`、`cordis.patch.yml`，以及 `scripts/` 里的
`build*.mjs` / `deploy.mjs` / `install-web.mjs` —— 界面产物与发布管线。
_Avoid_: D 层（D 层是产品词汇，本域是分工词汇）

**设置与工具域**：
`src/host/settings-*.js`、`tools.js`、`schema-compat.js`、`comm-channel-effect.cjs`，
以及 `src/client/index.tsx` 的设置面 —— 用户可配的字段与 agent 可调的工具。
_Avoid_: 配置域（「配置」在本仓库也指 DSH profile 配置）

**语音域**：
`fish-*.js`、`minimax/`、`voice-*.js`、`tts-*.js`、`mimo-tts.js`、`voice-model*.js`
及其 `scripts/test-fish-*` / `test-minimax-*` / `test-tts-*` / `test-voice-*` —— 发声链路。
_Avoid_: C 层（C 层含 80 条 .opus 素材，域只覆盖发声代码）

**叙述域**：
`narrative-*.js`、`dream*.js`、`supervisor*.js`、`beat-policy.js`、`silence-guard.js`、
`session-surface.js`、`feian.js` 及其测试 —— 分拍、复核、自我收回、空轮护栏等行为。
_Avoid_: 叙述调度层（那是 `docs/叙述调度层设计.md` 讨论的方案 B，域是分工单位）

> 共享文件（如 `src/client/index.tsx` 同时含设置面与语音面）不分域：两人都可改，改前知会即可。

## 协作词汇

**直推**：
不走 PR、直接提交到 main 的改动。判据 = 改动不改对外行为（见 `AGENTS.md` 跨会话纪律）。
_Avoid_: 快速提交、小改

**跨域 review**：
改到自己域之外的文件时，PR 由该域负责人 approve —— 与直推正交，直推也受这条约束。
_Avoid_: 互相 review（太泛）

**上游**：
`PersonaCLI/Herta`（原作者仓库）。本仓库的 fork 是 `HerTa-st/Herta-g`，
只读依赖副本是 `Herta-src`（无 git）。
_Avoid_: Herta 官方、原仓库（指向不唯一）

**ADR**：
上游的架构决策记录，编号如 ADR 0061。`docs/adr/` 不在任何 git 树里，**正本不可达**；
新代码要引用决策依据时，改引上游 commit 或 PR 链接。
_Avoid_: 决策文档（太泛）、设计文档（本仓库 `docs/*.md` 是设计文档，不是 ADR）
