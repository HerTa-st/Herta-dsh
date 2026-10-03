# 构建锚点：`Herta-src` 对应上游 `c86d122`，以及复现配方

**背景**：ADR-0002 计划给 `Herta-src` 加 `.git`、并向 `Herta-g` 推一个 marker 分支固化它对应的
上游 commit。**那个 marker 至今没有推**（2026-10-03 查：`Herta-g` 只有 `main` 与
`feat/dsh-backend-integration`，没有 release；组织内代码/提交搜索也找不到锚点记录）。
结果是一个隐式依赖：`lib/client.js` 由哪一版上游产出，**没有任何地方记着** ——
换台机器重建，产物就对不上，而没有人能说出应该对到哪儿。

**决定**：锚点记在这里，**上游 = `PersonaCLI/Herta` 的 `c86d122`**（2026-09-15），
它同时是 ADR-0002 提到的「源码通读」锚点 —— 一份记录，两个用途。

## 复现配方（2026-10-03 实测走通）

```bash
# 0) 准备一份只读上游（浅克隆够用）
git clone --depth 1 https://github.com/PersonaCLI/Herta.git Herta-src
cd Herta-src && git fetch --shallow-since=2026-08-01 origin && git checkout c86d122

# 1) esbuild 0.25.12（ADR-0003 固定版本）。构建脚本只认这一条路径：
#    HERTA_SRC/node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js
pnpm add esbuild@0.25.12          # 走代理 http://127.0.0.1:7897 时：先设 HTTPS_PROXY

# 2) PATH 里必须有 node —— pnpm 的子进程按名字找它（只给绝对路径调 pnpm.cjs 会报
#    'node' is not recognized）

# 3) 上游要先自己构建：pnpm install --ignore-scripts && pnpm build   （= tsc -b）
#    --ignore-scripts 是为了避开原生依赖编译

# 4) @herta/* 的桥要自己搭（最隐蔽的一步）：上游的 workspace 链接在各包自己的
#    node_modules 里，而 esbuild 是从**本仓库**的文件往上找 node_modules ——
#    所以要在本仓库（或构建台）的 node_modules/@herta/ 下给 9 个包建目录联接，
#    指向 HERTA_SRC/packages/*。搭上之后客户端立刻构建成功。

HERTA_SRC=<上面那份> node scripts/build.mjs
```

## 验收与已知代价

- 验收仍是 AGENTS 那条：`npm run build` 后 `git diff --exit-code -- lib` 为空。
- **判干净必须用内容哈希**，别看 `git status` —— 构建写 LF、检出 CRLF，
  `git status` 会显示一批 `M` 而内容其实一致（`git hash-object` vs `git rev-parse HEAD:<path>`）。
- 代价要说清：按本锚点重建出的 `lib/client.js` 与**该锚点落库前**那份不同
  （504,383 vs 504,934 字节）—— 也就是说锚点一旦写死，之后的产物以本锚点为准。

## 这条决定没有回答的问题

上游此后仍在前进（`PersonaCLI/Herta` 的 main 已到 `8fb8099`）。**什么时候跟进上游**
按 ADR-0002 的阈值（落后 30 天或 50 个提交触发评估），由梦源执行；本 ADR 只负责
把"现在用的是哪一版"写清楚。
