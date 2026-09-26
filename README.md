# dsh-herta

把 **Herta（黑塔）** 作为一个插件装进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：
她的人格、她的记忆、她的声音、她的界面。

> ## 📌 来源声明
>
> 本项目是**基于原作者项目所做的第三方改造**，不是原创作品。
>
> - **原作者项目**：**Herta** —— *THE SELF THAT USES THE AGENT*
> - **原作者官网**：<https://www.herta-ai.com/#research>
> - 本项目把 Herta 作为一个**插件**接进 DeepSeek Harness —— 人格、记忆、语音、界面四层
>   都来自 Herta 原作；插件侧的代码（`src/`、`scripts/`、Cordis 配置）为本次改造新写。
>
> 本项目由第三方独立开发，**与 Herta 原作者无任何隶属、合作或背书关系**。
> 如原作者认为本改造有不妥之处，请联系我，我会立即调整或撤下。
>
> 另：「Herta / 黑塔」是 HoYoverse《崩坏：星穹铁道》中的角色。Herta 原作者项目本身
> 即为**非官方同人作品**，本项目同样是非官方同人作品，与 HoYoverse / miHoYo / Cognosphere
> **无关联、未获其背书或赞助**。
>
> 素材授权细节见 [`THIRD-PARTY.md`](./THIRD-PARTY.md)。

四层，各自独立可验：

| 层 | 内容 | 落在哪 |
|---|---|---|
| **A 身份** | `HertaBio.txt` 逐字作人格前缀 + 为 DSH 改写的处境/纪律 | agent preset |
| **B 记忆** | 记忆货架（`.herta/narrative/`）作动态提示词段；四个记忆/做梦工具 | preset 行 |
| **C 语音** | 80 条她本人的 `.opus`（开场白 / 语气词 / 自我收回 / 彩蛋）+ 发声工具 | 静态路由 + client |
| **D 界面** | **乙**：用她的展示组件渲染 DSH 会话；**甲**：iframe 装下她的整机 | `conversation.view` ×2 |

---

## ⚙️ 兼容性（先看这一节）

**面向 DSH `0.1.7-rc.2`。** 本版本修的正是 0.1.5 → 0.1.7 之间三处**破坏性 API 变更**
（都是实测出来的，不是猜的）：

| 变了什么 | 0.1.5 时的写法 | 0.1.7 的现状 | 本仓库怎么办 |
|---|---|---|---|
| **agent preset 的载体** | `$DSH_HOME/.agent-presets/<name>/agent.cordis.yml`（一整棵 cordis 树）+ `preset.yml` | 该目录机制**整个移除**（运行时里已无任何代码引用 `.agent-presets`）；preset 变成一条 `@deepseek-ai/dsh-agent-preset` loader 行，官方写成 `dsh-web-app/presets/*.patch.yml` | 生成 `preset/herta.patch.yml`，作为**第二条 bundle patch** 随插件一起装（`dsh.bundle.patch` 现在可以是数组） |
| **用户偏好的存放（设置域）** | 宿主 `ctx.settings.register(ns, schema)` + 客户端 `settingsScope.bind({namespace})` | 两者**一起消失**：`SettingsProvider`/`SettingsScope`/`SettingsRegisterOptions` 不再导出，客户端 `settingsScope` 服务不存在，事件 `settings/updated`、`settings/document-updated` 也没了；换成基于插件 Config 的 `SettingsForms`/`configForms`，**没有第三方命名空间入口** | 语音偏好改为**自持**：`$DSH_HOME/dsh-herta-voice.json` + 白名单端点 `GET/PUT /herta-settings`（理由与代价见 `src/host/voice-settings.js` 文件头） |
| **消息来源的 kind（会话格式 v4）** | `{ kind: "plugin", plugin: "dsh-herta" }` | v4 只认「生产者自有 kind」，`kind: "plugin"` 在**写入会话时**就被 `assertV4SourceRowAdmission` 拒绝（`format v4 message requires a producer-owned source kind`）；第三方插件的合法形状是 `{ kind: "plugin:<包名>" }` —— 这正是 DSH 自己的 v3→v4 迁移为旧行推导出的形状，两代读回同一个 kind | 全部改成 `{ kind: "plugin:dsh-herta" }`（`agent.steer` 两处 + 两个 `PLUGIN_SOURCE`）；新增 `scripts/test-source-kind.mjs` 钉住这条不变量 |

> ⚠️ 第三处症状最难定位：被拒的事件**根本没进会话日志**（写入前就抛了），
> 事后翻 `session.v4.jsonl.zstd` 是干净的，只有 GUI 上显示「本轮运行失败」。
> 实测就是这么踩的 —— 详见 v0.1.3 版本历史。

其余用到的 API 在 0.1.7 上**没变**，实测可用：`ctx.systemPrompt.section({name,order,text})`、
`ctx.tools.register(defineTool(...))`、`ctx.inject([...])`、`ctx.slots.inject/register`、
`ctx.uiConversation.binding(id).target('chat')`、
`ctx.on('agent/turn-stopping' | 'agent/error' | 'tools/result')`、
`@deepseek-ai/dsh-llm` 的 `BlockAssembler` / `createUserMessage`、
`webServer.register({ kind: 'prefix' })`。

> 升级 DSH 后先跑这三条：
> 1. `dsh --profile <p> --dump-config` → 应有 `- id: preset-herta`，且其 `config.plugins` 末尾有 `plane: preset`
> 2. 启动日志 → 应有 `plane=host`、`plane=preset`、`叙述层依赖就绪`、`设置端点已挂`，**不应**出现 `settings.register is not a function`
> 3. `npm test` → 608 项；`npm run test:integration` → 28 项

---

## 📌 素材权利声明（clone 后先看这一节）

本仓库**包含**《崩坏：星穹铁道》的角色素材，**这些素材的权利不属于本仓库作者**：

> **© 米哈游版权所有**
>
> **【《崩坏：星穹铁道》素材的权利归米哈游所有，其他内容的相关权利、利益均归各自所有者享有】**

