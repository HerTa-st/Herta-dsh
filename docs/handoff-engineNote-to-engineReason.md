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

## 五、本机实测：别在缺工具链的机器上「自造」（2026-10-03 记录）

有人在一台**没有 esbuild、也没有那份 `Herta-src`** 的机器上试过「自己装一个再重建」。
结论：**死路**，别重趟。实测三条：

1. **esbuild 本身拿得到**：走 `http://127.0.0.1:7897` 代理 `pnpm add esbuild@0.25.12` 即可
   （构建脚本只认这一条路径：`HERTA_SRC/node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js`，
   见 `scripts/build.mjs:63-82`；平台二进制会随 `@esbuild/win32-x64` 一起装上）。
2. **上游锚点对不上**：`ADR-0002` 记的 `c86d122` 是「源码通读」的锚点，**不是构建锚点** ——
   把上游换到它之后，构建报 `X [ERROR] Could not resolve "@herta/core/text-sanitize"`。
   构建用的确切上游版本，仓库里**没有记**（这是本清单之外、值得补的一条）。
3. **即使跑通也不可信**：三次尝试、三次都把 `lib/minimax/*.js` 生成成**与提交不同的字节**
   （原因与待做的改动无关）。拿这种产物提交 = 把无关漂移混进历史，正是 AGENTS
   「产物只经构建生成（ADR-0003）」要防的事。

**结论**：第 3/4 笔后半与第 ⑤ 项，必须在**有那份确切 `Herta-src` 的机器**上做。
本机若只是读代码、跑不依赖构建的测试，可以把 `HERTA_SRC` 指向一份只读的上游克隆
（例如 `C:\herta-ai\tools\_herta-src`）；**但别用它生成产物**。

