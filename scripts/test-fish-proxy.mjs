/**
 * 「Fish 代理」这条链的测试（`src/host/fish-tts.js` + 设置页字段）。
 *
 * ## 为什么断言的是 src，不是产物
 *
 * 2026-09-30 的真事：梦源在 `src/client/index.tsx` 里加了「Fish 密钥」那一行，
 * 但**打包好的 `lib/client.js` 里没有**（客户端读的是那份字节）—— 于是源码看着有、
 * 界面里没有，用户填不了密钥，症状是「填了也不出声」。
 *
 * 那时的补法是对 `lib/client.js` 解码后 substring 断言；**2026-10-03 起换掉了**：
 * 产物只经 `npm run build` 生成、且 pre-commit 强制「build 后 `lib/` 无 diff」
 * （见 `AGENTS.md` 改动两步与 `.husky/pre-commit`），「产物 = 构建输出」已是被守卫的
 * 不变量 —— 对产物文本断言等于断言 esbuild 的转义风格，换版本就误报
 * （2026-10-01 `label: "Fish 代理"` 变 `\u4EE3\u7406` 就红过一次）。
 * 这里只断言 `src` 里的同一事实，产物那一面交给字节级守卫。
 *
 * 用法：node scripts/test-fish-proxy.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProxy } from "../src/host/fish-tts.js";
import { FIELDS } from "../src/host/settings-schema.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${label}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
  }
};

console.log(
  "=== resolveProxy：代理从哪来（顺序 + 明确关闭 + 空串不许冲掉配置）==="
);
/** 每个用例：描述、配置里的 proxy、设置页传来的 overrides、环境变量、期望。 */
const env = (o) => o;
const cases = [
  [
    "设置页的值优先于一切",
    { proxy: "http://cfg:1" },
    { fishProxy: "http://ui:9" },
    env({ HTTPS_PROXY: "http://env:2" }),
    "http://ui:9",
  ],
  [
    "没设设置页时用配置文件里的",
    { proxy: "http://cfg:1" },
    {},
    env({ HTTPS_PROXY: "http://env:2" }),
    "http://cfg:1",
  ],
  [
    "配置文件也没有时用 HTTPS_PROXY",
    {},
    {},
    env({ HTTPS_PROXY: "http://env:2" }),
    "http://env:2",
  ],
  [
    "小写 https_proxy 也认",
    {},
    {},
    env({ https_proxy: "http://env:3" }),
    "http://env:3",
  ],
  [
    "只设了 HTTP_PROXY 也认",
    {},
    {},
    env({ HTTP_PROXY: "http://env:4" }),
    "http://env:4",
  ],
  ["全都没有 → null（**不再有写死的默认代理**）", {}, {}, env({}), null],
  [
    "**设置页给空串 → 配置文件里的代理必须活着**（2026-09-30 试听不出声的真因）",
    { proxy: "http://cfg:1" },
    { fishProxy: "" },
    env({}),
    "http://cfg:1",
  ],
  [
    "设置页给空串、配置文件也没有 → 仍然看环境变量",
    {},
    { fishProxy: "" },
    env({ HTTPS_PROXY: "http://env:2b" }),
    "http://env:2b",
  ],
  [
    "空串当没设（继续往下看）",
    { proxy: "  " },
    {},
    env({ HTTPS_PROXY: "http://env:5" }),
    "http://env:5",
  ],
  [
    "设置页写 off → 明确不要代理，环境变量也不再被采用",
    {},
    { fishProxy: "off" },
    env({ HTTPS_PROXY: "http://env:6" }),
    null,
  ],
  [
    "off 大小写不认",
    {},
    { fishProxy: "OFF" },
    env({ HTTPS_PROXY: "http://env:7" }),
    null,
  ],
  [
    "none / 0 同义",
    {},
    { fishProxy: "0" },
    env({ HTTPS_PROXY: "http://env:8" }),
    null,
  ],
  [
    "前后空格不算内容",
    {},
    { fishProxy: "  http://ui:10  " },
    env({}),
    "http://ui:10",
  ],
  ["环境变量是纯空格 → 当没设", {}, {}, env({ HTTPS_PROXY: "   " }), null],
  [
    "overrides 整个缺失（老调用方）也不炸",
    { proxy: "http://cfg:9" },
    undefined,
    env({}),
    "http://cfg:9",
  ],
];
for (const [label, cfg, overrides, e, want] of cases) {
  const got = resolveProxy(cfg, overrides, e);
  ok(
    got === want,
    label,
    `期望 ${JSON.stringify(want)}，实得 ${JSON.stringify(got)}`
  );
}

console.log("\n=== 没有写死的默认代理（行为判据）===");
{
  // 这一节原先读 fish-tts.js 的源码文本再正则匹配（DEFAULTS 里 proxy 是 null、
  // OVERRIDE_KEYS 里没有 proxy、代理是作为参数传进 callFish 的）。按架构审查
  // candidate #3：**让测试穿过 interface，而不是抓源码**。
  //
  // 其中三条已被上面的用例表**行为地**覆盖，故直接删掉：
  //   · DEFAULTS.proxy 是 null        → 由「config 里 proxy 为 null、环境也没有 → null」那条覆盖
  //   · 没有 127.0.0.1:7897 兜底        → 同上（拿不到默认代理这件事只能这么验）
  //   · 代理作为参数传进 callFish        → **实现形状**，不是行为；callFish 要联网才能驱动，
  //                                      而"用不用代理"已经由 resolveProxy 的返回值守住了
  //
  // 「OVERRIDE_KEYS 里没有 proxy」（2026-09-30 那次覆盖把配置文件里的代理冲掉的事故）
  // 保留下来，但换成**行为**：空串覆盖必须落回 cfg.proxy 而不是把它抹掉。
  const got = resolveProxy({ proxy: "http://cfg:9" }, { fishProxy: "" }, env({}));
  ok(got === "http://cfg:9", "空串覆盖不冲掉配置文件里的代理（2026-09-30 事故的行为判据）", `实得 ${JSON.stringify(got)}`);
}

console.log("\n=== 设置页字段：读描述符的值（不读源码文本）===");
{
  // 原先读 settings-schema.js / minimax-voice.js 的文本再正则。现在直接把描述符
  // import 进来读值 —— 重命名字段、挪动文件都不会再造成误报（candidate #3）。
  const spec = FIELDS.fishProxy;
  ok(spec !== undefined, "字段表里有 fishProxy");
  ok(spec?.label === "Fish 代理", "字段名是「Fish 代理」", `实得 ${JSON.stringify(spec?.label)}`);
  ok(spec?.wired === true, "fishProxy 标了 wired: true");
  ok(spec?.group === "Fish 语音", "fishProxy 挂在「Fish 语音」组里", `实得 ${JSON.stringify(spec?.group)}`);
  // 「宿主把它传给了 fish-tts」原先靠正则找 `fishProxy: readStringField` —— 那是实现形状。
  // 宿主读取这条链路由 settings-schema 的字段表 + 宿主侧 test-herta-settings 守住，这里删掉。
}

// 产物（lib/client.js）的文本断言已删除：「产物 = 构建输出」由 pre-commit 的
// `npm run build && git diff --exit-code -- lib` 与 test-artifact-sync 的字节比较
// 共同守住；src 侧的字段/分组/hint 断言在上面两节里已经有了。
// src/host ↔ lib 的逐字节比较是 test-artifact-sync 的职责（它逐文件全覆盖），
// 这里不再重复一份 4 个文件的子集。

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
