# 交接：第 3/4 笔的后半 + 第 ⑤ 项（`engineNote` → `engineReason`）

> 给**有 esbuild 的机器**（梦源那台或发布机）。这台没有 esbuild，而这两项都要重建
> `lib/client.js` —— 按 ADR-0003 它只许由构建生成，**不许手改**。
> 坐标是 2026-10-03 在 `045a35c` 之后的树上实测的（不是回忆）。

## 为什么这两项要一起做

它们动的是**同一个字段**：候选 #1 之前，合成失败的原因塞在 `mini.engineNote` 那个可变
字段里，经状态帧 `engineNote` 一路送到客户端。候选 #1 之后原因有了正经出处
（adapter 给 `code`、router 收起、边界拼文案，见 ADR-0006），所以：

- 第 3/4 笔的后半 = **删掉 `engineNote`**，状态行改读 router 的 `reason`；
- 第 ⑤ 项 = 状态帧里的**字段改名** `engineNote` → `engineReason`（Q27）。

一次改完、一次重建客户端，别拆成两笔（拆了中间态是"字段两边名字不一致"的坏状态）。

## 一、宿主侧（`src/host/minimax-voice.js`）

现状（实测行号，改动后会移位）：

| 行 | 内容 | 怎么改 |
|---|---|---|
| 358 | `engineNote: null,`（字段声明） | **删掉** |
| 367 | `engineNote: mini.engineNote,`（在 `snapshot()` 里） | 换成 `engineReason: mini.reasonText(),` |
| 456 | `mini.engineNote = MIMO_NOT_WIRED;` | **删掉**（mimo 的 code 是 `not_wired`，router 已经报过状态） |
| 471 | `mini.engineNote = null;`（成功） | **删掉** |
| 474 | `mini.engineNote = reasonText(synthRouter.lastCode());` | **删掉**（理由由 `reasonText()` 现算） |
| 523 | `mini.engineNote = null;` | **删掉** |
| 406 / 431 / 708 | 三处 `note: mini.engineNote ?? "合成失败（看宿主日志）"` | 换成 `note: mini.reasonText() ?? "合成失败（看宿主日志）"` |

新增一个**只读**取词口（放在 `mini` 对象里，挨着 `engineOf`）：

```js
/** 现在这一档为什么不出声（给人看的中文）；没失败就是 null。 */
reasonText: () => {
  const { name, code } = synthRouter.lastCode();
  return code === SYNTH_CODES.ok ? null : reasonText({ name, code });
},
```

⚠️ 注意重名：模块里已有一个 `const reasonText = ({name, code}) => …` 的**局部函数**
（在 `ensureShared` 内，第 2/4 笔加的）。`mini.reasonText` 调的就是它 —— 名字撞车时
以"对象方法调局部函数"为准，别改名、也别把局部函数删了。

## 二、客户端侧（`src/client/index.tsx`）

实测只有 **5 处代码**（交接文档写"6 处"是旧计数；另有 2 处注释）：

| 行 | 内容 | 怎么改 |
|---|---|---|
| 923 | `markMinimax("minimaxEngineNote", frame.engineNote ?? null);` | `frame.engineNote` → `frame.engineReason`（store 的键名 `minimaxEngineNote` **不用改**，那是内部名） |
| 2654 | `const engineNote = typeof state?.engineNote === "string" && state.engineNote !== "" ? state.engineNote : null;` | 三处 `engineNote` 全改成 `engineReason`（变量名可保持） |
| 2712 / 2717 | `engineNote === null ? null : …` / `` `语音状态：${engineNote}` `` | 不用改（读的是上面那个局部变量） |
| 2640 | 注释里提到 `engineNote` | 顺手改成 `engineReason` |

改动一处**必须**同改：`frame` 那个字段来自宿主 `snapshot()`（上面第一节），两边名字要不一致，
状态行会静默变空 —— 那正是这次要收拾的毛病，别又造一个。

## 三、重建与验收

```bash
npm run build          # 会重建 lib/client.js；host 侧 .js 是平铺拷贝
git diff --name-only   # 期望：src/host/minimax-voice.js、lib/minimax-voice.js、
                       #       src/client/index.tsx、lib/client.js
npm test               # 全链（这台跑不了的两条这次能跑了）
```

这台能跑的那几条（应与改动前一致）：`test-artifact-sync` 4/0 ·
`test-minimax-voice` 43/0 · `test-minimax-synthesizer` 37/0 · `test-fish-key` 34/0 ·
`test-fish-proxy` 26/0 · `test-voice-settings` 52/0。

**验收三条**（缺一不可）：

1. 全仓搜 `engineNote`，**只剩历史注释/文档**，`src/` 与 `lib/` 里没有活代码引用；
2. 设置页的语音状态行仍然会显示「语音状态：…」（失败时），且 fish / local 的措辞中性
   （第 2711 行那条注释的要求：fish 不回落，不能写成"已回落"）；
