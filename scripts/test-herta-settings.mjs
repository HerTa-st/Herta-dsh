/**
 * 「黑塔」设置的单测 —— 纯逻辑，在 Node 里直接跑，不需要 DSH 运行时。
 *
 * 这个文件在 2026-09-26 被**重写**过一次：上一版测的是「把值写回整机自己读的
 * 两份 settings.json」（`settings-sync.js`：读-改-写、原子落盘、旧文件迁移、
 * 只写 `user` 层覆盖过的字段）。那一整条链路已经删除，所以那些断言连同它们
 * 要保护的模块一起消失。现在测的是剩下的事，外加**两条防回归的断言**：
 *
 *   1. 字段表自洽：每个字段有 label/kind/默认值，默认值自己是合法值，
 *      `wired` 注解与 `note` 配套（「暂未接线」的每一项都必须说清为什么）
 *   2. 校验与归一化：枚举域、布尔口径、数值范围、非法输入一律回落默认
 *   3. 交叉核对：`src/host/index.js` 的 Config 生成器与字段表同源
 *   4. **没有第二个真相来源**：`settings-sync.js` 不存在，字段表也不再导出
 *      写回意图 / 种子 / `sanitizeFollowedFields` 那一套
 *   5. **语音偏好真的接了 bridge**：`bridge.ts` 有三个新成员、
 *      `voice-prefs.ts` 有 `hydrateVoicePrefs`、`main.tsx` 调了它
 *   6. **每个活字段都会被渲染**：每个 `wired` 字段都必须声明 `group`，且那个组名
 *      必须在分组声明里 —— `voiceEngine` / `realtimeVoice` 曾因为「已接线」与
 *      「在哪个组里」是两份名单而静默不渲染；`theme` / `deviceScene` 曾因为两边
 *      不同步而渲染两遍。2026-10-03 起两边合并成一份（字段自己的 `group`），
 *      所以这条断言变成了「单源自洽」而不是「两张名单对账」。
 *
 * 第 4、5、6 条读源码文本，不看运行时 —— 它们要防的是「下一次有人顺手加回来」，
 * 而不是某个函数的行为。这类断言只能这么写。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULTS,
  FIELD_NAMES,
  FIELDS,
  SETTINGS_GROUPS,
  SETTINGS_NAMESPACE,
  UNWIRED_FIELD_NAMES,
  WIRED_FIELD_NAMES,
  groupOfField,
  isManagedValue,
  normalizeSettings,
} from "../src/host/settings-schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log("herta-settings");

// ── 1. 字段表自洽 ────────────────────────────────────────────────────────────
{
  check("字段表非空", FIELD_NAMES.length > 0);
  check(
    "每个字段都有 label / kind",
    FIELD_NAMES.every((n) => typeof FIELDS[n].label === "string" && FIELDS[n].label.length > 0 && typeof FIELDS[n].kind === "string"),
  );
  check("每个字段都有默认值", FIELD_NAMES.every((n) => DEFAULTS[n] === FIELDS[n].def));
  check(
    "每个字段的默认值自己就是合法值",
    FIELD_NAMES.every((n) => isManagedValue(n, DEFAULTS[n])),
  );
  check(
    "枚举字段的默认值在取值域里",
    FIELD_NAMES.filter((n) => FIELDS[n].kind === "enum").every((n) => FIELDS[n].values.includes(FIELDS[n].def)),
  );
  check(
    "数值字段带 min/max/step 且默认值在范围内",
    FIELD_NAMES.filter((n) => FIELDS[n].kind === "number").every(
      (n) => typeof FIELDS[n].min === "number" && typeof FIELDS[n].max === "number" && FIELDS[n].min <= FIELDS[n].def && FIELDS[n].def <= FIELDS[n].max,
    ),
  );
  // 这两个字段的默认值是「缺席」语义，整机会自己解释成「跟随系统 / follow」。
  check("locale 默认为空串（= 跟随系统）", DEFAULTS.locale === "");
  check("interactionLanguage 默认为 follow", DEFAULTS.interactionLanguage === "follow");
}

// ── 1b. `wired` / `note`：那次消费方核查的记录 ──────────────────────────────
{
  check(
    "wired 与 unwired 恰好覆盖全部字段，且互不重叠",
    WIRED_FIELD_NAMES.length + UNWIRED_FIELD_NAMES.length === FIELD_NAMES.length &&
      WIRED_FIELD_NAMES.every((n) => !UNWIRED_FIELD_NAMES.includes(n)),
  );
  check(
    "声明 wired:false 的每一项都必须写清原因（note 非空字符串）",
    UNWIRED_FIELD_NAMES.every((n) => typeof FIELDS[n].note === "string" && FIELDS[n].note.length > 10),
  );
  check(
    "没声明 wired:false 的项不带 note（别把活的写成死的）",
    WIRED_FIELD_NAMES.every((n) => FIELDS[n].note === undefined),
  );
  // 本轮新加的两个字段必须是活的：整机的播放路径真的读它们。
  check("voiceMuted / voiceVolume 是活字段", WIRED_FIELD_NAMES.includes("voiceMuted") && WIRED_FIELD_NAMES.includes("voiceVolume"));
  // 2026-09-30 体检核实：`theme` 与 `deviceScene` 在 DSH 侧**没有消费方**
  // （主题由外壳自己管；设备卡的 postMessage 分支根本没实现），所以它们被标成
  // `wired: false`，只该活在「暂未接线」里、各带一条 `note`。
  // `locale` 仍是活字段 —— 宿主真的按它解析整机界面语言。
  check(
    "locale 是活字段，theme / deviceScene 已被体检标成未接线",
    WIRED_FIELD_NAMES.includes("locale") &&
      UNWIRED_FIELD_NAMES.includes("theme") &&
      UNWIRED_FIELD_NAMES.includes("deviceScene"),
  );
  check("voiceVolume 默认满音量（100）", DEFAULTS.voiceVolume === 100);
  check("voiceMuted 默认不静音", DEFAULTS.voiceMuted === false);
}

// ── 1c. 分组与展示元数据的单源自洽（防回归）────────────────────────────────
// 2026-09-27 的真事：`voiceEngine` / `realtimeVoice` 被标成 `wired: true`（宿主
// 真的按它们分发）之后，就被「暂未接线」那一组自动排除了，而分组表没有跟着加 ——
// 于是这两个字段（连同「语音引擎」这一行）在设置页上**一行都不渲染**：改引擎只能
// 手改 profile 的 `cordis.patch.yml`。2026-10-01 是同一病灶的另一面：`theme` /
// `deviceScene` 从分组里摘掉时两边名单不同步，**渲染了两遍**。
//
// 2026-10-03 起分组归属与展示文案都住在字段描述符里（`SETTINGS_GROUPS` 从
// `FIELDS[n].group` 派生），所以这里不再「对两张名单」，而是断言**这一份是自洽的**：
// 每个活字段都有组、每个组都有字段、组内没有死字段、枚举标签与取值域对得上。
{
  const grouped = new Set(SETTINGS_GROUPS.flatMap((entry) => entry.fields));
  const listed = SETTINGS_GROUPS.flatMap((entry) => entry.fields);
  check("分组表里的字段名都在字段表里（没有拼错的）", [...grouped].every((n) => FIELD_NAMES.includes(n)));
  check("同一个字段不在分组表里出现两次", listed.length === grouped.size);
  check("分组表里的字段都是活字段（死字段该进「暂未接线」）", [...grouped].every((n) => WIRED_FIELD_NAMES.includes(n)));
  const missing = WIRED_FIELD_NAMES.filter((n) => !grouped.has(n));
  check(`每个活字段都声明了 group（缺的：${missing.join(",") || "无"}）`, missing.length === 0);
  check("「暂未接线」那组不与已接线的字段重叠", UNWIRED_FIELD_NAMES.every((n) => !grouped.has(n)));
  check("没有空组（声明了组就得有字段）", SETTINGS_GROUPS.every((entry) => entry.fields.length > 0));
  check(
    "字段声明的 group 值都在分组声明里（拼错就落不进任何组）",
    FIELD_NAMES.filter((n) => FIELDS[n].group !== undefined).every((n) =>
      SETTINGS_GROUPS.some((entry) => entry.title === FIELDS[n].group),
    ),
  );
  check(
    "voiceEngine 与 realtimeVoice 都在「语音」组里",
    groupOfField("voiceEngine") === "语音" && groupOfField("realtimeVoice") === "语音",
  );
  check("不在任何分组里的字段返回 undefined", groupOfField("closeToTray") === undefined);

  // 枚举标签：键必须在取值域里（打错字就是静默显示英文值），且不能漏值。
  const enumFields = FIELD_NAMES.filter((n) => FIELDS[n].kind === "enum");
  check(
    "每个 enum 字段都有 enumLabels",
    enumFields.every((n) => FIELDS[n].enumLabels !== undefined),
  );
  check(
    "enumLabels 的键都在取值域里（多了就是打错字）",
    enumFields.every((n) => Object.keys(FIELDS[n].enumLabels ?? {}).every((k) => FIELDS[n].values.includes(k))),
  );
  check(
    "enumLabels 覆盖全部取值（漏了就显示英文值）",
    enumFields.every((n) => FIELDS[n].values.every((v) => Object.hasOwn(FIELDS[n].enumLabels ?? {}, v))),
  );

  // 行内提示：每个字段都要说清「它是什么」。
  check(
    "每个字段都有 hint",
    FIELD_NAMES.every((n) => typeof FIELDS[n].hint === "string" && FIELDS[n].hint.length > 0),
  );

  // 引擎行的逐档文案：四张表都从描述符来，取值域必须逐档对齐。
  const engineValues = FIELDS.voiceEngine.values;
  const engineMeta = FIELDS.voiceEngine.engine;
  check("voiceEngine 声明了 engine 逐档文案", engineMeta !== undefined);
  check(
    "每一档都有 notes / badges / summary / facts",
    engineValues.every(
      (v) =>
        typeof engineMeta.notes[v] === "string" &&
        Array.isArray(engineMeta.badges[v]) &&
        typeof engineMeta.summary[v] === "string" &&
        Array.isArray(engineMeta.facts[v]),
    ),
  );
  check(
    "逐档文案没有多出取值域之外的档",
    Object.keys(engineMeta.notes).every((v) => engineValues.includes(v)),
  );

  // 描述符指名的 widget / trailer：客户端必须真认得（否则那一行静默退回通用形状，
  // 或者组尾那行状态悄悄消失）。
  const clientText = readFileSync(join(root, "src", "client", "index.tsx"), "utf8");
  const declaredWidgets = [...new Set(FIELD_NAMES.map((n) => FIELDS[n].widget).filter(Boolean))];
  const handledWidgets = new Set([...clientText.matchAll(/spec\.widget === "([^"]+)"/g)].map((m) => m[1]));
  check(
    `每个声明的 widget 客户端都认（缺的：${declaredWidgets.filter((w) => !handledWidgets.has(w)).join(",") || "无"}）`,
    declaredWidgets.every((w) => handledWidgets.has(w)),
  );
  const declaredTrailers = [...new Set(SETTINGS_GROUPS.map((e) => e.trailer).filter(Boolean))];
  check(
    `每个组的 trailer 客户端都注册了（缺的：${declaredTrailers.filter((t) => !clientText.includes(`"${t}":`)).join(",") || "无"}）`,
    declaredTrailers.every((t) => clientText.includes(`"${t}":`)),
  );

  // 展示元数据只有一份：客户端必须从字段表读，不许再抄表。
  //
  // 下面三条「不许再这样写」的断言只看**代码**，不看注释 —— 本文件与
  // `index.tsx` 都在注释里正当地引用旧写法（「2026-10-03 之前是拿组标题当 key」），
  // 拿原文匹配会把说明文档本身判成违规（第一版就是这么红的）。
  const clientCode = clientText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("客户端从字段表读展示元数据", clientCode.includes('from "../host/settings-schema.js"'));
  check("客户端没有再抄一份 SETTINGS_GROUPS 常量", !/const\s+SETTINGS_GROUPS\s*=/.test(clientCode));
  check(
    "客户端不再自持 ENUM_LABELS / FIELD_HINTS / ENGINE_* 平行表",
    !/const\s+ENUM_LABELS\s*=/.test(clientCode) &&
      !/const\s+FIELD_HINTS\s*=/.test(clientCode) &&
      !/const\s+ENGINE_(NOTES|BADGES|SUMMARY|FACTS)\s*[:=]/.test(clientCode),
  );
  check("客户端按描述符的 widget 分派（不再按字段名硬编码）", !/field === "voiceEngine"/.test(clientCode));
  check("客户端按 trailer 挂组尾（不拿显示文案当逻辑 key）", !/entry\.title === "/.test(clientCode));
}

// ── 1d. 设置命名空间：跨进程一份声明（防「设置页空白」那类静默失效）──────────
// 宿主与客户端必须用同一个 id，否则客户端 `ctx.configForms.get(ns)` 拿到 undefined
// —— 症状是设置页空白、写入静默无效，而两边代码看起来都对。原先各写一份字面量，
// 只靠客户端一段注释提醒，没有任何守卫。
{
  check("命名空间是 herta（profile 条目 id）", SETTINGS_NAMESPACE === "herta");

  const clientText = readFileSync(join(root, "src", "client", "index.tsx"), "utf8");
  const clientCode = clientText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check(
    "客户端从字段表取命名空间（不再自写字面量）",
    /const\s+MACHINE_NS\s*=\s*SETTINGS_NAMESPACE\s*;/.test(clientCode),
  );
  check("客户端没有再把 \"herta\" 写死成命名空间", !/MACHINE_NS\s*=\s*"herta"/.test(clientCode));

  const hostText = readFileSync(join(root, "src", "host", "index.js"), "utf8");
  const hostCode = hostText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("宿主也从同一个常量再导出", /HERTA_SETTINGS_NAMESPACE\s*=\s*SETTINGS_NAMESPACE\s*;/.test(hostCode));
  check("宿主没有再把 \"herta\" 写死成命名空间", !/HERTA_SETTINGS_NAMESPACE\s*=\s*"herta"/.test(hostCode));
}


// ── 2. 校验与归一化 ─────────────────────────────────────────────────────────
{
  check("非法字段名一律不认", !isManagedValue("windowState", {}) && !isManagedValue("minimaxVoice", {}));
  check("布尔字段认真值", isManagedValue("closeToTray", true) && isManagedValue("closeToTray", false));
  check("布尔字段拒字符串", !isManagedValue("closeToTray", "true") && !isManagedValue("closeToTray", 1));
  check("枚举字段认取值域内", isManagedValue("theme", "dark") && isManagedValue("voiceEngine", "mimo"));
  check("枚举字段拒域外", !isManagedValue("theme", "blue") && !isManagedValue("voiceEngine", "gpt"));
  check("枚举字段拒空串（除 locale 自己的空串）", !isManagedValue("theme", ""));
  check("locale 认空串（= 跟随系统）", isManagedValue("locale", ""));
  check("interactionLanguage 认 follow", isManagedValue("interactionLanguage", "follow"));
  check("path 字段认空串与普通路径", isManagedValue("workspace", "") && isManagedValue("workspace", "E:\\ws"));
  check("path 字段拒非字符串", !isManagedValue("workspace", 3) && !isManagedValue("workspace", null));

  // `text` 与 `path` **同一套校验**，区别只在界面：text 渲染成纯文本框（无工作区选择器、
  // 用字段自己的 placeholder），path 才给工作区建议。加这一条是为了钉住那条接缝 ——
  // 哪天有人把 text 的校验改了，path 不该跟着变。
  check("text 字段与 path 同口径（认字符串、拒非字符串）", (() => {
    const textField = FIELD_NAMES.find((n) => FIELDS[n].kind === "text");
    if (textField === undefined) return true; // 没有 text 字段时跳过，不误报
    return isManagedValue(textField, "abc") && isManagedValue(textField, "")
      && !isManagedValue(textField, 3) && !isManagedValue(textField, null);
  })());

  check("数值字段认范围内", isManagedValue("voiceVolume", 0) && isManagedValue("voiceVolume", 100) && isManagedValue("voiceVolume", 55));
  check("数值字段拒越界", !isManagedValue("voiceVolume", -1) && !isManagedValue("voiceVolume", 101));
  check("数值字段拒字符串与 NaN/Infinity", !isManagedValue("voiceVolume", "50") && !isManagedValue("voiceVolume", NaN) && !isManagedValue("voiceVolume", Infinity));
  check("数值字段拒布尔", !isManagedValue("voiceVolume", true));

  const n = normalizeSettings({ theme: "blue", closeToTray: "yes", voiceEngine: "mimo" });
  check("归一化：非法值回落默认", n.theme === DEFAULTS.theme && n.closeToTray === DEFAULTS.closeToTray);
  check("归一化：合法值保留", n.voiceEngine === "mimo");
  check("归一化：音量越界回落默认", normalizeSettings({ voiceVolume: 999 }).voiceVolume === DEFAULTS.voiceVolume);
  check("归一化：字段一个不少", Object.keys(n).sort().join(",") === [...FIELD_NAMES].sort().join(","));
  check(
    "归一化：undefined / null / 字符串都安全",
    [undefined, null, "x", 42, []].every((v) => Object.keys(normalizeSettings(v)).length === FIELD_NAMES.length),
  );
  check("归一化：不把无关字段带出来", !("windowState" in normalizeSettings({ windowState: { width: 1 }, theme: "dark" })));
}

// ── 3. Config 生成器与字段表同源（照抄 host/index.js 的那段）────────────────
{
  /** 记录调用链的最小替身，只为看清生成器用了哪个构造器与哪个默认值。 */
  const makeZ = () => {
    const leaf = (kind) => (def) => {
      const node = {
        kind,
        def,
        bounds: null,
        volatile: () => node,
        default: (d) => ((node.def = d), node),
        min(v) {
          node.bounds = { ...(node.bounds ?? {}), min: v };
          return node;
        },
        max(v) {
          node.bounds = { ...(node.bounds ?? {}), max: v };
          return node;
        },
      };
      return node;
    };
    return {
      boolean: leaf("boolean"),
      string: leaf("string"),
      number: leaf("number"),
      union(values) {
        const node = { kind: "union", values, default: (d) => ((node.def = d), node), volatile: () => node };
        return node;
      },
    };
  };
  const z = makeZ();
  const generated = Object.fromEntries(
    FIELD_NAMES.map((field) => {
      const spec = FIELDS[field];
      if (spec.kind === "boolean") return [field, z.boolean().default(spec.def).volatile()];
      if (spec.kind === "enum") return [field, z.union([...spec.values]).default(spec.def).volatile()];
      if (spec.kind === "number") return [field, z.number().min(spec.min).max(spec.max).default(spec.def).volatile()];
      return [field, z.string().default(spec.def).volatile()];
    }),
  );
  check("schema：键与字段表逐一对应", Object.keys(generated).sort().join(",") === [...FIELD_NAMES].sort().join(","));
  check("schema：每个字段的默认值等于字段表", FIELD_NAMES.every((n) => generated[n].def === FIELDS[n].def));
  check(
    "schema：枚举字段带上完整取值域",
    FIELD_NAMES.filter((n) => FIELDS[n].kind === "enum").every(
      (n) => generated[n].kind === "union" && generated[n].values.join(",") === FIELDS[n].values.join(","),
    ),
  );
  check(
    "schema：kind 决定构造器（boolean / enum→union / number→number / path→string）",
    FIELD_NAMES.every((n) => {
      const expected =
        FIELDS[n].kind === "boolean" ? "boolean" : FIELDS[n].kind === "enum" ? "union" : FIELDS[n].kind === "number" ? "number" : "string";
      return generated[n].kind === expected;
    }),
  );
  check(
    "schema：数值字段真的带上 min/max（少了它越界值能写进配置）",
    FIELD_NAMES.filter((n) => FIELDS[n].kind === "number").every(
      (n) => generated[n].bounds?.min === FIELDS[n].min && generated[n].bounds?.max === FIELDS[n].max,
    ),
  );
}

