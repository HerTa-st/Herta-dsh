# 交接：让 `dsh-herta` 自带主题（`dsh-theme-herta`）

> **这份是给接手的 AI 或人看的。** 读完这一页就能做完，不需要别的上下文。
> 每一步都写了判据；**只有人能做的步骤**单独标了「🔒 必须人做」。
> 对应工单：[issue #7](https://github.com/HerTa-st/Herta-dsh/issues/7)。

---

## 0. 一句话

主题包 `dsh-theme-herta` 已经做好并推到仓库；还差**三步接线**，让"装了 `dsh-herta` 的人自动拿到主题"。
第 1 步需要 npm 账号 / OTP，只有人能按；第 2、3 步是改主插件自己的清单。

## 1. 现状（都可自行核对）

| 事实 | 怎么核 |
|---|---|
| 独立仓库已建、已推 | `git ls-remote --heads https://github.com/HerTa-st/dsh-theme-herta main` → `3ce6e86` |
| 主仓库里有同一份源码 | `HerTa-st/Herta-dsh` → `theme/dsh-theme-herta/`（远端 `main` = `304045d`） |
| **npm 上还没有它** | `curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/dsh-theme-herta` → `404` |
| 开发机上它是通的 | 那台 profile 里以 `file:` 装着，开机动画 / 配色 / 背景 / 设置页都在跑 |

主题包含：开机 ASCII 开场（移植自上游，见其 `NOTICE.md`）、紫罗兰配色令牌、
可换背景（自带四张 / 网址 / 本机导入 / 纯色 / 关，默认「魔女阳台」）、DSH 设置里的「黑塔外观」页。

## 2. 动手前必须先由人定的两件事

### 2.1 🔒 上游授权

`theme/dsh-theme-herta/NOTICE.md` 写着：开场模块移植自 `PersonaCLI/Herta`，而那个仓库
**未标注标准许可证**（GitHub 读作 `NOASSERTION`/Other，2026-10-03 查）。

**发布前必须决定**：去跟上游确认，或者发布时把 `lib/opening/` 那 10 个文件移除
（移除后开场不播，其余功能不受影响）。
这是决策，不是技术问题 —— **别替人决定，先问**。

### 2.2 🔒 npm 发布

发布 `dsh-theme-herta` 需要 npm 账号与 **OTP**。持有者：梦源。

## 3. 任务（顺序不能换）

### 3.1 🔒 发布主题到 npm

在 `theme/dsh-theme-herta/` 里：

```bash
npm publish        # name: dsh-theme-herta, version: 0.1.0, publishConfig.access: public 已备好
```

判据：`curl -s https://registry.npmjs.org/dsh-theme-herta | head -c 200` 能取到包文档（不再是 404）。

### 3.2 把主题变成依赖

改 `dsh-herta/package.json`，**两处同一次改**：

- `dependencies` 里加 `"dsh-theme-herta": "^0.1.0"`；
- `files` 里加 `"theme"`。

> ⚠️ **别只加 `files`**：依赖没上时它没有任何用处，只让每次安装多带约 3 MB 的图。

### 3.3 加一行 loader

`dsh-herta/cordis.patch.yml` 的 `insert:` 列表里，与 `id: herta` 并列：

```yaml
- insert:
    - id: herta
      name: dsh-herta
    - id: ui-theme-herta
      name: 'dsh-theme-herta'
```

> ⚠️ `id` **不能与已有条目重名**。该文件自己的注释写着：重复的 loader 条目 id 会让
> profile **直接启动失败**。这是本任务唯一会让**所有人**坏掉的地方。

### 3.4 ⚠️ 走 PR，**不要**直推 main

远端 `main` 有保护规则，直推普通提交它只回一句提醒，但**改写历史一律拒绝**：

```
HTTP 422  Changes must be made through a pull request. Cannot force-push to this branch
```

所以：

1. 从 `main` 开分支（例如 `feat/theme-selfcontain`）；
2. 在分支上做 3.2、3.3 两笔改动（**分两笔提交**：一笔加依赖与 files，一笔加 loader 行）；
3. 开 PR → 按仓库规矩做**跨域 review**（这两处动的是「设置与工具域 / 界面与发布域」，
   负责人是梦源）→ 通过后合并。

提交信息风格照仓库：`<type>(<scope>): <subject>`，中文。

### 3.5 🔒 发版

合并后 bump `dsh-herta` 版本号，按 [`RELEASING.md`](../RELEASING.md) 走那 12 步。
全流程里只有两处必须人做：**npm 的 OTP**、**B 站公告确认**。

## 4. 验收（在**干净**的 profile 上做）

1. `dsh plugin add dsh-herta` 之后，`~/.dsh/profiles/<p>/node_modules/dsh-theme-herta` 存在；
2. 重启应用：开机有 ASCII 开场，界面是紫罗兰色调；
3. 设置里出现「黑塔外观」，换背景 / 调遮罩 / 切纯色都真的生效；
4. `theme/dsh-theme-herta/` 里的四张背景图能通过 `/herta-theme/backgrounds/*.png` 取到（200）；
5. **旧版用户不受影响** —— 用「只装旧版 `dsh-herta`、没有主题包」的环境启动一次，必须正常。
   **这条才是本任务的风险点，别跳。**

## 5. 已知的坑（照做就不会踩）

- **客户端不打包**：主题的客户端在运行时 `import()` 宿主路由 `/herta-theme/*` 上的模块 ——
  改了**不需要构建**；但**只有客户端那半侧要彻底重启应用**才生效（宿主路由每条请求现场读盘，那半侧立刻生效）。
- **本地开发装的是 `file:`**：本机 profile 现在以 `file:` 指向开发目录；发布后别人从 npm 装。
- **pre-commit 钩子**：在装了 `node_modules` 的机器上正常提交即可（钩子会跑 `npm run build` 与 `npm test`）。
  在**没有**构建环境的机器上会被钩子挡住 —— 那种情况下别用 `--no-verify` 绕过，
  换台有环境的机器做。
- **git 到 github 的通道**：若出现 `Failed to connect to github.com:443`，直连不通时加代理：
  `git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push …`
  （同一时刻 `api.github.com` 可能是通的，别据此判断"网断了"）。

## 6. 可选清理：主仓库那 3 个错署名的提交

主仓库远端历史里这三笔的 author 是**编出来的身份**（`HerTa-st <herta@users.noreply.github.com>`）：

```
304045d docs(handoff)…    a54dbd6 docs(readme)…    5430399 feat(theme)…
```

内容没问题，只是署名不是仓库主人。要清掉需要**改写历史并强推** —— 而 `main` 被保护规则挡着（见 3.4），
所以只有两条路：

1. **🔒 人在 GitHub 临时放行**：仓库 → Settings → Rules / Rulesets（或 Branches）→
   临时允许 force push → 推改写后的等价历史 → **立刻恢复设置**；
2. **留着**：把那 3 笔当历史遗留，**往后不会再发生**（提交身份已写进全局 git 配置：
   `JIENUODESU <JIENUODESU@users.noreply.github.com>`）。

无论走哪条，都**别**用 `--no-verify` 绕钩子去强推。

## 7. 边界：谁负责什么

| 事 | 归谁 |
|---|---|
| 主题本身（配色、背景、开场、设置页、它的 README / NOTICE） | 开拓者新划的**主题域** |
| 主插件的清单与发版（`package.json` / `cordis.patch.yml` / npm） | 设置与工具域 / 界面与发布域（梦源） |
| npm 发布 | 🔒 手上有 OTP 的人 |

## 附：事实速查

```
主题独立仓库   https://github.com/HerTa-st/dsh-theme-herta      main = 3ce6e86
主仓库         https://github.com/HerTa-st/Herta-dsh           main = 304045d
主题在包里     theme/dsh-theme-herta/        （包根就是它自己）
主题的入口     lib/index.js（宿主）· lib/client.js（客户端入口）· lib/theme.js · lib/settings.js
主题的路由     /herta-theme/*（白名单静态路由，扫目录建索引）
主题的槽位     dsh.client.inject = @deepseek-ai/dsh-client-ui-theme；设置页挂 settings.section
工单           https://github.com/HerTa-st/Herta-dsh/issues/7
```