| 素材 | 干什么用的 |
|---|---|
| `assets/voice/`（80 条 `.opus`，2.55 MB） | C 层语音：开场白 / 语气词 / 自我收回 / 彩蛋 |
| `preset/herta.patch.yml`（42 KB） | A 层人格正本（内含 `HertaBio.txt` 逐字，含引用台词） |
| `icon.png`（384×384，173 KB） | 插件在 DSH 插件管理页里的图标（取自 Herta 上游桌面应用，缩放重编码以符合 DSH 的 ≤256 KiB 约束） |

上述声明依据米哈游官方
**《崩坏：星穹铁道》同人衍生作品创作指引 V2.0**（2024-04-18 生效）第三条放置。
素材权利未转让，收录**不构成授权**，使用**仅限非商业用途**，
且不得作为独立素材包再分发（官方指引将「纯搬运」排除在二创许可之外）。

完整声明、依据、使用者义务与移除方式见 [`NOTICE.md`](./NOTICE.md)；
Herta 上游项目自身的授权范围见 [`THIRD-PARTY.md`](./THIRD-PARTY.md)。

clone 后**开箱即用，无需自备素材**。

---

## 装

### 桌面应用（0.1.7-rc.2）

桌面应用的 DSH 运行时打包在 `resources/app.asar` 里 —— 那是 Electron 的归档格式，
**普通 Node 读不到**，所以 `install-web.mjs` 驱动不了它。走应用内置的插件管理器：

```
plugin_manager  install_bundle   file:<本仓库绝对路径>
# 然后关掉桌面应用窗口，重新打开
```

或者在有独立 DSH 安装（不是 asar 版）时用命令行：

```powershell
dsh plugin --profile desktop add file:<本仓库绝对路径>
```

### 独立 DSH 安装 / lab（脚本可全程驱动）

```powershell
$env:DSH_BIN   = "<…>\node_modules\@deepseek-ai\dsh\lib\bin.js"   # 必须能被普通 Node 启动
$env:DSH_HOME  = "<目标 home>"                                    # 可选
node scripts\install-web.mjs --dry-run    # 只读：先看它会做什么
node scripts\install-web.mjs --profile desktop
# 然后关掉桌面应用窗口，重新打开
```

脚本做四件事：**前置检查 → 备份 → 装（`dsh plugin add`，失败则走确定性兜底）
→ `--dump-config` 自校验**（herta 行必须恰好一条、`preset-herta` 必须进合成结果、
其他已装插件不能消失）。回滚：`--rollback`。

**preset 不再需要单独安装。** 0.1.7 起它是本包自带的第二条 bundle patch
（`preset/herta.patch.yml`，见 `package.json` 的 `dsh.bundle.patch` 数组），
`plugin add` 会一并生效 —— 所以这个脚本里没有「拷 preset 到 `$DSH_HOME`」那一步了，
也**不再有「preset 属于整个 home」那个副作用**。

必须关窗重开：`dsh.profile.bundles` 的变更是**启动期合成**；桌面应用没有子进程守护，
直接杀掉 `dsh web` 不会自动拉起。

出问题回滚：`node scripts\install-web.mjs --rollback`（之后同样关窗重开）。

回滚按 **home + profile 过滤**备份（每份备份带 `TARGET.json`），不是取"全局最新"——
同一台机器上装过多个 profile 时，取最新会把别人的配置还原到这边来。
该路径已实测：还原后 `bundles` 与 `dependencies` 回到安装前、找不到匹配备份时
明确报错而不是乱还原。

⚠️ 桌面应用内置的插件管理器**没有回滚**。要改它真正在用的那个 profile 之前，
先手工备份 `profiles/<name>/package.json` 与 `cordis.patch.yml`。

---

## 架构

### 这个包同时挂在两个平面上，两件事不同

| | profile bundle 行（宿主面） | preset 行（agent 面） |
|---|---|---|
| 干什么 | 让 client 半侧进浏览器启动图 + 挂四条路由（语音 / 偏好 / 模型 / 整机） | 注册她的提示词段与五个工具 |
| 为什么不换 | `dsh-client-modules` 只扫 `loader.entries()`，preset 子树不在其中 | 放宿主面会把工具泄漏给**所有**会话 |
| 怎么区分 | 行上没有 `config` | 行上带 `config: { plane: preset }` |
| 住在哪 | 包自带的 `cordis.patch.yml` | 包自带的 `preset/herta.patch.yml`（0.1.7 起 preset 就是一条普通 loader 行；旧版的 `$DSH_HOME/.agent-presets/` 目录机制已被 DSH 移除） |

两个实例的 `apply` 都会跑（模块只求值一次，fiber 是两个），所以**模块级可变状态
必须与平面无关或按 key 索引** —— 缓存按 cwd 索引就是这个原因。

preset 行现在**启动期就挂**（0.1.7 实测：冷启动日志里 `plane=host` 与 `plane=preset`
一起出现）—— 旧版 0.1.5 是懒挂载，要等第一个属于该 preset 的会话才挂。
两种都正常，但**别拿「没看到 plane=preset」当插件没装上的证据**，以 `--dump-config`
为准。

### 两条界面路线

**乙**（`conversation.view` id `herta`）—— 用她的展示组件渲染 DSH 会话。数据走
`ctx.uiConversation.binding(sessionId).target('chat')`，组件拿到的是 DSH 的
`ConversationNode[]`，映射成她的气泡。样式挂进 **shadow root**：她原版样式表的
`:root` 变量在 shadow 里不匹配任何元素，所以构建期把 `:root` 转成 `:host`、
删掉整页 chrome（见 `scripts/build.mjs`）。

**甲**（`conversation.view` id `herta-full`，页签显示「黑塔·整机」）—— iframe 装下她的整机（`/herta-ui/`）。
iframe 是**独立文档**，所以她的原版样式**原样使用**（`:root` / `body` 整页规则在这里
正好是对的）。数据经 postMessage bridge 从父窗口取；bridge 会把每个调用的**最后一条
载荷缓存下来补给新订阅者** —— 不这么做，早期那次 reset 会在渲染层订阅之前丢掉，
现象是「界面起来了但会话是空的，而且不会恢复」。

