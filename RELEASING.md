# 发一个版本：dsh-herta 发布流程

> ## 一句话触发
>
> 对我说：**「按 RELEASING.md 发 0.1.6」** —— 其余照本文走。
> 只有两处必须你来：**给 npm 一次性口令（OTP）**、**B 站公告发布前确认**。

本文是 `dsh-herta` 每次版本更新的固定流程。**给 agent 执行用**：每一步都写了命令、
期望输出与失败怎么办。**任何一步不对就停下来说清楚，不要带着半截状态往下走。**

---

## 0. 环境事实（先读，别猜）

| 项 | 值 |
|---|---|
| 仓库 | `E:\deepseek工作区\HerTa\dsh-herta`（远端 `HerTa-st/Herta-dsh`） |
| 推送通道 | SSH（`ssh://git@ssh.github.com:443/…`）；main 有「必须走 PR」保护规则，但 `enforce_admins=false` → 管理员**可绕过**（推送时会出现 bypass 提示，属正常） |
| npm 身份 | `yunmengyuan`，`registry.npmjs.org`，2FA = **auth-and-writes**（发布必须带 OTP） |
| `gh` | 已登录 `YUNmengyuan`（scopes 含 `repo`） |
| 桌面应用 profile | `C:\Users\梦源\.dsh\profiles\desktop`，里面是 **`file:` 安装**（不是 npm 安装） |
| 本地更新插件 | `$env:DSH_PROFILE_DIR='C:\Users\梦源\.dsh\profiles\desktop'; node scripts/deploy.mjs`（镜像 lib/assets/preset/locale + 文档；逐字节核验；**不碰** profile 的 package.json） |
| 宿主版本事实源 | `E:\deepseek Desktop\resources\runtime\primary-runtime\runtime.json` 的 `desktopVersion` |
| 构建依赖 | esbuild 来自 `E:\deepseek工作区\HerTa\Herta-src\node_modules\.pnpm\esbuild@0.25.12`；preset 底本取仓库自带 `scripts/baselines/standard.dsh-*.patch.yml`（取版本最新） |
| 测试 | 核心 23 组 + MiniMax 6 组；其中 4 个（dream / dream-manifest / forget / tool-schema）**必须**带 `--import ./scripts/test-resolve-hook.mjs`（它们静态 import `@deepseek-ai/*`，DSH 解包运行时在 `dsh-017/`） |
| 上游目录 | 条目 `Herta-dsh`（`dsh-herta`）已收录；目录包 `dsh-plugin-catalog` **每天 UTC 02:23（北京 10:23）**重建 |
| 发布文档惯例 | 工作区根：`Herta-DSH-vX.Y.Z-Release说明.md` + `Herta-DSH-vX.Y.Z-公告.md`（模板在 `docs/templates/`） |

---

## 1. 定版本号

- **0.x 期间默认 patch 递增**（0.1.6 → 0.1.7）；有**破坏性变更**才跳 minor（→ 0.2.0）。
- 每次由用户拍板。同版本号**绝不重发**（见 §11 回滚）。

---

## 2. 抬版本号 + 写 README 版本历史条目

```powershell
cd 'E:\deepseek工作区\HerTa\dsh-herta'
# 1) package.json 的 version
# 2) README.md 的「## 版本历史」下加 ### vX.Y.Z（模板：docs/templates/readme-version-history.md）
```

**期望**：`node -e "console.log(require('./package.json').version)"` 打出新版本号。
**失败**：忘了写 README 条目的话，§4 的预检第 7 项会拦住（这是故意的）。

---

## 3. 写两份发布文案

用模板起草，落到**工作区根**（不是仓库里，仓库不放发布文档）：

- `Herta-DSH-vX.Y.Z-Release说明.md`（`docs/templates/release-notes.md`）—— 会作为 GitHub Release 正文
- `Herta-DSH-vX.Y.Z-公告.md`（`docs/templates/bilibili-announcement.md`）—— **简洁、无表情符号**，投 B 站动态/专栏

