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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProxy } from "../src/host/fish-tts.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

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

console.log("\n=== 没有写死的默认代理（回归守门）===");
{
  const src = read("src/host/fish-tts.js");
  ok(/proxy:\s*null,/.test(src), "DEFAULTS 里 proxy 是 null");
  ok(
    !/cfg\.proxy\s*\?\?\s*"http:\/\/127\.0\.0\.1:7897"/.test(src),
    '没有 `cfg.proxy ?? "http://127.0.0.1:7897"` 这种兜底'
  );
  ok(
    !/^\s*proxy:\s*"fishProxy",/m.test(src),
    "OVERRIDE_KEYS 里**没有** proxy —— 设置页的值必须并进 cfg 才不会冲掉配置文件（2026-09-30 事故）"
  );
  ok(
    /callFish\(text, cfg, key, out, resolveProxy\(cfg, overrides\)\)/.test(src),
    "代理是解析好之后**作为参数**传进 callFish 的"
  );
  ok(
    src.includes(
      "网络到不了 Fish 接口（fishaudio.org / api.fish.audio），而且没有配代理"
    ),
    "连不上且没代理时给的是可读的一句话（不是静默返回 null）"
  );
}

console.log("\n=== 设置页字段：schema / 分组表 / 宿主读取 ===");
{
  const schema = read("src/host/settings-schema.js");
  const groups = read("src/host/settings-groups.js");
  const voice = read("src/host/minimax-voice.js");
  ok(
    /fishProxy:\s*Object\.freeze\(\{/.test(schema),
    "schema 里有 fishProxy 字段"
  );
  ok(/label:\s*"Fish 代理"/.test(schema), "字段名是「Fish 代理」");
  ok(
    /wired:\s*true/.test(
      schema.slice(
        schema.indexOf("fishProxy:"),
        schema.indexOf("fishProxy:") + 400
      )
    ),
    "fishProxy 标了 wired: true"
  );
  ok(/"fishProxy"/.test(groups), "分组表里挂进了某一组");
  ok(
    /fishProxy:\s*readStringField/.test(voice),
    "宿主把它传给了 fish-tts（fishProxy）"
  );
  ok(
    /getLastFailure/.test(voice),
    "宿主用 getLastFailure 把失败原因写到 engineNote"
  );
}

// 产物（lib/client.js）的文本断言已删除：「产物 = 构建输出」由 pre-commit 的
// `npm run build && git diff --exit-code -- lib` 与 test-artifact-sync 的字节比较
// 共同守住；src 侧的字段/分组/hint 断言在上面两节里已经有了。
// src/host ↔ lib 的逐字节比较是 test-artifact-sync 的职责（它逐文件全覆盖），
// 这里不再重复一份 4 个文件的子集。

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