**整机页要去掉两处「宿主已经有的 chrome」**（都落在薄层 `src/herta-ui/herta-ui.css`，
两条规则，上游 `Herta-src/` 一行没动）：

| 去掉的 | 为什么 |
|---|---|
| `.composer`（她自己的输入框） | DSH 底部本来就有一整套输入区，两套并存；且她那套走 `bridge.submitText`，而 bridge **没实现**这个方法，发出去的话只会丢在地上 |
| `.window-controls`（右上角最小化/最大化/关闭） | 三个都是**死按钮** —— bridge 把它们全实现成空函数（iframe 里也没有「窗口」可最小化，该最小化的是外层 DSH 窗口） |

两处都只圈元素自己的 class、不碰父级，所以布局自动让位：`.workspace` 的
`grid-template-rows:1fr auto` 里那个 `auto` 行会跟着子项自己塌，对话区直接长满
（实测 452px → 512px），不留空档也不出双重滚动条。

### 叙述调度层（她的「自我叙述」）

她的原版里有一层**演员调度**：说什么、怎么分拍、什么时候自我收回、开口之前先想什么。
这一层在上游骑在**她自己的编码后端**上（`packages/herta/src/narrative/`，46 个模块
1.29 MB）。本插件**不移植那个后端**（DSH 就是后端），只把调度逻辑接到
**DSH 的 agent loop** 上。

完整设计（已核实的 DSH API、机制映射、踩过的坑）见
[`docs/叙述调度层设计.md`](./docs/叙述调度层设计.md)。要点：

**她的叙述语法**

```
（我 想）……（/我 想）      思考 —— 内心判断，不进用户视野
（我 说）……（/我 说）      说话 —— 真正说给开拓者的话
```

四组围栏在 zh/en 两种语言下**都是中文**（上游 `thought-hint.ts:16-18`：它们是语法
记号，不是指导语）。`src/host/narrative-hints.js` 把这套语法与上游的提示词资产
**逐字移植**进来（含 supervisor 否决模板、rethink/respeak 两阶段、三种分拍提示）。

**四种行为，各自落在 DSH 的哪个钩子上**

| 行为 | 落点 | 要 LLM 调用？ |
|---|---|---|
| **分拍**（干活中途补一句点评） | `tools/result` → 判据 → `agent.steer` | 否 |
| **自我收回 / supervisor 复核** | `agent/turn-stopping`（turn 关闭前被 await）→ 独立复核 → `steer` 让她重说 | **是** |
| **thought tag** | 输出里的围栏，由渲染层（乙 / 甲）呈现 | 否 |
| **做梦蒸馏** | `herta_dream` 的 `distill: true` → 宿主另起调用蒸馏候选 → 过门 → 落账 | **是** |

三条安全底线（缺一条都会出真问题）：**任何失败一律放行**（复核坏了不该让她说不出话）/
**配额到顶一律放行**（`steer` 会让 turn 继续，持续否决她将永远说不完）/
**拿不到模型路由就跳过**（`provider`/`model` 是必填，不猜）。

> **一个必须知道的语义差距**：DSH 的 `agent.steer` 在**下一个 step 边界**生效，
> 不像上游能在后端事件发生当拍插话。所以分拍是「事件后一个 step 补评」——
> 效果等价，时机晚一拍。

### 四条路由

前两条是**白名单静态资源**：启动时扫出文件索引，请求路径必须命中，否则 404。
不存在路径穿越的可能，也就不需要 `../` 过滤这类容易写错的代码。

- `/herta-voice` —— 80 条语音 + 代码生成的 `index.json`
- `/herta-ui` —— 整机页面（html / js / css / 开场段 / pdf worker）

后两条不是静态资源，是宿主自持的两个读写端点：

- `/herta-settings` —— 语音偏好。`GET` 读、`PUT` 写；body 上限 8 KB，只认
  `engine`（`local|minimax|mimo`）与 `realtimeVoice`（布尔），非法字段被丢弃、
  非法 JSON 回 400、其他方法回 405；落盘走「临时文件 + rename」，读方看不到半截 JSON。
  （0.1.7 起 DSH 设置域不再接受第三方命名空间注册，所以自持 —— 见
  `src/host/voice-settings.js` 文件头。）
- `/herta-voice-model` —— 本地语音模型（离线 TTS）的下载。
  `GET` 状态、`POST {"action":"download"|"cancel"|"remove"}` **点火即返回**，
  进度靠轮询 `GET` 拿。状态码与 `phase` 都用上游那套
  （`absent` / `downloading` / `ready` / `failed`，失败带 `error` 键）。
  详见下一节。

---

## 本地语音模型（离线 TTS 的模型那半）

设置面板里的「下载模型」现在是真的：宿主会去上游发布的地址取那一个归档。

**固定参数从上游扒来，钉在代码里**（`src/host/tts-release.js`）——不是运行时问服务端：

| 项 | 值 | 出处 |
|---|---|---|
| 归档 | `herta-best-e72.tar.gz` | `Herta-src/…/tts/tts-release.ts` |
| 地址 | `https://github.com/PersonaCLI/Herta/releases/download/voice-herta-best-e72/herta-best-e72.tar.gz` | 同上 |
| 体积 | 76,255,506 B（72.7 MiB） | 同上 |
| SHA-256 | `ce993a6fab911e9a86328facc952120c21de54303652f648e96e9d14ee4f172e` | 同上 |
| 解包后 | 115,897,197 B（110.5 MiB） | 同上 |
| 装到哪 | `$DSH_HOME/tts/herta-best-e72` | 上游是 `<userData>/tts`，这里跟 DSH 的 home |

上游那段注释说明了为什么要钉：*「A retrain is a new bundle id …, a new archive, new pins,
and therefore an app release: the download never trusts the host, only this file.」*
本插件**不重打包也不转发**这个归档，只是按上游发布的地址去取。

**四段，任何一段失败都不会留下半个可用的 bundle**（`src/host/voice-model.js`）：

1. 边下边算 SHA-256；先比**字节数**、再比**哈希**，任一不符即中止
2. 解到最终目录**旁边**的 `.installing/`，带解压炸弹上限（只看普通文件与目录，拒绝路径穿越）
3. 拿 bundle 自带的 `manifest.json` **逐个文件比 size + SHA-256**，还要比 `release` 是不是这一版期望的
4. 只有前三段全过，才 `rename` 就位 —— 读到的要么是旧的完整版，要么是新的完整版

