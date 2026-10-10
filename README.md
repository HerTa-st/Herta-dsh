# dsh-herta

把 **Herta（黑塔）** 作为一个插件装进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：
她的人格、她的记忆、她的声音、她的界面。

> ## 📌 来源声明
>
> 本项目是**基于原作者项目所做的第三方改造**，不是原创作品。
>
> - **原作者项目**：**Herta** —— _THE SELF THAT USES THE AGENT_
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

---

## 🎨 相关仓库：主题

界面配色、开机 ASCII 开场、可换背景与「外观」设置页，是**另一个包**：
**[`dsh-theme-herta`](https://github.com/HerTa-st/dsh-theme-herta)** —— 也可以单独安装
（没装本插件的人，照样能只下主题）。

> **0.1.7 起本插件自带它。** 接线三件事都已落地：主题已发到 npm
> （`dsh-theme-herta@0.1.0`）、本包把它列成依赖、`cordis.patch.yml` 里多了一行
> 并列的 `ui-theme-herta`。所以装了本插件就一起拿到主题，**不用再单独装**；
> 装完照例要**关窗重开**（bundle 是启动期挂载的）。
>
> 主题包自己的 `cordis.patch.yml` 不会被自动应用 —— loader 只读 profile 的
> `dsh.profile.bundles` 里那些包的 patch，所以挂载点必须由本包给出。
>
> 本仓库里也放了同一份源码（`theme/dsh-theme-herta/`）。⚠️ 主题的
> `NOTICE.md` 记着一条**未决的授权边界**：`lib/opening/` 那 10 个文件移植自
> `PersonaCLI/Herta`，而那个上游**未标注标准许可证**（GitHub 读作
> `NOASSERTION`）—— 用之前请自己与上游确认。

四层，各自独立可验：

| 层         | 内容                                                                 | 落在哪                 |
| ---------- | -------------------------------------------------------------------- | ---------------------- |
| **A 身份** | `HertaBio.txt` 逐字作人格前缀 + 为 DSH 改写的处境/纪律               | agent preset           |
| **B 记忆** | 记忆货架（`.herta/narrative/`）作动态提示词段；四个记忆/做梦工具     | preset 行              |
| **C 语音** | 80 条她本人的 `.opus`（开场白 / 语气词 / 自我收回 / 彩蛋）+ 发声工具 | 静态路由 + client      |
| **D 界面** | **乙**：用她的展示组件渲染 DSH 会话；**甲**：iframe 装下她的整机     | `conversation.view` ×2 |

---

## ⚙️ 兼容性（先看这一节）

**面向 DSH `0.1.7-rc.2`。** 本版本修的正是 0.1.5 → 0.1.7 之间三处**破坏性 API 变更**
（都是实测出来的，不是猜的）：

| 变了什么                           | 0.1.5 时的写法                                                                       | 0.1.7 的现状                                                                                                                                                                                                                                                                                | 本仓库怎么办                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **agent preset 的载体**            | `$DSH_HOME/.agent-presets/<name>/agent.cordis.yml`（一整棵 cordis 树）+ `preset.yml` | 该目录机制**整个移除**（运行时里已无任何代码引用 `.agent-presets`）；preset 变成一条 `@deepseek-ai/dsh-agent-preset` loader 行，官方写成 `dsh-web-app/presets/*.patch.yml`                                                                                                                  | 生成 `preset/herta.patch.yml`，作为**第二条 bundle patch** 随插件一起装（`dsh.bundle.patch` 现在可以是数组）                                                                                                                                   |
| **用户偏好的存放（设置域）**       | 宿主 `ctx.settings.register(ns, schema)` + 客户端 `settingsScope.bind({namespace})`  | 两者**一起消失**：`SettingsProvider`/`SettingsScope`/`SettingsRegisterOptions` 不再导出，客户端 `settingsScope` 服务不存在，事件 `settings/updated`、`settings/document-updated` 也没了；换成基于插件 Config 的 `SettingsForms`/`configForms`，**没有第三方命名空间入口**                   | 用后者：插件自己的 volatile `Config`（落 profile 的 `cordis.patch.yml`），客户端挂 `settings.section` 一页。密钥另走凭据缝 `ctx.remote.credentials`（值进 `$DSH_HOME/.credentials.yaml`，不进明文配置）。2026-09-26 起**黑塔的设置只有这一处** |
| **消息来源的 kind（会话格式 v4）** | `{ kind: "plugin", plugin: "dsh-herta" }`                                            | v4 只认「生产者自有 kind」，`kind: "plugin"` 在**写入会话时**就被 `assertV4SourceRowAdmission` 拒绝（`format v4 message requires a producer-owned source kind`）；第三方插件的合法形状是 `{ kind: "plugin:<包名>" }` —— 这正是 DSH 自己的 v3→v4 迁移为旧行推导出的形状，两代读回同一个 kind | 全部改成 `{ kind: "plugin:dsh-herta" }`（`agent.steer` 两处 + 两个 `PLUGIN_SOURCE`）；新增 `scripts/test-source-kind.mjs` 钉住这条不变量                                                                                                       |

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
>
> 1. `dsh --profile <p> --dump-config` → 应有 `- id: preset-herta`，且其 `config.plugins` 末尾有 `plane: preset`
> 2. 启动日志 → 应有 `plane=host`、`plane=preset`、`叙述层依赖就绪`、
>    `设置命名空间已就绪：herta（自带页面，不自动生成）`、`整机页面已挂：/herta-ui`，
>    **不应**出现 `settings.register is not a function`，也不应再出现
>    `从整机迁移设置：…`（种子已删除）或 `设置写回已挂`（写回已删除）
> 3. `npm test` → 1544 项（31 组）；`npm run test:integration` → 28 项

---

## 📌 素材权利声明（clone 后先看这一节）

本仓库**包含**《崩坏：星穹铁道》的角色素材，**这些素材的权利不属于本仓库作者**：

> **© 米哈游版权所有**
>
> **【《崩坏：星穹铁道》素材的权利归米哈游所有，其他内容的相关权利、利益均归各自所有者享有】**

| 素材                                      | 干什么用的                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `assets/voice/`（80 条 `.opus`，2.55 MB） | C 层语音：开场白 / 语气词 / 自我收回 / 彩蛋                                                     |
| `preset/herta.patch.yml`（42 KB）         | A 层人格正本（内含 `HertaBio.txt` 逐字，含引用台词）                                            |
| `icon.png`（384×384，173 KB）             | 插件在 DSH 插件管理页里的图标（取自 Herta 上游桌面应用，缩放重编码以符合 DSH 的 ≤256 KiB 约束） |

上述声明依据米哈游官方
**《崩坏：星穹铁道》同人衍生作品创作指引 V2.0**（2024-04-18 生效）第三条放置。
素材权利未转让，收录**不构成授权**，使用**仅限非商业用途**，
且不得作为独立素材包再分发（官方指引将「纯搬运」排除在二创许可之外）。

完整声明、依据、使用者义务与移除方式见 [`NOTICE.md`](./NOTICE.md)；
Herta 上游项目自身的授权范围见 [`THIRD-PARTY.md`](./THIRD-PARTY.md)。

clone 后**开箱即用，无需自备素材**。

---

## 装

### 插件市场 / npm

**已收录**：条目在上游精选目录
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（PR
[#5946](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/5946)，**2026-09-29 合并**）。
所以 DSH 内置的**插件市场（dshmarket）**里搜 `herta` 就能找到「Herta-dsh」并一键安装 ——
2026-10-01 实测：本机市场的目录（`/dsh-market/registry`）里已经有这一条，`added: 2026-09-29`。

> 📌 **目录与版本是两条链**：目录（简介、分类、下载量、能力扫描）由上游 CI 每日重建，
> 而**装到哪个版本以 npm 的 `latest` 为准** —— 市场里「有更新」的判据也是 npm 的
> `latest` dist-tag（`dshmarket/lib/updates.js`）。所以新版本发到 npm 之后用户立刻能装到，
> 目录卡片上的版本号要等下一次重建才跟上。
>
> ⚠️ 市场搜索的候选集**只有**那份上游目录（2026-10-01 实测 **4400 条**），**不含**本机已装
> 的插件，也没有「自定义目录源」这个用户入口。所以 `file:` 装进来的插件不会出现在搜索结果
> 里 —— 要能被搜到，就必须先被收录。
>
> 条目里那条 `install: dsh plugin --profile web add dsh-herta` 是上游 CI 按模板生成的通用值
> （条目文件里作者只写 `url` / `name` / `category` / `description` 四项）；桌面应用要把
> profile 换成 `desktop`。

也可以直接装 npm 包（`dsh-herta`，0.1.4 起有）：

```powershell
dsh plugin --profile desktop add dsh-herta
```

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

### 装完之后，怎么让她出声

**装好 ≠ 会说话。** 默认引擎是「本地模型」，而模型要另行下载；不做下面这几步，她会
一个字都不念。以前这里**连原因都不显示**（2026-09-30 体检后已修：失败原因会写在
设置页那一行上）。五步：

1. **打开设置**：DSH 设置 ▸ 黑塔 ▸ 「语音」组。
2. **二选一**（要么下模型、要么填密钥）：
   - **本地模型**（不花钱、不联网）：到「整机动作」组点「本地语音模型」的**下载**，
     约 72.7 MiB，装到 `$DSH_HOME/tts/herta-best-e72`；然后在「语音引擎」里选
     `本地模型`。**只有 GitHub 这一个源**（被墙时那个「安装包网盘」里**没有**模型）。
   - **云端**：「密钥」组里填 MiniMax 或 Fish 的密钥，再把「语音引擎」切到那一档。
     ⚠️ **MiniMax 只「认领」你账号上已有的克隆音色，不做上传/克隆** —— 新账号上还没有
     那个克隆时，**填了密钥也不会出声**。
3. **点「试听」那一行**：有声就说明这条链通了。没声就看同一行的**状态行** —— 它现在会说
   原因（没有密钥 / 模型没装 / 连不上且没配代理 / 认领失败…）。
4. **Fish 引擎要能连上接口**：插件按 **`fishaudio.org`**（官方现在用的域名，国内可直连）→
   **`api.fish.audio`**（旧域名，国内会被**按 SNI 重置**，只作海外兜底）的顺序试。
   两条都不通时才需要在「Fish 语音」组填 **「Fish 代理」**（例如 `http://127.0.0.1:7897`），
   或者设 `HTTPS_PROXY` 环境变量；**留空 = 直连**。都失败时状态行会直说原因。
   ⚠️ **音色 id 跟域名绑定**：默认的大黑塔属于 `fishaudio.org`，id 是
   `36e4d5f5-7654-43d4-b160-a1f15398116f`（旧域名那个 `f9ede038…` 在新域名下会返回
   `ERR_VOICE_NOT_FOUND`）。手动换域名时，「Fish 音色」那一行要跟着换。
5. **不想花钱 / 不想被吵到**：「语音」组里
   - **实时语音**关掉 = 不再自动念回复（省钱；`herta_say` 与试听不受它管）；
   - **静音**只决定**听不听得见**，**不决定要不要花钱合成**（合成照旧发生）。

---

## 架构

### 这个包同时挂在两个平面上，两件事不同

|            | profile bundle 行（宿主面）                                            | preset 行（agent 面）                                                                                                                 |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 干什么     | 让 client 半侧进浏览器启动图 + 挂四条路由（语音 / 偏好 / 模型 / 整机） | 注册她的提示词段与五个工具                                                                                                            |
| 为什么不换 | `dsh-client-modules` 只扫 `loader.entries()`，preset 子树不在其中      | 放宿主面会把工具泄漏给**所有**会话                                                                                                    |
| 怎么区分   | 行上没有 `config`                                                      | 行上带 `config: { plane: preset }`                                                                                                    |
| 住在哪     | 包自带的 `cordis.patch.yml`                                            | 包自带的 `preset/herta.patch.yml`（0.1.7 起 preset 就是一条普通 loader 行；旧版的 `$DSH_HOME/.agent-presets/` 目录机制已被 DSH 移除） |

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

| 去掉的                                         | 为什么                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.composer`（她自己的输入框）                  | DSH 底部本来就有一整套输入区，两套并存；且她那套走 `bridge.submitText`，而 bridge **没实现**这个方法，发出去的话只会丢在地上 |
| `.window-controls`（右上角最小化/最大化/关闭） | 三个都是**死按钮** —— bridge 把它们全实现成空函数（iframe 里也没有「窗口」可最小化，该最小化的是外层 DSH 窗口）              |

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

| 行为                           | 落点                                                                      | 要 LLM 调用？ |
| ------------------------------ | ------------------------------------------------------------------------- | ------------- |
| **分拍**（干活中途补一句点评） | `tools/result` → 判据 → `agent.steer`                                     | 否            |
| **自我收回 / supervisor 复核** | `agent/turn-stopping`（turn 关闭前被 await）→ 独立复核 → `steer` 让她重说 | **是**        |
| **thought tag**                | 输出里的围栏，由渲染层（乙 / 甲）呈现                                     | 否            |
| **做梦蒸馏**                   | `herta_dream` 的 `distill: true` → 宿主另起调用蒸馏候选 → 过门 → 落账     | **是**        |

三条安全底线（缺一条都会出真问题）：**任何失败一律放行**（复核坏了不该让她说不出话）/
**配额到顶一律放行**（`steer` 会让 turn 继续，持续否决她将永远说不完）/
**拿不到模型路由就跳过**（`provider`/`model` 是必填，不猜）。

> **一个必须知道的语义差距**：DSH 的 `agent.steer` 在**下一个 step 边界**生效，
> 不像上游能在后端事件发生当拍插话。所以分拍是「事件后一个 step 补评」——
> 效果等价，时机晚一拍。

### 六条路由

前两条是**白名单静态资源**：启动时扫出文件索引，请求路径必须命中，否则 404。
不存在路径穿越的可能，也就不需要 `../` 过滤这类容易写错的代码。

- `/herta-voice` —— 80 条语音 + 代码生成的 `index.json`
- `/herta-ui` —— 整机页面（html / js / css / 开场段 / pdf worker）

后三条不是静态资源，是宿主自持的读写端点：

- `/herta-voice-model` —— 本地语音模型（离线 TTS）的下载。
  `GET` 状态、`POST {"action":"download"|"cancel"|"remove"}` **点火即返回**，
  进度靠轮询 `GET` 拿。状态码与 `phase` 都用上游那套
  （`absent` / `downloading` / `ready` / `failed`，失败带 `error` 键）。
  详见下一节。
- `/herta-minimax-events` —— **SSE**：MiniMax 云端语音的 PCM 推给浏览器半侧。
  三种帧：`tts`（一个单元的 `Int16` PCM，base64）/ `ttsStop` / `state`。
  浏览器半侧转成 `push("voice", …)` 交给整机 iframe（iframe 缺席时自己在父窗口用
  WebAudio 放）。走自建 SSE 而不是 DSH 的事件通道，理由见下一条注释。
- `/herta-minimax-state` —— 认领状态 + 手动动作：
  `GET` 快照，`POST {"action":"adopt"|"reset"}`（设置页「重新认领」按钮）。

> **为什么 PCM 不走 DSH 的宿主→客户端事件**：那条路是 `ctx.remote.$on`，事件名在
> `@deepseek-ai/dsh-api-remotes` 里是**硬编码白名单**（第三方插件没有扩展点），
> 而且过线前要过 `isJsonValue` —— `Int16Array` 一律被拒（不是真数组、原型也不是
> `Object.prototype`）。所以 PCM 只能走插件自持的 HTTP 路由，SSE 是 `dsh-client-hmr`
> 已经在用、本仓库已验过的形状。

> **`/herta-settings` 已删除**（0.1.7 那版曾用它自持语音偏好）。现在客户端直接走
> `ctx.configForms`，再留一条 HTTP 写入口就是第二个真相来源。密钥也不走 HTTP ——
> 它们走 DSH 官方的凭据缝 `ctx.remote.credentials`。

---

## 本地语音模型（离线 TTS 的模型那半）

DSH 设置 ▸ 黑塔 ▸ 整机动作 里的「下载」现在是真的：宿主会去上游发布的地址取那一个归档。

**固定参数从上游扒来，钉在代码里**（`src/host/tts-release.js`）——不是运行时问服务端：

| 项      | 值                                                                                                 | 出处                                        |
| ------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 归档    | `herta-best-e72.tar.gz`                                                                            | `Herta-src/…/tts/tts-release.ts`            |
| 地址    | `https://github.com/PersonaCLI/Herta/releases/download/voice-herta-best-e72/herta-best-e72.tar.gz` | 同上                                        |
| 体积    | 76,255,506 B（72.7 MiB）                                                                           | 同上                                        |
| SHA-256 | `ce993a6fab911e9a86328facc952120c21de54303652f648e96e9d14ee4f172e`                                 | 同上                                        |
| 解包后  | 115,897,197 B（110.5 MiB）                                                                         | 同上                                        |
| 装到哪  | `$DSH_HOME/tts/herta-best-e72`                                                                     | 上游是 `<userData>/tts`，这里跟 DSH 的 home |

上游那段注释说明了为什么要钉：_「A retrain is a new bundle id …, a new archive, new pins,
and therefore an app release: the download never trusts the host, only this file.」_
本插件**不重打包也不转发**这个归档，只是按上游发布的地址去取。

**四段，任何一段失败都不会留下半个可用的 bundle**（`src/host/voice-model.js`）：

1. 边下边算 SHA-256；先比**字节数**、再比**哈希**，任一不符即中止
2. 解到最终目录**旁边**的 `.installing/`，带解压炸弹上限（只看普通文件与目录，拒绝路径穿越）
3. 拿 bundle 自带的 `manifest.json` **逐个文件比 size + SHA-256**，还要比 `release` 是不是这一版期望的
4. 只有前三段全过，才 `rename` 就位 —— 读到的要么是旧的完整版，要么是新的完整版

已经装好的旧 bundle 在任何失败下都活着（只在第 4 步被替换）。

> ✅ **运行时已随包分发**（`assets/tts-runtime/`，22 MB，sherpa-onnx 1.13.6 +
> onnxruntime 1.27.1）。宿主会**真探测**它（拉子进程把 addon 加载起来拿版本号，
> 结果进程内缓存），探测通过才报 `runtime: true` —— DSH 设置页里「本地语音模型」
> 那行按它如实报「运行时未就绪」，写死 true 就是仓库别处修过的假绿。
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

## 六个工具

| 工具                   | 作用                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `herta_narrative_list` | 列出记忆货架，并如实报告哪份进了当前提示词、哪份被门拦下                                                                                                            |
| `herta_narrative_read` | 读某一份的完整正文                                                                                                                                                  |
| `herta_memory_save`    | 随手记一笔（过格式门 + 标题新颖性）                                                                                                                                 |
| `herta_dream`          | 做梦：门槛更高（另加篇幅下限），并记进做梦账本                                                                                                                      |
| `herta_speak`          | 让模型能主动发声；片段信息经 `presentationMeta` 落到工具结果的 `meta` 上，浏览器侧读取后播放。**放的是她的录音片段（`.opus`），不经过任何合成**                     |
| `herta_say`            | 用她自己的克隆声音**说一句话**（MiniMax 云端合成，走 SSE 推给界面）。既是调试入口，也是语音链路的验收通道 —— 端到端哑掉时，先用它把「合成」与「推给界面」两段分开看 |

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

`npm test` 跑 31 组（核心测试链 + MiniMax 那一组，共 **1544 项**）；另有 LLM 路径的集成测试
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

| 变量                    | 给谁用                             | 含义                                                                  |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `HERTA_SRC`             | `build*.mjs`、`test-narrative.mjs` | Herta 源码树（身份正本与渲染层从这里取）                              |
| `DSH_PACKAGES`          | `build-preset.mjs`                 | DSH 安装里的 `…/node_modules/@deepseek-ai`（preset 底本）             |
| `DSH_MODULES`           | `test-resolve-hook.mjs`            | DSH 安装里的 `…/node_modules`（借 `@deepseek-ai/*`）                  |
| `DSH_PROFILE_DIR`       | `deploy.mjs`、`test-dream.mjs`     | 目标 lab profile                                                      |
| `DSH_BIN` / `DSH_HOME`  | `install-web.mjs`                  | 可被普通 Node 启动的 dsh bin、目标 home                               |
| `NODE_OPTIONS`          | DSH 宿主进程                       | 本机对 GitHub 有 TLS 拦截时需要 `--use-system-ca`，否则模型下载会失败 |
| `HERTA_TTS_ARCHIVE_URL` | `tts-release.js`                   | 开发用：覆盖模型归档地址（**哈希 pin 照旧生效**，内容不能换）         |

---

## 已知缺口

### ⚠️ 叙述调度层：哪些验过、哪些**没验**

如实分开写，别把「代码写完了」当成「验过了」：

| 部分                                        | 验到了什么                                                                                                                                                                                                                                                                                                                                                                                                                                    | **没验到**                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 提示词资产、语法解析、判决解析、配额闸      | **314 项纯逻辑单测**（Node 里直接跑）                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                  |
| 挂载与依赖                                  | lab 冷启动日志：`plane=preset` + `dsh-llm` 可用 + `llm` 服务就绪                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                                                                  |
| 模型路由可读性                              | lab 实测读出 `{"provider":"deepseek-official","model":"deepseek-flash"}`                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                  |
| LLM 路径的**管道**                          | **28 项集成测试**（mock `ctx.llm`）：请求组装 / 流消费 / 判决解析 / **失败一律放行**（无 llm、无路由、流抛错、`finish` 被截断）                                                                                                                                                                                                                                                                                                               | —                                                                                                                                  |
| **supervisor 复核的真实闭环**               | ✅ **lab 里用假模型服务跑通了整条链**（见下）：她说没凭据的话 → 复核 `veto` → `steer` → 她重想重说 → 复核 `pass` → turn 才结束。日志：`supervisor 否决 turn 1（第 1 次）：她宣称写过笔记，但记录里没有任何写入工具调用`                                                                                                                                                                                                                       | 真实 **DeepSeek** 的判决质量（它到底会不会正确 veto）。假模型验的是链路与行为，不是判断力。                                        |
| **thought tag 的真实渲染**                  | ✅ 同一次验证里，她重说的回复带 `（我 想）…（/我 想）` 与 `（我 说）…（/我 说）`，页面正确呈现                                                                                                                                                                                                                                                                                                                                                | 上游那种「逐字揭示」的动画节奏（`reveal-driver`）**没移植**。                                                                      |
| **做梦蒸馏的真实行为**                      | ✅ **lab 实测跑通整条链**：她调 `herta_dream {distill:true}` → 两阶段（worthiness `max_tokens=300` → generation `1200`）→ 过 `promoteFeian` 的格式门 → **落盘** `.herta/narrative/### 废案_01：….txt` → **记账** `manifest.json` 记 `promoted` / `tokens: 151`                                                                                                                                                                                | 真实 DeepSeek 蒸馏出的候选**质量**（像不像她的语气）没验。                                                                         |
| **分拍的真实行为**                          | ✅ **lab 实测**：mock 发起一次失败的工具调用 → `tools/result` 判 `tool-failed` → 分拍注入。日志：`tools/result #1 name=read isError=true → tool-failed` / `分拍候选 turn=1` / `分拍 turn 1（tool-failed）：cannot read …: not found`                                                                                                                                                                                                          | 验证类工具的**成功**分拍（`verification-passed`）没单独验。                                                                        |
| **空轮护栏**（2026-09-30 新增）             | ✅ **拿真实会话日志回放**验过：`session-96f68201` 的 70 轮里判出 13 轮「用户在界面上什么都看不到」（54、58、60–70）；而 52 / 56 / 57 这些「最后一步只出思考、前面有工具调用」的轮次**正确地没判成空轮**（那些轮次用户看得见卡片）。另加 40 项纯逻辑单测。<br>✅ **且在生产里真触发过一次**（2026-09-30）：信标记到 `silence: { "n": 1, "turn": 28, "attempt": 1 }`，那一刻她的正文没落地；下一轮她重说了 —— **通知 → 重说这条闭环实测走通**。 | 模型持续把回话写进思考通道时，护栏只能让**用户看见**，治不了模型 —— 见下。                                                         |
| **叙述层对子代理让过路**（2026-09-30 新增） | ✅ 判据 11 项单测（用本机实测的 header 形状）；外加 12 项**源码级接线检查**（三处钩子都在、且都问在动作之前、跳过都留痕）。                                                                                                                                                                                                                                                                                                                   | 运行时行为没验 —— 「接线检查」证明的是源码里没漏、没挪位，**不是**子代理真的不再被打断。要真验得跑一次长子任务看它能不能自己交完。 |

**一句话**：调度逻辑、失败路径、两条 LLM 路径的**管道**都测了；
**分拍 / thought tag / 自我收回 / supervisor 复核 / 做梦蒸馏的行为都在 lab 里
用假模型服务实测过**；**只剩「真实 DeepSeek 的判断力与语气质量」没验** ——
那需要真实凭据，且不属于代码正确性的范畴。

### ⚠️ 两种「她突然不会说话了」（2026-09-30 真事故）

`session-96f68201` 从第 58 轮起完全静默：用户只能一轮轮问「还在吗」，
每一轮再喂进去一条「只出思考」的先例。事后拆会话日志，静默有**两条独立的路径**：

| 路径              | 现象                                                                                                                                                                                                                      | 谁的问题                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A. 只出思考**   | 助手消息里**只有 `reasoning` 块**，没有 `text` 块也没有工具调用，`turn/end` 照样报 `completed`。模型在思考里循环「动手。/（做。）/（写。）」几十遍，最后把要说的那句写在思考末尾。DSH 只渲染 text 块 → 屏幕上什么都没有。 | **模型侧**（DSH 的 `EMPTY_RESPONSE` 只拦「一个块都没有」，有思考就不算空）。插件管不了，但能让它**看得见**。 |
| **B. 说了但被吞** | 回话**确实在 text 块里**，但整段被解析成思考 → `speech` 为空 → 界面上不显示。成因是 `splitSurfaces` 的形状 B（只有 `（我 想）` 没有说话围栏）把**整段**都当思考，连围栏之外那句正常发言一起吞掉。                         | **插件的 bug**，2026-09-30 修：`splitThoughtFences` —— 围栏之内是思考，**围栏之外仍是说话**。                |

处置：A 由 `src/host/silence-guard.js`（空轮护栏）兜住 —— 一轮结束前清点「用户到底能
看见什么」，什么都没有就注入一条**看得见的通知**并要求她重说；每轮最多 2 次，
且复核刚否决过的那一轮跳过（那条静默是 rethink 阶段故意要的）。
B 修在解析器里，半侧产物 `lib/client.js` 重建（`npm run build`）带上修复 ——
产物只经构建生成、不可手工修补（ADR-0003）。
**护栏不会让模型停止犯错**，它只是把「她不理我」变成「终端告诉你她这一轮只出了思考」。

### 叙述层该对谁说话：不当着工人的面喊她（2026-09-30）

叙述层那三样（复核 / 空轮护栏 / 分拍）都是**人格行为** —— 它们对着「跟你说话的那个她」
说话。而 `subagent` 不是她：它是她在会话里派出去的工人，产出通过父级回话交回。

**本机实测的形状**（会话头，四个子代理会话逐个看过）：

```jsonc
{
  "id": "…",
  "parentSession": "session-…",
  "origin": "subagent",
  "delegationDepth": 1,
  "agentPreset": "herta",
} // 人机只有 delegationDepth: 0，没有 origin
```

注意最后那个字段：**子代理继承人设**，所以人格机制会一视同仁地打进它们。那天的代价是
两次收尾被吃掉 —— 一次子代理把一句「分拍点评」当成交付物（几千字的摘要没交出来，
只能靠 `send_message` 追回），一次报告交完了、最后一轮被复核拉去做「重想」。

判据是 `isSubagentAgent(agent)`（`src/host/session-surface.js`，纯函数）：`origin` 是语义
字段、`delegationDepth` 是结构字段，任一说是子代理就认；两个都读不到才当人机 ——
默认站在「照常服务她」这一边，不误伤。三处钩子都问它，**都问在动作之前**，跳过都留痕
（`marks` + 信标 `subagentSkip` + 一行日志；分拍那处只在第一次打日志，工具结果太频繁）。

### 怎么确认叙述层真的在跑（启动信标）

叙述层**在放行的时候不留痕迹**：复核判 `pass` 就不注入、不写会话记录。所以在正式
环境里，光看会话记录区分不出「复核跑了并放行」与「复核压根没跑」。

`src/host/narrative-beacon.js` 把「跑到哪一步」写成一份**可读证据**，落在
`$DSH_HOME/dsh-herta-narrative.json`（lab 与正式环境各一份，互不覆盖）：

```jsonc
{
  "verdict": "叙述层在跑：复核执行过",
  "phases": {
    "install": { "pid": 123, "depsOk": true }, // 钩子挂上了
    "llm": { "ok": true }, // llm 服务拿到了
    "turnStop": { "n": 3, "turn": 3 }, // turn 边界钩子触发过
    "review": { "n": 3, "verdict": "pass" }, // 复核真的执行过（pass 也记）
    "veto": { "n": 1, "turn": 3, "stage": 1 }, // 复核否决过（rethink / respeak）
    "beat": { "n": 1, "kind": "tool-failed" }, // 分拍判据执行过
    "silence": { "n": 1, "turn": 60, "attempt": 1 }, // 空轮提醒注入过（只出思考的那一轮）
    "subagentSkip": { "n": 3, "hook": "beat" }, // 叙述层对子代理让过路（诊断，不是推进）
  },
}
```

`verdict` 可直接读作结论。**只放阶段名、计数、时间与 pid，不放任何对话内容。**

```powershell
# 正式环境：桌面应用的 DSH_HOME 是 %USERPROFILE%\.dsh
Get-Content "$env:USERPROFILE\.dsh\dsh-herta-narrative.json"
# lab：$env:DSH_HOME 指到哪就在哪
Get-Content "$env:DSH_HOME\dsh-herta-narrative.json"
```

同一目录下**曾经**还有语音偏好 `dsh-herta-voice.json` —— 那条自持路线已废弃
（语音偏好现在是 DSH 设置里的字段）。旧文件若还在，只是一份没人读的历史残留；
插件启动时那次「读→改名 `.imported`」的一次性迁移也已删除。

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
- **她的设置页已删除，全部设置由 DSH 设置 ▸ 黑塔 统一管理**（2026-09-26）。
  `Herta-src` 里的 `SettingsModal` + 7 个分页 + 侧栏入口按钮整块移除，插件也不再往
  她自己的 `settings.json` 写任何字节（写回、种子、`↺ 跟随整机` 一并删除）。
  仍在「暂未接线」组里的 9 项**整机当前不读**，页面逐行标注了原因 ——
  详见 `docs/设置搬迁.md`。（`voiceEngine` 与 `realtimeVoice` 已在 2026-09-27 移出这一组，见下。）
- **整机页的 `submitText` 未实现** —— 她那套输入框既然已隐藏，这条路径日常碰不到；
  但若要恢复输入框，必须同时把 bridge 的 `submitText` 补上，否则还是发不出消息。
- **C 层客户端消费 cue 的那一半未端到端验证** —— cue 的**抽取**已有单测覆盖
  （`test-mapping.mjs`），但从一个真实的 `herta_speak` 工具结果触发播放，需要
  一次模型调用才能走通。
- **整机的 `listSessions` 返回空** —— 她自己的会话列表 / 开场白 / 设备卡还没接；
  整机目前只服务「当前这一个 DSH 会话」。
- **云端语音（MiniMax）已端到端接通（2026-09-27）**：她的回复正文 → 宿主分段 →
  MiniMax 云端合成（**认领**她账号上已有的克隆，不做上传/克隆）→ SSE
  `/herta-minimax-events` → 浏览器半侧 → `push("voice", …)` → 整机 iframe 播放
  （iframe 缺席时父窗口用 WebAudio 自己放）。边写边念；复核否决/要求重说时把还在流的
  那一段掐掉；每轮 800 字上限；云端不可用（没密钥/没认领到克隆/被拒/克隆被删）时
  **显式回落本地模型**，并在设置页写明"现在是谁在说话"。**仍未接**的：
  `voiceEngine = local / mimo` 这两条（本地模型目前只服务 `herta_speak` 与这条回落，
  `mimo-tts.js` 仍未实例化）—— 这是决定不是遗漏。
  单测：`npm run test:minimax`（324 项；`test-minimax-segment` 还与上游做了
  16164 次差分比对，0 处不一致）。
- **C2（全量本地 TTS）已能合成**。现在：模型能按上游地址
  下载 / 校验 / 解包 / 装好，运行时（22 MB sherpa-onnx）随包分发且被**真探测**，
  合成本身用真实模型实测过（24 kHz / 非静音，`scripts/test-tts-runtime.mjs` 22 项）。
  它现在是**回落的音源**：MiniMax 不可用时由同一条 SSE 通道推给界面。
  注意回落需要先把模型下下来（`$DSH_HOME/tts/herta-best-e72`）；没装时回落会
  明确报「模型还没装」，不会假装出声。
  **静音与音量走通了**（2026-09-26）：它们是 DSH 设置里的 `voiceMuted` / `voiceVolume`，
  经 bridge 下发给整机的 `voice-prefs.ts`（`hydrateVoicePrefs`），播放路径真的读它们。
  换成独立版 / 官网 demo（没有那个 bridge 成员）时该模块退回自己的 localStorage。
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

### v0.1.10

**声音这条线一次收口** —— MiniMax 中转站可以配了、静音点了就闭嘴、语音工具条不再跟着滚；
外加两个「能跑但静默错」的真 bug：每一帧 tts 都在抛 `ReferenceError`（任何引擎都没声），
以及工具条那个静音键压根没接到音频链路上。

- **新功能：MiniMax 中转站可以配了**。四个可选字段 —— `minimaxBaseUrl`（地址）/
  `minimaxApi`（接口形状）/ `minimaxVoiceId`（音色 id）/ `minimaxModel`（模型名），
  **默认全空时与加它们之前逐字相同**（官方两条地址 + tag 认领 + `speech-2.8-hd`）。
  原先三处写死让中转站用户接不上：地址表没有配置入口；认领按 `voiceId.includes("b1a43133")`
  过滤（那个 tag 是作者账号上那个克隆的标记，中转站不可能有）→ 直接 `no_clone_key`
  终局失败；模型名是常量。更隐蔽的是 `available()` 要求「有 key **且** 已认领克隆」——
  中转站用户前一件为真、后一件永远为假，于是 router 在 `runAdapter()` 里就早退了，
  **静默回落本地、日志里连中转站的痕迹都没有**。
- **请求形状收进 `src/host/minimax/endpoint.ts`**：路径、请求体、响应解码、错误分类各一条记录，
  `api.ts` 只认这个 interface（加第三种形状不用碰 `synthesizePcm`）。官方与中转站的形状差异
  都是**实测事实**：路径 `/v1/t2a_v2` vs `/v1/tts/speech`；音色字段嵌套 vs **扁平**
  （嵌套写法实测回 502）；回体 `data.audio`（hex）vs **裸 s16le PCM**，且回 PCM 时
  `content-type: audio/mpeg` 是**假的** —— 所以判形状按字节，不按头。
- **形状跟着地址定**（`shapeFor`）：地址是官方那两条 → 官方形状；用户自己填的第三方 → 中转站形状。
  这是四个字段里**唯一一个「不改也能填完其余三格」**的，漏了它的症状是「看着连上了、每句都没声」
  —— 与音色无关，所以报上来像是「每个模型都连不上」。同一趟挖出并修掉三个真问题：
  `codeOf()` 靠中文字符串猜 code（音色 id 填错时只显示「失败」，新增 `SYNTH_CODES.voiceMissing`
  并把平台原因码留在中文里）；`classifyStatus` 认不出没有平台码的错误（中转站回
  `{"error":{"message":"invalid api key"}}`，于是坏 key 既不显示也不进 `REFUSALS`，
  会拿着同一把坏 key 把剩下每句都试一遍）；选了「中转站」形状却没填地址会「探通」一个
  根本发不出声的官方地址（404 在 `probeShape` 里算「地址活着」，那是给中转站地址定的规矩），
  现在直接报 `no_host` 并说清缺哪一格。
- **新增 `src/host/minimax/peak.ts`**：中转站回来的电平明显偏小（实测峰值 6231/32768），
  所以**只对明确偏轻的材料**（峰值 < 0.5）放大到 0.99，本来够响的原样返回。
- **静音点了就闭嘴**（用户报的）：原先静音只被两道「下一次」的门读（排下一段 / 合成前），
  **已经排进 WebAudio 时间轴的照播不误** —— 听感就是「等她念完这句」。现在 `applyMuteNow()`
  做三件事：增益归零（对已在播的源一样有效）、停掉已排的源并清游标、给整机 iframe 推一条
  空 id 的 `ttsStop`（既有协议里「停全部」的写法）。解静音按当前音量重算，不是简单置 1。
  **没有** `suspend()` AudioContext —— 那要等一次 `resume`，而 `resume` 需要用户手势，
  静音一次反而把声音永久弄哑。触发点接在设置表单的 `subscribe` 上（只转发**真正变了**的字段，
  且首次不发通知 —— 页面刚打开、她正在念开场白时把声音掐掉是最招人骂的那种「修复」）。
- **工具条的静音键从来没接上音频链路**（用户第二次报的）：它只改了一个组件内 `useState`
  （只喂给按钮标签、透明度、语气词判断），而真正拦声音的是设置里的 `voiceMuted`。
  现在这个键写的是同一个真闸门，并做双向镜像（设置页改的、整机 iframe 改的，工具条都跟着变）。
  `applyMuteNow()` 另记两条诊断（`minimaxMuteAppliedAt` / `minimaxGainNow`），
  把「调用压根没发生」与「调用了但听不见」分开。
- **语音工具条吸顶**：那四个键原来长在会话流里，上下文一长就滚上去（想关语音得先翻到最上面）。
  现在 `position: sticky` + 一层不透明底板 + `zIndex`。底板取 DSH 的 base 令牌、**不用
  `backdrop-filter`**：后者在这个壳里会强制新建合成层，滚动时和主题的背景图抢绘制（会抖）。
- **每一帧 tts 都在抛 `ReferenceError`**：`rememberSpokenAudio` / `awaitingSpokenTexts`
  在 `lib/client.js` 里**两个调用点、零个定义** —— 是 0.1.8 拆 region 时漏的一行 import
  （对照 0.1.7 产物：这个标识符从 3 次出现变 2 次）。症状是任何引擎的语音「点了没反应」，
  而且**连诊断标记都不留**（抛在 `markMinimax("minimaxAudioPlays", …)` 之前）。
- **新增四条测试**：`scripts/test-client-bundle-bindings.mjs`（issue #14 点名要的
  「打包产物级」判据：定义方必须 `export`、使用方必须 `import`、产物里必须有定义；
  摘掉那行 import 当场红 2 条）、`test-minimax-endpoint.mjs`、
  `test-minimax-relay-config.mjs`（假中转站 + 宿主真实装配的配置矩阵，接进 `test:minimax:e2e`）、
  `test-voice-mute-instant.mjs`。顺手修掉 `test-client-regions` 一直红着的那条
  （`./opus.js` → `./opus.ts`：`build.mjs` 的 jsToTs 认得，`client-test-hook.mjs` 不认）。
- **产物重建**：用 `Herta-src`（`build.mjs` 的默认来源）重建了 `lib/client.js`。
  与仓库里原来那份的差异只有两类：esbuild 的**源路径注释**（原先记的是本机已不存在的
  `../tools/_herta-src/…`）与上游 i18n 目录里多三条 **MiMo 引擎**的键
  （`voice.engine.mimo` / `voice.mimoKey` / `voice.mimoKeyDesc`，当前代码里没有调用点）。
- **验证**：`npm test` 链 **31 组 1544 项全过、0 失败**；`npm run test:integration` 28 项全过。
- **仍未接 / 仍未决**：`mimo` 合成器仍无调用点；主题 `lib/opening/` 上游授权未决；
  「黑塔外观」的值存在浏览器 `localStorage`；`theme` / `deviceScene` 两个字段 DSH 侧无消费方；
  SSE 没有断线重放（回复中途刷新会丢掉已推的帧）。

### v0.1.9

**设置页白屏修好了** —— v0.1.8 拆客户端时漏了三处 import，`设置 ▸ 黑塔` 那一页
打开是空的（本机与 npm 上那份都是）。这一版只有修复，没有新功能。

- **发布到 npm**：`dsh-herta@0.1.9`（N 个文件 / X MB）。
- **插件市场**：条目已收录，DSH 内置市场搜 `herta` 可一键安装。
- **这一版的主体**：**修 v0.1.8 的设置页白屏**。`b22ce9b`（#2「拆出 settings 层」）
  把代码搬进 `settings.ts` 时没把 `./machine.ts` / `./voice.ts` 的 import 带过来 ——
  `voiceModelState` / `miniMaxState` / `credentialStatus` 等 13 个名字成了自由标识符
  （`ui.ts` 同样漏 16 个、`voice.ts` 漏 1 个）。esbuild 不会为未绑定的标识符报错
  （它假设那是全局），所以构建期静默；设置快照变成 `ready`、渲染到语音那几行时抛
  `ReferenceError`，被 DSH 0.2.0 的**逐项错误边界**接住 —— 导航项还在（label 来自
  注册），内容区被降级成一个空的 `<div data-slot-error="settings.section">`。
- **顺手修掉的**：无（这一版不放别的东西）。
- **验证**：`npm test` 链 **29 组 M 项全过、0 失败**；另有一条针对产物的探针（加载
  `lib/client.js` → 调注册进 `settings.section` 的组件 → 递归求值所有子组件）：
  修前 3 处 `ReferenceError`，修后全部通过。
- **npm 上 0.1.8 已标记废弃**（`npm deprecate`）：装 0.1.8 的请升到这一版。
- **仍未接**：同 v0.1.8 —— `mimo` 合成器仍无调用点；主题 `lib/opening/` 上游授权未决；
  「黑塔外观」的值存在浏览器 `localStorage`；`theme` / `deviceScene` 两个字段 DSH 侧无消费方。

### v0.1.8

**语音与界面各回各家** —— 架构审查的五个部分全部落地：四档语音引擎收成一个 interface，
`index.tsx`（3196 行）拆成五个零依赖的 region，取值域与叙述层的隐式 interface 各自收口；
顺手修掉三个真 bug，其中一个是「合成一失败，状态回执就断」。

- **语音合成器只剩一个 interface（candidate #1）**：新增 `src/host/synth-registry.js` ——
  四档引擎（`local` / `minimax` / `fish` / `mimo`）各成一个 adapter 工厂进一张表，
  选哪一档、失败要不要回落（**只有 `minimax → local`**）、取消转发给谁，全归一个 router；
  原先压在 `synthUnit` 里的 95 行 `if` 链退休（`synthUnitLegacy` 已删）。
  失败只给机器可读的 `code`（`no_key` / `network` / `refused` / …），中文在边界拼一次。
- **客户端 `index.tsx` 拆成四个 region（candidate #2）**：`machine.ts` / `voice.ts` /
  `ui.ts` / `settings.ts`，外加 `.opus` 播放那条路单独成 `opus.ts`（47 行）；
  `index.tsx` 从 3196 行降到 364 行，只做装配。四个 region 之间**零依赖** ——
  改 PCM 播放不必再碰设置页的 diff。状态归它所在的层独占，外面只经显式入口
  （`bindMachineForm` / `stopVoiceModelTimer` —— 此前装配层直接给模块的变量赋值，
  拆分后 esbuild 会当场报 `Cannot assign to import`）。
- **测试从「抓源码文本」改成「穿过 interface」（candidate #3）**：`test-fish-proxy`
  的 11 条文本断言、`test-fish-key` 的几条，都改成读值或调用接口；
  `test-subagent-skip.mjs` 删除（它的三条断言由运行时测试覆盖）。
  新增 `scripts/test-client-regions.mjs` —— 靠 `scripts/client-test-hook.mjs` 把
  `react` / `react-dom/client` / `@gui/*` 指到最小桩，于是**未打包的客户端 module
  可以被裸 Node import**，客户端内部第一次有了可断言的行为。
- **引擎取值域收成一个声明（candidate #4）**：四档的合法值与可发声判定各自只写一处
  （`voice-engines.js`），设置页的选项、schema 的 enum、宿主的分发都从它派生；
  回落规则也变成一张表（表里没有的档就是不回落）。
- **叙述层的隐式 interface 收口（candidate #5）**：依赖通道（`host-deps.js`）与
  69 个诊断字段的总线（`host-marks.js`）拆开，子代理闸门收成一个 helper（三处调用）。
- **顺手修掉的三个真 bug**（都是「全面检查」抓出来的，不是五部分的内容）：
  - **合成一失败，状态回执就断**：删旧代码时把紧邻的 `reasonText` 局部函数一起删了，
    而唯一调用点留着 —— 每次失败都抛 `ReferenceError`，被管线吞掉，于是试听没有回执、
    `engineNote` 不更新，fish 档（按设计不回落）彻底静音。已补回并加了断言。
  - **「没密钥」被静默说成「失败」**：`SYNTH_CODES` 漏了 `no_key` 这一项，
    `codeOf()` 那条判断求值成 `undefined`，被兜底逻辑吞成 `other`；
    现在每档自报「我为什么用不了」（`unavailableCode()`），没密钥就是 `no_key`。
  - **Fish 的文件兜底被掐死**：鱼档的可用性只认 DSH 凭据，于是把
    `fish_config.json` 里那条 keyFile 兜底也判成「不可用」；改问 `fish-tts.js` 自己。
- **取消现在真的取消得到人**：router 那句「转发给所有带 `cancel` 的 adapter」此前
  转发给零个（四档都没实现这个可选方法，而 minimax 合成器的 `cancel` 一直存在）——
  用户打断时在飞的云端请求不会被中断。现在接上了，并用**真工厂**加了断言
  （此前那组用的是假 adapter，只能证明「router 会转发」）。
- **`herta_say` 的引擎名不再写死 `minimax`**：成功返回的兜底改从当前档取，
  工具说明与 `output.engine` 的描述四档全列 —— 此前用 fish 或本地时它会报错身份（PR #12）。
- **新增 `scripts/test-synth-registry.mjs`**：router 的四档/回落/失败码第一次有行为覆盖。
- **验证**：`npm test` 链 **29 组 1446 项全过、0 失败**。
- **仍未接 / 仍未决**：`mimo` 合成器仍无调用点（选择器里点得动、会如实说明为什么不发声）；
  主题 `lib/opening/` 的上游授权未决；「黑塔外观」那些值存在浏览器 `localStorage`，
  换机器不带走；`theme` / `deviceScene` 两个字段 DSH 侧无消费方。

### v0.1.7

**装完就有主题** —— 紫罗兰配色、开机 ASCII 开场、可换背景与「黑塔外观」设置页，
现在随插件一起装（主题包 `dsh-theme-herta@0.1.0` 成了本包的依赖，
`cordis.patch.yml` 多一行并列挂载）。另把「产物不再可手工修补」的构建收口做完，
并拆开叙述层的依赖通道与诊断总线。

- **自带主题**：三件事一次做完 —— `dependencies` 加 `dsh-theme-herta@^0.1.0`、
  `files` 加 `theme/`、`cordis.patch.yml` 里与 `id: herta` 并列插一条
  `id: ui-theme-herta`。loader 行**必须由本包给出**：主题包自己的 `cordis.patch.yml`
  不会被自动应用（loader 只从 profile 的 `dsh.profile.bundles` 里挑 bundle 的 patch），
  它只是本包的依赖、它的 patch 谁也不会去读。实测（dsh 0.2.0-rc.2）：装载器能按名字
  解析到它、宿主半侧挂载成功；重复的 loader 条目 id 也只被覆盖、不炸启动。
  主题内容与**授权边界**见它的 [`NOTICE.md`](https://github.com/HerTa-st/dsh-theme-herta/blob/main/NOTICE.md)
  —— `lib/opening/` 那 10 个文件移植自 `PersonaCLI/Herta`，该上游未标注标准许可证。
- **主题接线后暴露的四处界面问题**：壁纸不再从左侧栏透出来（在那一栏下垫等价不透明底）；
  「选项高光叠了两层」（侧栏底 × 选中行 × 通配悬停，三层半透明相乘）修掉；
  Windows 下品牌字不再被「收起侧边栏」按钮压住；会话里那条提示不再只剩 emoji 看得见
  （改取 DSH 的 `--dsw-alias-label-primary`，底与墨同源）。另把 `deploy.mjs` 的
  本地镜像集补上 `theme/`，否则 `file:` 安装「有主题却看不到主题」。
- **产物不再可手工修补（ADR-0003）**：esbuild **固定 0.25.12**（删掉候选列表，
  找不到就报错）、删除 8 个 `reapply-*.mjs`（靠字符串锚点给 bundle 打补丁，
  锚点对不上就静默漏改）、pre-commit 强制「`npm run build` 之后 `lib/` 无 diff」。
  代价写在 ADR 里：**没有 esbuild 的机器不能出产物**。
- **一个设置字段 = 改一个描述符（ADR-0004）**：展示元数据（`group` / `hint` /
  `enumLabels` / `widget`）住进字段描述符，`settings-groups.js` **整个删除**。
  此前加一个字段要同时改五处，漏一处就是渲染事故 —— 09-27「整组一行不渲染」与
  10-01「渲染两遍」两次都真发生过。测试从「两张名单对账」换成「单源自洽」+ 防复发断言。
- **叙述层：依赖通道与诊断总线拆开**：原先挤在同一个 `globalThis` 对象里（依赖
  `marks.ctx` / `marks.llm` 与 69 个诊断字段），外部无法区分谁写、何时就绪。
  现在拆成 `host-deps.js`（依赖通道）与 `host-marks.js`（诊断总线，那个对象只有这一处创建）；
  顺带把 `{ kind: "plugin:dsh-herta" }` 收成唯一常量、设置命名空间收成单源。
- **测试不再 grep 源码，改为穿过 interface**：新增 `test-narrative-layer.mjs`
  （用假 ctx 记录 `on(event, fn)` 的清单与**顺序**，再真的调用那些 handler）、
  `test-http-json.mjs`（413 之后不再写第二份响应 —— 那是被 TCP RST 截掉的真事故）、
  `test-tar-extract.mjs`；`test-source-kind.mjs` 重写成断言常量形状；
  `test-subagent-skip.mjs` **删除**（三条断言已由运行时测试覆盖）。
- **仍未接**：主题 `lib/opening/` 的上游授权未决；外观设置存在浏览器本地
  （换机器不带走）；MiMo 合成器仍无调用点；`theme` / `deviceScene` 两个字段仍未接线；
  本地合成常驻化未落地。
- 测试：**核心 26 组 1020 项 + MiniMax 6 组 390 项 = 1410 项全过、0 失败**。

### v0.1.6

**修掉「装完起不来」** —— 0.1.5 在宿主不给 `@deepseek-ai/schemastery` 时会整个插件导入失败
（`dsh: warning: 1 entry did not activate herta (dsh-herta): failed to import`）；
这一版把入口改成动态导入加兜底，另把「只改产物、源码没跟上」的双向漂移收口。

- **入口不再硬依赖运行时的 schemastery**：入口第 22 行原先是**静态导入** `@deepseek-ai/schemastery`，
  而本包 `dependencies` / `peerDependencies` 全空 —— 它指望 DSH 运行时把那个包递过来。
  运行时不给时，**模块在解析阶段就抛**，静态导入又没法用 try/catch 兜，于是整个插件起不来。
  新增 `src/host/schema-compat.js` 做**动态导入 + 兜底**：
  - 拿得到真库 → 行为与从前**完全一致**；
  - 拿不到 → 退到一个**宽容**的最小实现（覆盖用到的 `object/string/number/boolean/union`
    与 `default/min/max/volatile`，未知方法名也返回可链式调用，且**保证不是 thenable**，
    免得被 `await` 挂住）。它**不做真校验** —— 这比「整个插件起不来」好。
  - `settings-schema.js` 的 `FIELDS`（字段名与默认值）不受影响，仍是唯一真相。
- **产物双向漂移收口**：`lib/client.js` 是打包产物、真源是 `src/client/index.tsx`；此前几批体检
  （`reapply-ux-texts*.mjs`，**已于 2026-10-03 整体删除**，见 ADR-0003）**只改了产物、没回填源码**，
  于是直接 `npm run build` 会**静默回退
  8 处已经生效的界面文案**。本次把 8 处按脚本记录的原文回填进源码后重建（措辞收口：不再断言
  「没有任何代码读它们」、MiMo 密钥行的实话、网盘行补「不含语音模型」、下载失败带上原因、
  语音状态行显示「已计费 N 字」等），并给 `voice` / `pipeline` 的内联类型补上
  `billedCharsTotal` / `lastCap`。
- **回归守卫**：新增 `test-schema-optional.mjs`（挂进 `npm test`）—— 只给 `dsh-tools` / `dsh-llm`
  造替身、**故意不给 schemastery**，要求入口能加载且走的是兜底；`test-schema-optional` 因此
  **必须不带** `--import` hook（挂了 hook 等于把真库递进去，测的就不是兜底了）。
- **发版工程**：新增 `RELEASING.md` 与 `scripts/preflight-release.mjs`（发布前八项预检 +
  `--verify-published` 发布后核验）与 `docs/templates/` 三份文案模板；预检**照 `package.json`
  的 `test` 链**跑测试，不再写死清单。
- 测试：**核心 24 组 913 项 + MiniMax 6 组 390 项 = 1303 项全过、0 失败**。
  ⚠️ **升级提示**：npm 上 0.1.5 是坏的（装完插件不激活），请直接升到 0.1.6。

### v0.1.5

**让她真的出声，并且每一处「没声」都说得清原因** —— Fish 引擎补齐成可用的一档，
两条静默路径修掉，叙述层不再对子代理说话，设置页按体检结果收口。

- **Fish 引擎（`voiceEngine: fish`）**：与 MiniMax 并存的一档。
  - 「Fish 密钥」走 DSH 凭据缝（`FISH_API_KEY`），`C:/herta-ai/fish_key.txt` 退化成兜底；
  - 「Fish 代理」是**可留空**的一行：接口按可达性排序 —— `fishaudio.org`（官方现用域名，
    国内可直连）优先，`api.fish.audio`（旧域名，国内会被按 SNI 重置）兜底。
    ⚠️ **音色 id 跟域名绑定**：默认大黑塔用的是新域名下的 id，旧 id 在新域名上会返回
    `ERR_VOICE_NOT_FOUND`；
  - 计费字符数收下并显示到语音状态行（「这一档花了多少」有答案了）；
  - 代理不再写死本机端口，空串也不会冲掉 `fish_config.json` 里的值
    （那正是「填了密钥也不出声」的根因）。
- **两条静默路径修掉**：围栏之外的字算说话（「正常发言 + 内心话」不再被整段吞掉）；
  空轮护栏 —— 一轮什么都没说时注入一条看得见的通知（生产上已实测到它唯一的一次触发）。
- **叙述层对子代理让过路**：分拍 / 复核 / 空轮护栏一律不拦子代理 —— 三处钩子都问在动作之前，
  每次跳过都留痕。
- **设置页体检两批**：记忆能取下、失败说人话、做梦账本不丢、模型下载失败说出原因、
  计费字符上状态行；`theme` 与 `deviceScene` 经核实**在 DSH 侧没有消费方**，
  从活字段降为「暂未接线」并各写清原因 —— 此前这两行会**渲染两遍**（既在普通分组里，
  又在「暂未接线」里），现在只活在后者。
- **产物一致性上了测试**：`test-artifact-sync.mjs` 守着「`src/host` 的每个文件与 `lib/` 逐字节相同」，
  也守着「发布目录里不许留补丁脚本的 `.bak` 备份」（那东西会跟着 npm 包一起发出去）；
  另加每个工具的「形状声明必须覆盖它的返回值」。
- **兼容性收口**：`engines.dsh` 放宽上界，preset 底本改用自带的官方 `0.2.0`。
- **许可证**：GPL 分发义务写清，`THIRD-PARTY.md` 给出对应源码的获得方式。
- 测试：**核心 23 组 906 项 + MiniMax 6 组 390 项 = 1296 项全过、0 失败**。

### v0.1.4

**把 Herta 的 MiniMax 语音「拉过来」** —— 从"设置里存得下密钥"到"她真的用那个声音说话"。

- 新增 `src/host/minimax/`（**TS 移植件**，单独一条编译缝 `scripts/build-minimax.mjs`，
  用 Node 自带的 `stripTypeScriptTypes`，不引 esbuild/tsc）：
  - `api.ts` —— HTTP 层，忠实移植上游 `minimax-api.ts`；**不含**上传/克隆
    （用户决策：只认领已有克隆，不把 8.36 MB 参考音频带进插件）。
  - `segment.ts` —— `segmentSpeechUnits` 移植；与上游真身做了 **16164 次差分比对，0 处不一致**。
  - `voice.ts` —— 只认领：按 `LEGACY_REFERENCE_TAG = "b1a43133"` 找她自己那个克隆
    （那个 tag 正是 `herta-reference.wav` 的 SHA-256 前 8 位），失败冷却 10 分钟。
  - `synthesizer.ts` —— refusal 三态 doom 整个 utterance、取消静默、超时算 `network`、
    并发上限 2、`voice_missing` 交给宿主决定回落。
  - `pipeline.ts` —— 纯状态机：边写边念、`turn-stopping` 时掐掉还在流的那段、
    每轮字符上限、子代理的文字不念。
  - `state.ts` —— 克隆记录落 `$DSH_HOME/dsh-herta-minimax.json`（机器状态，不进设置表单）。
- `src/host/minimax-voice.js` —— 宿主接线：凭据缝读密钥、启动认领 + 凭据变更重认领、
  SSE `/herta-minimax-events` + 状态端点 `/herta-minimax-state`、按 `voiceEngine` 分发、
  **显式回落本地模型**并在状态里写明原因。
- 新工具 `herta_say`（云端合成说一句，调试 + 验收通道）；`voiceEngine` 与
  `realtimeVoice` 从 `wired: false` 翻成 `wired: true`（那 11 项「暂未接线」因此变成 9 项）。
  `realtimeVoice` 是**自动念回复**的总开关：关掉就不再自动送去合成（省钱），
  而 `herta_say` 是明确要求说一句，不受它管。
- 密钥走凭据缝：`MINIMAX_API_KEY` / `MINIMAX_PLAN_API_KEY`。没填就回落本地，
  状态里说清是哪一种 unavailable。
- 测试：`npm run test:minimax` = **388 项**
  （api 98 / segment 112 / voice+state 43 / synthesizer 37 / pipeline 43 / pcm 55）。
  全量 `npm test` = **20 组 1059 项全过、0 失败**（14 组逻辑用例 671 项 + 上面 6 组 388 项）。

**仍未接**：`voiceEngine = local / mimo` 这两条（本地模型目前只服务 `herta_speak` 与
上面那条回落；`mimo-tts.js` 仍未实例化）—— 这是决定，不是遗漏。

**同时按 DSH 插件清单规范收口**（`package.json`，这一版才补齐）：

- `dsh.manifestVersion: 1` —— 清单格式标识，与包版本、会话格式版本都无关。
- `engines.dsh: ">=0.1.7-rc.1 <0.2.0-0"` —— 作者声明的兼容 DSH 版本区间。
  **要带显式下界**：写成 `>=0.1.0-rc.1` 这种宽区间时，`0.1.7-rc.2` 一类预发布版会被
  semver 静默排除（预发布版只有在同 `major.minor.patch` 的比较子上才被认）。
  插件市场的「按宿主发现」读的就是这个字段（也接受同版本线的 `@deepseek-ai/dsh-*`
  peer 声明）。
- `locale/en.json` + `locale/zh.json`（形状 `{ "meta": { title, description } }`）——
  插件管理页与市场卡片**不激活插件**也能读到本地化的标题与简介；
  配套 `exports` 补 `./locale/*.json`、`files` 收 `locale`。
- `files` 补 `NOTICE.md` / `THIRD-PARTY.md`。npm 包会带上 `assets/voice/`（80 条语音）
  与 `preset/herta.patch.yml` 这些**第三方同人素材**，法律声明必须随包一起走；
  TTS 运行时的许可原文本来就在 `assets/tts-runtime/LICENSES/`（含 espeak-ng 的
  GPL-3.0 全文），随 `assets` 一起发，这一项此前已满足。
- `description` 改中英双语、补 `keywords`、补 `publishConfig.access: "public"`。

**刻意没加 `peerDependencies`。** 规范允许「`engines.dsh`」与「同版本线
`@deepseek-ai/dsh-*` peer 声明」二选一，市场两者都读。这里只声明 `engines.dsh`：
本包当前的安装形态是 `file:` 本地路径，加 peer 会让 pnpm 在安装时去解析一批宿主包，
收益（市场兼容性展示）与 `engines.dsh` 重合，风险却不重合。等有真实 npm 安装反馈再说。

**首次发到 npm**：`dsh-herta@0.1.4` —— 此前只在 GitHub 上，npm 上这个包名还是空的。

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
  DSH 设置页里「本地语音模型」那行会如实报「运行时未就绪」而不是把按钮点亮，两个标志
  都不是写死的。合成跑在子进程里（`src/host/tts-worker.cjs`）：sherpa 的 espeak 构建在
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

**验证**：`npm test` 13 组纯逻辑用例 **622 项全过**（test-narrative 31 /
dream 28 / mapping 41 / narrative-hints 54 / supervisor 81 / session-surface 32 /
beat-policy 61 / dream-distill 55 / mimo-tts 40 / voice-settings 50 /
voice-model 50 / herta-settings **92** / source-kind 7），另有 28 项 LLM 路径集成测试
（`npm run test:integration`）。

> **2026-09-26 收口**：`herta-settings` 那一组被**重写**过。它原来测的是「把值写回
> 整机自己读的两份 `settings.json`」（读-改-写、原子落盘、旧文件迁移、只写用户覆盖过
> 的字段）—— 那条链路连同 `src/host/settings-sync.js` 已整体删除，所以那些断言消失，
> 换成了字段表/Wired 注解/Config 同源 + 五组**防回归**（写回不得复活、语音偏好必须
> 真接 bridge、整机设置页组件必须不存在、`Select` 必须存在、凭据缝必须用
> `ctx.get` 而不是 `inject` 取）。数字从 78 变 92 不是「测多了」，是测的东西换了。

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

  > ⚠️ **这一条后来又被推翻了**（2026-09-26）：`SettingsForms` 已经够用（插件自己的
  > volatile `Config` + 客户端 `settings.section`），所以那条自持路线与 `/herta-settings`
  > 端点一并删除。读上面的历史时别照它去做 —— 现在语音偏好就是 DSH 设置里的字段。

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
