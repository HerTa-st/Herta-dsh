# 第三方素材与授权

## 上游项目

本插件的素材与人格语料全部来自 **Herta**（原作者项目）：

- **原作者项目**：Herta —— *THE SELF THAT USES THE AGENT*（`PersonaCLI/Herta`）
- **原作者官网**：<https://www.herta-ai.com/#research>

Herta 为**第三方开发**（其 `LICENSE` 署名 `Copyright (c) 2026 PersonaCLI`），
且为非官方同人作品。本插件是在 Herta 之上的**第三方改造**，
**与 Herta 原作者无隶属、合作或背书关系**。

## `assets/voice/`（80 条 `.opus`，2.5 MB）—— 角色语音

**这批音频不在 Herta 上游的 MIT 授权范围内**，权利另有归属；本仓库现按米哈游官方
同人指引放置法律声明后**随仓库分发**（声明原文见 [`NOTICE.md`](./NOTICE.md)）。

来源：`D:\Herta\resources\voice\`（本机安装的 Herta 0.1.5），原始出处为 Herta 上游仓库的
`data/voice/**`。Herta 的 `LICENSE` 用 SCOPE 段声明 MIT **只覆盖源代码**，并明确排除：

```
packages/gui/build/**          角色图标
packages/gui/resources/**      应用内美术
packages/herta/prompts/**      人格与设定语料、引用台词
website/src/assets/**
website/public/**
data/voice/**                  语音（上游仓库自身并不分发）
```

同时 Herta 为非官方同人作品，其 `electron-builder.yml` 的 copyright 字段写明
非 HoYoverse 背书。

### 收录依据

1. **Herta 原作者已同意**本仓库收录并分发这批素材 —— 解决上游那一层。
2. **米哈游官方口径**：《崩坏：星穹铁道》同人衍生作品创作指引 V2.0（2024-04-18 生效）
   第三条 Q1 明确，不禁止**非商业性质的个人使用**，可基于游戏素材制作并发布衍生内容；
   使用**角色配音 / 声音样本**等素材时**应放置法律声明** —— 即 `NOTICE.md` 中那两句。
   本仓库照此放置。

### 仍然成立的约束

- **仅限非商业用途**：不得出售，不得随商业项目分发。
- **不得作为独立素材包再分发**：官方指引把「纯搬运」（原样转载素材本身）排除在二创许可之外。
  要分发就连同本插件一并分发，并保留 `NOTICE.md`。
- **米哈游保留随时要求移除的权利**：收到要求即删 `assets/voice/`、
  `preset/herta.patch.yml` 与 `icon.png`，插件代码（MIT）不受影响。
- 若要用于超出「个人非商业使用」的场景，**声音相关人身权利需自行与配音人员确认并取得授权**
  —— 官方指引明示这一点由使用者自行负责。

`package.json` 的 `files` 里保留 `assets`，以便 `dsh plugin add` 能把语音一起装进去。

## 人格语料（`preset/herta.patch.yml`，42 KB）

内含 `HertaBio.txt` 正文逐字，来自 `Herta-src/packages/herta/prompts/HertaBio.txt`，
同样属于上表被排除的 `packages/herta/prompts/**`，其中**含引用台词**。

**收录依据与约束同上**（原作者同意 + 米哈游同人指引法律声明 + 仅限非商业）。
该文件是 `build-preset.mjs` 的产物（以随附的 standard preset 为底，只换 persona 行），
配好 `HERTA_SRC` 的机器上跑 `node scripts\build-preset.mjs` 可重新生成。

## 图标（`icon.png`，384×384 / 173 KB）

取自 Herta 上游桌面应用的 `resources/herta-icon.png`（原图 1024×1024 / 1.16 MB），
缩放重编码以符合 DSH 清单对图标的两条硬约束（≤256 KiB、必须位于包目录内）。
与上面两项同属角色素材，**收录依据与约束同上**；生成过程见 `scripts/make-icon.py`。

## 从 Herta **移植**的代码

插件侧代码为本次工作新写（MIT），但其中有几处是 **Herta 源码的逐字/近乎逐字移植**
（保留了原始注释与出处说明），列在这里以便追溯：

| 本仓库 | Herta 上游 |
|---|---|
| `src/host/narrative.js` | `packages/herta/src/narrative/`（`static-prefix.ts`、`few-shot-guard.ts`） |
| `src/host/feian.js` | `packages/herta/src/knowledge/novelty.ts` 等 |
| `src/host/narrative-hints.js` | 叙述语法与提示词资产（`thought-hint.ts` 等） |
| `src/host/session-surface.js` | `@deepseek-ai/dsh-session` 与上游会话表面提取口径 |
| `src/host/tar-extract.js` | `packages/gui/src/main/tts/tar-extract.ts`（去掉 TS 类型，内联 `isPathInside`） |
| `src/host/bundle-verify.js` | `packages/gui/src/main/tts/bundle-verify.ts` |
| `src/host/voice-model.js` | `packages/gui/src/main/tts/voice-model.ts` + `tts-path.ts` |
| `src/host/tts-release.js` | `packages/gui/src/main/tts/tts-release.ts` + `tts-path.ts`（**URL / 体积 / SHA-256 三个 pin 逐字照抄**） |

这些移植落在 MIT 覆盖的**源代码**范围内（Herta 的 `LICENSE` 排除的是
`packages/gui/build/**`、`packages/gui/resources/**`、`packages/herta/prompts/**`、
`website/**`、`data/voice/**` 这几处素材，不含 `packages/gui/src/**`）。

## 本地 TTS 运行时（`assets/tts-runtime/`，22 MB）

随包分发的 sherpa-onnx 原生运行时，取自 Herta 上游桌面应用的
`resources/tts-runtime/`（即上游 `packages/gui/` 的 `tts-runtime` 暂存目录）。
它让离线语音引擎**真的能出声**（实测 24 kHz / 非静音，见
`scripts/test-tts-runtime.mjs`）。

| 组件 | 版本 / 来源 | 许可 |
|---|---|---|
| sherpa-onnx（神经语音运行时） | 1.13.6 | **Apache-2.0** |
| onnxruntime（由 sherpa-onnx 捆绑） | 随 1.13.6 捆绑，实测 `1.27.1` | **MIT** |
| piper-phonemize（sherpa-onnx fork，commit `f3ff95af`） | 静态链进 `sherpa-onnx-c-api` | **MIT** |
| espeak-ng（sherpa-onnx fork，commit `ed530aa1`） | 静态链进 `sherpa-onnx-c-api` | ⚠️ **GPL-3.0-or-later** |

四份许可原文一并收录在 `assets/tts-runtime/LICENSES/`（逐字取自上游
`packages/gui/resources/licenses/`）。

> ⚠️ **`espeak-ng` 是 GPL-3.0-or-later，而且静态链接进 `sherpa-onnx-c-api.dll`。**
> 这个 dll 一旦随包分发，GPL 的义务就跟着它（要能提供对应源码 —— 上游通知文件里
> 指的就是 sherpa-onnx 1.13.6 的 CMake 树与那个 fork 的 commit）。
> 本地自用没问题；**要公开分发这个包时，这一条需要你自己拍板**。
> 不承担的办法只有一个：不随包分发离线引擎（也就失去本地合成能力）。
>
> ⚠️ **而且「公开分发」这件事已经发生了**（2026-09-30 核实）：`package.json` 的
> `files` 里有 `assets`，所以 npm 上的 `dsh-herta@0.1.4` **已经包含**这 22 MB 原生件
> —— 上面那条不是在讨论「将来某天」。要么按 GPL 处理（随包提供对应源码或书面要约，
> 并把这一项也写进 [`NOTICE.md`](./NOTICE.md)），要么把 `assets/tts-runtime/` 从
> 发行物里去掉（本地引擎不可用，云端引擎不受影响）。
> 另：`NOTICE.md` 的素材清单此前**只列了角色素材**，漏了这块原生件 —— 已在那一份里补上。

## 模型归档

本地语音模型（`herta-best-e72`）**不随本仓库分发**：插件只是按上游发布的地址
（`PersonaCLI/Herta` 的 `voice-herta-best-e72` release）在用户点「下载」时去取，
哈希 pin 与上游 `tts-release.ts` 一致。模型本身的授权归上游项目。

## 其余

插件自身的其余代码（`src/`、`scripts/`、`Cordis` 配置）为本次工作新写，可采用 MIT。