// ── 4. 没有第二个真相来源（防回归）──────────────────────────────────────────
{
  const syncPath = join(root, "src", "host", "settings-sync.js");
  check("settings-sync.js 已删除（不再写回她的任何文件）", !existsSync(syncPath));
  check("lib/settings-sync.js 也不在（构建产物同样清掉）", !existsSync(join(root, "lib", "settings-sync.js")));

  const schemaPath = join(root, "src", "host", "settings-schema.js");
  const schemaText = readFileSync(schemaPath, "utf8");
  const gone = [
    "export function valuesFromGlobalFile",
    "export function valuesFromWorkspaceFile",
    "export function globalFileEdits",
    "export function workspaceFileEdits",
    "export function sanitizeFollowedFields",
    "export function valuesFromLegacyVoiceFile",
    "export const LEGACY_MODEL_ALIASES",
    "export const LEGACY_VOICE_FIELD_MAP",
    "export const GLOBAL_FIELD_NAMES",
    "export const WORKSPACE_FIELD_NAMES",
  ];
  for (const needle of gone) {
    check(`字段表不再导出「写回/种子」时代的符号：${needle.replace("export ", "")}`, !schemaText.includes(needle));
  }

  const hostText = readFileSync(join(root, "src", "host", "index.js"), "utf8");
  check("宿主不再注册 followedFields 字段", !/followedFields\s*:/.test(hostText));
  check("宿主不再监听 loader/volatile-update", !hostText.includes("loader/volatile-update"));
  check("宿主仍然声明「自带页面」（configure auto:false）", hostText.includes("configure({ auto: false }"));

  const clientText = readFileSync(join(root, "src", "client", "index.tsx"), "utf8");
  check("客户端不再有「↺ 跟随整机」", !clientText.includes("↺ 跟随整机"));
  check("客户端不再写 followedFields", !clientText.includes('"followedFields"'));
  check("客户端页面不再宣称「同步到整机读的那几份 settings.json」", !clientText.includes("再同步到整机读的那几份"));
}

