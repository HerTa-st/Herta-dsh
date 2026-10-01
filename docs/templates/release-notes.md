## vX.Y.Z

**<一句话：这一版最值得说的一件事>**
面向 DSH `<宿主版本>`（`engines.dsh` 区间 `>=0.1.7-rc.1 <0.3.0-0`）。

- **发布到 npm**：`dsh-herta@X.Y.Z`（N 个文件 / X MB，sha1 `<preflight 打出来的那个>`）。
- **插件市场**：条目已收录，DSH 内置市场里搜 `herta` 一键安装。

### 这一版的主体：<主题>

- <改了什么、为什么、用户能感知到什么>
- <坑与解法：把「以前怎样 / 现在怎样」写清楚>

### 顺手修掉的

- <一条一件事>

### 验证

- **测试：核心 23 组 N 项 + MiniMax 6 组 M 项 = T 项全过、0 失败。**
- **npm 制品核验**：`dist.shasum = <sha1>`；把 tag 那一刻的树重新打包与 registry 上那份
  逐文件比对一致（文本文件按 EOL 归一）。
- **部署核验**：桌面 profile 里那份副本与仓库逐文件一致。

### 仍未接

- <明确列出来，别让读者以为「没有就是没做」>

### 装

```
dsh plugin --profile desktop add dsh-herta        # npm
```

或者直接在 DSH 内置插件市场里搜 `herta` 一键安装。
装完**关掉桌面应用窗口、重新打开**（`dsh.profile.bundles` 是启动期合成的，热重载不覆盖它）。

### 目录与上游状态（如实说明）

- 条目的 `version` 是上游每日构建（北京 10:23）的快照 —— 发布后次日才显示新版本号；
  **安装始终取 npm `latest`**，不受影响。
- 条目**内容**（描述 / 工具数 / owner / url）若有变化，另行提 PR。

### 来源与素材声明

> 这一段**每版都要原样保留**（第三方同人素材的声明义务，见 `NOTICE.md` / `THIRD-PARTY.md`）。

本项目是基于 **Herta**（<https://www.herta-ai.com/#research>，*THE SELF THAT USES THE AGENT*）
的**第三方改造**，与原作者无任何隶属、合作或背书关系。插件代码（`src/`、`lib/`、`scripts/`、
Cordis 配置）为本次改造新写，采用 MIT。

`assets/voice/`、`preset/herta.patch.yml` 与 `icon.png` 是第三方同人素材，权利归米哈游及
各自所有者，按《崩坏：星穹铁道》同人衍生作品创作指引 V2.0 第三条放置法律声明后收录：
**仅限非商业使用，且不得作为独立素材包再分发**。详见 `NOTICE.md` 与 `THIRD-PARTY.md`。

> ⚠️ `assets/tts-runtime/` 里的 espeak-ng 是 **GPL-3.0-or-later 且静态链接**，许可原文随包
> 分发在 `assets/tts-runtime/LICENSES/espeak-ng-LICENSE.txt`；`THIRD-PARTY.md` 已给出
> 对应源码的获得方式。
