# AGENTS.md

给在本仓库（`dsh-herta`：把 Herta 装成 DeepSeek Harness 插件）里干活的 agent。
**这里只放每次改动都适用的东西**；发版另走 [`RELEASING.md`](RELEASING.md)。

## 改动的两步（每次都要，判据可查）

1. **动了 `src/` 就重建产物。**
   `lib/*.js` 是 `src/host/*.js` 的平铺拷贝，`lib/client.js` 由 `src/client/index.tsx`
   经 esbuild 打包；`lib/` **随提交进仓库**，所以源码动了产物就得跟着动。
   判据：`npm run build`（视改动再加 `build:ui` / `build:preset`）之后
   `git diff --name-only` 输出为空。
2. **跑测试。** 判据：`npm test` 退出 0。链上每条命令自带它需要的 `--import` 标记，
   照链跑即可 —— 有的测试**要求不带** hook（`test-schema-optional` 验的是「没有
   schemastery 时的兜底」）。

> **真源是 `src/`，产物由构建生成。** 历史坑：`scripts/reapply-*.mjs` 那批「只改产物、
> 源码没跟上」的手改造成过双向漂移 —— 直接重建会静默回退 8 处已生效的界面文案
> （见提交 `f65dea8`）。要改行为，改 `src/` 再重建。

## 指针（按你手上是什么活去取）

- **发版 / 提 tag / 动 npm / 出问题回滚** → [`RELEASING.md`](RELEASING.md)：一句话触发、
  12 步清单、[`scripts/preflight-release.mjs`](scripts/preflight-release.mjs)
  （发布前八项只读预检；`--verify-published <ver>` 做发布后核验）、已知坑表。
- **写发布文案** → [`docs/templates/`](docs/templates/)：Release 说明 / B 站公告 / README 版本历史。
- **第三方素材的授权边界**（语音、preset、图标） → [`NOTICE.md`](NOTICE.md)、[`THIRD-PARTY.md`](THIRD-PARTY.md)。
- **这份包面向哪个 DSH 版本** → `package.json` 的 `engines.dsh`（不在这里缓存版本号）。

## 跨会话纪律

- **一次一个写者**：多个会话共用一个检出时推送会撞 —— 动手前 `git fetch` 看一眼远端，
  被拒就 `git pull --rebase`。
- **判干净看 `git diff`**：构建写 LF、检出 CRLF，`git status` 会显示一批 `M` 而内容其实一致。
- **中文注释、`<type>(<scope>): <subject>` 提交信息**，风格照现有文件。
- **改动按逻辑分笔**，别把功能、文案、版本号捆成一坨。

## 本机环境（跑测试与构建要的）

| 项 | 值 |
|---|---|
| DSH 解包运行时（测试借 `@deepseek-ai/*`） | `E:\deepseek工作区\HerTa\dsh-017\node_modules`，或 `$env:DSH_MODULES` |
| Herta 源码（`test-narrative` / `test-herta-settings` 要读） | `E:\deepseek工作区\HerTa\Herta-src`，或 `$env:HERTA_SRC` |
| esbuild（构建用） | 上面那份 Herta 源码的 pnpm store 里 |

桌面应用 profile、`deploy.mjs` 更新本地安装、宿主版本事实源等**发版相关**的环境事实，
集中在 [`RELEASING.md`](RELEASING.md) 的「0. 环境事实」一节。