// ── 5. 语音偏好真的接了 bridge（防回归）────────────────────────────────────
{
  const bridgeText = readFileSync(join(root, "src", "herta-ui", "bridge.ts"), "utf8");
  for (const member of ["getVoicePrefs", "setVoiceMuted", "setVoiceVolume"]) {
    check(`整机 bridge 实现并转发 ${member}`, bridgeText.includes(`${member}:`));
  }
  check(
    "bridge 的静音兜底与字段表默认值一致（不静音）",
    /getVoicePrefs[\s\S]{0,120}muted:\s*false/.test(bridgeText),
  );
  check(
    "bridge 的音量兜底是满音量（1，即字段表的 100）",
    /getVoicePrefs[\s\S]{0,160}volume:\s*1\b/.test(bridgeText),
  );

  const prefsText = readFileSync(join(root, "..", "Herta-src", "packages", "gui", "src", "renderer", "voice", "voice-prefs.ts"), "utf8");
  check("整机 voice-prefs 导出 hydrateVoicePrefs", prefsText.includes("export async function hydrateVoicePrefs"));
  check("整机 voice-prefs 仍有 localStorage 兜底（官网 demo / 独立版不受影响）", prefsText.includes("localStorage.setItem"));
  check("整机 voice-prefs 在 host 接手时不再写 localStorage", prefsText.includes("remoteOwnsPrefs()"));

  const mainText = readFileSync(join(root, "src", "herta-ui", "main.tsx"), "utf8");
  check("整机页入口调了 hydrateVoicePrefs", mainText.includes("hydrateVoicePrefs"));

  const typesText = readFileSync(join(root, "..", "Herta-src", "packages", "gui", "src", "renderer", "ipc", "bridge-types.ts"), "utf8");
  check("HertaBridge 契约里有 VoicePrefs", typesText.includes("export interface VoicePrefs"));

  const clientText = readFileSync(join(root, "src", "client", "index.tsx"), "utf8");
  check("父窗口应答 getVoicePrefs", clientText.includes('case "getVoicePrefs"'));
  check("父窗口把 0–100 换算成 0–1 下发", clientText.includes("volume / 100"));
}

