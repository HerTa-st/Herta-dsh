/**
 * 「黑塔」设置的**字段表** —— 纯数据 + 纯函数，无 IO、无 import。
 *
 * ## 这份文件解决的问题
 *
 * 她的设置原本散在四处、各有各的存法（见 `_herta-settings-統合設計.md` 的现状表）。
 * 现在统一成**一个真相来源**：`dsh-herta` 插件的 Config ——
 * 也就是 profile 的 `cordis.patch.yml` 里那条 `herta` 条目。
 *
 * ## 2026-09-26 的收口：不再写回她的任何文件
 *
 * 上一版还额外做一件事：把用户改过的值**写回整机读的那两份 settings.json**。
 * 那件事已整体删除，原因是一条实测事实 ——
 *
 *   · 嵌在 DSH 里的整机（`herta-full` 页签的 iframe）**从来不读那些文件**：
 *     它的每一个设置都经 postMessage bridge 向父窗口要，父窗口再读
 *     `ctx.configForms.get("herta")`。也就是说「唯一真相」早就只有一份。
 *   · 读那两份文件的是**独立安装的 Herta.exe**，而它已判定不再维护。
 *
 * 于是同时失去读者的还有：首次种子迁移、`followedFields` 声明、页面上每项的
 * 「↺ 跟随整机」复位。它们全部随 `settings-sync.js` 一起删除 ——
 * 留着就是没有读者的分支，而那种东西的代价是下一个人不敢删。
 *
 * ## 一个必须写在字段旁边的字段：`wired`
 *
 * 她的设置页是**大部分 bridge getter 唯一的消费者**。删掉那一页之后，
 * 逐个查过残留消费方，结论并不整齐（见每个字段的注释）：
 *
 *   · `wired: true`  —— 整机里真有人读它，改了就有效果；
 *   · `wired: false` —— **没有任何代码读它**。这些字段仍然保留（用户要的），
 *     但页面把它们收进「暂未接线」一组并逐行标注。留着它们不等于假装能用 ——
 *     恰恰相反：`note` 就是「谁该读它、现在缺什么」的备忘。
 *
 * 这条字段的存在本身是那次核查的记录。将来接上消费方时把它翻成 `true` 并删掉
 * `note` 即可，不需要重新论证一遍。
 *
 * ## 为什么字段是**平铺**的，不是嵌套的
 *
 * DSH 客户端写设置的口子是 `ConfigForm.set(field, value)`，它只接受**根级单字段**
 * （`{op:'set', path:[field]}`，见 `@deepseek-ai/dsh-client-ui-settings` 的
 * `config-form-types.d.ts`）。嵌套对象要走 `mutate` 拼路径，页面上每个控件都得
 * 知道自己在树里的位置 —— 平铺让「一个控件 ↔ 一个字段名」永远成立。
 *
 * ## 两个「absent 有语义」的字段
 *
 * 整机把两件事编码成「键不存在」，而不是某个具体值：
 *   · `locale` —— 缺失 = **跟随系统语言**
 *   · `interactionLanguage` —— 缺失 = **follow**（跟随 UI 语言）
 * 所以这两个字段的默认值分别是 `""` 与 `"follow"`。把它们写成 `zh` 会把
 * 「跟随系统」变成「钉死在中文」——那不是同一个语义。
 * （它们现在都只喂给整机那条 bridge；整机怎么解释「缺席」仍由整机决定。）
 *
 * ## 不搬的东西（连同理由，免得下一个人重新论证一遍）
 *
 *   · `windowState` —— 整机自己按 debounce 捕获窗口几何并在关闭时写一次，
 *     没有任何设置行读写它。搬进来必然互相覆盖。
 *   · `minimaxVoice` —— 服务端签发的克隆记录，属**机器状态**而不是用户偏好，所以
 *     它不进这份字段表。2026-09-27 接上云端语音之后**这一点没有变**：变的是另一件
 *     事 —— 记录现在有了 DSH 侧的落点 `$DSH_HOME/dsh-herta-minimax.json`
 *     （见 `src/host/minimax/state.ts`）。不落它，每次启动都要重新向平台认领一次，
 *     离线时还会整个失声。
 *   · 布局态（`herta.sidebar.collapsed`、`herta.fileViewer.widthPx`、
 *     设备场景 frost 缓存）—— 是窗口级布局记忆与渲染缓存，不是设置。
 *   · 桌宠（`herta-autostart`）的落点/置顶/目标屏 —— 那是**另一个程序**
 *     （A大黑塔桌宠），它的落点文件由 `Record-HertaPosition.ps1` 录制、
 *     由 `Start-HertaPet.ps1` 顶部常量兜底。要搬得先改那个 PowerShell 脚本的
 *     契约，与本文件的「DSH 是唯一真相」不是一类事情，故不做。
 *
 * ## 合法取值从哪来（不是猜的）
 *
 *   · 全局：`Herta-src/packages/gui/src/main/app-global-settings.ts:130-171` 逐字段手写校验
 *   · 工作区：`Herta-src/packages/gui/src/main/app-settings.ts:15-81` 的值表与判定函数
 *   · 默认值：整机的 IPC getter 与渲染层各自的默认（见每个字段的注释）
 */