已经装好的旧 bundle 在任何失败下都活着（只在第 4 步被替换）。

> ✅ **运行时已随包分发**（`assets/tts-runtime/`，22 MB，sherpa-onnx 1.13.6 +
> onnxruntime 1.27.1）。宿主会**真探测**它（拉子进程把 addon 加载起来拿版本号，
> 结果进程内缓存），探测通过才报 `runtime: true` —— 设置面板把「下载模型」按钮
> 与「实时语音」开关都 gate 在这个标志上，写死 true 就是仓库别处修过的假绿。
>
> 合成本身也实测过：`scripts/test-tts-runtime.mjs` 用真实模型合成
> 「你好。我是黑塔，天才俱乐部第八十三号。」→ **24 kHz / 5.08 s / 非静音**
> （峰值 25209、平均 2319），4.3 s 出结果。合成跑在**子进程**里
> （`src/host/tts-worker.cjs`）：sherpa 的 espeak 构建在 Windows 上处理不了
> 非 ASCII 绝对路径，而本机路径里就有中文 —— worker `chdir` 到模型根再传相对
> 路径，与上游同一招；顺带也避免了同步阻塞宿主、原生件崩溃拖死宿主。
>
> ⚠️ **还差最后一段**：把她的回复**自动**念出来（触发 + 播放）还没接。
> 也就是说 `runtime` 与 `bundle` 都是真的、引擎确实能合成，但「实时语音」开关
> 打开后她暂时不会自己开口。要接的是：回复文本 → 合成 → 推给 iframe 播放。

> ⚠️ **本机 TLS 提示。** 这台机器对 GitHub 有中间拦截，普通 Node 的 `fetch` 会直接
> `fetch failed`，加 `--use-system-ca` 才通。DSH 宿主是 Electron 拉起的**普通 Node
> 子进程**，所以要给宿主加 `NODE_OPTIONS=--use-system-ca` 再启动；下载失败时插件
> 会把这条提示写进日志（而不是只回一个 `network`）。

---

## 五个工具

| 工具 | 作用 |
|---|---|
| `herta_narrative_list` | 列出记忆货架，并如实报告哪份进了当前提示词、哪份被门拦下 |
| `herta_narrative_read` | 读某一份的完整正文 |
| `herta_memory_save` | 随手记一笔（过格式门 + 标题新颖性） |
| `herta_dream` | 做梦：门槛更高（另加篇幅下限），并记进做梦账本 |
| `herta_speak` | 让模型能主动发声；片段信息经 `presentationMeta` 落到工具结果的 `meta` 上，浏览器侧读取后播放 |

## 三道门

记忆内容会进她的系统提示词，所以写入必须过滤：

1. **格式门** —— 与读取端同一道（逐字移植 Herta 的 `few-shot-guard`）：对话栅栏必须
   平衡、不嵌套、到 EOF 全关；首行必须是 `### 废案` / `### 记录` 头；单个文件不超过
   1 万估算 token。**检查的是结构不是词汇** —— 上游第一版用词表判断，把全部 18 份
   活样本静默丢了 25 天。
2. **标题新颖性** —— 逐字移植 `novelty.ts`（含「文件名消毒后同名」那个坑与连载篇豁免）。
3. **token 预算** —— 实测她真实货架折合 **47445 tokens**，全部注入不可接受。默认预算
   12000，按「最新优先」挑选，但**拼装时排回升序**（拼接顺序与挑选顺序无关，否则
   同样内容会产出不同前缀、打散 KV 缓存）。

---

## 开发

```powershell
# 构建脚本需要一份「解开目录」的 DSH 安装（桌面应用的包在 app.asar 里，读不到）
$env:DSH_PACKAGES = "<…>\node_modules\@deepseek-ai"

node scripts\build.mjs           # client 半侧（esbuild + 模块加载器包装）
node scripts\build-preset.mjs    # agent preset 补丁层（以随附 standard 为底，只换 persona 行）
node scripts\build-herta-ui.mjs  # 整机页面
node scripts\deploy.mjs          # 三样都构建 + 镜像进 lab profile

node scripts\test-narrative.mjs        # 货架逻辑（31 项）
node scripts\test-dream.mjs            # 做梦逻辑（28 项）
node scripts\test-mapping.mjs          # DSH↔Herta 映射（41 项）
node scripts\test-narrative-hints.mjs  # 叙述语法与提示词资产（54 项）
node scripts\test-supervisor.mjs       # 复核：判决解析 / 路由 / 否决配额（81 项）
node scripts\test-session-surface.mjs  # 会话表面提取：候选回话 / 摘要 / turn（32 项）
node scripts\test-beat-policy.mjs      # 分拍判据与配额（61 项）
node scripts\test-dream-distill.mjs    # 蒸馏提示构造与解析（55 项）
node scripts\test-mimo-tts.mjs         # MiMo 合成请求构造（40 项）
node scripts\test-voice-settings.mjs   # 语音偏好的清洗 / 合并（58 项）
node scripts\test-voice-model.mjs      # 模型下载：tar 解析 / 校验 / 状态机（50 项）
```

**可选：用真实数据再跑一遍管线**（需要本机已经有一份真的 bundle —— Herta 桌面应用
在「设置 → 语音」里下过模型的话就有）：

```powershell
$env:HERTA_TTS_REAL_BUNDLE = "$env:APPDATA\Herta\tts\herta-best-e72"
node scripts\test-voice-model-real.mjs
```

它把那份真实的 **367 个文件 / 116 MB** 自己打成 tar.gz、起一个本机 HTTP 服务、
再走完整的下载 → 校验 → 解包 → 再校验 → 换入，最后**逐文件对账**。
小归档验不了的东西（真实 `manifest.json` 的 366 个真 SHA-256、真实的
`espeak-ng-data` 目录树、真实长路径）都在这里过一遍。默认不跑，因为它依赖机器上
已有的那份模型。