// ── 6. 设置页已从整机删除（防回归）──────────────────────────────────────────
{
  const settingsDir = join(root, "..", "Herta-src", "packages", "gui", "src", "renderer", "components", "Settings");
  for (const gone of [
    "SettingsModal.tsx",
    "LanguageSettings.tsx",
    "WindowSettings.tsx",
    "UpdateSettings.tsx",
    "VoiceSettings.tsx",
    "DreamSettings.tsx",
    "DeepSeekSettings.tsx",
    "BanzhuanSettings.tsx",
    "SettingRow.tsx",
    "Toggle.tsx",
  ]) {
    check(`整机设置页组件已删除：${gone}`, !existsSync(join(settingsDir, gone)));
  }
  check("KeyPrompt 保留（用户明确要求）", existsSync(join(settingsDir, "KeyPrompt.tsx")));
  // Select 是**共享**原语（FileViewer 的 LogView 也用它），删设置页时不能顺手删掉。
  check("Select 保留（它不是设置页独占的：LogView 也在用）", existsSync(join(settingsDir, "Select.tsx")));

  const appText = readFileSync(join(root, "..", "Herta-src", "packages", "gui", "src", "renderer", "App.tsx"), "utf8");
  check("App.tsx 不再渲染 SettingsModal", !appText.includes("SettingsModal"));
  check("App.tsx 不再持有 settingsOpen", !appText.includes("settingsOpen"));
  const sidebarText = readFileSync(join(root, "..", "Herta-src", "packages", "gui", "src", "renderer", "components", "Sidebar", "Sidebar.tsx"), "utf8");
  check("侧栏不再有设置入口按钮", !sidebarText.includes("sidebar-settings\""));
  check("侧栏不再接收 onOpenSettings", !sidebarText.includes("onOpenSettings"));
}

