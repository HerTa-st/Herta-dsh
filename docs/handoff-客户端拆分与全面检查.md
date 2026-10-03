# 交接：客户端 region 拆分（候选 #2）与五个部分的收尾

**对象**：`dsh-herta` 仓库 · 分支 `main` · 截至提交 `cf68c67`
**日期**：2026-10-04
**写这份的原因**：架构审查（`架构审查-candidate1语音合成器.html`）的五个 candidate 已逐条按**它自己写的验收标准**核过；
另外做了一次全面检查，抓出并修掉一处被拆分顶坏的测试。这份文档把「做了什么 / 凭什么说做完了 / 怎么自己验一遍 / 还差什么」写清楚。

---

## 一、五个部分：逐条对照报告的验收标准

| # | 报告标题 | 报告写的验收 | 状态 | 凭证 |
| - | -------- | ------------ | ---- | ---- |
| 1 | 让语音合成器只有一个 interface | 四档各成 adapter 进一张 map；**删 1 处 `await import` 特判** | ✅ | `src/host/synth-registry.js` 在；里面 `await import` **0 处**；`SpeechSynthesizer` / `available` / `synthesize` / `cancel` 齐 |
| 2 | 拆开 `src/client/index.tsx` 的 region | 四个 module ＋ 一个薄的 `index.tsx` | ✅ | `index.tsx` **364** 行；machine 278 / voice 708 / ui 797 / settings 1181 / **opus 47**（`.opus` 那块是后来补的精修，见下） |
| 3 | 让正则测试穿过 interface，而不是抓源码文本 | 点名的三份测试改成穿 interface | ✅ 实质完成 | `test-fish-proxy.mjs`：读源码 **0 处**（原 11 条文本断言）；新增 `test-client-regions.mjs`（6/0）；点名的 `test-subagent-skip.mjs` **本仓库不存在**（对应的是 `test-narrative-layer.mjs`，它已无正则断言） |
| 4 | 把引擎取值域收成一个声明 | 单一声明 → schema/客户端**派生** → **test 断言消失（不再需要对账）** | ✅ | 唯一声明是 `settings-schema.js` 里 `voiceEngine.enumLabels` 一处；`ENUM_LABELS` 由字段自己的 `enumLabels` 聚合（纯派生）；客户端自己的 `ENUM_LABELS` 已删（`index.tsx` 里只剩一句注释）；那条**已不可能失败**的同义反复核对已删 |
| 5 | 收 marks 的隐式 interface | 29 字段→一个 interface；闸门写一次；可测（不依赖 globalThis） | ✅ | `host-marks.js` / `host-deps.js` 各有 interface；`narrative-layer.js` 的 `skipsSubagent` 统一闸门（4 处）；`test-narrative-layer.mjs` **直接 import** `host-marks.js` 与 `host-deps.js` |

> **#4 那条值得单独说**：报告写的是「test 断言消失（不再需要对账）」。取值域收成一处之后
> （`FIELDS.voiceEngine.values = VOICE_ENGINES`），那条「共享模块的档位与字段表逐字一致」的断言
> **比的其实是同一份数据和它自己** —— 永远为真。删它**不是降低覆盖**，是它已经没有能力失败。
> 剩下的两条默认值核对（比的是两个真独立来源）保留。

---

## 二、结构上到底动了什么

```
src/client/                      （拆分前：index.tsx 一个文件 3196 行）
├── index.tsx     364 行   装配：installSettingsSection / apply ＋ 全层共用常量
├── machine.ts    278 行   bridge / 凭据服务 / 机器字段
├── voice.ts      708 行   SSE / PCM / 播放 / 音色状态
├── ui.ts         797 行   面板 / 视图 / 气泡
├── settings.ts  1181 行   字段表 / 样式 / 各行 / 整个表单
└── opus.ts        47 行   .opus 播放那条路（clipUrl / markVoice / playUrl / playClip）
```

**四个（现在是五个）region 之间零依赖** —— 谁也不 import 谁的 region，各自 import 共享纯模块。
改 PCM 播放不必再碰设置页的 diff（报告 candidate #2 要的就是这个）。

### 两条切分判据（比"搬代码"更要紧）

1. **状态归它所在的层独占，外面只经显式入口。** 搬家最容易漏的不是「谁读它」，是**「谁写它」**。
   实测两个外部写方：`machineForm` 被装配层 `apply` 赋值、`voiceModelTimer` 被界面 `useEffect` 清理赋值
   —— 都改成显式入口（`bindMachineForm` / `stopVoiceModelTimer`）。否则 esbuild 当场报
   `Cannot assign to import`。**迁移前先盘写方。**