**可选：验证本地 TTS 运行时真能出声**（同样需要一份真实模型）：

```powershell
$env:HERTA_TTS_MODEL_ROOT = "$env:APPDATA\Herta\tts\herta-best-e72"
node scripts\test-tts-runtime.mjs
```

22 项：运行时能被加载（拿到 sherpa-onnx 版本号）→ 真合成出 **24 kHz 非静音**音频
→ WAV 头/采样数/字节数自洽 → 波形有起伏（不是一条平线）。

`npm test` 跑十三组纯逻辑测试（共 **608 项**）；另有 LLM 路径的集成测试
（28 项，用 mock 的 `ctx.llm` 把管道整条跑通）：

```powershell
npm run test:integration
# 等价于 node --import ./scripts/test-resolve-hook.mjs scripts/test-llm-integration.mjs
```

> 集成测试为什么需要那个 hook：本仓库刻意不带 `node_modules`，而
> `supervisor-llm.js` / `dream-distill-llm.js` 静态 import `@deepseek-ai/dsh-llm`，
> 在仓库里直接 import 会 `ERR_MODULE_NOT_FOUND`（在测试目录放软链接也没用 ——
> ESM 从**被导入文件**的位置解析）。hook 把它指向本机 DSH 运行时那份。

`src/shared/mapping.js` 是**纯函数**、不 import 任何东西，所以 Node 能直接测、
esbuild 也能原样打进 client bundle —— 一份代码两个消费者，不需要额外构建步骤。
之所以把它从客户端里抽出来：那是客户端逻辑最密的一段（11 种节点 → 3 种块），
埋在 `.tsx` 里就只能靠浏览器验证。

改动落在 `dsh.profile.bundles` 或 preset 上的，**必须重启实例**才生效。

环境变量：

| 变量 | 给谁用 | 含义 |
|---|---|---|
| `HERTA_SRC` | `build*.mjs`、`test-narrative.mjs` | Herta 源码树（身份正本与渲染层从这里取） |
| `DSH_PACKAGES` | `build-preset.mjs` | DSH 安装里的 `…/node_modules/@deepseek-ai`（preset 底本） |
| `DSH_MODULES` | `test-resolve-hook.mjs` | DSH 安装里的 `…/node_modules`（借 `@deepseek-ai/*`） |
| `DSH_PROFILE_DIR` | `deploy.mjs`、`test-dream.mjs` | 目标 lab profile |
| `DSH_BIN` / `DSH_HOME` | `install-web.mjs` | 可被普通 Node 启动的 dsh bin、目标 home |
| `NODE_OPTIONS` | DSH 宿主进程 | 本机对 GitHub 有 TLS 拦截时需要 `--use-system-ca`，否则模型下载会失败 |
| `HERTA_TTS_ARCHIVE_URL` | `tts-release.js` | 开发用：覆盖模型归档地址（**哈希 pin 照旧生效**，内容不能换） |

---

## 已知缺口

### ⚠️ 叙述调度层：哪些验过、哪些**没验**

如实分开写，别把「代码写完了」当成「验过了」：

| 部分 | 验到了什么 | **没验到** |
|---|---|---|
| 提示词资产、语法解析、判决解析、配额闸 | **314 项纯逻辑单测**（Node 里直接跑） | — |
| 挂载与依赖 | lab 冷启动日志：`plane=preset` + `dsh-llm` 可用 + `llm` 服务就绪 | — |
| 模型路由可读性 | lab 实测读出 `{"provider":"deepseek-official","model":"deepseek-flash"}` | — |
| LLM 路径的**管道** | **28 项集成测试**（mock `ctx.llm`）：请求组装 / 流消费 / 判决解析 / **失败一律放行**（无 llm、无路由、流抛错、`finish` 被截断） | — |
| **supervisor 复核的真实闭环** | ✅ **lab 里用假模型服务跑通了整条链**（见下）：她说没凭据的话 → 复核 `veto` → `steer` → 她重想重说 → 复核 `pass` → turn 才结束。日志：`supervisor 否决 turn 1（第 1 次）：她宣称写过笔记，但记录里没有任何写入工具调用` | 真实 **DeepSeek** 的判决质量（它到底会不会正确 veto）。假模型验的是链路与行为，不是判断力。 |
| **thought tag 的真实渲染** | ✅ 同一次验证里，她重说的回复带 `（我 想）…（/我 想）` 与 `（我 说）…（/我 说）`，页面正确呈现 | 上游那种「逐字揭示」的动画节奏（`reveal-driver`）**没移植**。 |
| **做梦蒸馏的真实行为** | ✅ **lab 实测跑通整条链**：她调 `herta_dream {distill:true}` → 两阶段（worthiness `max_tokens=300` → generation `1200`）→ 过 `promoteFeian` 的格式门 → **落盘** `.herta/narrative/### 废案_01：….txt` → **记账** `manifest.json` 记 `promoted` / `tokens: 151` | 真实 DeepSeek 蒸馏出的候选**质量**（像不像她的语气）没验。 |
| **分拍的真实行为** | ✅ **lab 实测**：mock 发起一次失败的工具调用 → `tools/result` 判 `tool-failed` → 分拍注入。日志：`tools/result #1 name=read isError=true → tool-failed` / `分拍候选 turn=1` / `分拍 turn 1（tool-failed）：cannot read …: not found` | 验证类工具的**成功**分拍（`verification-passed`）没单独验。 |

**一句话**：调度逻辑、失败路径、两条 LLM 路径的**管道**都测了；
**分拍 / thought tag / 自我收回 / supervisor 复核 / 做梦蒸馏的行为都在 lab 里
用假模型服务实测过**；**只剩「真实 DeepSeek 的判断力与语气质量」没验** ——
那需要真实凭据，且不属于代码正确性的范畴。

### 怎么确认叙述层真的在跑（启动信标）

叙述层**在放行的时候不留痕迹**：复核判 `pass` 就不注入、不写会话记录。所以在正式
环境里，光看会话记录区分不出「复核跑了并放行」与「复核压根没跑」。

`src/host/narrative-beacon.js` 把「跑到哪一步」写成一份**可读证据**，落在
`$DSH_HOME/dsh-herta-narrative.json`（lab 与正式环境各一份，互不覆盖）：

