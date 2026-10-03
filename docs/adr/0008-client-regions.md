# 客户端拆成四个 region + 一个薄装配层

**背景**：`src/client/index.tsx` 曾经是 **3196 行 / 90 多个顶层声明** 的单文件。它同时装着四件
互不相干的事：DSH 的 bridge 与凭据通道、语音那条 SSE 与 PCM 播放、面板/视图的渲染、
设置页的字段表与表单。后果是 **Divergent change**：改一句 PCM 播放的代码，也要在
设置页那一千多行的 diff 里挪动；而架构审查把它列为 candidate #2（四个 region 合成一份
「上帝组件」）。

耦合关系（拆之前实测，按声明归属统计交叉引用次数）显示依赖是单向的、而且不深：

```
machine  ← 被其他四个引用（装配层引用它 35 次）—— 它是底座
voice    → machine(5) ui(5)
ui       → machine(20) voice(11)
settings → machine(15) voice(12) ui(3)
装配层   → machine(35) voice(1) ui(2) settings(3)
```

**决定**：按**职责**（而不是按行数）切成四个文件，`index.tsx` 只留装配与全层共用常量。
拆分后四个 region **彼此零依赖** —— 没有一个 region import 另一个 region；它们各自 import
共享的纯模块（`../shared/mapping.js`、`../host/voice-settings-shared.js`、`../host/settings-schema.js`）。

| 文件           | 行数 | 负责什么                                              | 出口（外部只能经这些）                                                                    |
| -------------- | ---- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `index.tsx`    | 364  | 装配：`installSettingsSection` / `apply` + 共用常量   | —（入口）                                                                                 |
| `machine.ts`   | 278  | bridge / 凭据服务 / 机器字段                          | `machineValues` `machineField` `writeMachineField` `resolveCredentials` `credentialStatus` `saveCredential` `clearCredential` `subscribeCredentials` `watchCredentials` + `bindMachineForm` |
| `voice.ts`     | 708  | SSE / PCM / 播放 / 音色状态                           | `voiceModelFacts` `refreshVoiceModel` `postVoiceModel` `postMiniMaxAction` `miniMaxErrorText` `miniMaxRetryText` `subscribeMiniMax` `registerVoiceSink` `playLocalVoice` `startMiniMaxStream` + `stopVoiceModelTimer` |
| `ui.ts`        | 825  | 面板 / 视图 / 气泡 / 点击朗读                         | `HertaView` `HertaFullView`                                                               |
| `settings.ts`  | 1181 | 字段表 / 样式 / 各行 / 整个表单                        | `loadSeedModule` `createSettingsSection`                                                  |

## 两条切分的判据（比"搬代码"更要紧）

1. **状态归它所在的层独占，外面只经显式入口。** 搬家时最容易漏的不是"谁读它"，而是
   **"谁写它"**。实测两个外部写方：`machineForm` 被装配层 `apply` 赋值、`voiceModelTimer`
   被界面的 `useEffect` 清理赋值 —— 都改成了显式入口（`bindMachineForm` / `stopVoiceModelTimer`），
   否则 esbuild 会当场报 `Cannot assign to import`。**迁移前先盘写方**。
2. **断言看它该看的文件，而不是盯着某个文件的字面。** 有六条测试抓的是 `index.tsx`
   的源码文本（`ctx.get("remote.credentials")`、`spec.widget ===`、`GROUP_TRAILERS` 的注册、
   凭据服务不可用的文案、`saveCredential(props.spec.ref` …）。搬走之后它们全部变红。
   处理办法不是改判据，而是**改它去看代码现在所在的那个文件**（`machineText` / `uiText` /
   `settingsText`）—— 这也是 candidate #3 的方向。

## 复现配方（每一步都可单独验，失败就回滚）

脚本在仓库外的工作台里（`tools/extract-*.mjs`），做法一致，四步一块：

1. **按内容定边界**（不按行号 —— 每拆一块，后面的行号全移）。首行必须是完整的顶层单元
   （文档注释 / `interface` / `let` / `const` / `function`），末行必须是收尾 `}`；**这条做成脚本自检，不满足就不写盘**。
   两次失败都出在边界上：把函数的**开头**当成了段的结尾（`clearCredential`），
   以及把下个单元的**注释行**当成了结尾。
2. **整条语句地搬 import**（多行 import 要整条收）。只收首行会产出断掉的语句 ——
   esbuild 会报 `Expected "as" but found "interface"`。
3. **写方改写**（见上）。
4. **先看产出，再构建**：`node scripts/build.mjs` → `git diff --stat` → 跑测试。

判据：`npm run build` 成功、`git diff --name-only` 只剩本次动的两个文件（`src/client/*`
与重建出来的 `lib/client.js`）、测试回到基线（`test-herta-settings` 在本机是 104/17，
见下）。

## 本机已知的环境红（不是代码问题）

- `test-herta-settings` 的 17 条：比的是**另一版上游**的整机 GUI 组件与 voice-prefs 导出，
  与本仓库的改动无关（逐条核过，没有一条碰引擎取值域）。
- `test-tool-schema` / `test-narrative-layer`：需要 `@deepseek-ai/*`，而 AGENTS.md 表里那份
  运行时（`E:\deepseek工作区\HerTa\dsh-017\node_modules`）**这台机器上没有** ——
  2026-10-04 实测：`E:` 与 `C:\herta-ai\tools\_E\` 下都不存在该目录（只有 `Herta-src`）。
  在装得上的机器上设 `$env:DSH_MODULES` 即可跑。
