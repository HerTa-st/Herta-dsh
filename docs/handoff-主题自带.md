# 交接：让 `dsh-herta` 自带主题（`dsh-theme-herta`）

给梦源。读完这一页就能动手，不需要别的上下文。
对应工单：[issue #7](https://github.com/HerTa-st/Herta-dsh/issues/7)。

---

## 一句话

主题包已经**做好、已推到仓库**；还差三步接线，让"装了 `dsh-herta` 的人自动拿到主题"。
第一步（发 npm）需要 npm 账号 / OTP —— 所以整件事是给你的。

## 现状（都可自行核对）

| 事实 | 怎么核 |
|---|---|
| 独立仓库已建、已推 | `HerTa-st/dsh-theme-herta`，`main` = `9a1c81f`（29 个文件） |
| 主仓库里也有同一份 | `HerTa-st/Herta-dsh` → `theme/dsh-theme-herta/`（`main` = `a54dbd6`） |
| **npm 上还没有它** | `curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/dsh-theme-herta` → `404` |
| 开发机上它是通的 | 那台 profile 里以 `file:` 装着，开机动画/配色/背景/设置页都在跑 |

主题包含：开机 ASCII 开场（移植自上游，见它的 `NOTICE.md`）、紫罗兰配色令牌、
可换背景（自带四张 / 网址 / 本机导入 / 纯色 / 关，默认「魔女阳台」）、DSH 设置里的「黑塔外观」页。

## ⚠️ 动手前要先定一件事：上游授权

`theme/dsh-theme-herta/NOTICE.md` 里写着：开场模块移植自 `PersonaCLI/Herta`，
而那个仓库**未标注标准许可证**（GitHub 读作 `NOASSERTION`/Other，2026-10-03 查）。

也就是说，**在把它发布出去之前，得先决定**：是去跟上游确认，还是把
`lib/opening/` 那块当作"本机自用"、发布时移除。这条是决策，不是技术问题 —— 归你。

（除此之外：角色与背景素材是**非商业同人**范围，`NOTICE.md` 已写明。）

## 你要做的三步（顺序不能换）

### 1. 发布主题到 npm

在 `theme/dsh-theme-herta/` 里（`package.json` 已备好 `name`/`version 0.1.0`/`publishConfig.access: public`）：

```bash
npm publish
```

### 2. 把主题变成依赖

`dsh-herta/package.json`：

- `dependencies` 里加 `"dsh-theme-herta": "^0.1.0"`
- `files` 里加 `"theme"`

> **别提前只加 `files`**：依赖还没上时它没有任何用处，只会让每次安装多带约 3 MB 的图。
> 两条**同一次**改。

### 3. 加一行 loader

`dsh-herta/cordis.patch.yml` 的 `insert:` 列表里，与 `id: herta` 并列：

```yaml
- insert:
    - id: herta
      name: dsh-herta
    - id: ui-theme-herta
      name: 'dsh-theme-herta'
```

> ⚠️ `id` **不能与已有条目重名** —— 该文件自己的注释写着：重复的 loader 条目 id 会让
> profile **直接启动失败**。

### 4. 然后才发版

bump `dsh-herta` 版本号 → 按 [`RELEASING.md`](../RELEASING.md) 走那 12 步。

**只 bump 版本就发**等于白发一次：发出去的还是不带主题的版本。

## 验收（在**干净**的 profile 上做）

1. `dsh plugin add dsh-herta` 之后，`~/.dsh/profiles/<p>/node_modules/dsh-theme-herta` 存在；
2. 重启应用：开机有 ASCII 开场，界面是紫罗兰色调；
3. 设置里出现「黑塔外观」一项；
4. 「外观」里换背景、调遮罩、切纯色都真的生效；
5. **旧版用户不受影响** —— 用只装旧版 `dsh-herta`（没有主题包）的环境启动一次，必须正常。
   这条才是本 issue 的风险点，**别跳**。

## 我这边的边界（免得你白等）

- 这台机器**没有 npm CLI、也没有任何 npm 凭据** → 第 1 步我做不了；
- 主题这一摊是开拓者新划给我的域，**主题本身的改动我来**（配色、背景、开场、设置页、它的 README/NOTICE）；
- 上面第 2、3 步动的是**主插件自己的清单**（设置与工具域 / 界面与发布域）→ 按规范归你。

## 附：这一包的几个约定（以后改它的人要知道）

- **客户端不打包**：它运行时 `import()` 宿主路由 `/herta-theme/*` 上的模块 —— 改完**不需要构建**；
  但**只有客户端那半侧要彻底重启应用**才生效（宿主路由每条请求现场读盘，所以那半侧立刻生效）。
- 主题在仓库里的路径就是它的包根：`theme/dsh-theme-herta/`。
- 它的 `dsh.bundle.patch` 指向自己的 `cordis.patch.yml`，`dsh.client.inject` 是
  `@deepseek-ai/dsh-client-ui-theme`。
- 背景图与配色都是本地资源（约 3 MB），不依赖外网。