2. **断言看它该看的文件，而不是盯着某个文件的字面。** 客户端拆分之后，一共 **9 条**测试断言
   因为「读 `index.tsx` 的源码文本」而变红（6 条在 `test-herta-settings`、3 条在 `test-fish-key`）。
   处理办法不是改判据，而是**改它去看代码现在所在的那个文件**；能读值的就读值
   （例：`FIELDS.fishProxy.label` 代替正则找 `label: "Fish 代理"`）。

---

## 三、全面检查做了什么（2026-10-04）

| 检查 | 结果 |
| ---- | ---- |
| `npm run build` 后 `git diff --name-only -- lib` | **空** ✓（产物 = 源码；判据取 AGENTS.md） |
| 全套 11 份测试 | **全绿** ✓（见下表） |
| 客户端 module 的自由变量（构建查不出的那类） | **无** ✓ |
| 打包后的用户可见字面量 | 客户端包解码 `\uXXXX` 后该有的都在 ✓；「没有密钥」正确地只在宿主侧 ✓ |
| 关键出口在产物里 | `createSynthRouter` / `createFishAdapter` / `fishStatus` 在宿主产物 ✓；`bindMachineForm` / `stopVoiceModelTimer` 在 `lib/client.js` ✓ |
| profile 里跑着的那份 | 四个文件与仓库**字节数一致** ✓（`deploy --no-build` 已镜像） |

```
test-artifact-sync ✓   test-client-regions 6/0 ✓   test-synth-registry 30/0 ✓
test-minimax-voice 43/0 ✓   test-minimax-pipeline 45/0 ✓   test-minimax-synthesizer 37/0 ✓
test-fish-key 34/0 ✓   test-fish-proxy 20/0 ✓   test-voice-settings 51/0 ✓
test-narrative 52/0 ✓   test-mapping 41/0 ✓
```

### 检查中抓到的真 bug（已修）

- **`test-fish-key` 从 34/0 变成 31/3**：三条断言读 `src/client/index.tsx` 找 Fish 密钥那一行的声明
  （`ref: "FISH_API_KEY"`）与 `saveCredential(props.spec.ref`，而这两处已随设置页搬进 `settings.ts`。
  修法：改看 `settings.ts`（提交 `cf68c67`）。
  **教训**：移动代码之后要跑**整套**测试，挑子集会漏 —— 这次就是漏了（我开头跑过它是 34/0，
  之后再没跑过它）。

### 同一批里修掉的线上 bug（也不是五部分的内容，但都是我们自己改动造成的）

| 症状 | 根因 | 提交 |
| ---- | ---- | ---- |
| 试听没有回执、fish 彻底静音 | 脚本删行时把紧邻的 `reasonText` 函数一起吃掉 → `snapshot()` 抛 → `noteState()` 也挂 | `e7abfac` |
| 状态行只报「不可用」 | `SYNTH_CODES` 漏了 `no_key`（ADR-0006 的契约里写着它） | `b05c26d` |
| 「Fish Audio 不可用」而配置其实是好的 | 鱼档可用性只认 DSH 凭据，掐死了 `fish_config.json` 的文件兜底 | `9751150` |

---

## 四、已知的"红"，都不是代码问题

1. **`test-herta-settings` 104/17**：那 17 条断言的是**另一版上游**（`Herta-src`）的状态
   —— 「App.tsx 不再渲染 SettingsModal」「整机设置页组件已删除」这类**刻意与上游分道**的守卫。
   本机上游修订不同所以红。**要不要留在这条测试链里，建议由梦源定**（不是我能替他决定的）。
2. **`test-tool-schema` / `test-narrative-layer`**：需要 `@deepseek-ai/*`，而 AGENTS.md 表里那份运行时
   （`E:\deepseek工作区\HerTa\dsh-017\node_modules`）**这台机器上没有** —— 2026-10-04 实测：
   `E:` 与 `C:\herta-ai\tools\_E\` 下都不存在该目录（只有 `Herta-src`）。装得上的机器设
   `$env:DSH_MODULES` 即可跑。
3. **`deploy` 带构建会挂**（issue #13）：`src/herta-ui/main.tsx` 引用上游**不存在**的导出
   `hydrateVoicePrefs`。当前用 `node scripts/deploy.mjs --no-build` 绕过（先 `npm run build`）。
4. **PR #12**（Q25 的 schema 四档全列）：开着等 review。

---

## 五、怎么自己验一遍（照抄即可）

```powershell
$R = "C:\herta-ai\dsh-herta"
$env:PATH = "C:\Users\AORUS\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;$env:PATH"
$env:HERTA_SRC = "C:\herta-ai\tools\_herta-src"     # 构建要的上游（ADR-0007 的锚点 c86d122）
cd $R