/**
 * 字段表。`def` 必须与整机那边的默认值逐字一致 —— 不一致的后果是
 * 「DSH 里显示的值」与「她实际在用的值」不同，而那是这个功能最不该出的错。
 *
 * 字段形状：
 *   · `kind`  —— `"boolean"` / `"enum"` / `"number"` / `"path"`
 *   · `values`—— 仅 enum：取值域
 *   · `min` / `max` / `step` —— 仅 number
 *   · `def`   —— 默认值
 *   · `label` —— 页面上的标签
 *   · `wired` —— 整机里有没有人读它（缺省视为 true）
 *   · `note`  —— 仅 `wired: false`：它本该由谁读、现在缺什么
 */
export const FIELDS = Object.freeze({
  /**
   * UI 外壳语言。`""` = 跟随系统（整机把「缺失」编码成这个语义）。
   * 消费者：`Herta-src .../renderer/App.tsx` 启动时 `bridge.getLocale()`。
   */
  locale: Object.freeze({
    kind: "enum",
    values: Object.freeze(["", "zh", "en"]),
    def: "",
    label: "界面语言",
  }),
  /**
   * 她被提示的语言。与 `locale` 独立，任意组合都合法。`follow` = 跟随 UI 语言。
   * 消费者：无 —— 上一版整机里只有 `LanguageSettings` 那一页读它（已删）。
   */
  interactionLanguage: Object.freeze({
    kind: "enum",
    values: Object.freeze(["follow", "zh", "en"]),
    def: "follow",
    label: "对话语言",
    wired: false,
    note: "整机当前不读它：原来只有她自己的设置页在读写这个键。将来要接，应接在会话创建时的提示词语言上。",
  }),
  /**
   * 外观。整机默认 `"system"`。
   *
   * **DSH 侧没有消费方**（2026-09-30 体检核实）：`getTheme` 返回的是 DSH 外壳自己的
   * 颜色（`document.documentElement.style.colorScheme`），这个字段本身全仓没有被读。
   * 以前它挂在正常分组里、改了没反应，页面头部还写着「这里改的值就是她读到的值」。
   */
  theme: Object.freeze({
    kind: "enum",
    values: Object.freeze(["system", "light", "dark"]),
    def: "system",
    label: "主题",
    wired: false,
    note: "主题由 DSH 外壳自己管（设置页这一行改了不影响界面）。整机那边才由 initTheme 读它。",
  }),
  /**
   * 点关闭是收进托盘还是退出。整机默认 `true`。
   * 消费者：无 —— 窗口与托盘是 Electron 主进程的事，iframe 里根本没有窗口。
   */
  closeToTray: Object.freeze({
    kind: "boolean",
    def: true,
    label: "关闭时收进托盘",
    wired: false,
    note: "iframe 里没有窗口可收，DSH 也没有她的托盘图标。原来只有她自己的设置页读它。",
  }),
  /**
   * 自动检查更新。整机默认 `true`。
   * 消费者：无 —— 更新是 electron-updater 在主进程里做的事，仅独立版存在。
   */
  autoUpdate: Object.freeze({
    kind: "boolean",
    def: true,
    label: "自动检查更新",
    wired: false,
    note: "更新由 electron-updater 在主进程完成，只有独立版有；DSH 不负责更新整机。",
  }),
  /**
   * 3D 设备卡。整机默认 `true`（`DEVICE_SCENE_DEFAULT`）。
   *
   * **DSH 侧没有消费方**（2026-09-30 体检核实）：父窗口的 postMessage 分发里没有
   * `getDeviceScene` / `setDeviceScene` 分支（未命中会回一句「整机视图还没有实现」），
   * iframe 侧的能力探测（`setDeviceScene !== undefined`）恒为 false，所以这张卡永远
   * 起不来。以前它挂在正常分组里、改了没反应。
   */
  deviceScene: Object.freeze({
    kind: "boolean",
    def: true,
    label: "3D 设备卡",
    wired: false,
    note: "DSH 侧没有这条路：父窗口没有 get/setDeviceScene 分支，整机视图也还没实现。",
  }),
  /**
   * 谁在说话。默认 `"local"`；不是字符串的值一律折成 `local`（`readStringField`）。
   *
   * 消费者：`src/host/minimax-voice.js` 的 `synthUnit` —— 宿主按这个值分发，
   * 判据只有一处：`minimax/pipeline.ts` 的 `speaksFor()`。
   *   · `minimax`：助手正文（**只念正文**，不念思考/工具结果/子代理）走 MiniMax
   *     云端合成，经 SSE 推给界面；云端不可用时（没密钥 / 没认领到克隆 / 被拒绝 /
   *     克隆被删）**显式回落本地模型**，并把回落原因写进状态 —— 用户看得见
   *     "现在是谁在说话"。
   *   · `local`：直接本地合成（离线 sherpa-onnx / Kokoro）。**2026-09-28 起真的会念**
   *     —— 在那之前这一档只在上面那条回落里被调用，选它等于静音。同一天它也改走
   *     **常驻合成进程**：加载一次模型，之后每句只付推理（实测 0.28 × 音频时长），
   *     空闲 10 分钟自动退掉；界面上写清了这一点（`ENGINE_NOTES`）与"首次约 3 秒"。
   *   · `mimo`：合成器尚未接线（`mimo-tts.js` 全仓零调用点），不发声；理由由宿主
   *     写给用户看。它**留在取值域里**是决定（保留全部档位 + 逐档标注），不是遗漏。
   */
  voiceEngine: Object.freeze({
    kind: "enum",
    // [herta-fish-engine] 加一档 fish
    values: Object.freeze(["local", "minimax", "fish", "mimo"]),
    def: "local",
    label: "语音引擎",
    wired: true,
  }),
  /**
   * 自动念回复的总开关。默认 `true`。
   *
   * 消费者：`src/host/minimax-voice.js` 的说话管线（`repliesEnabled`）—— 关掉它，
   * 助手的回复就**不再自动送去合成**（也就不再花钱）；`herta_say` 是明确要求
   * "说一句"，**不受它管**。设置页的「试听」同样不受它管（用户是明确要求现在出声）。
   *
   * 注意它管的是"自动"这一条，不是"能不能出声"：整机那边的静音/音量仍由
   * `voiceMuted` / `voiceVolume` 经 bridge 下发给播放器。
   */
  realtimeVoice: Object.freeze({
    kind: "boolean",
    def: true,
    label: "实时语音",
    wired: true,
  }),

  /** 主语音静音。整机默认 `false`（原来存在渲染层 localStorage）。 */
  voiceMuted: Object.freeze({ kind: "boolean", def: false, label: "静音" }),
  /**
   * 主音量，0–100（整机内部是 0–1，bridge 上换算）。
   * 整机默认 `100`（原来存在渲染层 localStorage）。
   */
  voiceVolume: Object.freeze({
    kind: "number",
    min: 0,
    max: 100,
    step: 5,
    def: 100,
    label: "音量",
  }),
  fishRef: Object.freeze({
    kind: "text",
    def: "f9ede0382ffc4671ac86b44d49f19cdd",
    placeholder: "f9ede0382ffc4671ac86b44d49f19cdd",
    label: "Fish 音色模型",
    wired: true,
  }),
  fishSpeed: Object.freeze({
    kind: "number",
    min: 0.5,
    max: 2,
    step: 0.05,
    def: 1,
    label: "Fish 语速",
    wired: true,
  }),
  fishEffect: Object.freeze({
    kind: "boolean",
    def: true,
    label: "Fish 信道音效",
    wired: true,
  }),
  fishPreset: Object.freeze({
    kind: "enum",
    values: Object.freeze(["terminal_textured", "terminal"]),
    def: "terminal_textured",
    label: "Fish 音效档位",
    wired: true,
  }),
  fishProxy: Object.freeze({
    kind: "text",
    def: "",
    placeholder: "http://127.0.0.1:7897（留空 = 直连）",
    label: "Fish 代理",
    wired: true,
    // 这里**刻意不写 `note`**：按本仓约定，`note` 只说「为什么这个字段没接线」
    // （见 `test-herta-settings.mjs` 那两条互斥断言）。这一行是活字段，用法说明在
    // 「Fish 语音」那一组的 hint 里、以及客户端 FIELD_HINTS 那份行内提示里。
  }),

  /**
   * ── Fish Audio（`voiceEngine: "fish"`）────────────────────────────────
   *
   * 这四个只在引擎选 `fish` 时被读。宿主侧消费者是 `minimax-voice.js` 的
   * `synthUnit` —— 它把值传给 `fish-tts.js` 的 `trySynthesizePcm()`，
   * 覆盖那个模块自己的默认值（`C:\herta-ai\fish_config.json`）。
   *
   * 也就是说：**这里设的值优先**，外部 JSON 退化成「没设过时的兜底」。
   *
   * 密钥**不在这里**（Config 落在 profile 的 `cordis.patch.yml`，是明文 YAML）：
   * 它在上面的「密钥」那一组里 —— 设置页新增的「Fish 密钥」一行，值落 DSH 凭据
   * （`$DSH_HOME/.credentials.yaml`）。`C:\herta-ai\fish_key.txt` 那份明文
   * 退化成「没填凭据时的兜底」。
   */
  /** 信道音效开关。关掉就是 Fish 原声（44.1kHz 完整频带）。 */
  /**
   * 音效档位。`terminal_textured` 多一层「跟着语音走的噪声」（上游 2026-09-05 选定），
   * `terminal` 是同一套滤波但不加噪声。
   */

  /**
   * 要同步的**工作区**根目录。空 = 不动任何工作区文件。
   * 消费者：无 —— 这个字段的全部用途就是给上一版的写回指路，而写回已删除。
   */
  workspace: Object.freeze({
    kind: "path",
    def: "",
    label: "同步到工作区",
    wired: false,
    note: "上一版用它决定「写回哪个工作区的 .herta\\settings.json」。写回已整体删除，所以它现在只被存下来。",
  }),

  /**
   * 「做梦」。整机默认 `true`。
   * 消费者：无 —— 原来只有她自己的设置页读它；做梦由整机自己的服务跑（仅独立版）。
   */
  dreamEnabled: Object.freeze({
    kind: "boolean",
    def: true,
    label: "做梦",
    wired: false,
    note: "做梦是整机自己的后台服务（独立版才有），DSH 会话里没有这条链路。",
  }),
  /** 板砖的推理档位。整机默认 `"high"`。消费者：无（同上，属独立版后端）。 */
  backendThinking: Object.freeze({
    kind: "enum",
    values: Object.freeze(["low", "high", "max"]),
    def: "high",
    label: "推理档位",
    wired: false,
    note: "板砖是整机独立版的后端；DSH 会话走 DSH 自己的模型配置。",
  }),
  /** 板砖的工具契约。整机默认 `"minimal"`。消费者：无（同上）。 */
  backendContract: Object.freeze({
    kind: "enum",
    values: Object.freeze(["standard", "minimal"]),
    def: "minimal",
    label: "工具契约",
    wired: false,
    note: "板砖是整机独立版的后端；DSH 会话走 DSH 自己的模型配置。",
  }),
  /** 黑塔本体的模型。整机默认 `"deepseek-v4-pro"`。消费者：无（同上）。 */
  modelsActor: Object.freeze({
    kind: "enum",
    values: Object.freeze(["deepseek-v4-pro", "deepseek-flash"]),
    def: "deepseek-v4-pro",
    label: "黑塔的模型",
    wired: false,
    note: "DSH 里她的模型由会话自己的模型配置决定，这个键只有独立版的后端会读。",
  }),
  /** 板砖的模型。整机默认 `"deepseek-flash"`。消费者：无（同上）。 */
  modelsBackend: Object.freeze({
    kind: "enum",
    values: Object.freeze(["deepseek-v4-pro", "deepseek-flash"]),
    def: "deepseek-flash",
    label: "板砖的模型",
    wired: false,
    note: "DSH 里板砖的模型由会话自己的模型配置决定，这个键只有独立版的后端会读。",
  }),
});