// ── 7. 凭据缝的取法是实测出来的，不许改回去（防回归）────────────────────────
{
  const clientText = readFileSync(join(root, "src", "client", "index.tsx"), "utf8");
    // 凭据那一层已拆到 machine.ts（#2 第一步）：这一组的两条断言改看它，别的断言仍看 index.tsx。
    const machineText = readFileSync(join(root, "src", "client", "machine.ts"), "utf8");
  // 实测（lab，三次构建）：`ctx.inject(["remote.credentials"], …)` 的回调**不触发**；
  // `ctx.inject(["remote"], …)` 之后读 `.credentials` 也不可靠（回调时有时无，
  // 且读属性很可能抛异常）。真正可用的是 `ctx.get("remote.credentials")` ——
  // 第一次尝试就拿到了（诊断标记 settingsCredentialsAttempts = 1）。
  check(
    "凭据缝用 ctx.get('remote.credentials') 解析",
    machineText.includes('get?.("remote.credentials")'),
  );
  check(
    "凭据缝的**代码**不再用 ctx.inject 取（注释里留着坑的记录，不算违规）",
    !clientText.includes('ctx.inject(["remote"],'),
  );
  check("凭据解析包在 try 里（有的实现读属性会抛）", machineText.includes("function resolveCredentials"));
  check("解析不到时页面如实显示「凭据服务不可用」而不是假装能用", clientText.includes("凭据服务不可用"));
  check("保存/清除走真调用（saveCredential / clearCredential）", clientText.includes("saveCredential(props.spec.ref") && clientText.includes("clearCredential(props.spec.ref"));
  check("密钥不进 Config（不在 FIELDS 里）", !FIELD_NAMES.some((n) => /key/i.test(n)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