```jsonc
{
  "verdict": "叙述层在跑：复核执行过",
  "phases": {
    "install":  { "pid": 123, "depsOk": true },      // 钩子挂上了
    "llm":      { "ok": true },                      // llm 服务拿到了
    "turnStop": { "n": 3, "turn": 3 },               // turn 边界钩子触发过
    "review":   { "n": 3, "verdict": "pass" },       // 复核真的执行过（pass 也记）
    "beat":     { "n": 1, "kind": "tool-failed" }    // 分拍判据执行过
  }
}
```

`verdict` 可直接读作结论。**只放阶段名、计数、时间与 pid，不放任何对话内容。**

```powershell
# 正式环境：桌面应用的 DSH_HOME 是 %USERPROFILE%\.dsh
Get-Content "$env:USERPROFILE\.dsh\dsh-herta-narrative.json"
# lab：$env:DSH_HOME 指到哪就在哪
Get-Content "$env:DSH_HOME\dsh-herta-narrative.json"
```

同一目录下还有语音偏好 `dsh-herta-voice.json`（0.1.7 起自持，见上文「兼容性」）。

> **`turnStop` 那一条是「它活着」最硬的信号** —— 比「有没有人 veto」硬得多：
> 放行不留痕迹，而钩子被触发过就说明链路接上了。

### 怎么在没有 API Key 的环境里验这些

`scripts/mock-llm-server.mjs` —— 一个 OpenAI 兼容的 SSE 假模型服务，
按 system 提示的词判定阶段（复核 / 蒸馏 / 对话 / 第三方辅助调用），
并让**第一次复核 veto、之后 pass**，于是一次会话就能看到完整的自我收回往返。

它**不碰任何真实凭据**：DeepSeek provider 的配置里只放凭据的「名字」
（`apiKeyEnv`），密钥不进配置 —— 所以 lab 指向它时用的是假的环境变量名。

```powershell
node scripts\mock-llm-server.mjs --port 8791
# 然后在**只属于 lab** 的 profile patch 里把 llm-deepseek 指向它：
#   - id: llm-deepseek
#     config: { baseURL: http://127.0.0.1:8791, apiKeyEnv: DEEPSEEK_API_KEY, models: [{id: deepseek-flash, …}] }
# 并用一个假值启动 lab：$env:DEEPSEEK_API_KEY='mock-key-for-lab-verification'
# 验完记得还原 patch（别让它进正式配置）。
```

> 这一条路是**踩出来的**：此前几轮都以为「没有 Key 就验不了真实链路」。
> 其实要分开看 —— **真实模型回什么**验不了，但**行为链路**能验。

### 其余缺口

- **五个工具从未在真实会话里被调用过** —— 只验证到「进了工具表」与纯逻辑单测。
  lab 里没有 API Key，所以一次真实调用的闭环还没走通。
- **构建脚本需要指向一份 DSH 安装**，因为 preset 的底本是官方随附的那份。
  0.1.7 起：`build-preset.mjs` 读 `dsh-web-app/presets/standard.patch.yml`，
  通过 `DSH_PACKAGES`（指到 `…/node_modules/@deepseek-ai`）定位；集成测试与
  `test-dream.mjs` 通过 `DSH_MODULES`（指到 `…/node_modules`）借 `@deepseek-ai/*`。
  **两者都不再写死本机绝对路径**，探测不到会明确报错并告诉你设哪个变量。
  `HERTA_SRC`（Herta 源码树）仍有一个本机默认值，可用环境变量覆盖。
  ⚠️ 桌面应用的包在 `app.asar` 里，构建脚本读不到 —— 构建请指向一份
  **解开目录**的 DSH 安装（npm 安装或便携版）。
- **语音偏好不再出现在 DSH 的设置界面里**。0.1.7 移除了第三方注册设置命名空间的
  入口，所以它只在她自己的设置面板里可改（代价见上文「兼容性」一节）。
- **整机页的 `submitText` 未实现** —— 她那套输入框既然已隐藏，这条路径日常碰不到；
  但若要恢复输入框，必须同时把 bridge 的 `submitText` 补上，否则还是发不出消息。
- **C 层客户端消费 cue 的那一半未端到端验证** —— cue 的**抽取**已有单测覆盖
  （`test-mapping.mjs`），但从一个真实的 `herta_speak` 工具结果触发播放，需要
  一次模型调用才能走通。
- **整机的 `listSessions` 返回空** —— 她自己的会话列表 / 开场白 / 设备卡还没接；
  整机目前只服务「当前这一个 DSH 会话」。
- **C2（全量本地 TTS）已能合成，但还不会「自己开口」**。现在：模型能按上游地址
  下载 / 校验 / 解包 / 装好，运行时（22 MB sherpa-onnx）随包分发且被**真探测**，
  合成本身用真实模型实测过（24 kHz / 非静音，`scripts/test-tts-runtime.mjs` 22 项）。
  **没接的是最后一跳**：把她的回复自动送去合成、再推给整机 iframe 播放。
  所以「实时语音」开关会被点亮（`canSpeak = bundle && runtime && !failed` 都为真，
  而这一次这两个标志都**不是**写死的），但打开后她暂时不会出声。
  音量/静音那两个偏好走上游自己的渲染层 store，同样还没接。
- **整机页面占 20.1 MB**（16 MB JS + 3 MB 开场段）。开场段可以改成首次运行下载。
- **B 层的「知识」部分按计划推迟了**。现在实现的是**记忆**（货架 + 做梦账本 +
  四个工具）；Herta 上游 `@herta/knowledge` 里还有一套 sqlite 知识库
  （canon / 自省提取 / 剧情摄入，数百行）。当初的分期决定是「先把
  `.herta/narrative/` 的文本货架打通，sqlite 留到 B2」。
  她的**身份**不需要它（那由 A 层的人格正本负责），所以不影响她现在的可用性；
  但如果你想要「她记得设定集里的细节」这类能力，那就是这块。

---

## ⚠️ 授权

插件代码（`src/`、`lib/`、`scripts/`、Cordis 配置）为本次改造新写，采用 MIT。