/** 全部字段名，声明顺序即字段表顺序（页面的分组另在客户端声明）。 */
export const FIELD_NAMES = Object.freeze(Object.keys(FIELDS));

/**
 * 默认值表，可直接喂给 schemastery 的 `.default()`。
 */
export const DEFAULTS = Object.freeze(
  Object.fromEntries(FIELD_NAMES.map((name) => [name, FIELDS[name].def])),
);

/** 整机里真有人读的字段名。页面把其余的收进「暂未接线」。 */
export const WIRED_FIELD_NAMES = Object.freeze(FIELD_NAMES.filter((n) => FIELDS[n].wired !== false));

/** 声明了「暂时没有消费方」的字段名。 */
export const UNWIRED_FIELD_NAMES = Object.freeze(FIELD_NAMES.filter((n) => FIELDS[n].wired === false));

/** 是不是本插件管的字段名。 */
export function isFieldName(name) {
  return Object.prototype.hasOwnProperty.call(FIELDS, name);
}

/**
 * 一个值是不是该字段的合法取值。
 *
 * 布尔字段只认真正的 `boolean`（`"true"` 不算）—— 与整机自己的校验同口径。
 *
 * @param {string} name - 字段名。
 * @param {unknown} value - 待判定的值。
 * @returns {boolean}
 */