3. `git diff --name-only` 里 `lib/client.js` 有变更 —— 没有就是客户端没重建成功。

## 四、完成后

- 若走 PR：base `main`、标题照 `<type>(<scope>): <subject>`；
- 这两项做完，交接的 ①~⑥ 就全清了（①②③④⑤⑥ 均已落地）。

## 五、工具链能不能自己凑出来？（2026-10-03 实测，结论已修正）

先前的版本在这里写着「别自造，产物不可信」—— **那句是错的** ✗，已按实测改正：

**能凑出来，而且 host 侧逐字节可复现。** 缺的四样都是环境，不是代码：

1. **esbuild 0.25.12** —— 走 `http://127.0.0.1:7897` 代理 `pnpm add esbuild@0.25.12` 即可。
   构建脚本只认这一条路径：`HERTA_SRC/node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js`
   （`scripts/build.mjs:63-82`）；平台二进制随 `@esbuild/win32-x64` 一起装。
2. **PATH 里要有 `node`** —— pnpm 的子进程按名字找 `node`，只给绝对路径调 `pnpm.cjs` 会报
   `'node' is not recognized`。
3. **上游要先自己构建**：在 `HERTA_SRC` 里 `pnpm install --ignore-scripts` + `pnpm build`（= `tsc -b`）。
4. **`@herta/*` 的桥要自己搭** ✓ 这最隐蔽：上游的 workspace 包链接在各包自己的 `node_modules` 里，
   而 esbuild 是从**本仓库**的文件往上找 `node_modules` —— 所以要在本仓库（或构建台）的
   `node_modules/@herta/` 下给 9 个包建目录联接（指向 `HERTA_SRC/packages/*`）。搭上之后
   `lib/client.js` 立刻构建成功。

**判据必须用内容哈希，别看 `git status`** ✓ —— 构建写 LF、检出 CRLF，`git status` 会显示一批 `M`
而内容其实一致（AGENTS.md 记过这个假阳性）。实测：

```
git hash-object -- lib/...   vs   git rev-parse HEAD:lib/...
→ lib/ 里 54 个文件与提交内容全部相同 ✓
```

**还没做到的**：`lib/client.js` 的**逐字节**复现 ✗。它随上游版本变化（`c86d122` 504,383 字节 →
`1de74a5` 508,214 → fork main 520,900，而目标是 **504,934**），二分已收到 `c86d122` 之后一两笔；
而某个上游提交的说明指出「the voice payload is a **hash-pinned release asset** the workflow fetches」
—— 语音素材是**从 release 单独取**的，不随仓库走。所以差的那部分很可能是**素材**，不是版本。

**所以**：第 3/4 笔后半与第 ⑤ 项要改 `src/client/index.tsx` ✓ —— 本机**能构建** ✓，但要让产物与提交
逐字节一致、好让 `build 后 lib/ 无 diff` 那条守卫通过 ✓，还得先拿到那批 hash 钉住的素材 ✓
（或者在有完整 `Herta-src` + 素材的机器上做 ✓，那是更短的路 ✓）。

## 六、顺带收尾：候选 #4 的两处抄本（同一台机器一起做）

`settings-schema.js` 与 `voice-settings-shared.js` 各自还留着一份引擎取值域的抄本：

```js
export const VOICE_ENGINES = Object.freeze(["local", "minimax", "fish", "mimo"]);
```

**实测（2026-10-03，同一上游、两次构建的 A/B）**：把这两处改成从
`src/host/voice-engines.js` 派生之后，`lib/client.js` **会变**（496.4 KB → 496.5 KB，哈希不同）。
所以它**不能只改源码** —— 必须和上面第 3/4 笔后半、第 ⑤ 项**在同一台能重建客户端的机器上**一起做。

改法与验收：

- 两处那一行各自换成：

  ```js
  import { VOICE_ENGINES } from "./voice-engines.js";
  export { VOICE_ENGINES };
  ```

  （对外名字不变，`voice-settings-shared.js` 的消费方不用动 —— 尤其**别**把 641 行的
  字段表拖进客户端包，那正是 `voice-engines.js` 单独成文件的原因。）
- **两处都各自会改 bundle**（2026-10-03 逐个 A/B 实测：只改 `settings-schema.js` 那一处，
  `lib/client.js` 也从 `c868206f…` 变成 `88f7ffb1…`；两处一起改则 496.4 → 496.5 KB）。
  别指望"只动一个文件所以不用重建" ❌ —— 只要模块图变了，产物就变。
  （**中性的**是另一件事：把同一文件里的字面量换成常量引用 —— 即本仓库已落地的
  `values: VOICE_ENGINES` —— 那一次实测两版 bundle 逐字节相同。）
- 验收：`npm run build` 之后 `git diff --exit-code -- lib` 为空（ADR-0003 的那条守卫）。
- 做完之后，加一档引擎才真的**只动 `voice-engines.js` 一处**。



