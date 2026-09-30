/**
 * 体检第二批：把设置页那几条**文案/接线**改进补进已打好的 `lib/client.js`。
 *
 * ## 为什么又是打产物
 *
 * 设置页是通用渲染器，照着**内联在产物里的**一份字段表与分组表画行；而 `theme` /
 * `deviceScene` 的 `wired` 标志、以及那些提示文本，都在这份产物里有一份副本。
 * 源码（`src/host/settings-schema.js`、`src/client/index.tsx`）是真源，产物是当时那份
 * 字节 —— 两者必须一起动（2026-09-30 两次踩坑的教训，见 `test-artifact-sync.mjs`）。
 *
 * ## 这一批改了什么
 *
 *  1. `theme`：标 `wired: false` + 说明 —— 它以前挂在正常分组里，改了没反应（消费者
 *     是 DSH 外壳自己，不是这个字段）。
 *  2. `deviceScene`：同上 —— 父窗口根本没有 get/set 分支，那张卡永远起不来。
 *  3. 「暂未接线」分组那句说明：原来断言「整机当前没有任何代码读它们」，而 bridge 里
 *     确实有读 `closeToTray` / `dreamEnabled` 的代码（只是今天没被调用）—— 断言收一收。
 *  4. MiMo 密钥那一行：原话说「宿主侧 mimo-tts.js 会读它」，实际那个合成器只读环境变量、
 *     而且全仓零调用点 —— 改成实话。
 *  5. 「已回落：」→「语音状态：」：fish 明确不回落，却被渲染成「已回落：Fish Audio 不可用…」
 *     （自相矛盾）。状态行改成中性措辞。
 *  6. 网盘那一行：说明里补「不含语音模型」—— 它就摆在「本地语音模型」正下方，被墙的
 *     用户极可能点进去找一个不在里面的东西。
 *  7. 撞到每轮上限时，那一行补一句人话（用 `stats().lastCap` 的「念了多少 / 上限多少」）。
 *
 * ## 幂等
 *
 * 见到 `lastCap ?` 就当补过，跳过。覆盖前留 `<file>.bak-ux-texts`（已进 .gitignore）。
 *
 * usage: node scripts/reapply-ux-texts.mjs <lib/client.js>
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const MARK = "lastCap ?";

/** 每一条：`[编号, 说明, 查找, 替换]`。查找串必须**只出现一次**，否则整条放弃。 */
const EDITS = [
  [
    "1",
    "theme 标成未接线",
    '    def: "system",\n    label: "\\u4E3B\\u9898"\n  }),',
    '    def: "system",\n    label: "\\u4E3B\\u9898",\n    wired: false,\n    note: "主题由 DSH 外壳自己管（这一行改了不影响界面）；整机那边才由 initTheme 读它。"\n  }),',
  ],
  [
    "2",
    "deviceScene 标成未接线",
    '    def: true,\n    label: "3D \\u8BBE\\u5907\\u5361"\n  }),',
    '    def: true,\n    label: "3D \\u8BBE\\u5907\\u5361",\n    wired: false,\n    note: "DSH 侧没有这条路：父窗口没有 get/setDeviceScene 分支，整机视图也还没实现。"\n  }),',
  ],
  [
    "3",
    "「暂未接线」的说明收一收断言",
    "**\\u6574\\u673A\\u5F53\\u524D\\u6CA1\\u6709\\u4EFB\\u4F55\\u4EE3\\u7801\\u8BFB\\u5B83\\u4EEC**",
    "**\\u6574\\u673A\\u5F53\\u524D\\u4E0D\\u4F1A\\u8C03\\u7528\\u5B83\\u4EEC**",
  ],
  [
    "4",
    "MiMo 那一行的说明改成实话",
    "\\u5BBF\\u4E3B\\u4FA7 mimo-tts.js \\u4F1A\\u8BFB\\u5B83",
    "它写进 DSH 凭据存储；宿主侧的 MiMo 合成器目前还没有接线（它只读环境变量），所以现在填了也不会有人读",
  ],
  [
    "5",
    "「已回落」改成中性措辞",
    "\\u5DF2\\u56DE\\u843D\\uFF1A${engineNote}",
    "语音状态：${engineNote}",
  ],
  [
    "6",
    "网盘那一行注明不含语音模型",
    "\\u6574\\u673A\\u5B89\\u88C5\\u5305\\u7684\\u7F51\\u76D8\\u955C\\u50CF\\uFF08\\u7F51\\u7EDC\\u5230\\u4E0D\\u4E86 GitHub \\u65F6\\u7528\\uFF09\\u3002",
    "\\u6574\\u673A\\u5B89\\u88C5\\u5305\\u7684\\u7F51\\u76D8\\u955C\\u50CF\\uFF08\\u7F51\\u7EDC\\u5230\\u4E0D\\u4E86 GitHub \\u65F6\\u7528\\uFF09\\u3002**\\u4E0D\\u542B\\u8BED\\u97F3\\u6A21\\u578B**\\uFF08\\u6A21\\u578B\\u53EA\\u80FD\\u4ECE GitHub \\u4E0B\\uFF09\\u3002",
  ],
  [
    "7",
    "撞到上限时那一行补一句人话",
    "\\u3000\\xB7\\u3000SSE \\u5BA2\\u6237\\u7AEF\\uFF1A${clients === null ? \"\\u672A\\u77E5\" : clients}`",
    "\\u3000\\xB7\\u3000SSE \\u5BA2\\u6237\\u7AEF\\uFF1A${clients === null ? \"\\u672A\\u77E5\" : clients}` + (pipeline.lastCap ? `\\u3000\\xB7\\u3000\\u26A0\\uFE0F \\u4E0A\\u4E00\\u8F6E\\u592A\\u957F\\uFF1A\\u53EA\\u5FF5\\u4E86\\u524D ~${pipeline.lastCap.spokenChars} \\u5B57\\uFF08\\u4E0A\\u9650 ${pipeline.lastCap.limit} \\u5B57\\uFF09\\uFF0C\\u540E\\u9762\\u7684\\u5185\\u5BB9\\u53EA\\u663E\\u793A\\u3001\\u6CA1\\u53D1\\u58F0` : \"\")",
  ],
];

let failed = 0;
for (const file of process.argv.slice(2)) {
  console.log(`\n=== ${file} ===`);
  if (!existsSync(file)) {
    console.log("  ✗ 文件不存在");
    failed += 1;
    continue;
  }
  let text = readFileSync(file, "utf8");
  if (text.includes(MARK)) {
    console.log("  ✅ 已经补过（跳过）");
    continue;
  }
  copyFileSync(file, `${file}.bak-ux-texts`);
  const before = Buffer.byteLength(text);

  for (const [id, label, find, repl] of EDITS) {
    const hits = text.split(find).length - 1;
    if (hits !== 1) {
      console.log(`  ✗ ${id}. ${label}：锚点命中 ${hits} 次（要求 1 次）—— 不猜，跳过这一条`);
      failed += 1;
      continue;
    }
    text = text.replace(find, repl);
    console.log(`  ✅ ${id}. ${label}`);
  }

  writeFileSync(file, text, "utf8");
  console.log(`  字节：${before} → ${Buffer.byteLength(text)}；备份：${file}.bak-ux-texts`);
}

console.log(`\n=== ${failed === 0 ? "全部通过" : `${failed} 处失败`} ===`);
process.exit(failed === 0 ? 0 : 1);