**期望**：两个文件存在且版本号与 `package.json` 一致。**失败**：预检第 7 项拦住。

---

## 4. 发布前预检（唯一门槛）

```powershell
node scripts/preflight-release.mjs
```

八项：版本号高于 npm `latest` 且未发布过 / 工作区干净 / 测试全绿 / 构建零差异 /
产物一致（`src/host` ↔ `lib` + 发布目录无 `.bak`）/ 打包内容与 sha1 / 三份文案齐备 /
宿主矩阵（`engines.dsh` vs 桌面应用版本）。

**期望**：`汇总：N ✅ / M ⚠️ / 0 ❌`，退出码 0。⚠️ 项人工判断（例如未跟踪的临时文件、
构建写 LF 造成的行尾噪音）。
**失败**：退出码 1，末尾会列出阻塞项 —— 逐条修掉再跑，**不要跳过**。

> 预检会真的跑一遍构建。构建后 `git diff` 必须为空：产物与源码不同步时它就会红。
> 若红了：**先判断哪边是真源**（历史上出现过 `reapply-*.mjs` 只改产物、源码没跟上的
> 双向漂移 —— 见 `chore(client): 产物 re-sync` 那次提交），把该留在源码里的改动回填进
> `src/`，再重建；**不要**为了让预检变绿而回退产物。

---

## 5. 破坏性变更通道（仅当本次不兼容）

比常规多三件事，缺一不可：

1. **必须跳 minor**（0.2.0 之类），并在公告里显著标注不兼容；
2. **Release 说明必须写迁移步骤**（用户照做就能过）；
3. **发布前在隔离环境跑通迁移**：
   - `herta-lab` profile（现成、可反复）跑一遍新版本行为；
   - 再建一个**临时干净 profile** 装本地 tarball 跑一遍（覆盖"别人装到会怎样"）：

```powershell
$env:DSH_HOME='<一个空目录>'
dsh plugin --profile <临时名> add file:'<repo>\dsh-herta-<ver>.tgz'   # 先 npm pack 出来
```
4. **保留旧行为至少一版**（deprecate 期），不要把用户一把掷进不兼容。

---

## 6. 本地双路验收

```powershell
# 甲：日常那份 file: 安装（我自己的环境）
$env:DSH_PROFILE_DIR='C:\Users\梦源\.dsh\profiles\desktop'
node scripts/deploy.mjs                 # 镜像 + 逐字节核验
# 乙：真实用户的 npm 安装路径 —— 用临时 profile 装本地包（发布前即可做）
npm pack --pack-destination $env:TEMP
$env:DSH_HOME='<空目录>'; dsh plugin --profile <临时名> add file:$env:TEMP\dsh-herta-<ver>.tgz
```

**期望**：甲报「核验 N 个文件逐字节一致」；乙能装上且插件可加载。
**然后关窗重开桌面应用**，设置 ▸ 黑塔 ▸ 语音点「试听」（Fish 引擎时「Fish 代理」留空）。

---

## 7. 提交与打 tag

```powershell
git add -- <按逻辑分组的路径>          # 精确暂存；不要把临时文件/发布文档带进仓库
git commit -m "<type>(<scope>): <subject>"
git tag -a vX.Y.Z -F <tag 消息文件>    # 附注 tag，与 v0.1.4/v0.1.5 一致
```

- **tag 只打在发布提交上**；发布之后再有文档修正，用**后续提交**，**不挪 tag**。
- 提交按逻辑分笔（功能 / 文案 / 工程 / 版本号），不要一坨。

---

## 8. 推送

```powershell
git push origin main
git push origin vX.Y.Z
```

