# dsh-theme-herta

给 DeepSeek Harness 的**黑塔主题**：开机时播一段 ASCII 开场，界面换成紫罗兰色调，
背景是一层可换的壁纸。

> 非商业同人作品，与米哈游、与 DeepSeek 官方无关。素材与上游出处见 [NOTICE.md](./NOTICE.md)。

## 它能做什么

- **开机开场**：DSH 启动时铺一层全屏遮罩，播上游那套 ASCII 开场（每秒逐帧画，不是视频）。
  冷启动播一次（刷新不重播），最长 15 秒强制收场，任何失败都会立刻撤掉遮罩。
- **配色令牌**：一整套深/浅两色的 `--dsw-alias-*`，颜色取自角色原画量出来的那几档。
- **背景层**：自带四张图（**默认「魔女阳台」**），也可以填图片网址、从本机导入一张、
  用一个纯色，或者干脆关掉。壁纸在面板底下（半透明面板所以透得出来）。
- **外观设置页**：DSH 设置里多一项「黑塔外观」—— 换背景、调遮罩、纯色预设色块 + 系统调色盘。

## 安装

跟其他 DSH 插件一样：

```bash
dsh plugin --profile <你的 profile> add dsh-theme-herta
```

也可以直接从本仓库安装（`package.json` 里声明了 `dsh.bundle.patch`，装完**要重启**才生效）：

```bash
dsh plugin --profile <你的 profile> add <本仓库地址或本地路径>
```

## 结构

```
lib/index.js            宿主：注册 /herta-theme 静态路由（白名单，扫目录建索引）
lib/opening-route.js    那条路由的实现
lib/client.js           客户端入口：__ModuleLoader__.load + 开场遮罩 + 动态 import 下面两个
lib/theme.js            主题层：配色令牌 + 背景层 + 与原生标题栏对齐
lib/settings.js         外观设置页（挂在 settings.section 槽上）
lib/opening/            移植来的开场模块（10 个，见 NOTICE）
lib/opening-segments/   开场数据（4 段）
lib/backgrounds/        四张自带背景图
```

**关键设计**：客户端**不打包** —— 它在运行时 `import()` 宿主路由上的模块，
所以不需要任何构建步骤就能改（也不受 esbuild 之类的限制）。

## 已知边界（说实话那部分）

- 右上角那三个窗口键（最小化/最大化/关闭）是 **Windows 原生画的**，网页盖不住它们 ✗。
  主题能做的是**让它们与画面同色**（开机动画期间连同原生那条一起融掉）。
- **外观设置里的值存在浏览器本地**（`localStorage`），**不是** profile 配置 ——
  换机器不带走。要跨机器请用图片网址。
- 本地导入的图会先压到最长边 2560，再存成 `data:` URL；压完仍超 4MB 会明确报错。

## 许可

代码 MIT（见 [LICENSE](./LICENSE)）；移植部分与素材见 [NOTICE.md](./NOTICE.md)。