**语音资产（`assets/voice/`）与人设语料（`preset/herta.patch.yml`）不在 Herta 的
MIT 范围内**，权利归米哈游及各自所有者。本仓库已按《崩坏：星穹铁道》同人衍生作品
创作指引 V2.0 第三条放置法律声明后收录：**仅限非商业使用，且不得作为独立素材包再分发**。

法律声明原文见 [`NOTICE.md`](./NOTICE.md)；上游授权范围与收录依据见
[`THIRD-PARTY.md`](./THIRD-PARTY.md)。

---

## 与 Herta 上游的关系

人格正本、格式门、新颖性判定、语音资产都来自 Herta（逐字或逐字移植，出处写在
各处注释里）。**做梦的蒸馏环节被换掉了**：原版是离线自主 pass（约 6700 行，用它
自己的 LLM 蒸馏候选），这里改由她在会话里写候选 —— 在 DSH 里模型就是她本人、
上下文就在眼前，再让宿主另起一次 LLM 调用去「蒸馏她自己」既贵又绕。
保留的是**晋升门**与**做梦账本**。


---

## 版本历史

### v0.1.3

**首个把「0.1.7 兼容修复」真正发出去的版本。** v0.1.2 那批改动（preset 载体迁移、
语音偏好自持）此前只存在于仓库里、没有单独发版；这一版连同下面几项一起发布，
tag 为 `v0.1.3`：

- **会话 v4 的消息来源 kind**（第三处破坏性变更，2026-09-26 实测补上）：注入消息
  原先写 0.1.5 时代的 `{ kind: "plugin", plugin: "dsh-herta" }`，v4 在**写入会话时**
  就拒（`format v4 message requires a producer-owned source kind`），症状是每一轮
  都报「本轮运行失败」，而被拒的事件根本没进日志 —— 翻会话文件是干净的，极难定位。
  三处 `agent.steer` / `PLUGIN_SOURCE` 全部改成 `{ kind: "plugin:dsh-herta" }`
  （与 DSH 自己的 v3→v4 迁移为旧行推导出的形状一致），并新增
  `scripts/test-source-kind.mjs` 把这条不变量钉住（已确认注入旧写法会变红）。
  同一形状的坑 `dsh-mimo-coder` 也有，一并改了它的 `PLUGIN_SOURCE`。
- **本地 TTS 运行时随包分发**（`assets/tts-runtime/`，22 MB）：sherpa-onnx 1.13.6 +
  onnxruntime 1.27.1 + espeak-ng / piper-phonemize 的 fork，许可原文在 `LICENSES/`。
  宿主**真探测**它（子进程把 addon 加载起来拿版本号）之后才报 `runtime: true` ——
  设置面板的「下载模型」按钮与「实时语音」开关都 gate 在这个标志上，两个标志都不是
  写死的。合成跑在子进程里（`src/host/tts-worker.cjs`）：sherpa 的 espeak 构建在
  Windows 上处理不了非 ASCII 绝对路径，而本机路径里就有中文。
  ⚠️ espeak-ng 是 **GPL-3.0-or-later 且静态链接**，分发前需自行拍板 —— 见
  [`THIRD-PARTY.md`](./THIRD-PARTY.md)。
- **本地语音模型的下载**（`/herta-voice-model`）：归档参数钉死在
  `src/host/tts-release.js`（`herta-best-e72` / 76,255,506 B / SHA-256），四段流程 ——
  边下边算哈希（先比字节数、再比哈希）→ 解到最终目录旁边的 `.installing/`（带解压
  炸弹上限、拒绝路径穿越）→ 拿 bundle 自带的 `manifest.json` 逐文件比 size + SHA-256
  → 前三段全过才 `rename` 就位。任何一段失败都不留半个可用的 bundle，已装好的旧
  bundle 在任何失败下都还活着。
- **插件图标** `icon.png`（384×384 / 173 KB）：满足清单对图标的两条硬约束
  （≤256 KiB、必须位于 manifest 所在目录之内），生成过程留在 `scripts/make-icon.py`。
- **构建与测试脚本去掉全部写死的本机绝对路径**：preset 底本改从
  `dsh-web-app/presets/standard.patch.yml` 取，探测不到会明确报错并告诉你设哪个变量。

兼容性细节（三处破坏性 API 变更、修之前各自的症状）见上面「兼容性」一节与
下面 v0.1.2 一节 —— v0.1.2 的正文是前两处真正发出去的内容。

**验证**：`npm test` 13 组纯逻辑用例 **608 项全过**（test-narrative 31 /
dream 28 / mapping 41 / narrative-hints 54 / supervisor 81 / session-surface 32 /
beat-policy 61 / dream-distill 55 / mimo-tts 40 / voice-settings 50 /
voice-model 50 / herta-settings 78 / source-kind 7），另有 28 项 LLM 路径集成测试
（`npm run test:integration`）。

**仍未接**：回复 → 合成 → 整机 iframe 播放那一跳 —— 「实时语音」开关会亮，
但她暂时不会自己开口。

### v0.1.2

**兼容 DSH `0.1.7-rc.2`。** 这一版全部是兼容性修复 —— 0.1.5 → 0.1.7 之间有两处
破坏性 API 变更，旧版在 0.1.7 上「界面能开、功能静默失效」：

- **修 preset**：DSH 移除了 `$DSH_HOME/.agent-presets/` 目录机制，preset 改成一条
  `@deepseek-ai/dsh-agent-preset` loader 行。`build-preset.mjs` 重写为生成
  `preset/herta.patch.yml`，并通过 `dsh.bundle.patch` **数组**随包一起装。
  修之前的表现是：`--dump-config` 一切正常，但「黑塔」这个 preset 根本不存在 ——
  A 层人设、B 层提示词段与五个工具、叙述调度层**全部静默缺席**。
- **修语音偏好**：DSH 移除了 `SettingsProvider.register` 与客户端 `settingsScope`
  （换成基于插件 Config 的 `SettingsForms`/`configForms`，无第三方命名空间入口）。
  改为自持：`$DSH_HOME/dsh-herta-voice.json` + 白名单端点 `GET/PUT /herta-settings`。
  修之前的表现是：宿主打一行 `settings.register is not a function`，客户端那个
  `ctx.inject(["settingsScope"])` **永不回调** —— 面板能开能点，值永远是默认值。
