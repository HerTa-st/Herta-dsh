# 官方 agent preset 底本（自带）

这里放的是从**官方 DSH 发行版**里逐字节导出的 `dsh-web-app/presets/standard.patch.yml`，
供 [`scripts/build-preset.mjs`](../build-preset.mjs) 生成 `preset/herta.patch.yml` 时当底本。

## 为什么需要它

`build-preset.mjs` 的设计意图是「以官方 standard 为底、只替换 persona 行，其余逐字保留」，
这样工具清单永远跟随官方，不会因为抄漏一行而少给她能力。

但官方那份底本在**运行时的位置**读不到：

- 桌面应用把整棵 `dsh` 打进 `resources/app.asar`（一个归档文件，裸 Node 读不进去）；
- profile 里的 `node_modules/@deepseek-ai` 常常只是指向上游的 junction，上游一换位置就断；
- 本机解包出来的那份安装是 `dsh-017`（`0.1.7-rc.2`），而桌面应用已经是 `0.2.0-rc.2`。

「只读本机安装」的后果不是构建报错，而是**静默用旧底本生成 preset** —— 官方在新版里
新增的工具会凭空少几项，症状是「她少了某个能力」，没人会往构建脚本上想。

所以 `resolveBaseline()` 会在「本机 DSH 安装随附的那份」和「这个目录里的自带底本」
之间**取版本最新的那份**（`$env:DSH_PACKAGES` 是显式覆盖，优先级最高）。装了更新的
DSH 就自动跟上游，没装也至少不会比自带底本更旧。

## 命名与内容规范

```
standard.dsh-<该 DSH 的版本>.patch.yml
```

- 内容必须是**逐字节导出**的官方文件：不要加注释头、不要重排、不要格式化。
  它是「官方在这一版里到底给 agent 配了什么」的证据，改了就不再是证据。
- 版本号取该发行版里 `@deepseek-ai/dsh-web-app/package.json` 的 `version`。
- 新增一版就**再加**一个文件，不要覆盖旧的：`resolveBaseline()` 按文件名里的版本比较。

## 已有底本

| 文件 | 来源 | 大小 | SHA-256 |
|---|---|---|---|
| `standard.dsh-0.2.0-rc.2.patch.yml` | `E:\deepseek Desktop\resources\app.asar` → `dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml` | 7511 B | `6cd2f197737fc94a45e487d0bb57869461dd6f392d45f6429b576e75d973eda8` |

导出方式（app.asar 头部是 JSON 目录 + 偏移表，可只读需要的那个条目，无需解包 121 MB）：

```powershell
E:\node\node.exe ..\..\..\_asar-tool.mjs `
  "E:\deepseek Desktop\resources\app.asar" `
  dump "dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml" `
  <目标路径>
```

（`_asar-tool.mjs` 是本次兼容性检查留在工作区根目录的工具，见
`_Herta-DSH-与DSH0.2.0兼容性检查.md` 的附录。）