# 1) 产物必须与源码一致（AGENTS.md 的判据）
node scripts/build.mjs
git diff --name-only -- lib          # 期望：空

# 2) 全套测试（注意 client-regions 要带 resolve hook）
node scripts/test-artifact-sync.mjs
node --import ./scripts/client-test-hook.mjs scripts/test-client-regions.mjs
node scripts/test-synth-registry.mjs
node scripts/test-minimax-voice.mjs
node scripts/test-minimax-pipeline.mjs
node scripts/test-minimax-synthesizer.mjs
node scripts/test-fish-key.mjs
node scripts/test-fish-proxy.mjs
node scripts/test-voice-settings.mjs
node scripts/test-narrative.mjs
node scripts/test-mapping.mjs

# 3) 镜像给跑着的桌面应用（带构建会撞 issue #13）
node scripts/deploy.mjs --no-build
```

---

## 六、这一轮新加的东西（下一手会用到）

- **`scripts/client-test-hook.mjs` ＋ `scripts/test-stubs/{react, react-dom-client, gui}.mjs`**
  —— **本轮最有用的副产品**：把 `react` / `react-dom/client` / `@gui/*` 指到最小桩，于是
  **未打包的客户端 module 可以被裸 Node import**（node v24 直接读 `.ts`）。报告抱怨过
  「bundle 之后只有 `lib/client.js`，测不到内部 seam」—— 这是那条的正解，也是做候选 #3
  那类改造的入口。
- **`scripts/test-client-regions.mjs`**：第一条穿 interface 的客户端测试（6/0），已接进
  `package.json` 的 `test` 链。
- **`docs/adr/0008-client-regions.md`**：拆分的记录（耦合矩阵、五个文件的职责与出口、
  两条切分判据、四步复现配方、本机环境红）。

---

## 七、还差的（都不在五部分里，按价值排序）

1. **`GROUP_TRAILERS` 及那些行组件的提升**：它现在是 `createSettingsSection` 里的局部常量，
   引用着同样在内部的那些行组件；想把「每个组的 trailer 客户端都注册了」也变成行为断言，
   得连着行组件一起提到模块级（实测单独提会 TDZ 报错 `MiniMaxVoiceRow is not defined`）。
2. **`test-herta-settings` 里剩下的、读我们自己文件的断言**：大部分是**结构性/缺失型**
   （「客户端不再有 X」），本来就变不成行为断言；只有"事实落在导出面上"的那些可以改。
3. **`test-herta-settings` 那 17 条上游态断言的去留**：建议交给梦源定。
4. **issue #13**（`herta-ui` 的坏导入）与 **PR #12**：等梦源。

---

## 八、给下一手的几条坑（都是这一轮真踩过的）

1. **命令行引号**：显示字符串里再套 `"` 会直接把整段脚本解析掉（PowerShell 整段解析、一处错全不执行）。
   提交信息带引号 → 用 `git commit -F <信息文件>`；内联 JS 过 PowerShell → **写成文件跑**。
2. **`[System.IO.File]::ReadAllText` 认的是进程 CWD**，不是 PowerShell 的当前目录 —— 用绝对路径。
3. **不要给 `$host` / `$home` 这类自动变量赋值**（大小写不敏感，会被拒）。
4. **行号算术不可信**：插删之后的下标要**单趟拼接**重算，别做增量下标；边界要**成对取**
   （首行是完整顶层单元、末行是收尾 `}`），并**做成脚本自检**：不满足就不写盘。
5. **`esbuild` 不解析自由变量**：搬走一段代码之后，"某个名字没被 import"这种错**构建不报**，
   是运行时错。要自己查一遍（本轮用的是逐行扫描 + 「谁用到了却没 import」的交叉核对）。
6. **判干净看内容哈希**：构建写 LF、检出 CRLF，`git status` 会显示一批 `M` 而内容其实一致
   —— `git hash-object -- <path>` 对比 `git rev-parse HEAD:<path>`。
7. **大段迁移要先确认能退**：本轮三次失败、三次 `git checkout` 干净回滚。判断"能不能动手"的标准
   不是"我有多确信"，是"错了能不能一步退回去"。