**期望**：`568eaab..xxxxxxx  main -> main` 与 `[new tag] vX.Y.Z -> vX.Y.Z`。
**注意**：main 有保护规则，推送会打印 `Bypassed rule violations… Changes must be made through a pull request.` —— 这是管理员 bypass，属正常；不想再看到就改走 PR（小修直推、功能/风险改动开 PR 自审）。

---

## 9. GitHub Release

```powershell
gh release create vX.Y.Z --repo HerTa-st/Herta-dsh `
  --title "vX.Y.Z —— <一句话>" `
  --notes-file '<工作区根>\Herta-DSH-vX.Y.Z-Release说明.md' `
  --latest
```

**期望**：`gh release list` 第一行是新版本且标记 `Latest`。
**别只推 tag**：没有 Release 时，Releases 页面仍挂着上一个版本（v0.1.5 就这么差点漏掉）。

---

## 10. npm 发布（唯一需要 OTP 的一步）

```powershell
npm publish
```

npm 会以 `EOTP` 停下（本账号 2FA = auth-and-writes）。三条路，按顺位：

1. **首选（我执行）**：`npm publish --json` → 错误 JSON 里的 `error.authUrl` /
   `error.doneUrl` **没有被 npm 脱敏**（普通输出会被 `@npmcli/redact` 打码成
   `auth/cli/***`），把 `authUrl` 交给用户点开认证；认证完从 `doneUrl` 取回 token，
   用它重发：`npm publish --otp=<token>`。
   ⚠️ 非 TTY 环境**没有轮询者**，所以原进程不会自动重试 —— **必须重跑**（重跑会换新
   `authId`，旧链接作废）。
2. **用户在自己终端跑 `npm publish`**：TTY 下 npm 自己弹链接、自动轮询，
   认证完**自动重试成功**，不用重跑。最省事。
3. **用户给 6 位 OTP**（authenticator 应用）→ `npm publish --otp=<code>`。
   TOTP 30 秒窗口，过期就再要一个；安全密钥/passkey 型 2FA 没有 6 位码，只能走 1 或 2。

**期望**：`+ dsh-herta@X.Y.Z`，并打印 `shasum` / `integrity` / `total files`。
**失败**：`EOTP` 时**没有半发布状态**（registry 上不会留下半截版本），重试即可。

---

## 11. 发布后核验 + 回滚

```powershell
node scripts/preflight-release.mjs --verify-published X.Y.Z
```

核验：registry 元数据（版本 / `dist.shasum` / `integrity` / 文件数）、**把 tag 那一刻的树
重新打包并与 registry 上那份逐文件比对**（文本文件按 EOL 归一）、三大镜像的 `latest`、
远端 tag、GitHub Release。

**镜像滞后不算缺陷**（按需同步）；真要让人立刻拿到新版本，让他显式指定：
`dsh plugin --profile desktop add dsh-herta@X.Y.Z`。

**回滚**（按 Q9 的约定）：

| 情况 | 做法 |
|---|---|
| 已发布的版本有严重问题（72 小时内） | `npm unpublish dsh-herta@X.Y.Z`，修好后**递增 patch** 再发 |
| 超出 72 小时 | `npm deprecate dsh-herta@X.Y.Z "原因"`，修好后递增 patch |
| 任何时候 | **绝不重发同一个版本号**（会搞乱镜像、缓存与已装用户的 `latest` 语义） |
| GitHub 侧 | `git revert <发布提交>` / 删掉 Release；tag 不轻易删（删了要提醒已装用户） |
| 本地 profile | `dsh-herta\install-backups\` 里有安装前快照；或重跑 `deploy.mjs` 镜像旧版本 |

---

## 12. 归档与通知

1. 两份文案已在工作区根落盘（§3）；把 Release 说明粘进 GitHub Release（§9 已用 `--notes-file`）。
2. **B 站公告发布前让用户确认**（对外发声，必须过目），确认后用户自己发。
3. 提醒用户：**关窗重开桌面应用**（插件是启动期挂载的，热重启不覆盖）。
4. **上游目录不用管**：卡片上的 `version` 是上游每日构建（北京 10:23）的快照，滞后一天
   不是缺陷；**安装始终取 npm `latest`**。只有条目**内容**变了（描述 / 工具数 / owner / url）
   才需要提 PR 更新条目。

---

## 13. 已知坑（都真踩过）

| # | 坑 | 现象 | 解法 |
|---|---|---|---|
| 1 | **产物与源码双向漂移** | 直接 `npm run build` 会静默回退 `reapply-*.mjs` 手改过的文案 | 改产物前先确认源码是真源；重建后逐条核验文案仍在（`test-fish-proxy` 已加一条守卫） |
| 2 | **`.bak` 备份会被发出去** | `reapply-*.mjs` 的备份写在 `lib/` 里，而 `files` 收了整个 `lib/` | `test-artifact-sync.mjs` 现在守着「发布目录无 `.bak`」 |
| 3 | **`deploy.mjs` 曾把包内文件当陈旧删掉** | 镜像集漏了 `locale`/`LICENSE`/`NOTICE.md`/`THIRD-PARTY.md`，陈旧清理又遍历整个目标目录 | 已修：镜像集与 `package.json` 的 `files` 对齐，陈旧清理限定在镜像集内 |
| 4 | **`git status` 的行尾噪音** | 构建写 LF、检出 CRLF，`git status` 显示 M 但 `git diff` 为空 | 判干净看 `git diff`，不看 `git status` |
| 5 | **`npm test` 不含 4 个测试** | `test-tool-schema` / `test-dream-manifest` / `test-forget` / `test-artifact-sync` 不在链上 | 预检脚本按核心 23 组跑，别只跑 `npm test` |
| 6 | **`dsh plugin add` 会换掉安装形态** | 本地是 `file:`，一旦 `add dsh-herta` 就变成 npm 安装，之后改代码不再生效 | 日常环境用 `deploy.mjs`；真实 npm 路径用临时 profile 验 |
| 7 | **npm 认证链接被打码** | 普通输出里 `auth/cli/***`、`authId=***` | 用 `npm publish --json` 取未脱敏的 `authUrl`/`doneUrl` |
| 8 | **非 TTY 发布不会自动重试** | 认证完原进程已退出 | 拿 `doneUrl` 的 token 重发，或让用户在自己终端发 |
| 9 | **CI 想上还早** | 干净机器上 23 个测试可跑，但 `npm test` 会在 `test-narrative` 因缺 `Herta-src` 直接 ENOENT 断链 | 上 CI 前：给 `test-narrative` / `test-herta-settings` 加「目录不存在则跳过」，6 个 hook 测试补 DSH 运行时 + `DSH_MODULES` |
| 10 | **tag 不等于 Release** | 只推 tag，Releases 页面仍显示上一个版本 | §9 必须建 Release（`--latest`） |

---

## 附：一次典型发布的命令序列（新版本 0.1.6 为例）

```powershell
cd 'E:\deepseek工作区\HerTa\dsh-herta'
# 1) 版本号 + README 条目 + 两份文案
# 2) 预检
node scripts/preflight-release.mjs                     # 必须 0 ❌
# 3) 提交 + tag + 推送
git add -- <路径>; git commit -m "…"; git tag -a v0.1.6 -F <消息>
git push origin main; git push origin v0.1.6
# 4) Release
gh release create v0.1.6 --repo HerTa-st/Herta-dsh --title "v0.1.6 —— …" `
  --notes-file '..\Herta-DSH-v0.1.6-Release说明.md' --latest
# 5) npm（OTP）
npm publish --json    # 取 authUrl 给用户；认证后从 doneUrl 取 token 重发
# 6) 核验
node scripts/preflight-release.mjs --verify-published 0.1.6
# 7) 归档 + B 站公告（用户确认后发）+ 提醒关窗重开
```