- **修构建/测试脚本**：去掉全部写死的本机绝对路径；preset 底本从
  `dsh-agent-presets/presets/standard/*`（已不存在）改为
  `dsh-web-app/presets/standard.patch.yml`；`test-dream.mjs` 不再依赖某个
  已部署的 lab profile（改用 `lib/` + resolve hook），`test-narrative.mjs`
  的临时目录改到系统 temp。
- **插件图标**：加 `icon.png`（取自 Herta 上游桌面应用的 `resources/herta-icon.png`，
  由 1024×1024 / 1.16 MB 缩放重编码为 384×384 / 173 KB），并在 `package.json` 里声明
  `"icon": "./icon.png"` —— DSH 插件管理页按这个字段显示图标。
  两条硬约束（见 `@deepseek-ai/dsh-package-manifest` 与 `dsh-app-boot` 的 `iconOf`）：
  **≤256 KiB**、**必须位于 manifest 所在目录之内**；原图两条都不满足。
  生成过程留在 `scripts/make-icon.py`，便于换图时复现。
- **本地语音模型的下载**：从上游扒来并**钉死**在 `src/host/tts-release.js` 的
  归档参数（`voice-herta-best-e72` / 76,255,506 B / SHA-256），加上完整四段流程
  （下 → 校验 → 解包 → 再校验 → 原子换入）与 `/herta-voice-model` 端点。
  同时修了整机 bridge 里三个坏成员：`downloadVoiceModel` 的兜底值曾是
  `phase:"ready"`（**假绿** —— 盘上什么都没有却显示已就绪）、`onVoiceModel` 从不订阅、
  `cancelVoiceModelDownload` 是空函数。**模型能下、能校验、能装；还发不出声**（缺运行时）。
- **修「语音模型显示约 0 MB」**（用户报，看截图发现的）：iframe 那边的
  `onVoiceModel` 只登记本地监听、**从不通知父窗口**，于是父窗口那个
  `onVoiceModel` 应答器永远不被触发 —— 它既不去读宿主的模型状态、也不推
  `voiceModel` 事件。现在订阅会补一次 `call`（与真实 preload 的语义一致），
  父窗口另外**主动推一次**。实测：iframe 收到的 `unpackedBytes` 从 `0` 变成
  `115,897,197`，即面板显示「约 116 MB」。
  > ⚠️ **下载按钮仍然点不了**：上游把它 gate 在 `disabled={!runtime}` 上
  > （`VoiceSettings.tsx:489` / `:506`），而 `runtime` 指 sherpa-onnx 原生运行时
  > 在不在。这是上游有意为之：没有运行时，116 MB 的模型下下来也用不了。
  > 要让它亮起来，得先把那 22 MB 原生件接进来。
- **随包分发本地 TTS 运行时**（应要求，22 MB）：`assets/tts-runtime/`
  （sherpa-onnx 1.13.6 + onnxruntime 1.27.1 + espeak-ng/piper-phonemize 的 fork，
  许可原文见 `LICENSES/`，**espeak-ng 是 GPL-3.0-or-later 且静态链接，分发前需自行拍板** ——
  见 `THIRD-PARTY.md`）。宿主侧新增 `src/host/tts-runtime.js`（**真探测** + 合成入口）
  与 `src/host/tts-worker.cjs`（子进程执行体：非 ASCII 路径 / 同步阻塞 / 原生崩溃
  三重隔离）。`runtime` 从恒为 `false` 变成**探测结果**，于是「下载模型」按钮
  与「实时语音」开关都会点亮 —— 而这两个标志这次都不是写死的。
  实测：真实模型合成「你好。我是黑塔…」→ 24 kHz / 5.08 s / 非静音，
  `test-tts-runtime.mjs` 22 项全过。**仍未接**：回复 → 合成 → iframe 播放那一跳。
- **验证**：531 项单测 + 28 项集成全过（`test-mapping` 的实际项数从 31 更正为 41；
  新增 `test-voice-model.mjs` 50 项，用现造的小归档覆盖哈希/体积/穿越/炸弹/取消/
  「失败不留半个 bundle」/「旧 bundle 在失败下活着」）；
  在真实 0.1.7-rc.2 运行时冷启动实测 `plane=host` / `plane=preset` /
  `叙述层依赖就绪` / 四条路由 200；无头 Edge 实测 client 半侧两个视图注册成功、
  `voiceSettingsLoaded: true`、控制台无错误；
  模型下载走**真链接**实测（HTTP 进度按字节推进，`content-length` 与 pin 逐字节一致）。

### v0.1.1

叙述调度层（方案 B）落地，并修掉一个用户报的真 bug：

- **叙述调度层**：把她的演员调度接到 DSH 的 agent loop 上（不移植上游 1.6 MB
  后端）—— `（我 想）`/`（我 说）` 叙述语法、**分拍**、**thought tag**、
  **自我收回**、**supervisor 复核**、**做梦蒸馏走 LLM**。设计见
  [`docs/叙述调度层设计.md`](./docs/叙述调度层设计.md)
- **修 bug（用户报）**：她的思考围栏被当成发言显示出来了 —— `mapping.js` 原来
  把 assistant 的整段文本无条件当 `speech`，没解析围栏
- **可观测性**：加启动信标 `$DSH_HOME/dsh-herta-narrative.json`，让「叙述层在不在
  跑」变成可读证据（放行是不留痕迹的，光看会话记录分不出来）
- **测试**：314 项单元 + 28 项集成（mock `ctx.llm`）；另有假模型服务
  `scripts/mock-llm-server.mjs` 可在无 API Key 的环境里验真实链路
- **验证边界**：五种行为都在 lab 用假模型服务实测过；**真实 DeepSeek 的判断力
  与语气质量没验**（需要真实凭据）。详见 README 的「验过 / 没验」表

### v0.1

首个公开版本：四层（人格 / 记忆 / 语音 / 界面）+ 五个工具 + 两条静态路由。