export function isManagedValue(name, value) {
  const field = FIELDS[name];
  if (field === undefined) return false;
  if (field.kind === "boolean") return typeof value === "boolean";
  if (field.kind === "enum") return typeof value === "string" && field.values.includes(value);
  if (field.kind === "number") {
    return typeof value === "number" && Number.isFinite(value) && value >= field.min && value <= field.max;
  }
  // path：只约束类型与长度。空串是合法值（= 不同步工作区），不是「未设置」。
  if (field.kind === "path") return typeof value === "string" && value.length <= 4096;
  // text：与 path 同一套约束，但**界面上是纯文本框** —— 没有工作区选择器、
  // 用字段自己的 placeholder。给「模型 ID」这类既不是路径也不是枚举的值用。
  if (field.kind === "text") return typeof value === "string" && value.length <= 4096;
  // REMOVED，但**界面上是纯文本框** —— 没有工作区选择器、
  // 用字段自己的 `placeholder`。给「模型 ID」这类既不是路径、也不是枚举的值用。
  return false;
}

/**
 * 把任意来源的对象归一成**完整**的设置值：非法或缺席一律回落默认。
 *
 * 永不抛错，也永不返回缺键的对象 —— 调用方（页面、bridge 应答）不该再判 undefined。
 *
 * @param {unknown} raw - 来自 Config 或快照的任意值。
 * @returns {Record<string, unknown>} 每个字段都有值的对象。
 */
export function normalizeSettings(raw) {
  const src = raw !== null && typeof raw === "object" ? raw : {};
  const out = {};
  for (const name of FIELD_NAMES) {
    out[name] = isManagedValue(name, src[name]) ? src[name] : FIELDS[name].def;
  }
  return out;
}
