window.__ModuleLoader__.load({ id: "dsh-herta", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/host/voice-engines.js
var VOICE_ENGINES = Object.freeze(["local", "minimax", "fish", "mimo"]);
var SPEAKING_ENGINES = Object.freeze(["local", "minimax", "fish"]);
var ENGINE_FALLBACK = Object.freeze({ minimax: "local" });

// src/host/settings-schema.js
var SETTINGS_NAMESPACE = "herta";
var FIELDS = Object.freeze({
  /**
   * UI 外壳语言。`""` = 跟随系统（整机把「缺失」编码成这个语义）。
   * 消费者：`Herta-src .../renderer/App.tsx` 启动时 `bridge.getLocale()`。
   */
  locale: Object.freeze({
    kind: "enum",
    values: Object.freeze(["", "zh", "en"]),
    def: "",
    label: "\u754C\u9762\u8BED\u8A00",
    group: "\u754C\u9762",
    enumLabels: Object.freeze({ "": "\u8DDF\u968F\u7CFB\u7EDF", zh: "\u4E2D\u6587", en: "English" }),
    hint: "\u6574\u673A\u754C\u9762\u81EA\u5DF1\u7684\u8BED\u8A00\u3002\u300C\u8DDF\u968F\u7CFB\u7EDF\u300D= \u4E0D\u5199\u8FD9\u4E2A\u952E\uFF0C\u6309\u64CD\u4F5C\u7CFB\u7EDF\u8BED\u8A00\u89E3\u6790\u3002"
  }),
  /**
   * 她被提示的语言。与 `locale` 独立，任意组合都合法。`follow` = 跟随 UI 语言。
   * 消费者：无 —— 上一版整机里只有 `LanguageSettings` 那一页读它（已删）。
   */
  interactionLanguage: Object.freeze({
    kind: "enum",
    values: Object.freeze(["follow", "zh", "en"]),
    def: "follow",
    label: "\u5BF9\u8BDD\u8BED\u8A00",
    wired: false,
    note: "\u6574\u673A\u5F53\u524D\u4E0D\u8BFB\u5B83\uFF1A\u539F\u6765\u53EA\u6709\u5979\u81EA\u5DF1\u7684\u8BBE\u7F6E\u9875\u5728\u8BFB\u5199\u8FD9\u4E2A\u952E\u3002\u5C06\u6765\u8981\u63A5\uFF0C\u5E94\u63A5\u5728\u4F1A\u8BDD\u521B\u5EFA\u65F6\u7684\u63D0\u793A\u8BCD\u8BED\u8A00\u4E0A\u3002",
    enumLabels: Object.freeze({ follow: "\u8DDF\u968F\u754C\u9762", zh: "\u4E2D\u6587", en: "English" }),
    hint: "\u5979\u88AB\u63D0\u793A\u7528\u54EA\u79CD\u8BED\u8A00\u8BF4\u8BDD\u3002"
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
    label: "\u4E3B\u9898",
    wired: false,
    note: "\u4E3B\u9898\u7531 DSH \u5916\u58F3\u81EA\u5DF1\u7BA1\uFF08\u8BBE\u7F6E\u9875\u8FD9\u4E00\u884C\u6539\u4E86\u4E0D\u5F71\u54CD\u754C\u9762\uFF09\u3002\u6574\u673A\u90A3\u8FB9\u624D\u7531 initTheme \u8BFB\u5B83\u3002",
    enumLabels: Object.freeze({ system: "\u8DDF\u968F\u7CFB\u7EDF", light: "\u6D45\u8272", dark: "\u6DF1\u8272" }),
    hint: "\u6574\u673A\u754C\u9762\u7684\u660E\u6697\u3002"
  }),
  /**
   * 点关闭是收进托盘还是退出。整机默认 `true`。
   * 消费者：无 —— 窗口与托盘是 Electron 主进程的事，iframe 里根本没有窗口。
   */
  closeToTray: Object.freeze({
    kind: "boolean",
    def: true,
    label: "\u5173\u95ED\u65F6\u6536\u8FDB\u6258\u76D8",
    wired: false,
    note: "iframe \u91CC\u6CA1\u6709\u7A97\u53E3\u53EF\u6536\uFF0CDSH \u4E5F\u6CA1\u6709\u5979\u7684\u6258\u76D8\u56FE\u6807\u3002\u539F\u6765\u53EA\u6709\u5979\u81EA\u5DF1\u7684\u8BBE\u7F6E\u9875\u8BFB\u5B83\u3002",
    hint: "\u70B9\u7A97\u53E3\u5173\u95ED\u65F6\u6536\u8FDB\u6258\u76D8\u8FD8\u662F\u9000\u51FA\u3002"
  }),
  /**
   * 自动检查更新。整机默认 `true`。
   * 消费者：无 —— 更新是 electron-updater 在主进程里做的事，仅独立版存在。
   */
  autoUpdate: Object.freeze({
    kind: "boolean",
    def: true,
    label: "\u81EA\u52A8\u68C0\u67E5\u66F4\u65B0",
    wired: false,
    note: "\u66F4\u65B0\u7531 electron-updater \u5728\u4E3B\u8FDB\u7A0B\u5B8C\u6210\uFF0C\u53EA\u6709\u72EC\u7ACB\u7248\u6709\uFF1BDSH \u4E0D\u8D1F\u8D23\u66F4\u65B0\u6574\u673A\u3002",
    hint: "\u81EA\u52A8\u68C0\u67E5\u66F4\u65B0\u3002"
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
    label: "3D \u8BBE\u5907\u5361",
    wired: false,
    note: "DSH \u4FA7\u6CA1\u6709\u8FD9\u6761\u8DEF\uFF1A\u7236\u7A97\u53E3\u6CA1\u6709 get/setDeviceScene \u5206\u652F\uFF0C\u6574\u673A\u89C6\u56FE\u4E5F\u8FD8\u6CA1\u5B9E\u73B0\u3002",
    hint: "\u5DEE\u5206\u534F\u5904\u7406\u5668\u9875\u4E0A\u7684 3D \u8BBE\u5907\u5361\u3002"
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
    // [herta-fish-engine] 加一档 fish；取值域从上面那份**唯一声明**取（候选 #4）
    values: VOICE_ENGINES,
    def: "local",
    label: "\u8BED\u97F3\u5F15\u64CE",
    wired: true,
    group: "\u8BED\u97F3",
    enumLabels: Object.freeze({
      local: "\u672C\u5730\u6A21\u578B",
      minimax: "MiniMax \u514B\u9686",
      fish: "Fish Audio \u514B\u9686",
      mimo: "MiMo \u5408\u6210"
    }),
    hint: "\u5979\u8BF4\u8BDD\u7528\u54EA\u4E2A\u5F15\u64CE\u3002\u6539\u5B8C\u7ACB\u523B\u751F\u6548 \u2014\u2014 \u5BBF\u4E3B\u6BCF\u4E00\u8F6E\u90FD\u73B0\u8BFB\u8FD9\u4E2A\u503C\u3002",
    /**
     * 「语音引擎」那一行不是「标签 + 一个控件」：它还有逐档现状、本地就绪、试听。
     * 通用 `kind` 决定不了这种形状，所以由 `widget` 指名专用渲染器
     * （客户端注册表 `herta-settings-widgets`）。这里是**声明**，不是组件本身 ——
     * 本模块保持纯数据、无 import。
     */
    widget: "engineRow",
    /**
     * 逐档的**结构化文案**（2026-10-03 从客户端五张 `ENGINE_*` 表收编）。
     *
     * 为什么不是段落：原来 84 字的说明堆在卡片左列折成 4~6 行，右边控件下方留一大片
     * 空白 —— 于是拆成 `badges`（短标签一行扫完）/ `summary`（一句不超行）/
     * `facts`（展开后整宽三列）。**文案要短**：`fish` 第一版 84 字是当时最长的一条，
     * 那正是那段 UI 变难看的直接原因。
     *
     * `notes` 是逐档现状（是行为，不是偏好）：四档里三档真会出声，`mimo` 没有调用点 ——
     * 这一句必须写出来，而不是把选项藏起来（用户决策：保留全部档位 + 逐档标注）。
     * `fish` 与 `minimax` 的区别在**失败时**：`minimax` 静默回落本地，`fish` 不回落
     * （换成别的声音比没声音更糟），理由由宿主写进状态行。
     */
    engine: Object.freeze({
      notes: Object.freeze({
        local: "\u79BB\u7EBF\u5408\u6210\uFF1A\u4E0D\u82B1\u94B1\u3001\u4E0D\u9700\u8981\u7F51\u7EDC\u3002\u5408\u6210\u8FDB\u7A0B\u4F1A\u5E38\u9A7B\uFF08\u5207\u5230\u8FD9\u4E00\u6863\u5C31\u5148\u9884\u70ED\uFF09\uFF0C\u70ED\u8D77\u6765\u540E\u6BCF\u53E5\u53EA\u4ED8\u63A8\u7406\uFF1B\u9996\u6B21\u3001\u6216\u7A7A\u95F2\u56DE\u6536\u4E4B\u540E\uFF0C\u8981\u91CD\u65B0\u52A0\u8F7D\u6A21\u578B\u7EA6 3 \u79D2\u3002",
        minimax: "\u4E91\u7AEF\u5408\u6210\uFF1A\u8FB9\u5199\u8FB9\u5FF5\u3002\u4E91\u7AEF\u4E0D\u53EF\u7528\uFF08\u6CA1\u5BC6\u94A5 / \u6CA1\u8BA4\u9886\u5230\u514B\u9686 / \u88AB\u62D2\u7EDD\uFF09\u65F6\u81EA\u52A8\u56DE\u843D\u672C\u5730\u6A21\u578B\uFF0C\u56DE\u843D\u539F\u56E0\u5199\u5728\u4E0B\u9762\u300CMiniMax \u8BED\u97F3\u300D\u90A3\u4E00\u884C\u3002",
        fish: "\u4E91\u7AEF\u5408\u6210\uFF08Fish Audio\uFF09\uFF1A44.1kHz\uFF0C\u97F3\u8272\u662F\u7AD9\u4E0A\u8BAD\u7EC3\u597D\u7684\u5927\u9ED1\u5854\u89D2\u8272\u6A21\u578B\u3002\u9700\u8981\u8054\u7F51\uFF0C\u53F0\u8BCD\u4F1A\u4F20\u5230 fish.audio\uFF1B\u53C2\u6570\u5728\u4E0B\u9762\u300CFish \u8BED\u97F3\u300D\u90A3\u4E00\u7EC4\u91CC\u8C03\u3002",
        mimo: "\u5408\u6210\u5668\u5C1A\u672A\u63A5\u7EBF\uFF08\u5BBF\u4E3B\u4FA7 mimo-tts.js \u8FD8\u6CA1\u6709\u8C03\u7528\u70B9\uFF09\uFF0C\u9009\u5B83\u4E0D\u4F1A\u53D1\u58F0\u3002"
      }),
      badges: Object.freeze({
        local: Object.freeze(["\u79BB\u7EBF", "\u65E0\u9700\u8054\u7F51", "\u96F6\u6210\u672C"]),
        minimax: Object.freeze(["\u4E91\u7AEF", "\u8FB9\u5199\u8FB9\u5FF5", "\u5931\u8D25\u56DE\u843D"]),
        fish: Object.freeze(["\u4E91\u7AEF", "44.1kHz", "\u9700\u8054\u7F51"]),
        mimo: Object.freeze(["\u672A\u63A5\u7EBF", "\u4E0D\u53D1\u58F0"])
      }),
      summary: Object.freeze({
        local: "\u5728\u672C\u673A\u8DD1\uFF0C\u5408\u6210\u8FDB\u7A0B\u5E38\u9A7B\uFF0C\u70ED\u8D77\u6765\u540E\u6BD4\u64AD\u653E\u8FD8\u5FEB\u3002",
        minimax: "MiniMax \u5408\u6210\uFF1B\u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u56DE\u843D\u672C\u5730\u6A21\u578B\uFF0C\u539F\u56E0\u5199\u5728\u4E0B\u9762\u3002",
        fish: "Fish Audio \u5408\u6210\uFF0C\u97F3\u8272\u662F\u7AD9\u4E0A\u8BAD\u7EC3\u597D\u7684\u89D2\u8272\u6A21\u578B\u3002",
        mimo: "\u5BBF\u4E3B\u4FA7\u8FD8\u6CA1\u6709\u8C03\u7528\u70B9\uFF0C\u9009\u5B83\u4E0D\u4F1A\u51FA\u58F0\u3002"
      }),
      facts: Object.freeze({
        local: Object.freeze([
          Object.freeze(["\u9700\u8981\u7F51\u7EDC", "\u5426"]),
          Object.freeze(["\u91C7\u6837\u7387", "24 kHz"]),
          Object.freeze(["\u97F3\u8272\u6765\u6E90", "\u6A21\u578B\u5185\u7F6E\uFF08\u4E0D\u53EF\u6362\uFF09"]),
          Object.freeze(["\u5F00\u9500", "\u96F6\u6210\u672C"])
        ]),
        minimax: Object.freeze([
          Object.freeze(["\u9700\u8981\u7F51\u7EDC", "\u662F"]),
          Object.freeze(["\u5931\u8D25\u65F6", "\u56DE\u843D\u672C\u5730\u6A21\u578B"]),
          Object.freeze(["\u9700\u8981\u5BC6\u94A5", "MINIMAX_API_KEY"]),
          Object.freeze(["\u514B\u9686\u97F3\u8272", "\u9700\u5957\u9910"])
        ]),
        fish: Object.freeze([
          Object.freeze(["\u9700\u8981\u7F51\u7EDC", "\u662F"]),
          Object.freeze(["\u91C7\u6837\u7387", "44.1 kHz"]),
          Object.freeze(["\u53F0\u8BCD\u4E0A\u4F20", "\u4F20\u5230 fish.audio"]),
          Object.freeze(["\u97F3\u8272\u6765\u6E90", "\u7AD9\u4E0A\u8BAD\u7EC3\u7684\u89D2\u8272\u6A21\u578B"]),
          Object.freeze(["\u53EF\u6362\u97F3\u8272", "\u662F"]),
          Object.freeze(["\u53C2\u6570\u4F4D\u7F6E", "\u4E0B\u9762\u300CFish \u8BED\u97F3\u300D\u7EC4"])
        ]),
        mimo: Object.freeze([
          Object.freeze(["\u9700\u8981\u7F51\u7EDC", "\u2014"]),
          Object.freeze(["\u72B6\u6001", "\u5408\u6210\u5668\u672A\u63A5\u7EBF"]),
          Object.freeze(["\u80FD\u5426\u53D1\u58F0", "\u5426"])
        ])
      })
    })
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
    label: "\u5B9E\u65F6\u8BED\u97F3",
    wired: true,
    group: "\u8BED\u97F3",
    hint: "\u300C\u81EA\u52A8\u5FF5\u56DE\u590D\u300D\u7684\u603B\u5F00\u5173\u3002\u5173\u6389\u5C31\u4E0D\u518D\u81EA\u52A8\u628A\u56DE\u590D\u9001\u53BB\u5408\u6210\uFF08\u4E0D\u518D\u82B1\u94B1\uFF09\uFF1Bherta_say \u4E0E\u300C\u8BD5\u542C\u300D\u4E0D\u53D7\u5B83\u7BA1\u3002"
  }),
  /** 主语音静音。整机默认 `false`（原来存在渲染层 localStorage）。 */
  voiceMuted: Object.freeze({
    kind: "boolean",
    def: false,
    label: "\u9759\u97F3",
    group: "\u8BED\u97F3",
    hint: "\u5173\u6389\u5979\u6240\u6709\u7684\u8BED\u97F3\u64AD\u653E\u3002\u7ACB\u523B\u751F\u6548\u3002"
  }),
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
    label: "\u97F3\u91CF",
    group: "\u8BED\u97F3",
    hint: "\u8BED\u97F3\u64AD\u653E\u7684\u97F3\u91CF\uFF080\u2013100\uFF09\u3002\u7ACB\u523B\u751F\u6548\u3002"
  }),
  fishRef: Object.freeze({
    kind: "text",
    def: "f9ede0382ffc4671ac86b44d49f19cdd",
    placeholder: "f9ede0382ffc4671ac86b44d49f19cdd",
    label: "Fish \u97F3\u8272\u6A21\u578B",
    wired: true,
    group: "Fish \u8BED\u97F3",
    hint: "fish.audio \u4E0A\u7684\u97F3\u8272\u6A21\u578B ID\u3002\u9ED8\u8BA4\u662F\u5927\u9ED1\u5854\uFF1B\u6362\u6210\u522B\u7684\u89D2\u8272\u53EA\u8981\u6539\u8FD9\u4E00\u884C\u3002"
  }),
  fishSpeed: Object.freeze({
    kind: "number",
    min: 0.5,
    max: 2,
    step: 0.05,
    def: 1,
    label: "Fish \u8BED\u901F",
    wired: true,
    group: "Fish \u8BED\u97F3",
    hint: "\u8BED\u901F\u30021 \u662F\u6A21\u578B\u539F\u59CB\u901F\u5EA6\u3002"
  }),
  fishEffect: Object.freeze({
    kind: "boolean",
    def: true,
    label: "Fish \u4FE1\u9053\u97F3\u6548",
    wired: true,
    group: "Fish \u8BED\u97F3",
    hint: "\u4FE1\u9053\u97F3\u6548\uFF1A400Hz\u20135.5kHz \u5E26\u901A + \u9971\u548C\uFF0C\u66F4\u50CF\u6E38\u620F\u91CC\u900F\u8FC7\u7EC8\u7AEF\u8BF4\u8BDD\u3002\u5173\u6389\u5C31\u662F Fish \u539F\u58F0\u3002"
  }),
  fishPreset: Object.freeze({
    kind: "enum",
    values: Object.freeze(["terminal_textured", "terminal"]),
    def: "terminal_textured",
    label: "Fish \u97F3\u6548\u6863\u4F4D",
    wired: true,
    group: "Fish \u8BED\u97F3",
    enumLabels: Object.freeze({ terminal_textured: "\u5E26\u566A\u58F0", terminal: "\u7EAF\u51C0" }),
    hint: "terminal_textured \u591A\u4E00\u5C42\u8DDF\u7740\u8BED\u97F3\u8D70\u7684\u566A\u58F0\uFF1Bterminal \u662F\u540C\u4E00\u5957\u6EE4\u6CE2\u4F46\u4E0D\u52A0\u566A\u58F0\u3002"
  }),
  fishProxy: Object.freeze({
    kind: "text",
    def: "",
    placeholder: "http://127.0.0.1:7897\uFF08\u7559\u7A7A = \u76F4\u8FDE\uFF09",
    label: "Fish \u4EE3\u7406",
    wired: true,
    group: "Fish \u8BED\u97F3",
    hint: "\u4E24\u6761\u63A5\u53E3\u90FD\u4E0D\u901A\u65F6\u624D\u9700\u8981\uFF08\u63D2\u4EF6\u9ED8\u8BA4\u5148\u8D70 fishaudio.org\uFF0C\u56FD\u5185\u53EF\u76F4\u8FDE\uFF09\u3002\u7559\u7A7A\u5219\u4F9D\u6B21\u770B fish_config.json \u7684 proxy\u3001\u73AF\u5883\u53D8\u91CF HTTPS_PROXY / HTTP_PROXY\u3002"
    // 这里**刻意不写 `note`**：按本仓约定，`note` 只说「为什么这个字段没接线」
    // （见 `test-herta-settings.mjs` 那两条互斥断言）。这一行是活字段，用法说明在
    // 「Fish 语音」那一组的组 hint 里、以及上面这条行内 `hint` 里。
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
    label: "\u540C\u6B65\u5230\u5DE5\u4F5C\u533A",
    wired: false,
    note: "\u4E0A\u4E00\u7248\u7528\u5B83\u51B3\u5B9A\u300C\u5199\u56DE\u54EA\u4E2A\u5DE5\u4F5C\u533A\u7684 .herta\\settings.json\u300D\u3002\u5199\u56DE\u5DF2\u6574\u4F53\u5220\u9664\uFF0C\u6240\u4EE5\u5B83\u73B0\u5728\u53EA\u88AB\u5B58\u4E0B\u6765\u3002",
    hint: "\u6574\u673A\u7684\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09\u3002"
  }),
  /**
   * 「做梦」。整机默认 `true`。
   * 消费者：无 —— 原来只有她自己的设置页读它；做梦由整机自己的服务跑（仅独立版）。
   */
  dreamEnabled: Object.freeze({
    kind: "boolean",
    def: true,
    label: "\u505A\u68A6",
    wired: false,
    note: "\u505A\u68A6\u662F\u6574\u673A\u81EA\u5DF1\u7684\u540E\u53F0\u670D\u52A1\uFF08\u72EC\u7ACB\u7248\u624D\u6709\uFF09\uFF0CDSH \u4F1A\u8BDD\u91CC\u6CA1\u6709\u8FD9\u6761\u94FE\u8DEF\u3002",
    hint: "\u5979\u7A7A\u95F2\u65F6\u81EA\u5DF1\u5199\u5E9F\u6848\u3002"
  }),
  /** 板砖的推理档位。整机默认 `"high"`。消费者：无（同上，属独立版后端）。 */
  backendThinking: Object.freeze({
    kind: "enum",
    values: Object.freeze(["low", "high", "max"]),
    def: "high",
    label: "\u63A8\u7406\u6863\u4F4D",
    wired: false,
    note: "\u677F\u7816\u662F\u6574\u673A\u72EC\u7ACB\u7248\u7684\u540E\u7AEF\uFF1BDSH \u4F1A\u8BDD\u8D70 DSH \u81EA\u5DF1\u7684\u6A21\u578B\u914D\u7F6E\u3002",
    enumLabels: Object.freeze({ low: "low", high: "high", max: "max" }),
    hint: "\u677F\u7816\u7684\u63A8\u7406\u6863\u4F4D\u3002"
  }),
  /** 板砖的工具契约。整机默认 `"minimal"`。消费者：无（同上）。 */
  backendContract: Object.freeze({
    kind: "enum",
    values: Object.freeze(["standard", "minimal"]),
    def: "minimal",
    label: "\u5DE5\u5177\u5951\u7EA6",
    wired: false,
    note: "\u677F\u7816\u662F\u6574\u673A\u72EC\u7ACB\u7248\u7684\u540E\u7AEF\uFF1BDSH \u4F1A\u8BDD\u8D70 DSH \u81EA\u5DF1\u7684\u6A21\u578B\u914D\u7F6E\u3002",
    enumLabels: Object.freeze({ standard: "standard", minimal: "minimal" }),
    hint: "\u677F\u7816\u7684\u5DE5\u5177\u5951\u7EA6\u3002"
  }),
  /** 黑塔本体的模型。整机默认 `"deepseek-v4-pro"`。消费者：无（同上）。 */
  modelsActor: Object.freeze({
    kind: "enum",
    values: Object.freeze(["deepseek-v4-pro", "deepseek-flash"]),
    def: "deepseek-v4-pro",
    label: "\u9ED1\u5854\u7684\u6A21\u578B",
    wired: false,
    note: "DSH \u91CC\u5979\u7684\u6A21\u578B\u7531\u4F1A\u8BDD\u81EA\u5DF1\u7684\u6A21\u578B\u914D\u7F6E\u51B3\u5B9A\uFF0C\u8FD9\u4E2A\u952E\u53EA\u6709\u72EC\u7ACB\u7248\u7684\u540E\u7AEF\u4F1A\u8BFB\u3002",
    enumLabels: Object.freeze({ "deepseek-v4-pro": "V4 Pro", "deepseek-flash": "V4.1 Flash" }),
    hint: "\u9A71\u52A8\u9ED1\u5854\u8BF4\u8BDD\u7684\u6A21\u578B\u3002"
  }),
  /** 板砖的模型。整机默认 `"deepseek-flash"`。消费者：无（同上）。 */
  modelsBackend: Object.freeze({
    kind: "enum",
    values: Object.freeze(["deepseek-v4-pro", "deepseek-flash"]),
    def: "deepseek-flash",
    label: "\u677F\u7816\u7684\u6A21\u578B",
    wired: false,
    note: "DSH \u91CC\u677F\u7816\u7684\u6A21\u578B\u7531\u4F1A\u8BDD\u81EA\u5DF1\u7684\u6A21\u578B\u914D\u7F6E\u51B3\u5B9A\uFF0C\u8FD9\u4E2A\u952E\u53EA\u6709\u72EC\u7ACB\u7248\u7684\u540E\u7AEF\u4F1A\u8BFB\u3002",
    enumLabels: Object.freeze({ "deepseek-v4-pro": "V4 Pro", "deepseek-flash": "V4.1 Flash" }),
    hint: "\u9A71\u52A8\u677F\u7816\u7684\u6A21\u578B\u3002"
  })
});
var FIELD_NAMES = Object.freeze(Object.keys(FIELDS));
var GROUP_DECLARATION = Object.freeze([
  Object.freeze({ title: "\u754C\u9762" }),
  Object.freeze({
    title: "\u8BED\u97F3",
    hint: "\u8FD9\u56DB\u4E2A\u503C\u90FD\u662F\u5BBF\u4E3B\u771F\u5728\u8BFB\u7684\uFF0C\u6539\u5B8C\u7ACB\u523B\u751F\u6548\u3002\u9759\u97F3\u53EA\u51B3\u5B9A\u300C\u542C\u4E0D\u542C\u5F97\u89C1\u300D\uFF0C\u4E0D\u51B3\u5B9A\u8981\u4E0D\u8981\u82B1\u94B1\u5408\u6210\u3002",
    trailer: "minimax-voice"
  }),
  Object.freeze({
    title: "Fish \u8BED\u97F3",
    hint: "\u53EA\u5728\u300C\u8BED\u97F3\u5F15\u64CE\u300D\u9009 fish \u65F6\u751F\u6548\u3002\u8FD9\u91CC\u7684\u503C**\u4F18\u5148**\u4E8E\u5916\u90E8 fish_config.json \u2014\u2014 \u90A3\u8FB9\u9000\u5316\u6210\u300C\u6CA1\u8BBE\u8FC7\u65F6\u7684\u515C\u5E95\u300D\u3002\u5BC6\u94A5\u4E0D\u5728\u8FD9\u91CC\uFF1A\u5B83\u5728\u4E0A\u9762\u7684\u300CFish \u5BC6\u94A5\u300D\u90A3\u4E00\u884C\uFF0C\u8D70 DSH \u51ED\u636E\u5B58\u50A8\uFF0C\u4E0D\u843D\u660E\u6587\u914D\u7F6E\u3002**\u6CA1\u58F0\u901A\u5E38\u5C31\u662F\u8FD9\u4E00\u6761**\uFF1A\u7F51\u7EDC\u5230\u4E0D\u4E86 Fish \u63A5\u53E3 \u2014\u2014 \u63D2\u4EF6\u6309 fishaudio.org\uFF08\u56FD\u5185\u53EF\u76F4\u8FDE\uFF09\u2192 api.fish.audio\uFF08\u65E7\u57DF\u540D\uFF0C\u56FD\u5185\u88AB\u5899\uFF09\u7684\u987A\u5E8F\u8BD5\uFF0C\u4E24\u6761\u90FD\u4E0D\u901A\u65F6\u624D\u9700\u8981\u5728\u300CFish \u4EE3\u7406\u300D\u90A3\u4E00\u884C\u586B\u4EE3\u7406\u5730\u5740\uFF0C\u518D\u70B9\u4E00\u6B21\u8BD5\u542C\u3002"
  })
]);
var SETTINGS_GROUPS = Object.freeze(
  GROUP_DECLARATION.map(
    (decl) => Object.freeze({
      ...decl,
      fields: Object.freeze(FIELD_NAMES.filter((n) => FIELDS[n].group === decl.title))
    })
  )
);
var ENUM_LABELS = Object.freeze(
  Object.fromEntries(
    FIELD_NAMES.filter((n) => FIELDS[n].kind === "enum" && FIELDS[n].enumLabels !== void 0).map((n) => [
      n,
      FIELDS[n].enumLabels
    ])
  )
);
var FIELD_HINTS = Object.freeze(
  Object.fromEntries(FIELD_NAMES.filter((n) => FIELDS[n].hint !== void 0).map((n) => [n, FIELDS[n].hint]))
);
var DEFAULTS = Object.freeze(
  Object.fromEntries(FIELD_NAMES.map((name2) => [name2, FIELDS[name2].def]))
);
var WIRED_FIELD_NAMES = Object.freeze(FIELD_NAMES.filter((n) => FIELDS[n].wired !== false));
var UNWIRED_FIELD_NAMES = Object.freeze(FIELD_NAMES.filter((n) => FIELDS[n].wired === false));
function isManagedValue(name2, value) {
  const field = FIELDS[name2];
  if (field === void 0) return false;
  if (field.kind === "boolean") return typeof value === "boolean";
  if (field.kind === "enum") return typeof value === "string" && field.values.includes(value);
  if (field.kind === "number") {
    return typeof value === "number" && Number.isFinite(value) && value >= field.min && value <= field.max;
  }
  if (field.kind === "path") return typeof value === "string" && value.length <= 4096;
  if (field.kind === "text") return typeof value === "string" && value.length <= 4096;
  return false;
}
function normalizeSettings(raw) {
  const src = raw !== null && typeof raw === "object" ? raw : {};
  const out = {};
  for (const name2 of FIELD_NAMES) {
    out[name2] = isManagedValue(name2, src[name2]) ? src[name2] : FIELDS[name2].def;
  }
  return out;
}

// src/client/machine.ts
var machineForm = null;
async function writeMachineOps(ops) {
  const field = String(ops[0]?.path?.[0] ?? "");
  if (machineForm === null) {
    markMachine("settingsWriteSkipped", field);
    return false;
  }
  try {
    const accepted = await machineForm.mutate(ops);
    markMachine("settingsLastWrite", field);
    markMachine("settingsLastWriteAccepted", accepted);
    return accepted;
  } catch (error) {
    markMachine("settingsWriteError", String(error?.message ?? error));
    return false;
  }
}
async function writeMachineField2(field, value) {
  return writeMachineOps([{ op: "set", path: [field], value }]);
}
function markMachine(field, value) {
  const mark = globalThis.__DSH_HERTA__;
  if (mark !== void 0) mark[field] = value;
}
var credentialsRemote = null;
var credentialsSubs = /* @__PURE__ */ new Set();
function bindCredentialsRemote(next) {
  credentialsRemote = next;
  for (const cb of credentialsSubs) {
    try {
      cb();
    } catch {
    }
  }
}
function resolveCredentials(ctx) {
  try {
    const direct = ctx.get?.("remote.credentials");
    if (direct !== void 0 && direct !== null) return direct;
  } catch {
  }
  try {
    const remote = ctx.remote;
    if (remote === null || remote === void 0 || typeof remote !== "object") return void 0;
    return remote.credentials;
  } catch {
    return void 0;
  }
}
function watchCredentials(ctx, mark) {
  const already = resolveCredentials(ctx);
  if (already !== void 0) {
    bindCredentialsRemote(already);
    mark.settingsCredentialsBound = true;
    mark.settingsCredentialsAttempts = 1;
    return;
  }
  const INTERVAL_MS = 500;
  const MAX_ATTEMPTS = 40;
  let attempts = 0;
  const timer2 = setInterval(() => {
    attempts += 1;
    const found = resolveCredentials(ctx);
    if (found !== void 0) {
      bindCredentialsRemote(found);
      mark.settingsCredentialsBound = true;
      mark.settingsCredentialsAttempts = attempts;
      clearInterval(timer2);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      mark.settingsCredentialsError = `remote.credentials \u5728 ${MAX_ATTEMPTS * INTERVAL_MS / 1e3} \u79D2\u5185\u6CA1\u6709\u51FA\u73B0\uFF08\u8BD5\u4E86 ${attempts} \u6B21\uFF09`;
      clearInterval(timer2);
    }
  }, INTERVAL_MS);
  ctx.effect?.(() => () => clearInterval(timer2), "dsh-herta: \u7B49 remote.credentials");
}
function bindMachineForm(form) {
  machineForm = form;
}

// src/client/minimax-pcm.ts
var B64_VALUE = (() => {
  const table = new Int8Array(128).fill(-1);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i += 1) table[alphabet.charCodeAt(i)] = i;
  return table;
})();
function decodeBase64ToBytes(input) {
  let cleanLength = 0;
  for (let i = 0; i < input.length; i += 1) {
    const at = input.charCodeAt(i);
    if (at < 128 && B64_VALUE[at] >= 0) cleanLength += 1;
  }
  const bytes = new Uint8Array(Math.floor(cleanLength * 3 / 4));
  let byteIndex = 0;
  let accumulator = 0;
  let bits = 0;
  let skipped = 0;
  let padding = 0;
  for (let i = 0; i < input.length; i += 1) {
    const at = input.charCodeAt(i);
    const value = at < 128 ? B64_VALUE[at] : -1;
    if (value < 0) {
      if (at === 61) padding += 1;
      else skipped += 1;
      continue;
    }
    if (padding > 0) {
      skipped += 1;
      continue;
    }
    accumulator = accumulator << 6 | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = accumulator >> bits & 255;
      byteIndex += 1;
    }
  }
  return {
    bytes: byteIndex === bytes.length ? bytes : bytes.subarray(0, byteIndex),
    skipped
  };
}
function decodePcmFrame(samplesB64) {
  if (typeof samplesB64 !== "string") {
    throw new TypeError(`decodePcmFrame \u9700\u8981 string\uFF0C\u6536\u5230 ${typeof samplesB64}`);
  }
  if (samplesB64 === "") return { samples: new Int16Array(0), byteLength: 0, skippedChars: 0 };
  const { bytes, skipped } = decodeBase64ToBytes(samplesB64);
  if (bytes.length % 2 !== 0) {
    throw new Error(
      `PCM \u957F\u5EA6\u4E0D\u662F 16 bit \u7684\u6574\u6570\u500D\uFF1A${bytes.length} \u5B57\u8282\uFF08base64 ${samplesB64.length} \u5B57\u7B26\uFF09`
    );
  }
  const aligned = new Int16Array(bytes.length / 2);
  for (let i = 0; i < aligned.length; i += 1) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    aligned[i] = (hi << 8 | lo) << 16 >> 16;
  }
  return { samples: aligned, byteLength: bytes.length, skippedChars: skipped };
}
function createSerialPlaybackQueue(options) {
  const onPlay = options.onPlay;
  const onStop = options.onStop;
  const log = options.log ?? (() => {
  });
  let pending = [];
  let playing = null;
  let order = /* @__PURE__ */ new Map();
  let orderSeq = 0;
  let cutoffOrder = 0;
  let received = /* @__PURE__ */ new Set();
  const RECEIVED_LIMIT = 4096;
  const rankOf = (item) => (order.get(item.utteranceId) ?? 0) * 1e6 + item.seq;
  function drain() {
    if (playing !== null || pending.length === 0) return;
    let best = 0;
    for (let i = 1; i < pending.length; i += 1) {
      if (rankOf(pending[i]) < rankOf(pending[best])) best = i;
    }
    const item = pending.splice(best, 1)[0];
    playing = item;
    try {
      onPlay(item);
    } catch (error) {
      log(`onPlay \u629B\u9519\uFF08${item.utteranceId}#${item.seq}\uFF09\uFF1A${String(error)}`);
      playing = null;
      drain();
    }
  }
  function fireStop(id) {
    if (onStop === void 0) return;
    try {
      onStop(id);
    } catch (error) {
      log(`onStop \u629B\u9519\uFF08${id}\uFF09\uFF1A${String(error)}`);
    }
  }
  return {
    push(utteranceId, seq, payload) {
      if (typeof utteranceId !== "string" || utteranceId === "") return "stopped";
      if (typeof seq !== "number" || !Number.isFinite(seq)) return "stopped";
      const seen = order.get(utteranceId);
      if (seen !== void 0 && seen <= cutoffOrder) return "duplicate";
      if (seen === void 0) {
        orderSeq += 1;
        order.set(utteranceId, orderSeq);
      }
      const key = `${utteranceId}#${seq}`;
      if (received.has(key)) return "duplicate";
      if (received.size >= RECEIVED_LIMIT) received = /* @__PURE__ */ new Set();
      received.add(key);
      pending.push({ utteranceId, seq, payload });
      if (playing === null) {
        drain();
        if (playing !== null && playing.utteranceId === utteranceId && playing.seq === seq) {
          return "playing";
        }
      }
      return "queued";
    },
    complete(utteranceId, seq) {
      if (playing === null || playing.seq !== seq || playing.utteranceId !== utteranceId) return;
      playing = null;
      drain();
    },
    /** 摘掉一条 utterance：待播里的一起清，正在播的就掐掉。 */
    stop(utteranceId) {
      pending = pending.filter((it) => it.utteranceId !== utteranceId);
      if (playing === null || playing.utteranceId !== utteranceId) return;
      playing = null;
      fireStop(utteranceId);
      drain();
    },
    /**
     * 掐掉一切 —— 正在播的、以及所有待播的。
     *
     * **这是唯一会打断播放的入口**，而它只该由「用户点了某一段」来调。
     */
    stopAll() {
      const id = playing !== null ? playing.utteranceId : "";
      pending = [];
      playing = null;
      cutoffOrder = orderSeq;
      fireStop(id);
    },
    reset() {
      pending = [];
      playing = null;
    },
    state() {
      const current = playing !== null ? playing.utteranceId : pending.length > 0 ? pending[0].utteranceId : null;
      return {
        current,
        playing: playing !== null ? playing.seq : null,
        queued: pending.filter((it) => it.utteranceId === current).map((it) => it.seq).sort((a, b) => a - b)
      };
    }
  };
}

// src/client/voice.ts
var MINIMAX_EVENTS_URL = "/herta-minimax-events";
var MINIMAX_STATE_URL = "/herta-minimax-state";
var fullFrame = null;
function voiceSinkWindow() {
  const win = fullFrame?.contentWindow;
  return win === null || win === void 0 ? null : win;
}
function pushVoiceToFrame(payload) {
  const win = voiceSinkWindow();
  if (win === null) return;
  win.postMessage({ __herta: true, kind: "event", event: "voice", payload }, window.location.origin);
}
var voiceAudio = null;
var voiceSources = /* @__PURE__ */ new Map();
var voiceCursor = /* @__PURE__ */ new Map();
var voiceEndAt = 0;
var VOICE_CURSOR_LIMIT = 64;
var resumeArmed = false;
function markMinimax(field, value) {
  const mark = globalThis.__DSH_HERTA__;
  if (mark !== void 0) mark[field] = value;
}
function ensureVoiceAudio() {
  if (voiceAudio === null) {
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (Ctor === void 0) return null;
      const ctx2 = new Ctor();
      const gain = ctx2.createGain();
      gain.connect(ctx2.destination);
      ctx2.addEventListener?.("statechange", () => {
        markMinimax("minimaxAudioState", ctx2.state);
        markMinimax("minimaxAudioBlocked", ctx2.state === "suspended");
      });
      voiceAudio = { ctx: ctx2, gain };
    } catch {
      markMinimax("minimaxAudioError", "AudioContext \u6784\u9020\u5931\u8D25");
      return null;
    }
  }
  const { ctx } = voiceAudio;
  try {
    const volume = Number(machineField("voiceVolume"));
    voiceAudio.gain.gain.value = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume / 100)) : 1;
  } catch {
  }
  if (ctx.state === "suspended") {
    void ctx.resume().then(
      () => {
        markMinimax("minimaxAudioState", ctx.state);
        markMinimax("minimaxAudioBlocked", ctx.state === "suspended");
      },
      () => {
        markMinimax("minimaxAudioBlocked", true);
        armVoiceResume();
      }
    );
  }
  return ctx;
}
function armVoiceResume() {
  if (resumeArmed) return;
  resumeArmed = true;
  const onGesture = () => {
    const ctx = voiceAudio?.ctx;
    if (ctx === void 0) return;
    void ctx.resume().then(
      () => {
        markMinimax("minimaxAudioBlocked", ctx.state === "suspended");
        if (ctx.state !== "suspended") {
          window.removeEventListener("pointerdown", onGesture);
          window.removeEventListener("keydown", onGesture);
        }
      },
      () => {
      }
    );
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
}
function stopLocalVoice(utteranceId) {
  const ids = utteranceId === void 0 ? [...voiceSources.keys()] : [utteranceId];
  for (const id of ids) {
    for (const source of voiceSources.get(id) ?? []) {
      try {
        source.onended = null;
        source.stop();
      } catch {
      }
    }
    voiceSources.delete(id);
    voiceCursor.delete(id);
  }
  if (voiceSources.size === 0) voiceEndAt = 0;
}
function playLocalVoice2(utteranceId, seq, samples, sampleRate, durationMs) {
  if (machineField("voiceMuted") === true) return;
  if (samples.length === 0 || !(sampleRate > 0)) return;
  const ctx = ensureVoiceAudio();
  if (ctx === null) return;
  try {
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      channel[i] = (samples[i] ?? 0) / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(voiceAudio.gain);
    const at = Math.max(ctx.currentTime, voiceEndAt);
    let set = voiceSources.get(utteranceId);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      voiceSources.set(utteranceId, set);
    }
    set.add(source);
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      localQueue2.complete(utteranceId, seq);
    };
    source.onended = () => {
      set.delete(source);
      if (set.size === 0) voiceSources.delete(utteranceId);
      settle();
    };
    source.start(at);
    if (!voiceCursor.has(utteranceId) && voiceCursor.size >= VOICE_CURSOR_LIMIT) voiceCursor.clear();
    voiceCursor.set(utteranceId, at + buffer.duration);
    voiceEndAt = at + buffer.duration;
    markMinimax("minimaxAudioPlays", (globalThis.__DSH_HERTA__?.minimaxAudioPlays ?? 0) + 1);
    markMinimax("minimaxAudioLast", `#${samples.length}/${sampleRate}Hz`);
    const guardMs = Math.max(0, durationMs) + Math.round((at - ctx.currentTime) * 1e3) + 250;
    setTimeout(settle, guardMs);
  } catch {
    markMinimax("minimaxAudioError", "\u8C03\u5EA6\u5931\u8D25");
    localQueue2.complete(utteranceId, seq);
  }
}
var localQueue2 = createSerialPlaybackQueue({
  onPlay: (item) => {
    playLocalVoice2(
      item.utteranceId,
      item.seq,
      item.payload.samples,
      item.payload.sampleRate,
      item.payload.durationMs
    );
  },
  onStop: (id) => {
    if (id === "") stopLocalVoice();
    else stopLocalVoice(id);
  }
});
function onMiniMaxPcm(frame) {
  const utteranceId = typeof frame.utteranceId === "string" ? frame.utteranceId : "";
  const seq = typeof frame.seq === "number" ? frame.seq : 0;
  const sampleRate = typeof frame.sampleRate === "number" ? frame.sampleRate : 0;
  const durationMs = typeof frame.durationMs === "number" ? frame.durationMs : 0;
  if (utteranceId === "" || typeof frame.samplesB64 !== "string") {
    markMinimax("minimaxFrameDropped", "\u7F3A\u5C11 utteranceId / samplesB64");
    return;
  }
  let samples;
  try {
    samples = decodePcmFrame(frame.samplesB64).samples;
  } catch (error) {
    markMinimax("minimaxFrameDropped", String(error?.message ?? error));
    return;
  }
  markMinimax("minimaxLastFrame", `${utteranceId}#${seq} ${samples.length} samples`);
  rememberSpokenAudio(frame.text, samples, sampleRate, durationMs);
  for (const [token, askedText] of awaitingSpokenTexts) {
    if (utteranceId.indexOf(token) >= 0) {
      rememberSpokenAudio(askedText, samples, sampleRate, durationMs);
      awaitingSpokenTexts.delete(token);
      break;
    }
  }
  if (voiceSinkWindow() !== null) {
    pushVoiceToFrame({ kind: "tts", utteranceId, seq, samples, sampleRate, durationMs });
    return;
  }
  localQueue2.push(utteranceId, seq, { samples, sampleRate, durationMs });
}
function onMiniMaxStop(utteranceId) {
  if (voiceSinkWindow() !== null) {
    pushVoiceToFrame({ kind: "ttsStop", utteranceId });
    return;
  }
  localQueue2.stop(utteranceId);
}
var miniMaxState2 = null;
var miniMaxSubs = /* @__PURE__ */ new Set();
function notifyMiniMax() {
  for (const cb of miniMaxSubs) {
    try {
      cb(miniMaxState2);
    } catch {
    }
  }
}
async function refreshMiniMax() {
  try {
    const res = await fetch(MINIMAX_STATE_URL, { headers: { accept: "application/json" } });
    if (res.ok) miniMaxState2 = await res.json();
  } catch {
  }
  notifyMiniMax();
  return miniMaxState2;
}
function dispatchMiniMaxFrame(frame) {
  if (frame.kind === "tts") {
    onMiniMaxPcm(frame);
    return;
  }
  if (frame.kind === "ttsStop") {
    const id = typeof frame.utteranceId === "string" ? frame.utteranceId : "";
    if (id !== "") onMiniMaxStop(id);
    return;
  }
  if (frame.voice !== void 0 || frame.synth !== void 0 || frame.kind === "state") {
    miniMaxState2 = frame;
    markMinimax("minimaxEngine", frame.engine);
    markMinimax("minimaxEngineNote", frame.engineReason ?? null);
    notifyMiniMax();
  }
}
function parseSseData(data) {
  try {
    const parsed = JSON.parse(data);
    return parsed !== null && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
var miniMaxStream = null;
var miniMaxStreamRefs = 0;
function startMiniMaxStream() {
  miniMaxStreamRefs += 1;
  if (miniMaxStream !== null) {
    let released2 = false;
    return () => {
      if (released2) return;
      released2 = true;
      miniMaxStreamRefs -= 1;
      if (miniMaxStreamRefs <= 0 && miniMaxStream !== null) {
        miniMaxStream.close();
        miniMaxStream = null;
        markMinimax("minimaxSse", "closed");
      }
    };
  }
  if (typeof EventSource !== "function") {
    markMinimax("minimaxSse", "unavailable");
    return () => {
      miniMaxStreamRefs = Math.max(0, miniMaxStreamRefs - 1);
    };
  }
  let source;
  try {
    source = new EventSource(MINIMAX_EVENTS_URL);
  } catch (error) {
    markMinimax("minimaxSse", `construct failed: ${String(error?.message ?? error)}`);
    return () => {
      miniMaxStreamRefs = Math.max(0, miniMaxStreamRefs - 1);
    };
  }
  miniMaxStream = source;
  markMinimax("minimaxSse", "connecting");
  source.onopen = () => {
    markMinimax("minimaxSse", "open");
    void refreshMiniMax();
  };
  source.onerror = () => {
    markMinimax("minimaxSse", "error");
  };
  source.onmessage = (event) => {
    const frame = parseSseData(String(event.data ?? ""));
    if (frame === null) {
      markMinimax("minimaxBadFrames", (globalThis.__DSH_HERTA__?.minimaxBadFrames ?? 0) + 1);
      return;
    }
    dispatchMiniMaxFrame(frame);
  };
  let released = false;
  return () => {
    if (released) return;
    released = true;
    miniMaxStreamRefs -= 1;
    if (miniMaxStreamRefs <= 0) {
      source.close();
      if (miniMaxStream === source) miniMaxStream = null;
      markMinimax("minimaxSse", "closed");
    }
  };
}

// src/client/ui.ts
var import_react12 = require("react");
var import_client = require("react-dom/client");

// ../tools/_herta-src/packages/core/dist/text-sanitize.js
var DISPLAY_UNSAFE = (
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is this module's purpose
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u2028-\u202E\u2060-\u2064\u2066-\u2069\uD800-\uDFFF\uFEFF\u{E0000}-\u{E007F}]/gu
);
function stripDisplayUnsafe(text) {
  return text.replace(DISPLAY_UNSAFE, "");
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/HertaBubble.tsx
var import_react4 = require("react");

// ../tools/_herta-src/packages/gui/src/renderer/i18n/LocaleProvider.tsx
var import_react = require("react");

// ../tools/_herta-src/packages/gui/src/renderer/i18n/messages/en.ts
var en = {
  "nav.voice": "Voice",
  "nav.dream": "Dream",
  "nav.deepseek": "DeepSeek",
  "nav.coprocessor": "Coprocessor",
  "nav.language": "Language",
  "nav.window": "Window",
  "nav.update": "Updates",
  "update.intro": "Station firmware, received and installed. New versions download in the background and install automatically on exit.",
  "update.betaLead": "Beta: ",
  "update.betaNotice": "still under test \u2014 releases may include breaking changes, and past sessions or settings may not fully survive an update.",
  "update.auto": "Automatic updates",
  "update.autoDesc": "When off, updates are neither checked nor downloaded automatically \u2014 only on a manual check.",
  "update.currentVersion": "Current version",
  "update.checkNow": "Check for updates",
  "update.restartNow": "Restart & update",
  "update.checking": "Checking\u2026",
  "update.available": "New version found:",
  "update.downloading": "Downloading",
  "update.ready": "Ready \u2014 installs on exit:",
  "update.error": "Check failed",
  "update.unreachable": "The update server (GitHub) could not be reached. Check the network or VPN; the latest build is also on Baidu Netdisk.",
  "update.netdisk": "Open Baidu Netdisk",
  "update.upToDate": "Up to date",
  "update.notChecked": "Not checked yet",
  "update.unsupported": "Updates unavailable here",
  "nav.group.general": "General",
  "nav.group.herta": "Herta",
  "nav.group.engine": "Engine",
  "window.intro": "How the window looks, opens, and closes.",
  "window.theme": "Appearance",
  "window.themeDesc": "Light or dark interface; System follows the OS setting automatically.",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "window.closeToTray": "Close to tray",
  "window.closeToTrayDesc": "Closing the window hides Herta to the system tray and keeps her running; turn this off to quit on close.",
  "window.minimize": "Minimize",
  "window.maximize": "Maximize",
  "window.restore": "Restore",
  "window.closeBtn": "Close",
  "settings.eyebrow": "Settings",
  "settings.closeAria": "Close settings",
  "settings.sectionsAria": "Settings sections",
  "settings.dialogAria": "Settings",
  "settings.loadFailed": "Couldn't load this setting \u2014 reopen Settings to retry",
  "language.rowLabel": "Display language",
  "language.intro": "Herta's own voice is unaffected.",
  "language.interactionRowLabel": "Interaction language",
  "language.interactionDesc": "The language Herta talks with you in. Applies to new sessions; English sessions have no voice in this release.",
  "language.follow": "Follow UI language",
  "topbar.toggleSidebar": "Toggle sidebar",
  "topbar.search": "Search sessions",
  "topbar.newSession": "New session",
  "topbar.resolveApprovalFirst": "Resolve the pending approval first",
  "topbar.settings": "Settings",
  "session.untitled": "Untitled",
  "session.searchPlaceholder": "Search sessions",
  "session.filterAria": "Filter sessions by title",
  "session.noMatches": "No matching sessions",
  "session.searching": "Searching transcripts\u2026",
  "session.searchUnavailable": "(content search unavailable \u2014 titles only)",
  "session.pendingApproval": "Pending approval",
  "session.confirmDelete": "Confirm delete",
  "session.deleteAria": "Delete session",
  "session.openFailed": "Archive damaged",
  "session.switchInterrupts": "This interrupts the current reply \u2014 click again to confirm",
  "session.group.today": "Today",
  "session.group.yesterday": "Yesterday",
  "session.group.previous7Days": "Previous 7 Days",
  "session.group.older": "Older",
  "voice.realtime": "Real-time voice",
  "voice.realtimeDesc": "Open the terminal microphone.",
  "voice.realtimeMissing": "This install lacks the voice runtime \u2014 she can only type for now.",
  "voice.realtimeFailed": "The voice process failed repeatedly; it's off for this run. Restart Herta to retry.",
  "voice.model": "Voice model",
  "voice.modelAbsent": "About {size} MB; available once downloaded.",
  "voice.modelDev": "Using the model in the workspace's data/tts.",
  "voice.modelDownload": "Download",
  "voice.modelDownloading": "Downloaded {received} / {total} MB",
  "voice.modelCancel": "Cancel",
  "voice.modelReady": "Installed, about {size} MB on disk.",
  "voice.modelRemove": "Remove",
  "voice.modelRetry": "Retry",
  "voice.modelFailed.network": "GitHub could not be reached to download the model. Check the network or VPN and retry.",
  "voice.modelFailed.http": "The server did not return the model file.",
  "voice.modelFailed.size": "The downloaded file had the wrong size; discarded.",
  "voice.modelFailed.hash": "The downloaded file failed its checksum; discarded.",
  "voice.modelFailed.archive": "The model archive could not be unpacked; discarded.",
  "voice.modelFailed.verify": "The model files failed verification; discarded.",
  "voice.modelFailed.disk": "Writing to this machine failed; check disk space.",
  "voice.modelFailed.cancelled": "Cancelled.",
  "voice.engine": "Voice engine",
  "voice.engineDesc": "The downloaded local model, or the cloud model that sounds better.",
  "voice.engine.local": "Local model",
  "voice.engine.minimax": "MiniMax cloud",
  "voice.minimaxKey": "MiniMax API key",
  "voice.minimaxKeyDesc": "Pay-as-you-go. Generates the voice ID; also synthesizes speech when no plan key is set. Get one at platform.minimaxi.com.",
  "voice.minimaxKeyAria": "MiniMax API key",
  "voice.keyDelete": "Delete",
  "voice.minimaxHelpAria": "About the keys",
  "voice.minimaxHelp": "Cloud voice needs an API key for two jobs: generating the voice ID and synthesizing speech. The voice ID can only be generated with the MiniMax API key (pay-as-you-go, once). Speech prefers the Token Plan key (free within the plan) and uses the API key when none is set.",
  "voice.minimaxKeyRejected": "Key rejected",
  "voice.minimaxKeyQuota": "Out of balance",
  "voice.minimaxKeyUnchecked": "Unchecked",
  "voice.speechRefused.quota": "The account is out of balance; replies type unvoiced until it is topped up.",
  "voice.speechRefused.auth": "MiniMax refused the key; replies type unvoiced until it is fixed.",
  "voice.speechRefused.invalid_key": "MiniMax did not accept the key; replies type unvoiced until it is fixed.",
  "voice.minimaxPlanKey": "Token Plan key",
  "voice.minimaxPlanKeyDesc": "Optional. Synthesizes speech under a Token Plan subscription.",
  "voice.minimaxPlanKeyAria": "MiniMax Token Plan key",
  "voice.minimaxRejected": "MiniMax did not accept that key \u2014 check it and try again.",
  "voice.clonePreparing": "Preparing her voice\u2026",
  "voice.cloneRetry": "Retry",
  "voice.cloneFailed.no_key": "Enter a MiniMax key first.",
  "voice.cloneFailed.no_clone_key": "Generating the voice ID needs the MiniMax API key (pay-as-you-go); enter it and retry.",
  "voice.cloneFailed.invalid_key": "MiniMax did not accept the key.",
  "voice.cloneFailed.auth": "MiniMax refused the request; check the key and the account.",
  "voice.cloneFailed.rate": "Too many requests; try again shortly.",
  "voice.cloneFailed.quota": "The account is out of balance.",
  "voice.cloneFailed.sensitive": "The reference recording failed the platform's content check.",
  "voice.cloneFailed.voice_missing": "The voice on the platform has expired.",
  "voice.cloneFailed.invalid": "The platform did not accept the request's parameters.",
  "voice.cloneFailed.network": "MiniMax could not be reached; check the network and retry.",
  "voice.cloneFailed.http": "MiniMax returned an unexpected response.",
  "voice.cloneFailed.cancelled": "Cancelled.",
  "voice.cloneFailed.other": "Cloning failed; try again later.",
  "voice.cloneFailed.reference": "This install lacks the reference recording.",
  "voice.mute": "Mute voice",
  "voice.muteDesc": "Silence all of Herta's voice.",
  "voice.volume": "Volume",
  "voice.volumeDesc": "Adjust the loudness of Herta's voice.",
  "dream.enable": "Enable Dream",
  "dream.enableDesc": "Let Herta dream while you're away.",
  "dream.intro": "Dream is Herta's downtime. While you're away, she looks back over your finished sessions and writes down the memorable moments \u2014 coming to know you a little better the longer you work together.",
  // Punctuation rule (owner 2026-08-27): a single-clause LABEL or status
  // carries no terminal period — only prose that explains or instructs keeps
  // one. So "Couldn't save — try again." keeps its period and "Restart to
  // apply" does not.
  "common.couldntSave": "Couldn't save \u2014 try again.",
  "common.restartToApply": "Restart to apply",
  "deepseek.intro": "The API key is stored encrypted on this device. Get one at platform.deepseek.com.",
  "deepseek.checking": "Checking\u2026",
  "deepseek.statusFailed": "Couldn't check the key status",
  "deepseek.connected": "Connected",
  "deepseek.noKey": "No key set",
  "deepseek.replaceKey": "Replace key\u2026",
  "deepseek.keyAria": "DeepSeek API key",
  "deepseek.save": "Save",
  "deepseek.verifying": "Verifying\u2026",
  "deepseek.deleteKey": "Delete key",
  "deepseek.deleting": "Deleting\u2026",
  "deepseek.rejected": "DeepSeek rejected that key \u2014 check it and try again.",
  "deepseek.busy": "Finish the current turn first",
  "deepseek.unverified": "Saved, but couldn't reach DeepSeek to verify it \u2014 check your connection if Herta doesn't respond.",
  "deepseek.unencrypted": "Stored unencrypted \u2014 this device has no secure keychain available.",
  "deepseek.models.intro": "Model choice: Flash is faster and cheaper and can read images; Pro costs more. Changes apply after a restart.",
  "deepseek.model.actor": "Conversation model",
  "deepseek.model.actorDesc": "The model used when talking with Herta.",
  "deepseek.model.backend": "Coprocessor model",
  "deepseek.model.backendDesc": "The model Brick runs tasks with.",
  "deepseek.model.pro": "Pro",
  "deepseek.model.flash": "Flash",
  "keyprompt.title": "Connect Herta to DeepSeek",
  // "stored in your OS keychain", not "stored encrypted" (audit BL18):
  // key-store falls back to plaintext when safeStorage reports no encryption
  // available, and this card is shown BEFORE anything knows which it will be.
  // The honest per-state string (deepseek.unencrypted) exists and is used in
  // Settings once the key is saved.
  "keyprompt.body": "Herta needs a DeepSeek API key to think. It's stored in your OS keychain on this device and never leaves your machine except to call DeepSeek.",
  // Where to get one (audit BL19) — platform.deepseek.com appeared in exactly
  // one pane of the app and in neither the README nor the website, so a user
  // met with a key prompt on first launch had nowhere to go.
  "keyprompt.where": "Get a key at platform.deepseek.com",
  "keyprompt.notNow": "Not now",
  "keyprompt.saveSend": "Save & send",
  "keyprompt.saveFail": "Couldn't save the key \u2014 try again.",
  "device.state.idle": "Idle",
  "device.state.working": "Working",
  "device.state.reading": "Reading",
  "device.state.writing": "Writing",
  "device.state.runningCommand": "Running a command",
  "device.state.verifying": "Verifying",
  "device.state.awaitingApproval": "Awaiting approval",
  "device.state.done": "Done",
  "device.state.error": "Error",
  "banzhuan.legend.idle": "resting \u2014 nothing delegated",
  "banzhuan.legend.delegated": "Brick is working on your task",
  "banzhuan.legend.waitingApproval": "it needs your approval to continue",
  "banzhuan.legend.succeeded": "finished cleanly \u2014 a green beat",
  "banzhuan.legend.failed": "the task errored",
  "banzhuan.intro": "The Brick handles the coding for me. To delegate, write the full @\u677F\u7816 \u2014 that @ is the real trigger. The ring on its face shows what it's doing right now:",
  "banzhuan.thinking": "Thinking effort",
  "banzhuan.thinkingDesc": "How hard Brick thinks while working. Applies on the next launch.",
  "banzhuan.thinking.low": "Low",
  "banzhuan.thinking.high": "High",
  "banzhuan.thinking.max": "Max",
  "banzhuan.contract": "Tool contract",
  "banzhuan.contractDesc": "The toolset Brick works with. Standard: a full set of dedicated tools; Minimal: a lean toolset that cuts running cost sharply and needs bash installed on this machine. Applies on the next launch.",
  "banzhuan.contract.noBash": "No bash was found on this machine; Minimal will run as Standard. Install Git for Windows and restart to enable it.",
  "banzhuan.contract.standard": "Standard",
  "banzhuan.contract.minimal": "Minimal",
  "banzhuan.scene": "3D device",
  "banzhuan.sceneDesc": "A lit 3D object; off shows the flat renders.",
  "approval.title": "Permission request",
  "approval.allow": "Allow",
  "approval.alwaysAllow": "Allow for this task",
  "approval.allowProject": "Allow in project",
  "approval.projectRuleNote": "\u201CAllow in project\u201D remembers: {rule}",
  "approval.deny": "Deny",
  "approval.risk.read": "Read workspace",
  "approval.risk.write": "Write workspace",
  "approval.risk.destructive": "Destructive operation",
  "approval.risk.network": "Network access",
  "approval.reason.commandUnknown": "Unrecognized command \u2014 review carefully",
  "approval.reason.commandInterpreter": "Interpreter runs a script \u2014 review the script and arguments",
  "approval.reason.commandDestructive": "Destructive command \u2014 confirm before allowing",
  "approval.reason.commandNetwork": "This command makes a network call",
  "approval.reason.commandWrite": "This command writes files",
  "approval.reason.commandReaderPath": "Reads a sensitive or out-of-workspace path",
  "approval.reason.commandRecursiveRead": "Recursive read bypasses the credential guard",
  "approval.reason.commandVcs": "This git command changes the repository or working tree",
  "approval.reason.commandFs": "Filesystem operation (create / copy / move) \u2014 check the paths",
  "approval.reason.commandDelete": "This command deletes files \u2014 check the paths",
  "approval.reason.commandProcess": "This command ends processes \u2014 check the target",
  "approval.reason.commandCwdEscape": "This command leaves the workspace directory \u2014 later relative paths are unguarded",
  "approval.reason.commandUnresolved": "This command has unresolved parts",
  "approval.alsoClasses": "Also: {list}",
  "approval.consequence.discardsUncommitted": "Note: discards uncommitted changes \u2014 they cannot be recovered.",
  "approval.consequence.deletesUntracked": "Note: deletes untracked files \u2014 they cannot be recovered.",
  "approval.consequence.deletesStash": "Note: deletes stashed work \u2014 it cannot be recovered.",
  "approval.consequence.rewritesLocalHistory": "Note: rewrites local commit history.",
  "approval.consequence.rewritesRemoteHistory": "Note: overwrites the remote branch's history.",
  "approval.consequence.concludesInProgressOperation": "Note: a merge/rebase is mid-flight \u2014 this step concludes it.",
  "app.fanNotice": "Herta is a character from Honkai: Star Rail, \xA9 HoYoverse. Unofficial fan project, unaffiliated with and not endorsed by HoYoverse.",
  "approval.diffShowAria": "Show the diff: {n} changed lines, {add} added, {del} removed",
  "approval.diffHideAria": "Hide the diff",
  "approval.reason.writeNewFile": "Creates a new file",
  "approval.reason.editFile": "Edits an existing file",
  "approval.reason.strReplaceEditor": "Writes a file",
  "approval.heredocFolded": "    \u22EF {n} lines folded \u2014 see the diff below \u22EF",
  "composer.placeholder": "Message Herta\u2026",
  "composer.aria": "Message composer",
  "composer.send": "Send message",
  "composer.stop": "Interrupt the current turn",
  "composer.attach": "Add documents",
  "composer.attach.formats": ".pdf .docx .md .txt .csv .json .log .py .ts and other text",
  // The composer-notice pill (owner 2026-08-27): terse, formal, and NO
  // trailing period — a pill is a label, not a sentence. Settings-row prose
  // keeps its periods; these do not.
  "composer.attach.busy": "Turn not finished \u2014 cannot add files",
  "composer.attach.tooMany": "Ten files at most",
  "composer.attach.failed": "Adding files failed",
  "composer.attach.denied": "Credential-shaped \u2014 refused",
  // The staged strip (ADR 0048): pictures waiting to be sent WITH a message.
  "composer.staged": "Images to send",
  "composer.staged.remove": "Remove",
  // Enter with staged pictures and no words (owner 2026-08-27): pictures
  // ride a message; an empty user block is not a message.
  "composer.attach.needText": "Say something first",
  // The per-message picture cap (owner 2026-08-27): a message is a moment,
  // not an album.
  "composer.attach.imageLimit": "Five pictures at most",
  // Click-to-enlarge lightbox (ADR 0048 §4a). `lightbox.open` prefixes the
  // thumb button's aria-label, followed by the filename.
  "lightbox.open": "View picture",
  "lightbox.close": "Close",
  "lightbox.zoomIn": "Zoom in",
  "lightbox.zoomOut": "Zoom out",
  // The pill's tooltip: a bare wheel scrolls, so the zoom gesture is said
  // here (owner 2026-08-28).
  "lightbox.zoomHint": "Ctrl + wheel to zoom, drag to pan",
  "connect.button": "Connect to Herta",
  "connect.failed": "Session start failed \u2014 try again",
  "workspace.rewind": "Rewind to here",
  "workspace.editsNotReverted": "Edited files were not reverted",
  "workspace.rewindFailed": "Rewind failed",
  "workspace.processing": "Working\u2026",
  "workspace.took": "Took",
  "workspace.recapping": "Tidying conversation history\u2026",
  "workspace.turnFailed": "Connection lost \u2014 this reply was not delivered. Please send again.",
  "workspace.turnFailed401": "Invalid or expired DeepSeek API key \u2014 replace it in Settings.",
  "workspace.turnFailed402": "Insufficient DeepSeek balance \u2014 top up and send again.",
  "workspace.turnFailed429": "Rate-limited by DeepSeek \u2014 wait a moment and send again.",
  "workspace.turnFailed500": "DeepSeek server error \u2014 please try again later.",
  "workspace.turnFailed503": "DeepSeek servers are busy \u2014 please try again later.",
  "workspace.turnFailedTls": "The secure connection to DeepSeek was refused \u2014 usually a company proxy or VPN. Resending will not help; check your network settings.",
  "workspace.sending": "Message is crossing the galaxy\u2026",
  "workspace.gammaStorm": "Message caught in a gamma storm\u2026",
  "workspace.gammaStormLong": "The storm hasn't passed \u2014 message still en route\u2026",
  "workspace.jumpToLatest": "Back to bottom",
  "workspace.loadEarlier": "Load {n} earlier entries",
  "workspace.topicRailAria": "Topic guide",
  "activity.verb.reading": "Reading",
  "activity.verb.writing": "Writing",
  "activity.verb.running": "Running",
  "activity.verb.planning": "Planning",
  "activity.verb.inspecting": "Inspecting",
  "activity.verb.searching": "Searching",
  "activity.verb.stopping": "Stopping",
  "activity.verb.digesting": "Digesting",
  "activity.result.digest": "digest",
  "activity.result.chunks": "chunks",
  "activity.result.cached": "cached",
  "activity.verb.savingMemory": "Saving memory",
  "activity.result.tests": "tests",
  "activity.result.failed": "failed",
  "activity.result.exit": "exit",
  "activity.result.lines": "lines",
  "activity.result.matches": "matches",
  "activity.result.files": "files",
  "activity.result.truncated": "truncated",
  "activity.result.finding": "finding",
  "activity.step.patchPreview": "patch preview",
  "activity.bg.label": "background",
  "activity.bg.running": "running",
  "activity.bg.stopped": "stopped",
  "activity.bg.exited": "exited",
  "activity.bg.signal": "signal",
  "activity.todo.list": "todo list",
  "activity.todo.step": "Step",
  "activity.attachment.label": "attachment",
  "activity.attachment.chars": "chars",
  "activity.attachment.unreadable.binary": "not a text file",
  "activity.attachment.unreadable.tooLarge": "too large, no body taken",
  "activity.attachment.unreadable.empty": "no text extracted",
  "activity.attachment.unreadable.readError": "could not be read",
  "activity.attachment.unreadable.denied": "credential-shaped \u2014 refused",
  "activity.attachment.unreadable.removed": "removed",
  "activity.attachment.unreadable.encrypted": "password-protected, no body taken",
  "activity.attachment.unreadable.unsupported": "unsupported document format",
  "activity.attachment.unreadable.scanned": "no text extracted \u2014 probably a scan",
  "activity.attachment.unreadable.tooManyPages": "too many pages, not extracted",
  "activity.attachment.unreadable.textTooLong": "text too long, no head taken",
  "activity.attachment.format.pdf": "PDF",
  "activity.attachment.format.docx": "Word document",
  // Images (ADR 0048). `{f}` is the format token (PNG/JPEG) — data, not
  // chrome, so it is substituted rather than translated.
  "activity.attachment.image": "image {f}",
  "activity.attachment.unreadable.imageTooLarge": "too large to read",
  "activity.attachment.unreadable.noCaption": "stored, not read",
  "activity.attachment.pages": "pages",
  "activity.attachment.extracted": "text extracted",
  "activity.attachment.outline": "outline \xB7 {n} entries",
  "activity.attachment.remove": "Remove this attachment",
  "activity.attachment.removeFailed": "Removing the attachment failed",
  "activity.file.openAria": "View file",
  "activity.commit.openAria": "View commit",
  "activity.diff.openAria": "View changes",
  "viewer.close": "Close",
  "viewer.closeTab": "Close file",
  "viewer.copyPath": "Copy path",
  "viewer.copySha": "Copy commit id",
  "viewer.copied": "Copied",
  "viewer.openExternal": "Open in default app",
  "viewer.notFound": "File no longer exists or was moved",
  "viewer.binary": "Binary file \u2014 open with the default app",
  "viewer.outside": "This path is outside the workspace",
  "viewer.unreadable": "Couldn't read this file",
  "viewer.truncatedNote": "Long file \u2014 showing the head; open externally for the rest",
  "viewer.tooLarge": "Too large to view here \u2014 open with the default app",
  "viewer.renderFailed": "Couldn't render this file \u2014 open with the default app",
  "viewer.showSource": "View source",
  "viewer.showRendered": "View rendered",
  "viewer.rendering": "Rendering\u2026",
  "viewer.diagramFailed": "The diagram didn't render \u2014 its source is below",
  "viewer.imageFit": "Fit to panel",
  "viewer.imageActual": "Actual size",
  "viewer.pdfPages": "{n} pages",
  "viewer.rowsCapped": "Showing the first {n} rows",
  "viewer.colsCapped": "Showing the first {n} columns",
  "viewer.emptySheet": "Empty sheet",
  "viewer.chart": "Chart",
  "viewer.object": "Embedded object",
  "viewer.slidesCapped": "Showing the first {n} slides",
  "viewer.prevSlide": "Previous slide",
  "viewer.nextSlide": "Next slide",
  "viewer.slideAria": "Slide {n}",
  "viewer.commit.notFound": "This commit could not be read",
  "viewer.timeout": "Timed out reading \u2014 the repository is large or git is busy; try again",
  "viewer.commit.files": "{n} files",
  "viewer.commit.merge": "merge commit",
  "viewer.commit.binary": "binary",
  "viewer.commit.truncated": "Long patch \u2014 showing the head",
  "viewer.commit.moreFiles": "{n} more files not listed",
  "viewer.diff.against": "Changes against HEAD",
  "viewer.diff.none": "No changes against HEAD",
  "viewer.diff.truncated": "Long diff \u2014 showing the head",
  "viewer.diff.notFound": "Couldn't read the changes for this path",
  "viewer.log.tab": "History",
  "viewer.log.more": "Load more",
  "viewer.log.end": "Beginning of history",
  "viewer.log.notFound": "Couldn't read the history",
  "viewer.log.branch": "Branch",
  "viewer.log.search": "Search commit messages",
  "viewer.log.noMatch": "No matching commits",
  "activity.plan.more": "+{n} more",
  "plan.card.title": "Todo list",
  "plan.card.itemsUnavailable": "No item detail in this record",
  "trace.card.title": "Operation trace",
  "trace.card.steps": "{n} steps",
  "trace.card.files": "{n} files",
  "repo.card.title": "Repository",
  "repo.card.clean": "Working tree clean",
  "repo.card.dirty": "{n} changes",
  "repo.card.detached": "Detached HEAD",
  "repo.card.unborn": "No commits yet",
  "repo.card.upstream": "Upstream {name}",
  "repo.card.upstreamGone": "Upstream {name} is gone",
  "repo.card.gone": "gone",
  "repo.card.ahead": "{n} ahead",
  "repo.card.behind": "{n} behind",
  "repo.card.conflicts": "{n} conflicts",
  "repo.card.more": "{n} more",
  "repo.card.scope": "Workspace at {prefix}",
  "repo.card.recent": "Recent commits",
  "repo.card.all": "All",
  "repo.card.unpushed": "Not pushed",
  "repo.card.inProgress.merge": "Merge in progress",
  "repo.card.inProgress.rebase": "Rebase in progress",
  "repo.card.inProgress.cherryPick": "Cherry-pick in progress",
  "repo.card.inProgress.revert": "Revert in progress",
  "repo.card.inProgress.bisect": "Bisect in progress",
  "repo.card.status.modified": "Modified",
  "repo.card.status.added": "Added",
  "repo.card.status.deleted": "Deleted",
  "repo.card.status.renamed": "Renamed",
  "repo.card.status.untracked": "Untracked",
  "repo.card.status.conflict": "Conflict",
  "repo.card.status.other": "Changed",
  "activity.result.detail": "result detail",
  "evidence.output": "output",
  "evidence.excerpt": "excerpt",
  "evidence.attachment": "attachment",
  "evidence.attachment.clipped": "(head only \u2014 the file continues)",
  "evidence.outline": "outline \xB7 {n} entries",
  "evidence.outline.shown": "(first {n})",
  "evidence.matches": "matches",
  "evidence.matches.omitted": "({n} more not listed)",
  "evidence.digest": "digest of {source} (model-generated, {n} chunks \u2014 per-chunk entries in {path})",
  "evidence.findings": "findings",
  "evidence.hint": "hint",
  "evidence.files": "changed files",
  "evidence.risks": "risks",
  "evidence.todos": "to do",
  "evidence.evidence": "findings",
  "evidence.error": "error",
  "activity.detail.show": "show detail",
  "activity.detail.hide": "hide detail",
  "workspace.codeChip": "code",
  "workspace.diffExpand": "Expand diff \xB7 {n} lines (+{add} \u2212{del})",
  "workspace.diffCollapse": "Collapse",
  "device.aria": "Agent device",
  // The drag affordance's own label. Terse (owner 2026-08-27) — its context
  // comes from the enclosing card, labelled "Coprocessor: {state}", and from
  // the device image's own alt text above.
  "device.dragHint": "Drag upward",
  "device.ariaLabel": "Coprocessor: {state}",
  "record.chip.coprocessor": "Coprocessor",
  "record.chip.system": "System",
  "record.marker.completed": "Done",
  "record.marker.blocked": "Blocked",
  "record.marker.failed": "Failed",
  "record.marker.interrupted": "Stopped",
  "record.marker.partial": "Partial",
  "record.marker.file": "{n} file",
  "record.marker.files": "{n} files",
  "record.marker.tests": "tests {passed}/{total}",
  "record.marker.testsFailed": "tests {passed} passed, {failed} failed",
  "record.marker.risk": "{n} risk",
  "record.marker.risks": "{n} risks",
  "record.marker.aborted": "run aborted",
  "record.marker.commit": "committed {sha}",
  "record.marker.pushed": "pushed {ref}",
  "record.marker.noop": "No output",
  "card.workspace": "Workspace",
  "card.workspaceDefault": "Workspace \xB7 default",
  "card.setWorkspace": "Set workspace\u2026",
  "card.resetDefault": "Reset to default",
  "card.workspaceSetError": "could not set workspace",
  "card.rules": "Remembered commands",
  "card.rulesEmpty": "No commands remembered",
  "card.rulesRemove": "Remove rule {rule}",
  "card.deviceInfoAria": "device card info",
  "card.deviceInfo": "The device card represents Brick (the differential coprocessor) \u2014 Herta's coding execution backend. The ring color and breathing rate reflect the backend's current state (idle, reading, writing, running, waiting for approval, etc.).",
  "time.justNow": "just now",
  "time.minAgo": "{n} min ago",
  "app.cantStart": "Herta couldn't start",
  "app.cantStartBody": "Restart the app. If this keeps happening, check the logs. (Your DeepSeek key is set in Settings \u2192 DeepSeek \u2014 a missing key no longer blocks startup.)",
  "app.bridgeUnavailable": "The desktop bridge ({bridge}) is unavailable \u2014 the preload script failed to load.",
  "app.bridgeUnavailableBody": "Restart the app. If this persists, the preload build output or its path in the main process is misconfigured.",
  "app.crashTitle": "Interface error",
  "app.crashBody": "Your session record is safe \u2014 reload the interface to continue.",
  "app.crashReload": "Reload",
  "conversation.rowError": "This entry failed to render and was skipped."
};

// ../tools/_herta-src/packages/gui/src/renderer/i18n/messages/zh.ts
var zh = {
  "nav.voice": "\u8BED\u97F3",
  "nav.dream": "\u5165\u68A6",
  "nav.deepseek": "DeepSeek",
  "nav.coprocessor": "\u5DEE\u5206\u534F\u5904\u7406\u5668",
  "nav.language": "\u8BED\u8A00",
  "nav.window": "\u7A97\u53E3",
  "nav.update": "\u66F4\u65B0",
  "update.intro": "\u7A7A\u95F4\u7AD9\u56FA\u4EF6\u7684\u63A5\u6536\u4E0E\u5B89\u88C5\u3002\u65B0\u7248\u672C\u4F1A\u5728\u540E\u53F0\u4E0B\u8F7D\uFF0C\u9000\u51FA\u65F6\u81EA\u52A8\u5B89\u88C5\u3002",
  "update.betaLead": "Beta \u6D4B\u8BD5\u7248\uFF1A",
  "update.betaNotice": "\u76EE\u524D\u4ECD\u5904\u4E8E\u6D4B\u8BD5\u9636\u6BB5\uFF0C\u7248\u672C\u4E4B\u95F4\u53EF\u80FD\u51FA\u73B0\u7834\u574F\u6027\u6539\u52A8\uFF0C\u66F4\u65B0\u540E\u5386\u53F2\u4F1A\u8BDD\u6216\u8BBE\u7F6E\u672A\u5FC5\u80FD\u5B8C\u6574\u4FDD\u7559\u3002",
  "update.auto": "\u81EA\u52A8\u66F4\u65B0",
  "update.autoDesc": "\u5173\u95ED\u540E\u5C06\u4E0D\u518D\u81EA\u52A8\u68C0\u67E5\u4E0E\u4E0B\u8F7D\u66F4\u65B0\uFF0C\u4EC5\u5728\u624B\u52A8\u68C0\u67E5\u65F6\u8FDB\u884C\u3002",
  "update.currentVersion": "\u5F53\u524D\u7248\u672C",
  "update.checkNow": "\u68C0\u67E5\u66F4\u65B0",
  "update.restartNow": "\u91CD\u542F\u5E76\u66F4\u65B0",
  "update.checking": "\u6B63\u5728\u68C0\u67E5\u2026",
  "update.available": "\u53D1\u73B0\u65B0\u7248\u672C",
  "update.downloading": "\u6B63\u5728\u4E0B\u8F7D",
  "update.ready": "\u5DF2\u5C31\u7EEA\uFF0C\u9000\u51FA\u65F6\u5B89\u88C5\uFF1A",
  "update.error": "\u68C0\u67E5\u5931\u8D25",
  "update.unreachable": "\u65E0\u6CD5\u8FDE\u63A5\u66F4\u65B0\u670D\u52A1\u5668\uFF08GitHub\uFF09\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216 VPN\uFF1B\u4E5F\u53EF\u4ECE\u767E\u5EA6\u7F51\u76D8\u4E0B\u8F7D\u6700\u65B0\u7248\u672C\u3002",
  "update.netdisk": "\u6253\u5F00\u767E\u5EA6\u7F51\u76D8",
  "update.upToDate": "\u5DF2\u662F\u6700\u65B0",
  "update.notChecked": "\u5C1A\u672A\u68C0\u67E5\u66F4\u65B0",
  "update.unsupported": "\u6B64\u73AF\u5883\u4E0D\u652F\u6301\u66F4\u65B0",
  "nav.group.general": "\u901A\u7528",
  "nav.group.herta": "\u9ED1\u5854",
  "nav.group.engine": "\u5F15\u64CE",
  "window.intro": "\u7A97\u53E3\u7684\u5916\u89C2\u4E0E\u5F00\u5408\u884C\u4E3A\u3002",
  "window.theme": "\u5916\u89C2",
  "window.themeDesc": "\u754C\u9762\u7684\u660E\u6697\u4E3B\u9898\uFF1B\u8DDF\u968F\u7CFB\u7EDF\u65F6\u968F\u64CD\u4F5C\u7CFB\u7EDF\u81EA\u52A8\u5207\u6362\u3002",
  "theme.light": "\u6D45\u8272",
  "theme.dark": "\u6DF1\u8272",
  "theme.system": "\u8DDF\u968F\u7CFB\u7EDF",
  "window.closeToTray": "\u5173\u95ED\u65F6\u6536\u8FDB\u6258\u76D8",
  "window.closeToTrayDesc": "\u5173\u95ED\u7A97\u53E3\u65F6\u6536\u8FDB\u7CFB\u7EDF\u6258\u76D8\u7EE7\u7EED\u8FD0\u884C\uFF1B\u5173\u6389\u6B64\u9879\u540E\uFF0C\u5173\u95ED\u5373\u9000\u51FA\u3002",
  "window.minimize": "\u6700\u5C0F\u5316",
  "window.maximize": "\u6700\u5927\u5316",
  "window.restore": "\u8FD8\u539F",
  "window.closeBtn": "\u5173\u95ED",
  "settings.eyebrow": "\u8BBE\u7F6E",
  "settings.closeAria": "\u5173\u95ED\u8BBE\u7F6E",
  "settings.sectionsAria": "\u8BBE\u7F6E\u5206\u533A",
  "settings.dialogAria": "\u8BBE\u7F6E",
  "settings.loadFailed": "\u8BBE\u7F6E\u8BFB\u53D6\u5931\u8D25\u2014\u2014\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u4EE5\u91CD\u8BD5",
  "language.rowLabel": "\u754C\u9762\u8BED\u8A00",
  "language.intro": "\u9ED1\u5854\u672C\u4EBA\u7684\u8BF4\u8BDD\u65B9\u5F0F\u4E0D\u53D7\u5F71\u54CD\u3002",
  "language.interactionRowLabel": "\u5BF9\u8BDD\u8BED\u8A00",
  "language.interactionDesc": "\u9ED1\u5854\u4E0E\u4F60\u4EA4\u8C08\u6240\u7528\u7684\u8BED\u8A00\u3002\u4EC5\u5BF9\u65B0\u4F1A\u8BDD\u751F\u6548\uFF1B\u672C\u7248\u672C\u4E2D\uFF0C\u82F1\u6587\u4F1A\u8BDD\u6CA1\u6709\u8BED\u97F3\u3002",
  "language.follow": "\u8DDF\u968F\u754C\u9762\u8BED\u8A00",
  "topbar.toggleSidebar": "\u5207\u6362\u4FA7\u680F",
  "topbar.search": "\u641C\u7D22\u4F1A\u8BDD",
  "topbar.newSession": "\u65B0\u5EFA\u4F1A\u8BDD",
  "topbar.resolveApprovalFirst": "\u5148\u5904\u7406\u5F85\u6279\u51C6\u8BF7\u6C42",
  "topbar.settings": "\u8BBE\u7F6E",
  "session.untitled": "\u672A\u547D\u540D",
  "session.searchPlaceholder": "\u641C\u7D22\u4F1A\u8BDD",
  "session.filterAria": "\u6309\u6807\u9898\u7B5B\u9009\u4F1A\u8BDD",
  "session.noMatches": "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD",
  "session.searching": "\u6B63\u5728\u68C0\u7D22\u4F1A\u8BDD\u8BB0\u5F55\u2026",
  "session.searchUnavailable": "\uFF08\u5185\u5BB9\u68C0\u7D22\u4E0D\u53EF\u7528\uFF0C\u4EC5\u6309\u6807\u9898\u5339\u914D\uFF09",
  "session.pendingApproval": "\u5F85\u6279\u51C6",
  "session.confirmDelete": "\u786E\u8BA4\u5220\u9664",
  "session.deleteAria": "\u5220\u9664\u4F1A\u8BDD",
  "session.openFailed": "\u5B58\u6863\u635F\u574F",
  "session.switchInterrupts": "\u5C06\u4E2D\u65AD\u5F53\u524D\u56DE\u590D\uFF0C\u518D\u6B21\u70B9\u51FB\u786E\u8BA4",
  "session.group.today": "\u4ECA\u5929",
  "session.group.yesterday": "\u6628\u5929",
  "session.group.previous7Days": "\u524D 7 \u5929",
  "session.group.older": "\u66F4\u65E9",
  "voice.realtime": "\u5B9E\u65F6\u8BED\u97F3",
  "voice.realtimeDesc": "\u5F00\u542F\u7EC8\u7AEF\u9EA6\u514B\u98CE\u3002",
  "voice.realtimeMissing": "\u672C\u6B21\u5B89\u88C5\u7F3A\u5C11\u8BED\u97F3\u8FD0\u884C\u65F6\uFF0C\u5979\u6682\u65F6\u53EA\u80FD\u6253\u5B57\u3002",
  "voice.realtimeFailed": "\u8BED\u97F3\u8FDB\u7A0B\u53CD\u590D\u5931\u8D25\uFF0C\u672C\u6B21\u8FD0\u884C\u5185\u5DF2\u505C\u7528\uFF1B\u91CD\u542F\u540E\u91CD\u8BD5\u3002",
  "voice.model": "\u8BED\u97F3\u6A21\u578B",
  "voice.modelAbsent": "\u7EA6 {size} MB\uFF0C\u4E0B\u8F7D\u5230\u672C\u673A\u540E\u53EF\u7528\u3002",
  "voice.modelDev": "\u6B63\u5728\u4F7F\u7528\u5DE5\u4F5C\u533A data/tts \u4E2D\u7684\u6A21\u578B\u3002",
  "voice.modelDownload": "\u4E0B\u8F7D",
  "voice.modelDownloading": "\u5DF2\u4E0B\u8F7D {received} / {total} MB",
  "voice.modelCancel": "\u53D6\u6D88",
  "voice.modelReady": "\u5DF2\u5B89\u88C5\uFF0C\u5360\u7528\u7EA6 {size} MB\u3002",
  "voice.modelRemove": "\u5220\u9664",
  "voice.modelRetry": "\u91CD\u8BD5",
  "voice.modelFailed.network": "\u65E0\u6CD5\u8FDE\u63A5 GitHub \u4E0B\u8F7D\u6A21\u578B\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216 VPN \u540E\u91CD\u8BD5\u3002",
  "voice.modelFailed.http": "\u670D\u52A1\u5668\u6CA1\u6709\u7ED9\u51FA\u6A21\u578B\u6587\u4EF6\u3002",
  "voice.modelFailed.size": "\u4E0B\u8F7D\u7684\u6587\u4EF6\u5927\u5C0F\u4E0D\u5BF9\uFF0C\u5DF2\u4E22\u5F03\u3002",
  "voice.modelFailed.hash": "\u4E0B\u8F7D\u7684\u6587\u4EF6\u6821\u9A8C\u5931\u8D25\uFF0C\u5DF2\u4E22\u5F03\u3002",
  "voice.modelFailed.archive": "\u6A21\u578B\u538B\u7F29\u5305\u65E0\u6CD5\u89E3\u5F00\uFF0C\u5DF2\u4E22\u5F03\u3002",
  "voice.modelFailed.verify": "\u6A21\u578B\u6587\u4EF6\u6821\u9A8C\u5931\u8D25\uFF0C\u5DF2\u4E22\u5F03\u3002",
  "voice.modelFailed.disk": "\u5199\u5165\u672C\u673A\u5931\u8D25\uFF0C\u68C0\u67E5\u78C1\u76D8\u7A7A\u95F4\u3002",
  "voice.modelFailed.cancelled": "\u5DF2\u53D6\u6D88\u3002",
  "voice.engine": "\u8BED\u97F3\u5F15\u64CE",
  "voice.engineDesc": "\u4F7F\u7528\u4E0B\u8F7D\u7684\u672C\u5730\u6A21\u578B\u6216\u6548\u679C\u66F4\u597D\u7684\u4E91\u7AEF\u6A21\u578B\u3002",
  "voice.engine.local": "\u672C\u5730\u6A21\u578B",
  "voice.engine.minimax": "MiniMax \u4E91\u7AEF",
  "voice.minimaxKey": "MiniMax API \u5BC6\u94A5",
  "voice.minimaxKeyDesc": "\u6309\u91CF\u8BA1\u8D39\u3002\u7528\u4E8E\u751F\u6210\u97F3\u8272 ID\uFF1B\u672A\u914D\u7F6E\u5957\u9910\u5BC6\u94A5\u65F6\u4E5F\u7528\u4E8E\u8BED\u97F3\u5408\u6210\u3002\u53EF\u5728 platform.minimaxi.com \u83B7\u53D6\u3002",
  "voice.minimaxKeyAria": "MiniMax API \u5BC6\u94A5",
  "voice.keyDelete": "\u5220\u9664",
  "voice.minimaxHelpAria": "\u5BC6\u94A5\u8BF4\u660E",
  "voice.minimaxHelp": "\u4E91\u7AEF\u8BED\u97F3\u9700\u8981\u914D\u7F6E API \u5BC6\u94A5\uFF0C\u5206\u4E3A\u97F3\u8272 ID \u751F\u6210\u4E0E\u8BED\u97F3\u5408\u6210\u4E24\u90E8\u5206\u3002\u97F3\u8272 ID \u4EC5\u80FD\u7531 MiniMax API \u5BC6\u94A5\u751F\u6210\uFF08\u6309\u91CF\u8BA1\u8D39\uFF0C\u53EA\u9700\u751F\u6210\u4E00\u6B21\uFF09\uFF1B\u8BED\u97F3\u5408\u6210\u4F18\u5148\u4F7F\u7528 Token Plan \u5BC6\u94A5\uFF08\u5957\u9910\u5185\u514D\u8D39\u5408\u6210\uFF09\uFF0C\u672A\u914D\u7F6E\u65F6\u4F7F\u7528 API \u5BC6\u94A5\u3002",
  "voice.minimaxKeyRejected": "\u5BC6\u94A5\u65E0\u6548",
  "voice.minimaxKeyQuota": "\u4F59\u989D\u4E0D\u8DB3",
  "voice.minimaxKeyUnchecked": "\u672A\u6838\u5BF9",
  "voice.speechRefused.quota": "\u8D26\u6237\u4F59\u989D\u4E0D\u8DB3\uFF0C\u5145\u503C\u524D\u56DE\u590D\u4E0D\u53D1\u58F0\u3002",
  "voice.speechRefused.auth": "MiniMax \u62D2\u7EDD\u4E86\u8FD9\u4E2A\u5BC6\u94A5\uFF0C\u4FEE\u6B63\u524D\u56DE\u590D\u4E0D\u53D1\u58F0\u3002",
  "voice.speechRefused.invalid_key": "MiniMax \u4E0D\u63A5\u53D7\u8FD9\u4E2A\u5BC6\u94A5\uFF0C\u4FEE\u6B63\u524D\u56DE\u590D\u4E0D\u53D1\u58F0\u3002",
  "voice.minimaxPlanKey": "Token Plan \u5BC6\u94A5",
  "voice.minimaxPlanKeyDesc": "\u53EF\u9009\u3002\u8BA2\u9605 Token Plan \u5957\u9910\u540E\u7528\u4E8E\u8BED\u97F3\u5408\u6210\u3002",
  "voice.minimaxPlanKeyAria": "MiniMax Token Plan \u5BC6\u94A5",
  "voice.minimaxRejected": "MiniMax \u4E0D\u63A5\u53D7\u8FD9\u4E2A\u5BC6\u94A5\uFF0C\u68C0\u67E5\u540E\u518D\u8BD5\u3002",
  "voice.clonePreparing": "\u6B63\u5728\u51C6\u5907\u5979\u7684\u58F0\u97F3\u2026",
  "voice.cloneRetry": "\u91CD\u8BD5",
  "voice.cloneFailed.no_key": "\u5148\u586B\u5165 MiniMax \u5BC6\u94A5\u3002",
  "voice.cloneFailed.no_clone_key": "\u751F\u6210\u97F3\u8272 ID \u9700\u8981 MiniMax API \u5BC6\u94A5\uFF08\u6309\u91CF\u8BA1\u8D39\uFF09\uFF0C\u586B\u5165\u540E\u91CD\u8BD5\u3002",
  "voice.cloneFailed.invalid_key": "MiniMax \u4E0D\u63A5\u53D7\u8FD9\u4E2A\u5BC6\u94A5\u3002",
  "voice.cloneFailed.auth": "MiniMax \u62D2\u7EDD\u4E86\u8FD9\u6B21\u8BF7\u6C42\uFF0C\u68C0\u67E5\u5BC6\u94A5\u548C\u8D26\u6237\u3002",
  "voice.cloneFailed.rate": "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
  "voice.cloneFailed.quota": "\u8D26\u6237\u4F59\u989D\u4E0D\u8DB3\u3002",
  "voice.cloneFailed.sensitive": "\u53C2\u8003\u5F55\u97F3\u672A\u901A\u8FC7\u5E73\u53F0\u7684\u5185\u5BB9\u5BA1\u6838\u3002",
  "voice.cloneFailed.voice_missing": "\u5E73\u53F0\u4E0A\u7684\u58F0\u97F3\u5DF2\u5931\u6548\u3002",
  "voice.cloneFailed.invalid": "\u5E73\u53F0\u4E0D\u63A5\u53D7\u8FD9\u6B21\u8BF7\u6C42\u7684\u53C2\u6570\u3002",
  "voice.cloneFailed.network": "\u8FDE\u4E0D\u4E0A MiniMax\uFF0C\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002",
  "voice.cloneFailed.http": "MiniMax \u8FD4\u56DE\u4E86\u610F\u5916\u7684\u54CD\u5E94\u3002",
  "voice.cloneFailed.cancelled": "\u5DF2\u53D6\u6D88\u3002",
  "voice.cloneFailed.other": "\u514B\u9686\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
  "voice.cloneFailed.reference": "\u672C\u6B21\u5B89\u88C5\u7F3A\u5C11\u53C2\u8003\u5F55\u97F3\u3002",
  "voice.mute": "\u9759\u97F3",
  "voice.muteDesc": "\u5173\u95ED\u9ED1\u5854\u7684\u5168\u90E8\u8BED\u97F3\u3002",
  "voice.volume": "\u97F3\u91CF",
  "voice.volumeDesc": "\u8C03\u6574\u9ED1\u5854\u8BED\u97F3\u7684\u54CD\u5EA6\u3002",
  "dream.enable": "\u5F00\u542F\u5165\u68A6",
  "dream.enableDesc": "\u4F60\u79BB\u5F00\u65F6\u8BA9\u9ED1\u5854\u5165\u68A6\u3002",
  "dream.intro": "\u5165\u68A6\u662F\u9ED1\u5854\u7684\u4F11\u606F\u65F6\u95F4\u3002\u4F60\u79BB\u5F00\u65F6\uFF0C\u5979\u4F1A\u56DE\u987E\u8FC7\u5F80\u7684\u4F1A\u8BDD\uFF0C\u628A\u90A3\u4E9B\u503C\u5F97\u8BB0\u4F4F\u7684\u7247\u523B\u5199\u4E0B\u6765\u2014\u2014\u76F8\u5904\u8D8A\u4E45\uFF0C\u5C31\u8D8A\u4E86\u89E3\u4F60\u3002",
  // Punctuation rule (owner 2026-08-27): a single-clause LABEL or status
  // carries no terminal 。 — only prose that explains or instructs keeps one.
  // So "保存失败，请重试。" (two clauses) keeps its period and "重启后生效"
  // does not.
  "common.couldntSave": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "common.restartToApply": "\u91CD\u542F\u540E\u751F\u6548",
  "deepseek.intro": "API \u5BC6\u94A5\u4EE5\u52A0\u5BC6\u5F62\u5F0F\u5B58\u50A8\u5728\u672C\u673A\u3002\u53EF\u5728 platform.deepseek.com \u83B7\u53D6\u3002",
  "deepseek.checking": "\u68C0\u67E5\u4E2D\u2026",
  "deepseek.statusFailed": "\u5BC6\u94A5\u72B6\u6001\u8BFB\u53D6\u5931\u8D25",
  "deepseek.connected": "\u5DF2\u8FDE\u63A5",
  "deepseek.noKey": "\u672A\u8BBE\u7F6E\u5BC6\u94A5",
  "deepseek.replaceKey": "\u66F4\u6362\u5BC6\u94A5\u2026",
  "deepseek.keyAria": "DeepSeek API \u5BC6\u94A5",
  "deepseek.save": "\u4FDD\u5B58",
  "deepseek.verifying": "\u9A8C\u8BC1\u4E2D\u2026",
  "deepseek.deleteKey": "\u5220\u9664\u5BC6\u94A5",
  "deepseek.deleting": "\u5220\u9664\u4E2D\u2026",
  "deepseek.rejected": "DeepSeek \u62D2\u7EDD\u4E86\u8BE5\u5BC6\u94A5\u2014\u2014\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5\u3002",
  "deepseek.busy": "\u8BF7\u5148\u7ED3\u675F\u5F53\u524D\u56DE\u5408",
  "deepseek.unverified": "\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u65E0\u6CD5\u8FDE\u63A5 DeepSeek \u9A8C\u8BC1\u2014\u2014\u82E5\u9ED1\u5854\u6CA1\u6709\u56DE\u5E94\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3002",
  "deepseek.unencrypted": "\u5DF2\u660E\u6587\u5B58\u50A8\u2014\u2014\u6B64\u8BBE\u5907\u6CA1\u6709\u53EF\u7528\u7684\u5B89\u5168\u5BC6\u94A5\u94FE\u3002",
  // Per-stage model choice (2026-08-17, owner: API prices rose). Restart-to-
  // apply. Since the 2026-09 API (`deepseek-flash` = V4.1 Flash, which reads
  // images; V4 Pro retires 2026-09-14) both rows offer the same two names —
  // the 板砖-only "Flash 视觉版" row is gone (ADR 0048 §5b).
  "deepseek.models.intro": "\u6A21\u578B\u9009\u62E9\uFF1AFlash \u66F4\u5FEB\u3001\u66F4\u7701\uFF0C\u80FD\u76F4\u63A5\u770B\u56FE\u7247\uFF1BPro \u6210\u672C\u8F83\u9AD8\u3002\u6539\u52A8\u91CD\u542F\u540E\u751F\u6548\u3002",
  "deepseek.model.actor": "\u5BF9\u8BDD\u6A21\u578B",
  "deepseek.model.actorDesc": "\u4E0E\u9ED1\u5854\u4EA4\u6D41\u65F6\u4F7F\u7528\u7684\u6A21\u578B\u3002",
  "deepseek.model.backend": "\u534F\u5904\u7406\u5668\u6A21\u578B",
  "deepseek.model.backendDesc": "\u677F\u7816\u6267\u884C\u4EFB\u52A1\u65F6\u4F7F\u7528\u7684\u6A21\u578B\u3002",
  "deepseek.model.pro": "Pro",
  "deepseek.model.flash": "Flash",
  "keyprompt.title": "\u5C06\u9ED1\u5854\u63A5\u5165 DeepSeek",
  "keyprompt.body": "\u9ED1\u5854\u9700\u8981\u4E00\u4E2A DeepSeek API \u5BC6\u94A5\u624D\u80FD\u601D\u8003\u3002\u5B83\u5B58\u653E\u5728\u672C\u673A\u7684\u7CFB\u7EDF\u5BC6\u94A5\u94FE\u91CC\uFF0C\u9664\u4E86\u8C03\u7528 DeepSeek \u7EDD\u4E0D\u5916\u4F20\u3002",
  "keyprompt.where": "\u5728 platform.deepseek.com \u83B7\u53D6\u5BC6\u94A5",
  "keyprompt.notNow": "\u6682\u4E0D",
  "keyprompt.saveSend": "\u4FDD\u5B58\u5E76\u53D1\u9001",
  "keyprompt.saveFail": "\u4FDD\u5B58\u5BC6\u94A5\u5931\u8D25\u2014\u2014\u8BF7\u91CD\u8BD5\u3002",
  "device.state.idle": "\u7A7A\u95F2",
  "device.state.working": "\u5904\u7406\u4E2D",
  "device.state.reading": "\u8BFB\u53D6\u4E2D",
  "device.state.writing": "\u5199\u5165\u4E2D",
  "device.state.runningCommand": "\u6267\u884C\u547D\u4EE4\u4E2D",
  "device.state.verifying": "\u9A8C\u8BC1\u4E2D",
  "device.state.awaitingApproval": "\u7B49\u5F85\u6279\u51C6",
  "device.state.done": "\u5B8C\u6210",
  "device.state.error": "\u51FA\u9519",
  "banzhuan.legend.idle": "\u7A7A\u95F2\u2014\u2014\u6CA1\u6709\u6D3E\u6D3B",
  "banzhuan.legend.delegated": "\u677F\u7816\u6B63\u5728\u5904\u7406\u4F60\u7684\u4EFB\u52A1",
  "banzhuan.legend.waitingApproval": "\u5B83\u9700\u8981\u4F60\u6279\u51C6\u624D\u80FD\u7EE7\u7EED",
  "banzhuan.legend.succeeded": "\u5E72\u51C0\u6536\u5DE5\u2014\u2014\u4EAE\u8D77\u7EFF\u706F",
  "banzhuan.legend.failed": "\u4EFB\u52A1\u51FA\u9519\u4E86",
  "banzhuan.intro": "\u677F\u7816\u66FF\u6211\u5904\u7406\u4EE3\u7801\u7684\u6D3B\u3002\u6D3E\u6D3B\u8981\u5199\u5168 @\u677F\u7816\uFF0C\u90A3\u4E2A @ \u624D\u662F\u771F\u6B63\u7684\u89E6\u53D1\u7B26\u3002\u6B63\u9762\u90A3\u5708\u5149\u6807\u7740\u5B83\u6B64\u523B\u5728\u5E72\u4EC0\u4E48\uFF1A",
  "banzhuan.thinking": "\u601D\u8003\u5F3A\u5EA6",
  "banzhuan.thinkingDesc": "\u677F\u7816\u5E72\u6D3B\u65F6\u7684\u601D\u8003\u5F3A\u5EA6\uFF0C\u4E0B\u6B21\u542F\u52A8\u751F\u6548\u3002",
  "banzhuan.thinking.low": "\u4F4E",
  "banzhuan.thinking.high": "\u9AD8",
  "banzhuan.thinking.max": "\u6700\u9AD8",
  // Tool contract (ADR 0040, 2026-08-17). Owner register: what it is, the
  // one trade-off, apply semantics; the no-bash sentence only when detected.
  "banzhuan.contract": "\u5DE5\u5177\u5951\u7EA6",
  "banzhuan.contractDesc": "\u677F\u7816\u4F7F\u7528\u7684\u5DE5\u5177\u7EC4\u5408\u3002\u6807\u51C6\uFF1A\u4E00\u5957\u4E13\u7528\u5DE5\u5177\u96C6\uFF1B\u6781\u7B80\uFF1A\u7CBE\u7B80\u5DE5\u5177\u7EC4\uFF0C\u5927\u5E45\u964D\u4F4E\u6267\u884C\u6210\u672C\uFF0C\u9700\u8981\u672C\u673A\u5DF2\u5B89\u88C5 bash\u3002\u4E0B\u6B21\u542F\u52A8\u751F\u6548\u3002",
  "banzhuan.contract.noBash": "\u672C\u673A\u672A\u68C0\u6D4B\u5230 bash\uFF0C\u9009\u6781\u7B80\u4E5F\u4F1A\u6309\u6807\u51C6\u8FD0\u884C\uFF1B\u88C5\u4E0A Git for Windows \u540E\u91CD\u542F\u5373\u53EF\u7528\u3002",
  "banzhuan.contract.standard": "\u6807\u51C6",
  "banzhuan.contract.minimal": "\u6781\u7B80",
  // 3D device card (ADR 0057). Same register as the rows above: what it is,
  // the one trade-off, apply semantics.
  "banzhuan.scene": "\u7ACB\u4F53\u677F\u7816",
  "banzhuan.sceneDesc": "\u7ACB\u4F53\u5B9E\u7269\u6E32\u67D3\uFF0C\u5173\u95ED\u5219\u663E\u793A\u5E73\u9762\u56FE\u3002",
  "approval.title": "\u8BF7\u6C42\u6743\u9650",
  "approval.allow": "\u540C\u610F",
  "approval.alwaysAllow": "\u4EFB\u52A1\u5185\u540C\u610F",
  "approval.allowProject": "\u672C\u9879\u76EE\u5141\u8BB8",
  "approval.projectRuleNote": "\u300C\u672C\u9879\u76EE\u5141\u8BB8\u300D\u4F1A\u8BB0\u4F4F\uFF1A{rule}",
  "approval.deny": "\u62D2\u7EDD",
  "approval.risk.read": "\u8BFB\u53D6\u5DE5\u4F5C\u533A",
  "approval.risk.write": "\u5199\u5165\u5DE5\u4F5C\u533A",
  "approval.risk.destructive": "\u7834\u574F\u6027\u64CD\u4F5C",
  "approval.risk.network": "\u7F51\u7EDC\u8BBF\u95EE",
  "approval.reason.commandUnknown": "\u672A\u8BC6\u522B\u7684\u547D\u4EE4\uFF0C\u8BF7\u4ED4\u7EC6\u6838\u5BF9",
  "approval.reason.commandInterpreter": "\u89E3\u91CA\u5668\u6267\u884C\u811A\u672C\uFF0C\u8BF7\u6838\u5BF9\u811A\u672C\u4E0E\u53C2\u6570",
  "approval.reason.commandDestructive": "\u7834\u574F\u6027\u547D\u4EE4\uFF0C\u8BF7\u786E\u8BA4\u540E\u653E\u884C",
  "approval.reason.commandNetwork": "\u8BE5\u547D\u4EE4\u4F1A\u8BBF\u95EE\u7F51\u7EDC",
  "approval.reason.commandWrite": "\u8BE5\u547D\u4EE4\u4F1A\u5199\u5165\u6587\u4EF6",
  "approval.reason.commandReaderPath": "\u8BFB\u53D6\u654F\u611F\u6216\u5DE5\u4F5C\u533A\u5916\u7684\u8DEF\u5F84",
  "approval.reason.commandRecursiveRead": "\u9012\u5F52\u8BFB\u53D6\u4F1A\u7ED5\u8FC7\u51ED\u636E\u4FDD\u62A4",
  "approval.reason.commandVcs": "\u8BE5 git \u547D\u4EE4\u4F1A\u6539\u52A8\u4ED3\u5E93\u6216\u5DE5\u4F5C\u533A",
  "approval.reason.commandFs": "\u6587\u4EF6\u7CFB\u7EDF\u64CD\u4F5C\uFF08\u65B0\u5EFA / \u590D\u5236 / \u79FB\u52A8\uFF09\uFF0C\u8BF7\u6838\u5BF9\u8DEF\u5F84",
  "approval.reason.commandDelete": "\u8BE5\u547D\u4EE4\u4F1A\u5220\u9664\u6587\u4EF6\uFF0C\u8BF7\u6838\u5BF9\u8DEF\u5F84",
  "approval.reason.commandProcess": "\u8BE5\u547D\u4EE4\u4F1A\u7ED3\u675F\u8FDB\u7A0B\uFF0C\u8BF7\u6838\u5BF9\u76EE\u6807",
  "approval.reason.commandCwdEscape": "\u8BE5\u547D\u4EE4\u4F1A\u5207\u5230\u5DE5\u4F5C\u533A\u4E4B\u5916\uFF0C\u4E4B\u540E\u7684\u76F8\u5BF9\u8DEF\u5F84\u4E0D\u53D7\u5DE5\u4F5C\u533A\u4FDD\u62A4",
  "approval.reason.commandUnresolved": "\u8FD9\u6761\u547D\u4EE4\u6709\u672A\u89E3\u6790\u90E8\u5206",
  // A chained line with more than one ask class: the other classes, named.
  "approval.alsoClasses": "\u53E6\u542B\uFF1A{list}",
  // Consequence notes (ADR 0049 §5) — one sentence on what the command will
  // do to work that cannot be recovered. Display-only; the tier enforces.
  "approval.consequence.discardsUncommitted": "\u6CE8\u610F\uFF1A\u4F1A\u4E22\u5F03\u672A\u63D0\u4EA4\u7684\u6539\u52A8\uFF0C\u65E0\u6CD5\u627E\u56DE\u3002",
  "approval.consequence.deletesUntracked": "\u6CE8\u610F\uFF1A\u4F1A\u5220\u9664\u672A\u8DDF\u8E2A\u7684\u6587\u4EF6\uFF0C\u65E0\u6CD5\u627E\u56DE\u3002",
  "approval.consequence.deletesStash": "\u6CE8\u610F\uFF1A\u4F1A\u5220\u9664 stash \u91CC\u7684\u5DE5\u4F5C\uFF0C\u65E0\u6CD5\u627E\u56DE\u3002",
  "approval.consequence.rewritesLocalHistory": "\u6CE8\u610F\uFF1A\u4F1A\u6539\u5199\u672C\u5730\u63D0\u4EA4\u5386\u53F2\u3002",
  "approval.consequence.rewritesRemoteHistory": "\u6CE8\u610F\uFF1A\u4F1A\u8986\u76D6\u8FDC\u7AEF\u5206\u652F\u7684\u5386\u53F2\u3002",
  "approval.consequence.concludesInProgressOperation": "\u6CE8\u610F\uFF1A\u4ED3\u5E93\u6B63\u5728\u5408\u5E76/\u53D8\u57FA\u4E2D\u9014\uFF0C\u8FD9\u4E00\u6B65\u4F1A\u628A\u5B83\u6536\u5C3E\u3002",
  "app.fanNotice": "\u9ED1\u5854\u662F\u300A\u5D29\u574F\uFF1A\u661F\u7A79\u94C1\u9053\u300B\u7684\u89D2\u8272\uFF0C\u7248\u6743\u5F52\u7C73\u54C8\u6E38\u6240\u6709\u3002\u672C\u9879\u76EE\u4E3A\u975E\u5B98\u65B9\u540C\u4EBA\u4F5C\u54C1\uFF0C\u4E0E\u7C73\u54C8\u6E38\u65E0\u5173\uFF0C\u4EA6\u672A\u83B7\u5176\u8BA4\u53EF\u3002",
  "approval.diffShowAria": "\u5C55\u5F00\u5DEE\u5206\uFF1A{n} \u884C\u6539\u52A8\uFF0C\u65B0\u589E {add} \u884C\uFF0C\u5220\u9664 {del} \u884C",
  "approval.diffHideAria": "\u6536\u8D77\u5DEE\u5206",
  "approval.reason.writeNewFile": "\u65B0\u5EFA\u6587\u4EF6",
  "approval.reason.editFile": "\u4FEE\u6539\u73B0\u6709\u6587\u4EF6",
  "approval.reason.strReplaceEditor": "\u5199\u5165\u6587\u4EF6",
  // A heredoc body folded out of the command well (the content is in the
  // diff below) — 2026-08-17.
  "approval.heredocFolded": "    \u22EF \u5DF2\u6298\u53E0 {n} \u884C\uFF0C\u5185\u5BB9\u89C1\u4E0B\u65B9\u5DEE\u5F02 \u22EF",
  "composer.placeholder": "\u7ED9\u9ED1\u5854\u53D1\u6D88\u606F\u2026",
  "composer.aria": "\u6D88\u606F\u8F93\u5165\u6846",
  "composer.send": "\u53D1\u9001\u6D88\u606F",
  "composer.stop": "\u6253\u65AD\u5F53\u524D\u56DE\u5408",
  "composer.attach": "\u6DFB\u52A0\u6587\u6863",
  /** The tooltip's muted second line. Extensions, not kinds (owner
   *  2026-08-10): a reader scans `.md .txt .csv` faster than a sentence about
   *  categories. The trailing 等 keeps it honest — the sniff accepts any text
   *  file, so the list is representative, not exhaustive. `.pdf .docx` lead
   *  since ADR 0038: they are the two formats people actually hand over. */
  "composer.attach.formats": ".pdf .docx .md .txt .csv .json .log .py .ts \u7B49\u6587\u672C\u6587\u4EF6",
  // The composer-notice pill (owner 2026-08-27): terse, formal, and NO
  // trailing 。 — a pill is a label, not a sentence. Settings-row prose keeps
  // its periods; these do not.
  "composer.attach.busy": "\u56DE\u5408\u8FD8\u672A\u7ED3\u675F\uFF0C\u65E0\u6CD5\u6DFB\u52A0\u6587\u4EF6",
  "composer.attach.tooMany": "\u6700\u591A\u5341\u4E2A\u6587\u4EF6",
  "composer.attach.failed": "\u6587\u4EF6\u52A0\u8F7D\u5931\u8D25",
  "composer.attach.denied": "\u6D89\u53CA\u5BC6\u94A5\u6216\u51ED\u636E\uFF0C\u4E0A\u4F20\u5931\u8D25",
  // The staged strip (ADR 0048): pictures waiting to be sent WITH a message.
  "composer.staged": "\u5F85\u53D1\u9001\u7684\u56FE\u7247",
  "composer.staged.remove": "\u79FB\u9664",
  // Enter with staged pictures and no words (owner 2026-08-27): pictures
  // ride a message; an empty user block is not a message.
  "composer.attach.needText": "\u8BF4\u70B9\u4EC0\u4E48\u518D\u53D1",
  // The per-message picture cap (owner 2026-08-27): a message is a moment,
  // not an album.
  "composer.attach.imageLimit": "\u6700\u591A\u4E94\u5F20\u56FE",
  // Click-to-enlarge lightbox (ADR 0048 §4a). `lightbox.open` prefixes the
  // thumb button's aria-label, followed by the filename.
  "lightbox.open": "\u67E5\u770B\u56FE\u7247",
  "lightbox.close": "\u5173\u95ED",
  "lightbox.zoomIn": "\u653E\u5927",
  "lightbox.zoomOut": "\u7F29\u5C0F",
  // The pill's tooltip: a bare wheel scrolls, so the zoom gesture is said
  // here (owner 2026-08-28).
  "lightbox.zoomHint": "Ctrl + \u6EDA\u8F6E\u7F29\u653E\uFF0C\u6309\u4F4F\u62D6\u52A8\u53EF\u79FB\u52A8",
  "connect.button": "\u63A5\u5165\u9ED1\u5854\u7A7A\u95F4\u7AD9",
  "connect.failed": "\u4F1A\u8BDD\u5EFA\u7ACB\u5931\u8D25\u2014\u2014\u8BF7\u91CD\u8BD5",
  "workspace.rewind": "\u56DE\u5230\u6B64\u5904",
  "workspace.editsNotReverted": "\u6539\u52A8\u7684\u6587\u4EF6\u672A\u64A4\u9500",
  "workspace.rewindFailed": "\u64A4\u56DE\u5931\u8D25",
  "workspace.processing": "\u5904\u7406\u4E2D\u2026",
  "workspace.took": "\u7528\u65F6",
  "workspace.recapping": "\u7EC8\u7AEF\u6B63\u5728\u5F52\u6574\u5386\u53F2\u6D88\u606F\u2026",
  "workspace.turnFailed": "\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u8FD9\u6761\u56DE\u590D\u672A\u80FD\u9001\u8FBE\u2014\u2014\u8BF7\u91CD\u65B0\u53D1\u9001\u3002",
  "workspace.turnFailed401": "DeepSeek \u5BC6\u94A5\u65E0\u6548\u6216\u5DF2\u5931\u6548\u2014\u2014\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u66F4\u6362\u5BC6\u94A5\u3002",
  "workspace.turnFailed402": "DeepSeek \u8D26\u6237\u4F59\u989D\u4E0D\u8DB3\u2014\u2014\u8BF7\u5145\u503C\u540E\u91CD\u65B0\u53D1\u9001\u3002",
  "workspace.turnFailed429": "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u5DF2\u88AB DeepSeek \u9650\u6D41\u2014\u2014\u8BF7\u7A0D\u5019\u518D\u53D1\u9001\u3002",
  "workspace.turnFailed500": "DeepSeek \u670D\u52A1\u5668\u51FA\u9519\u2014\u2014\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "workspace.turnFailed503": "DeepSeek \u670D\u52A1\u5668\u7E41\u5FD9\u2014\u2014\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "workspace.turnFailedTls": "\u5230 DeepSeek \u7684\u52A0\u5BC6\u8FDE\u63A5\u88AB\u62D2\u7EDD\uFF0C\u901A\u5E38\u662F\u516C\u53F8\u4EE3\u7406\u6216 VPN \u62E6\u622A\u2014\u2014\u91CD\u53D1\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8BBE\u7F6E\u3002",
  "workspace.sending": "\u6D88\u606F\u6B63\u5728\u7A7F\u8D8A\u94F6\u6CB3",
  "workspace.gammaStorm": "\u6D88\u606F\u53D7\u5230\u4F3D\u9A6C\u98CE\u66B4\u5E72\u6270\u2026",
  "workspace.gammaStormLong": "\u5E72\u6270\u8FD8\u6CA1\u5E73\u606F\uFF0C\u6D88\u606F\u4ECD\u5728\u8DEF\u4E0A\u2026",
  "workspace.jumpToLatest": "\u56DE\u5230\u5E95\u90E8",
  "workspace.loadEarlier": "\u52A0\u8F7D\u66F4\u65E9\u7684 {n} \u6761\u8BB0\u5F55",
  "workspace.topicRailAria": "\u8BDD\u9898\u5BFC\u89C8",
  "activity.verb.reading": "\u8BFB\u53D6",
  "activity.verb.writing": "\u5199\u5165",
  "activity.verb.running": "\u8FD0\u884C",
  "activity.verb.planning": "\u89C4\u5212",
  "activity.verb.inspecting": "\u68C0\u67E5",
  "activity.verb.savingMemory": "\u4FDD\u5B58\u8BB0\u5FC6",
  "activity.verb.searching": "\u68C0\u7D22",
  "activity.verb.stopping": "\u505C\u6B62",
  /** digest_document (ADR 0043): a side-model pass over a whole document. */
  "activity.verb.digesting": "\u6458\u8981",
  "activity.result.digest": "\u6458\u8981",
  "activity.result.chunks": "\u6BB5",
  "activity.result.cached": "\u5DF2\u6709",
  "activity.result.tests": "\u6D4B\u8BD5",
  "activity.result.failed": "\u5931\u8D25",
  "activity.result.exit": "\u9000\u51FA",
  "activity.result.lines": "\u884C",
  // search_text result row (2026-08-17): "↳ 5 处匹配 · 1 个文件".
  "activity.result.matches": "\u5904\u5339\u914D",
  "activity.result.files": "\u4E2A\u6587\u4EF6",
  "activity.result.truncated": "\u5DF2\u622A\u65AD",
  /** A recorded conclusion row (ADR 0039): "↳ 结论: <claim> — <cites>". */
  "activity.result.finding": "\u7ED3\u8BBA",
  "activity.step.patchPreview": "\u8865\u4E01\u9884\u89C8",
  "activity.bg.label": "\u540E\u53F0",
  "activity.bg.running": "\u8FD0\u884C\u4E2D",
  "activity.bg.stopped": "\u5DF2\u505C\u6B62",
  "activity.bg.exited": "\u5DF2\u9000\u51FA",
  "activity.bg.signal": "\u4FE1\u53F7\u4E2D\u6B62",
  "activity.todo.list": "\u4EFB\u52A1\u6E05\u5355",
  "activity.todo.step": "\u6B65\u9AA4",
  // Attachments (ADR 0033). The unreadable reasons are deliberately four
  // distinct strings rather than one "读取失败": the user needs to know
  // whether to convert the file, split it, or that we simply cannot read it.
  "activity.attachment.label": "\u9644\u4EF6",
  "activity.attachment.chars": "\u5B57",
  "activity.attachment.unreadable.binary": "\u975E\u6587\u672C\u6587\u4EF6",
  "activity.attachment.unreadable.tooLarge": "\u6587\u4EF6\u8FC7\u5927\uFF0C\u672A\u53D6\u6B63\u6587",
  "activity.attachment.unreadable.empty": "\u672A\u63D0\u53D6\u5230\u6587\u672C",
  "activity.attachment.unreadable.readError": "\u8BFB\u53D6\u5931\u8D25",
  "activity.attachment.unreadable.denied": "\u6D89\u53CA\u5BC6\u94A5\u6216\u51ED\u636E\uFF0C\u5DF2\u62D2\u6536",
  "activity.attachment.unreadable.removed": "\u5DF2\u79FB\u9664",
  // ADR 0038 — PDF / Word. Two more reasons the user can act on (unlock the
  // file; re-save as .docx/.pdf), plus the extraction facts the row shows so
  // a `.pdf.txt` path never reads as a text file the user typed.
  "activity.attachment.unreadable.encrypted": "\u6587\u6863\u5DF2\u52A0\u5BC6\uFF0C\u672A\u53D6\u6B63\u6587",
  "activity.attachment.unreadable.unsupported": "\u6682\u4E0D\u652F\u6301\u7684\u6587\u6863\u683C\u5F0F",
  "activity.attachment.unreadable.scanned": "\u672A\u63D0\u53D6\u5230\u6587\u672C\uFF0C\u53EF\u80FD\u662F\u626B\u63CF\u4EF6",
  "activity.attachment.unreadable.tooManyPages": "\u9875\u6570\u8FC7\u591A\uFF0C\u672A\u63D0\u53D6",
  "activity.attachment.unreadable.textTooLong": "\u6B63\u6587\u8FC7\u957F\uFF0C\u672A\u53D6\u6B63\u6587",
  "activity.attachment.format.pdf": "PDF",
  "activity.attachment.format.docx": "Word \u6587\u6863",
  // Images (ADR 0048). `{f}` is the format token (PNG/JPEG) — data, not
  // chrome, so it is substituted rather than translated.
  "activity.attachment.image": "\u56FE\u7247 {f}",
  "activity.attachment.unreadable.imageTooLarge": "\u56FE\u7247\u8FC7\u5927\uFF0C\u672A\u80FD\u8BFB\u56FE",
  "activity.attachment.unreadable.noCaption": "\u5DF2\u5B58\u56FE\u7247\uFF0C\u672A\u80FD\u8BFB\u56FE",
  "activity.attachment.pages": "\u9875",
  "activity.attachment.extracted": "\u5DF2\u63D0\u53D6\u6587\u672C",
  /** The document's own outline, stored beside the text (2026-08-23). */
  "activity.attachment.outline": "\u76EE\u5F55 {n} \u6761",
  "activity.attachment.remove": "\u79FB\u9664\u8FD9\u4E2A\u9644\u4EF6",
  "activity.attachment.removeFailed": "\u79FB\u9664\u9644\u4EF6\u5931\u8D25",
  "activity.file.openAria": "\u67E5\u770B\u6587\u4EF6",
  /** The commit tab (ADR 0059): a sha in the done marker or the repository
   *  card opens the commit beside the record. */
  "activity.commit.openAria": "\u67E5\u770B\u63D0\u4EA4",
  /** The diff tab (ADR 0059 §5): a dirty row opens its change against HEAD. */
  "activity.diff.openAria": "\u67E5\u770B\u6539\u52A8",
  "viewer.close": "\u5173\u95ED",
  "viewer.closeTab": "\u5173\u95ED\u6587\u4EF6",
  "viewer.copyPath": "\u590D\u5236\u8DEF\u5F84",
  "viewer.copySha": "\u590D\u5236\u63D0\u4EA4\u53F7",
  "viewer.copied": "\u5DF2\u590D\u5236",
  "viewer.openExternal": "\u7528\u7CFB\u7EDF\u5E94\u7528\u6253\u5F00",
  "viewer.notFound": "\u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u79FB\u52A8",
  "viewer.binary": "\u4E8C\u8FDB\u5236\u6587\u4EF6\u2014\u2014\u7528\u7CFB\u7EDF\u5E94\u7528\u6253\u5F00\u67E5\u770B",
  "viewer.outside": "\u8BE5\u8DEF\u5F84\u5728\u5DE5\u4F5C\u533A\u4E4B\u5916",
  "viewer.unreadable": "\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u6587\u4EF6",
  "viewer.truncatedNote": "\u6587\u4EF6\u8F83\u957F\uFF0C\u4EC5\u663E\u793A\u5F00\u5934\uFF1B\u5B8C\u6574\u5185\u5BB9\u7528\u7CFB\u7EDF\u5E94\u7528\u6253\u5F00",
  /** The rich renderers (ADR 0054). */
  "viewer.tooLarge": "\u6587\u4EF6\u592A\u5927\uFF0C\u9762\u677F\u5185\u65E0\u6CD5\u67E5\u770B\uFF1B\u7528\u7CFB\u7EDF\u5E94\u7528\u6253\u5F00",
  "viewer.renderFailed": "\u65E0\u6CD5\u6E32\u67D3\u8BE5\u6587\u4EF6\u2014\u2014\u7528\u7CFB\u7EDF\u5E94\u7528\u6253\u5F00\u67E5\u770B",
  "viewer.showSource": "\u67E5\u770B\u6E90\u7801",
  "viewer.showRendered": "\u67E5\u770B\u6E32\u67D3",
  "viewer.rendering": "\u6B63\u5728\u6E32\u67D3\u2026",
  "viewer.diagramFailed": "\u56FE\u8868\u672A\u80FD\u6E32\u67D3\uFF0C\u4E0B\u9762\u662F\u5B83\u7684\u6E90\u7801",
  "viewer.imageFit": "\u9002\u5E94\u9762\u677F",
  "viewer.imageActual": "\u539F\u59CB\u5927\u5C0F",
  "viewer.pdfPages": "{n} \u9875",
  "viewer.rowsCapped": "\u4EC5\u663E\u793A\u524D {n} \u884C",
  "viewer.colsCapped": "\u4EC5\u663E\u793A\u524D {n} \u5217",
  "viewer.emptySheet": "\u7A7A\u8868",
  "viewer.chart": "\u56FE\u8868",
  "viewer.object": "\u5D4C\u5165\u5BF9\u8C61",
  "viewer.slidesCapped": "\u4EC5\u663E\u793A\u524D {n} \u9875",
  "viewer.prevSlide": "\u4E0A\u4E00\u9875",
  "viewer.nextSlide": "\u4E0B\u4E00\u9875",
  "viewer.slideAria": "\u7B2C {n} \u9875",
  "viewer.commit.notFound": "\u8BE5\u63D0\u4EA4\u4E0D\u5B58\u5728\u6216\u65E0\u6CD5\u8BFB\u53D6",
  "viewer.timeout": "\u8BFB\u53D6\u8D85\u65F6\uFF1A\u4ED3\u5E93\u592A\u5927\u6216 git \u6B63\u5FD9\uFF0C\u7A0D\u540E\u518D\u8BD5",
  "viewer.commit.files": "{n} \u4E2A\u6587\u4EF6",
  "viewer.commit.merge": "\u5408\u5E76\u63D0\u4EA4",
  "viewer.commit.binary": "\u4E8C\u8FDB\u5236",
  "viewer.commit.truncated": "\u8865\u4E01\u8F83\u957F\uFF0C\u4EC5\u663E\u793A\u5F00\u5934",
  "viewer.commit.moreFiles": "\u8FD8\u6709 {n} \u4E2A\u6587\u4EF6\u672A\u5217\u51FA",
  "viewer.diff.against": "\u76F8\u5BF9 HEAD \u7684\u6539\u52A8",
  "viewer.diff.none": "\u4E0E HEAD \u6CA1\u6709\u5DEE\u5F02",
  "viewer.diff.truncated": "\u6539\u52A8\u8F83\u957F\uFF0C\u4EC5\u663E\u793A\u5F00\u5934",
  "viewer.diff.notFound": "\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u8DEF\u5F84\u7684\u6539\u52A8",
  /** The history tab (ADR 0059 §6). */
  "viewer.log.tab": "\u63D0\u4EA4\u8BB0\u5F55",
  "viewer.log.more": "\u52A0\u8F7D\u66F4\u591A",
  "viewer.log.end": "\u5DF2\u5230\u6700\u65E9\u7684\u63D0\u4EA4",
  "viewer.log.notFound": "\u65E0\u6CD5\u8BFB\u53D6\u63D0\u4EA4\u8BB0\u5F55",
  "viewer.log.branch": "\u5206\u652F",
  "viewer.log.search": "\u641C\u7D22\u63D0\u4EA4\u4FE1\u606F",
  "viewer.log.noMatch": "\u6CA1\u6709\u5339\u914D\u7684\u63D0\u4EA4",
  "activity.plan.more": "\u8FD8\u6709 {n} \u9879",
  "plan.card.title": "\u4EFB\u52A1\u6E05\u5355",
  "plan.card.itemsUnavailable": "\u672C\u6B21\u8BB0\u5F55\u65E0\u6E05\u5355\u660E\u7EC6",
  // 操作轨迹 rail card (2026-08-17) — the plan card's fallback for
  // dispatches with no 任务清单 (every 极简 run).
  "trace.card.title": "\u64CD\u4F5C\u8F68\u8FF9",
  "trace.card.steps": "{n} \u6B65",
  "trace.card.files": "{n} \u6587\u4EF6",
  // 仓库 rail card (ADR 0058): the workspace's repository, under the device.
  "repo.card.title": "\u4ED3\u5E93",
  "repo.card.clean": "\u5DE5\u4F5C\u533A\u5E72\u51C0",
  "repo.card.dirty": "{n} \u5904\u6539\u52A8",
  "repo.card.detached": "\u6E38\u79BB HEAD",
  "repo.card.unborn": "\u5C1A\u65E0\u63D0\u4EA4",
  "repo.card.upstream": "\u4E0A\u6E38 {name}",
  "repo.card.upstreamGone": "\u4E0A\u6E38 {name} \u5DF2\u4E0D\u5B58\u5728",
  "repo.card.gone": "\u5DF2\u5220\u9664",
  "repo.card.ahead": "\u9886\u5148 {n}",
  "repo.card.behind": "\u843D\u540E {n}",
  "repo.card.conflicts": "{n} \u4E2A\u51B2\u7A81",
  "repo.card.more": "\u8FD8\u6709 {n} \u9879",
  // A workspace that is a subfolder of its repository (ADR 0058 amendment).
  "repo.card.scope": "\u5DE5\u4F5C\u533A\u4F4D\u4E8E {prefix}",
  "repo.card.recent": "\u6700\u8FD1\u63D0\u4EA4",
  "repo.card.all": "\u5168\u90E8",
  "repo.card.unpushed": "\u672A\u63A8\u9001",
  "repo.card.inProgress.merge": "\u5408\u5E76\u8FDB\u884C\u4E2D",
  "repo.card.inProgress.rebase": "\u53D8\u57FA\u8FDB\u884C\u4E2D",
  "repo.card.inProgress.cherryPick": "\u62E3\u9009\u8FDB\u884C\u4E2D",
  "repo.card.inProgress.revert": "\u56DE\u9000\u8FDB\u884C\u4E2D",
  "repo.card.inProgress.bisect": "\u4E8C\u5206\u67E5\u627E\u8FDB\u884C\u4E2D",
  "repo.card.status.modified": "\u5DF2\u4FEE\u6539",
  "repo.card.status.added": "\u65B0\u589E",
  "repo.card.status.deleted": "\u5DF2\u5220\u9664",
  "repo.card.status.renamed": "\u5DF2\u91CD\u547D\u540D",
  "repo.card.status.untracked": "\u672A\u8DDF\u8E2A",
  "repo.card.status.conflict": "\u51B2\u7A81",
  "repo.card.status.other": "\u5DF2\u53D8\u66F4",
  "activity.result.detail": "\u7ED3\u679C\u660E\u7EC6",
  // Evidence-detail section labels. The canonical record composes these in
  // Chinese and keeps them there (ADR 0018); these translate the DISPLAY.
  "evidence.output": "\u8F93\u51FA",
  "evidence.excerpt": "\u6458\u5F55",
  "evidence.attachment": "\u9644\u4EF6",
  /** Noted under a head excerpt so neither reader takes it for the whole file. */
  "evidence.attachment.clipped": "\uFF08\u4EC5\u5F00\u5934\u90E8\u5206\uFF0C\u6B63\u6587\u66F4\u957F\uFF09",
  /** The outline pane (2026-08-23): `↳ 目录 N 条（前 M 条）` + one line per entry. */
  "evidence.outline": "\u76EE\u5F55 {n} \u6761",
  "evidence.outline.shown": "\uFF08\u524D {n} \u6761\uFF09",
  /** The search-hit pane (2026-08-17): `↳ 匹配 /pattern/:` + one line per hit. */
  "evidence.matches": "\u5339\u914D",
  "evidence.matches.omitted": "\uFF08\u53E6\u6709 {n} \u5904\u672A\u5217\u51FA\uFF09",
  /** The digest overview pane (ADR 0043); "模型生成" is part of the evidence. */
  "evidence.digest": "\u6458\u8981 {source}\uFF08\u6A21\u578B\u751F\u6210\uFF0C\u5171 {n} \u6BB5\uFF0C\u5206\u6BB5\u6458\u8981\u89C1 {path}\uFF09",
  /** The done-marker's conclusions section (ADR 0039). */
  "evidence.findings": "\u7ED3\u8BBA",
  /** A failed tool call's own suggestion (2026-08-17). */
  "evidence.hint": "\u63D0\u793A",
  "evidence.files": "\u6539\u52A8\u6587\u4EF6",
  "evidence.risks": "\u98CE\u9669",
  "evidence.todos": "\u5F85\u529E",
  "evidence.evidence": "\u4F9D\u636E",
  "evidence.error": "\u9519\u8BEF",
  "activity.detail.show": "\u5C55\u5F00\u660E\u7EC6",
  "activity.detail.hide": "\u6536\u8D77\u660E\u7EC6",
  "workspace.codeChip": "\u4EE3\u7801",
  "workspace.diffExpand": "\u5C55\u5F00 \u5DEE\u5F02 {n} \u884C \uFF08+{add} \u2212{del}\uFF09",
  "workspace.diffCollapse": "\u6536\u8D77",
  "device.aria": "\u667A\u80FD\u4F53\u8BBE\u5907",
  // The drag affordance's own label. Terse (owner 2026-08-27) — its context
  // comes from the enclosing card, which is labelled 差分协处理器：{state},
  // and from the device image's own alt text above.
  "device.dragHint": "\u5411\u4E0A\u62D6\u52A8",
  "device.ariaLabel": "\u5DEE\u5206\u534F\u5904\u7406\u5668\uFF1A{state}",
  "record.chip.coprocessor": "\u5DEE\u5206\u534F\u5904\u7406\u5668",
  "record.chip.system": "\u7CFB\u7EDF",
  "record.marker.completed": "\u5B8C\u6210",
  "record.marker.blocked": "\u53D7\u963B",
  "record.marker.failed": "\u5931\u8D25",
  "record.marker.interrupted": "\u4E2D\u65AD",
  "record.marker.partial": "\u90E8\u5206\u5B8C\u6210",
  "record.marker.file": "{n} \u4E2A\u6587\u4EF6",
  "record.marker.files": "{n} \u4E2A\u6587\u4EF6",
  "record.marker.tests": "\u6D4B\u8BD5 {passed}/{total}",
  "record.marker.testsFailed": "\u6D4B\u8BD5 {passed} \u901A\u8FC7\uFF0C{failed} \u5931\u8D25",
  "record.marker.risk": "{n} \u98CE\u9669",
  "record.marker.risks": "{n} \u98CE\u9669",
  "record.marker.aborted": "\u8FD0\u884C\u5F02\u5E38\u4E2D\u6B62",
  "record.marker.commit": "\u63D0\u4EA4 {sha}",
  "record.marker.pushed": "\u63A8\u9001 {ref}",
  "record.marker.noop": "\u65E0\u4EA7\u51FA",
  "card.workspace": "\u5DE5\u4F5C\u533A",
  "card.workspaceDefault": "\u5DE5\u4F5C\u533A \xB7 \u9ED8\u8BA4",
  "card.setWorkspace": "\u8BBE\u7F6E\u5DE5\u4F5C\u533A\u2026",
  "card.resetDefault": "\u6062\u590D\u9ED8\u8BA4",
  "card.workspaceSetError": "\u65E0\u6CD5\u8BBE\u7F6E\u5DE5\u4F5C\u533A",
  "card.rules": "\u5DF2\u8BB0\u4F4F\u7684\u547D\u4EE4",
  "card.rulesEmpty": "\u6682\u65E0\u5DF2\u8BB0\u4F4F\u7684\u547D\u4EE4",
  "card.rulesRemove": "\u5220\u9664\u89C4\u5219 {rule}",
  "card.deviceInfoAria": "\u8BBE\u5907\u5361\u7247\u4FE1\u606F",
  "card.deviceInfo": "\u8BBE\u5907\u5361\u7247\u4EE3\u8868\u677F\u7816\uFF08\u5DEE\u5206\u534F\u5904\u7406\u5668\uFF09\u2014\u2014\u9ED1\u5854\u7684\u7F16\u7801\u6267\u884C\u540E\u7AEF\u3002\u5149\u73AF\u989C\u8272\u4E0E\u547C\u5438\u8282\u594F\u53CD\u6620\u540E\u7AEF\u5F53\u524D\u72B6\u6001\uFF08\u7A7A\u95F2\u3001\u8BFB\u53D6\u3001\u5199\u5165\u3001\u8FD0\u884C\u3001\u7B49\u5F85\u6279\u51C6\u7B49\uFF09\u3002",
  "time.justNow": "\u521A\u521A",
  "time.minAgo": "{n} \u5206\u949F\u524D",
  "app.cantStart": "\u9ED1\u5854\u65E0\u6CD5\u542F\u52A8",
  "app.cantStartBody": "\u91CD\u542F\u5E94\u7528\u3002\u82E5\u4ECD\u7136\u53CD\u590D\u51FA\u73B0\uFF0C\u8BF7\u67E5\u770B\u65E5\u5FD7\u3002\uFF08DeepSeek \u5BC6\u94A5\u5728 \u8BBE\u7F6E \u2192 DeepSeek \u4E2D\u8BBE\u7F6E\u2014\u2014\u7F3A\u5C11\u5BC6\u94A5\u5DF2\u4E0D\u518D\u963B\u6B62\u542F\u52A8\u3002\uFF09",
  "app.bridgeUnavailable": "\u684C\u9762\u6865\uFF08{bridge}\uFF09\u4E0D\u53EF\u7528\u2014\u2014\u9884\u52A0\u8F7D\u811A\u672C\u52A0\u8F7D\u5931\u8D25\u3002",
  "app.bridgeUnavailableBody": "\u91CD\u542F\u5E94\u7528\u3002\u82E5\u4ECD\u7136\u5982\u6B64\uFF0C\u53EF\u80FD\u662F\u9884\u52A0\u8F7D\u811A\u672C\u7684\u6784\u5EFA\u4EA7\u7269\u6216\u5B83\u5728\u4E3B\u8FDB\u7A0B\u4E2D\u7684\u8DEF\u5F84\u914D\u7F6E\u6709\u8BEF\u3002",
  "app.crashTitle": "\u754C\u9762\u51FA\u9519",
  "app.crashBody": "\u4F1A\u8BDD\u8BB0\u5F55\u6CA1\u6709\u4E22\u5931\u2014\u2014\u91CD\u65B0\u8F7D\u5165\u754C\u9762\u5373\u53EF\u7EE7\u7EED\u3002",
  "app.crashReload": "\u91CD\u65B0\u8F7D\u5165",
  "conversation.rowError": "\u8FD9\u6761\u8BB0\u5F55\u6E32\u67D3\u5931\u8D25\uFF0C\u5DF2\u8DF3\u8FC7\u3002"
};

// ../tools/_herta-src/packages/gui/src/renderer/i18n/LocaleProvider.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CATALOGS = { zh, en };
var LocaleContext = (0, import_react.createContext)(null);
function interpolate(template, params) {
  if (params === void 0) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (whole, name2) => name2 in params ? String(params[name2]) : whole
  );
}
function makeT(lang) {
  const catalog = CATALOGS[lang];
  return (key, params) => interpolate(catalog[key] ?? key, params);
}
function LocaleProvider(props) {
  const { locale, onLocaleChange } = props;
  const value = (0, import_react.useMemo)(
    () => ({ locale, setLocale: onLocaleChange, t: makeT(locale) }),
    [locale, onLocaleChange]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocaleContext.Provider, { value, children: props.children });
}
function useLocaleContext() {
  const v = (0, import_react.useContext)(LocaleContext);
  if (v === null) {
    throw new Error("useT/useLocale must be used within a LocaleProvider");
  }
  return v;
}
function useT() {
  return useLocaleContext().t;
}
function useLocale() {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}

// ../tools/_herta-src/packages/gui/src/renderer/lib/banzhuan-text.tsx
var import_react2 = require("react");

// ../tools/_herta-src/packages/core/dist/text/banzhuan-alias.js
var INLINE_CODE_SPAN = /`[^`]*`/g;
var BRICK_INPUT_MENTION = /(?<![\w@])@brick\b/gi;

// ../tools/_herta-src/packages/gui/src/renderer/lib/banzhuan-mention.ts
var BANZHUAN_MENTION = "@\u677F\u7816";
function tokenizeBanzhuanMentions(text, opts) {
  const nodes = [];
  const pushText = (s) => {
    if (s.length === 0) return;
    if (opts?.matchBrickInput !== true) {
      nodes.push({ kind: "text", value: s });
      return;
    }
    let last2 = 0;
    for (const m of s.matchAll(BRICK_INPUT_MENTION)) {
      const idx = m.index ?? 0;
      if (idx > last2) nodes.push({ kind: "text", value: s.slice(last2, idx) });
      nodes.push({ kind: "mention", value: m[0] });
      last2 = idx + m[0].length;
    }
    if (last2 < s.length) nodes.push({ kind: "text", value: s.slice(last2) });
  };
  const splitOutside = (segment) => {
    const parts = segment.split(BANZHUAN_MENTION);
    for (let i = 0; i < parts.length; i++) {
      pushText(parts[i] ?? "");
      if (i < parts.length - 1) nodes.push({ kind: "mention", value: "@\u677F\u7816" });
    }
  };
  let last = 0;
  for (const m of text.matchAll(INLINE_CODE_SPAN)) {
    const idx = m.index ?? 0;
    splitOutside(text.slice(last, idx));
    nodes.push({ kind: "code", value: m[0] });
    last = idx + m[0].length;
  }
  splitOutside(text.slice(last));
  return nodes;
}

// ../tools/_herta-src/packages/gui/src/renderer/lib/reveal-perf.ts
var enabled = false;
var totals = /* @__PURE__ */ new Map();
function setRevealPerfEnabled(on) {
  enabled = on;
}
function resetRevealPerf() {
  totals.clear();
}
function snapshotRevealPerf() {
  const out = {};
  for (const [name2, t] of totals) out[name2] = { ...t };
  return out;
}
function measureRevealSpan(name2, work, chars) {
  if (!enabled) return work();
  const t0 = performance.now();
  const result = work();
  const t1 = performance.now();
  const t = totals.get(name2) ?? { calls: 0, chars: 0, ms: 0 };
  t.calls += 1;
  t.chars += chars(result);
  t.ms += t1 - t0;
  totals.set(name2, t);
  try {
    performance.measure(`herta:${name2}`, { start: t0, end: t1 });
  } catch {
  }
  return result;
}
if (typeof window !== "undefined") {
  window.__hertaRevealPerf = {
    enable: setRevealPerfEnabled,
    snapshot: snapshotRevealPerf,
    reset: resetRevealPerf
  };
}

// ../tools/_herta-src/packages/gui/src/renderer/lib/banzhuan-text.tsx
var import_jsx_runtime2 = (
  // biome-ignore lint/suspicious/noArrayIndexKey: stable positional split of one string
  require("react/jsx-runtime")
);
function renderBanzhuanText(text, variant, lang = "zh") {
  const cls = variant === "composer" ? "composer-mention" : "banzhuan-mention";
  const alias = variant === "bubble" && lang === "en";
  const matchBrickInput = variant === "composer" && lang === "en";
  const nodes = measureRevealSpan(
    "bubble.tokenize",
    () => tokenizeBanzhuanMentions(text, { matchBrickInput }),
    () => text.length
  );
  return nodes.map((node, i) => {
    if (node.kind === "mention") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: cls, children: alias ? "@Brick" : node.value }, i);
    }
    if (node.kind === "code" && variant === "bubble") {
      const inner = node.value.slice(1, -1);
      if (inner.length > 0) {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable positional split of one string
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: "inline-code", children: inner }, i)
        );
      }
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable positional split of one string
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react2.Fragment, { children: node.value }, i)
      );
    }
    const value = alias ? node.value.replaceAll("\u677F\u7816", "Brick") : node.value;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react2.Fragment, { children: value }, i);
  });
}

// ../tools/_herta-src/packages/gui/src/renderer/lib/segment-speech.ts
var MAX_SEGMENTS = 5;
var FENCE_LINE = /^\s*```([^`\n]*)\s*$/;
function segmentSpeech(text) {
  return foldSegments(segmentUnits(text));
}
function segmentUnits(text) {
  const lines = text.split("\n");
  const segments = [];
  let proseBuf = [];
  let codeBuf = null;
  let codeLang;
  const flushProse = () => {
    const joined = proseBuf.join("\n");
    proseBuf = [];
    for (const para of joined.split(/\n\s*\n+/)) {
      const trimmed = para.trim();
      if (trimmed.length > 0) segments.push({ kind: "prose", text: trimmed });
    }
  };
  for (const line of lines) {
    const fence = line.match(FENCE_LINE);
    if (codeBuf === null) {
      if (fence !== null) {
        flushProse();
        codeBuf = [];
        const lang = fence[1]?.trim() ?? "";
        codeLang = lang.length > 0 ? lang : void 0;
      } else {
        proseBuf.push(line);
      }
    } else if (fence !== null && (fence[1]?.trim() ?? "") === "") {
      const code = codeBuf.join("\n");
      codeBuf = null;
      if (code.trim().length > 0) {
        segments.push({
          kind: "code",
          text: code,
          ...codeLang !== void 0 ? { lang: codeLang } : {}
        });
      }
      codeLang = void 0;
    } else {
      codeBuf.push(line);
    }
  }
  if (codeBuf !== null) {
    const code = codeBuf.join("\n");
    if (code.trim().length > 0) {
      segments.push({
        kind: "code",
        text: code,
        ...codeLang !== void 0 ? { lang: codeLang } : {}
      });
    }
  } else {
    flushProse();
  }
  return segments;
}
function foldUnitText(s) {
  return s.kind === "code" ? `\`\`\`
${s.text}
\`\`\`` : s.text;
}
function foldSegments(segments) {
  if (segments.length <= MAX_SEGMENTS) return segments;
  const kept = segments.slice(0, MAX_SEGMENTS - 1);
  const folded = segments.slice(MAX_SEGMENTS - 1);
  kept.push({ kind: "prose", text: folded.map(foldUnitText).join("\n\n") });
  return kept;
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/BubbleTime.tsx
var import_react3 = require("react");

// ../tools/_herta-src/packages/gui/src/renderer/lib/now-tick.ts
var NOW_TICK_MS = 3e4;
var listeners = /* @__PURE__ */ new Set();
var nowMs = Date.now();
var timer = null;
function getNowMs() {
  return nowMs;
}
function subscribeNow(listener) {
  if (listeners.size === 0) {
    nowMs = Date.now();
    timer = window.setInterval(() => {
      nowMs = Date.now();
      for (const l of listeners) l();
    }, NOW_TICK_MS);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/format-time.ts
var fmtCache = /* @__PURE__ */ new Map();
function cachedFormat(localeTag, opts, key) {
  let fmt = fmtCache.get(key);
  if (fmt === void 0) {
    fmt = new Intl.DateTimeFormat(localeTag, opts);
    fmtCache.set(key, fmt);
  }
  return fmt;
}
function formatTime(iso, locale, timeZone) {
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  return cachedFormat(
    tag,
    { hour: "numeric", minute: "2-digit", hour12: true, timeZone },
    `time|${tag}|${timeZone ?? ""}`
  ).format(new Date(iso));
}
var MINUTE_MS = 6e4;
function dayKey(ms, timeZone) {
  return cachedFormat(
    "en-CA",
    { timeZone, year: "numeric", month: "2-digit", day: "2-digit" },
    `day|${timeZone ?? ""}`
  ).format(ms);
}
function formatBubbleTime(iso, nowMs2, locale, t, timeZone) {
  const ts = new Date(iso).getTime();
  const deltaMin = Math.floor((nowMs2 - ts) / MINUTE_MS);
  if (deltaMin < 1) return t("time.justNow");
  if (deltaMin < 60) return t("time.minAgo", { n: deltaMin });
  const time = formatTime(iso, locale, timeZone);
  if (dayKey(ts, timeZone) === dayKey(nowMs2, timeZone)) return time;
  const sameYear = dayKey(ts, timeZone).slice(0, 4) === dayKey(nowMs2, timeZone).slice(0, 4);
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  const date = cachedFormat(
    tag,
    {
      timeZone,
      month: "short",
      day: "numeric",
      ...sameYear ? {} : { year: "numeric" }
    },
    `date|${tag}|${timeZone ?? ""}|${sameYear ? "y" : "Y"}`
  ).format(ts);
  return `${date}, ${time}`;
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/BubbleTime.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function BubbleTime(props) {
  const { locale } = useLocale();
  const t = useT();
  const label = (0, import_react3.useSyncExternalStore)(
    subscribeNow,
    () => formatBubbleTime(props.at, getNowMs(), locale, t)
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "message-actions__time", children: label });
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/HertaBubble.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var SegmentBody = (0, import_react4.memo)(function SegmentBody2(props) {
  const t = useT();
  const lang = props.lang ?? "zh";
  if (props.seg?.kind === "code") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { ref: props.innerRef, className: "code-standalone", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "code-card__head", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "code-card__lang", children: props.seg.lang ?? t("workspace.codeChip") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "code-block", children: props.seg.text }),
      props.caret === true && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "streaming-caret", "aria-hidden": "true" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { ref: props.innerRef, className: "message-bubble herta-bubble", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "message-text", children: [
    props.seg !== null && renderBanzhuanText(props.seg.text, "bubble", lang),
    props.caret === true && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "streaming-caret", "aria-hidden": "true" })
  ] }) });
});
var HertaBubble = (0, import_react4.memo)(function HertaBubble2(props) {
  const segments = segmentSpeech(stripDisplayUnsafe(props.text));
  if (segments.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: segments.map((seg, i) => {
    const isLast = i === segments.length - 1;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        className: `message-row herta-row${isLast ? "" : " is-stack-mid"}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SegmentBody, { seg, lang: props.lang }),
          isLast && props.at !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "message-actions", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BubbleTime, { at: props.at }) })
        ]
      },
      i
    );
  }) });
});

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/UserBubble.tsx
var import_react11 = require("react");

// ../tools/_herta-src/packages/gui/src/shared/attachment-image.ts
var ATTACHMENT_SCHEME = "herta-attachment";
function attachmentImageUrl(relPath) {
  const segments = relPath.split("/").map(encodeURIComponent);
  return `${ATTACHMENT_SCHEME}://file/${segments.join("/")}`;
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Tooltip/Tooltip.tsx
var import_react5 = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime5 = require("react/jsx-runtime");
var HOVER_DELAY_MS = 400;
var FLIP_THRESHOLD_PX = 56;
var GAP_PX = 6;
function Tooltip(props) {
  const placement = props.placement ?? "bottom";
  const align = props.align ?? "center";
  const [suppressed, setSuppressed] = (0, import_react5.useState)(false);
  const wrapRef = (0, import_react5.useRef)(null);
  const timer2 = (0, import_react5.useRef)(null);
  const [fixedAt, setFixedAt] = (0, import_react5.useState)(null);
  const clearTimer = () => {
    if (timer2.current !== null) {
      window.clearTimeout(timer2.current);
      timer2.current = null;
    }
  };
  (0, import_react5.useEffect)(
    () => () => {
      if (timer2.current !== null) window.clearTimeout(timer2.current);
    },
    []
  );
  (0, import_react5.useEffect)(() => {
    if (fixedAt === null) return;
    const close = () => setFixedAt(null);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [fixedAt]);
  const openPortal = () => {
    const el = wrapRef.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    const roomBelow = window.innerHeight - r.bottom;
    setFixedAt(
      placement === "top" || roomBelow < FLIP_THRESHOLD_PX ? {
        left: Math.round(r.left + r.width / 2),
        bottom: Math.round(window.innerHeight - r.top + GAP_PX)
      } : {
        left: Math.round(r.left + r.width / 2),
        top: Math.round(r.bottom + GAP_PX)
      }
    );
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the span is a transparent wrapper — the interactive element is the CHILD control, and these handlers only observe its bubbled pointer/focus events to time the pill. Making the span itself focusable/interactive would add a second tab stop for no control.
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "span",
      {
        ref: wrapRef,
        className: `tooltip-wrap tooltip-${placement} tooltip-align-${align}${suppressed ? " is-suppressed" : ""}`,
        onPointerDown: () => {
          setSuppressed(true);
          clearTimer();
          setFixedAt(null);
        },
        onPointerEnter: props.portal === true ? () => {
          clearTimer();
          timer2.current = window.setTimeout(openPortal, HOVER_DELAY_MS);
        } : void 0,
        onPointerLeave: () => {
          setSuppressed(false);
          clearTimer();
          setFixedAt(null);
        },
        onFocus: props.portal === true ? openPortal : void 0,
        onBlur: props.portal === true ? () => {
          clearTimer();
          setFixedAt(null);
        } : void 0,
        children: [
          props.children,
          props.portal !== true && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "tooltip", role: "tooltip", children: [
            props.label,
            props.sub !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "tooltip-sub", children: props.sub })
          ] }),
          props.portal === true && fixedAt !== null && !suppressed && (0, import_react_dom.createPortal)(
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "span",
              {
                className: "tooltip tooltip--portal",
                role: "tooltip",
                style: {
                  left: `${fixedAt.left}px`,
                  ...fixedAt.top !== void 0 ? { top: `${fixedAt.top}px` } : {},
                  ...fixedAt.bottom !== void 0 ? { bottom: `${fixedAt.bottom}px` } : {}
                },
                children: [
                  props.label,
                  props.sub !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "tooltip-sub", children: props.sub })
                ]
              }
            ),
            document.body
          )
        ]
      }
    )
  );
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/ImageLightbox.tsx
var import_react10 = require("react");
var import_react_dom2 = require("react-dom");

// ../tools/_herta-src/packages/gui/src/renderer/hooks/useSessionScoped.ts
var import_react8 = require("react");

// ../tools/_herta-src/packages/gui/src/renderer/hooks/useSessionSelector.ts
var import_react7 = require("react");

// ../tools/_herta-src/packages/gui/src/renderer/context/HertaBridgeContext.tsx
var import_react6 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var HertaBridgeContext = (0, import_react6.createContext)(null);

// ../tools/_herta-src/packages/gui/src/renderer/lib/overlay-stack.ts
var import_react9 = require("react");

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/ImageLightbox.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var noop = () => {
};
var LightboxContext = (0, import_react10.createContext)(noop);
function useLightbox() {
  return (0, import_react10.useContext)(LightboxContext);
}

// ../tools/_herta-src/packages/gui/src/renderer/components/Workspace/UserBubble.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function RewindIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "svg",
    {
      className: "message-rewind-svg",
      "data-icon": "rewind",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false",
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "m15 15-6 6m0 0-6-6m6 6V9a6 6 0 0 1 12 0v3" })
    }
  );
}
var UserBubble = (0, import_react11.memo)(function UserBubble2(props) {
  const t = useT();
  const openLightbox = useLightbox();
  const lang = props.lang ?? "zh";
  const hasActions = props.onRewind !== void 0 || props.at !== void 0;
  const images = props.images ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      className: "message-row user-row",
      "data-abs-index": props.absIndex,
      style: props.hidden ? { visibility: "hidden" } : void 0,
      children: [
        images.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "message-images", children: images.map((img) => (
          // Click-to-enlarge (ADR 0048 §4a): the 56px thumb is an index
          // card, the lightbox is the picture. A BUTTON, so the keyboard
          // reaches it too.
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              type: "button",
              className: "message-images__open",
              "aria-label": `${t("lightbox.open")} ${img.name}`,
              onClick: () => openLightbox(img),
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "img",
                {
                  className: "message-images__thumb",
                  src: attachmentImageUrl(img.path),
                  alt: img.caption ?? img.name,
                  title: img.name,
                  ...img.width !== void 0 ? { width: img.width } : {},
                  ...img.height !== void 0 ? { height: img.height } : {},
                  draggable: false
                }
              )
            },
            img.path
          )
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { ref: props.bubbleRef, className: "message-bubble user-bubble", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "message-text", children: renderBanzhuanText(props.text, "bubble", lang) }) }),
        hasActions && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "message-actions", children: [
          props.onRewind !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tooltip, { label: t("workspace.rewind"), placement: "bottom", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              type: "button",
              className: "message-rewind",
              "aria-label": t("workspace.rewind"),
              onClick: props.onRewind,
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RewindIcon, {})
            }
          ) }),
          props.at !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BubbleTime, { at: props.at })
        ] })
      ]
    }
  );
});

// ../tools/_herta-src/packages/gui/src/renderer/styles/reference-ux.css
var reference_ux_default = `:host{color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;user-select:none;}:host{
  --ink:#111417;
  --banzhuan-led:#4d86ff;
  --muted:#6f7782;
  --hairline:rgba(17,20,23,.08);
  --hairline-strong:rgba(17,20,23,.12);
  --shell:rgba(250,252,253,.88);
  --panel:rgba(255,255,255,.72);
  --panel-solid:#fbfcfd;
  --soft-gray:rgba(232,235,238,.62);
  --message:#f3f4f5;
  --speech-card-bg:rgba(255,255,255,.78);
  --speech-border:rgba(17,20,23,.08);
  --speech-shadow:rgba(34,45,57,.10);
  --speech-ring:rgba(17,20,23,.25);
  --speech-wave-main:rgba(17,20,23,.48);
  --speech-wave-soft:rgba(17,20,23,.28);
  --speech-menu:rgba(17,20,23,.42);
  --agent-ring-opacity:.98;
  --agent-breathe-duration:2.8s;
  /* \u2500\u2500 Theme tokens (night-mode slice 1, 2026-07-13) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     Semantic color vocabulary extracted VALUE-PRESERVING from the inline
     literals below: every token holds the exact string it replaced, so the
     light theme's computed values are unchanged by construction. Dark mode
     (slice 2) overrides these under [data-theme="dark"]. Literals still
     inline are deliberate: sub-3\xD7 one-offs (slice 2 decides each), the
     state-color LED/glow/status palettes (likely theme-invariant), and
     mask-image alpha stops (theme-independent by nature). Names are
     scaffolding \u2014 slice 2 may merge near-duplicate tiers (e.g. the four
     ~#71-7a mid-grays) once a visual change is allowed. */
  /* The cosmic body backdrop \u2014 the biggest dark-mode lever. */
  --app-bg:
    radial-gradient(circle at 18% 35%,rgba(192,246,215,.95) 0 10%,transparent 28%),
    radial-gradient(circle at 58% 2%,rgba(205,248,210,.9) 0 8%,transparent 26%),
    radial-gradient(circle at 82% 18%,rgba(165,240,250,.95) 0 13%,transparent 33%),
    radial-gradient(circle at 38% 18%,rgba(38,158,236,.78) 0 22%,transparent 48%),
    linear-gradient(135deg,#25b7ee 0%,#8fece7 46%,#14a5e2 100%);
  --app-bg-bloom:
    radial-gradient(circle at 12% 78%,rgba(220,255,224,.75),transparent 22%),
    radial-gradient(circle at 66% 88%,rgba(6,104,195,.42),transparent 27%),
    radial-gradient(circle at 50% 40%,rgba(255,255,255,.2),transparent 38%);
  /* Accents. --accent was previously only a var() fallback (#2f7d92). */
  --accent:#2f7d92;
  --accent-blue:#2563eb;
  /* Ink ladder \u2014 text tiers, darkest to faintest. */
  --ink-2:#283139;        /* headings, section labels, icons */
  --ink-3:#2a2f34;        /* emphasized body text */
  --ink-strong:#0f172a;   /* approval title ink */
  --muted-strong:#3b4350; /* step text, shimmer base */
  --muted-slate:#475569;  /* approval body text */
  --muted-deep:#59616e;   /* secondary labels */
  --muted-2:#717984;      /* tertiary labels */
  --muted-3:#7a838e;      /* timestamps, activity labels */
  --muted-4:#8b90a0;      /* activity line text */
  --muted-faint:#aab2bf;  /* faintest text, shimmer highlight */
  --ink-inverse:#fff;     /* text on ink/accent surfaces */
  --surface-pop:#fff;     /* solid white popover/knob surfaces */
  /* Ink at alpha \u2014 hairlines, washes, scrims (flip with the ink). */
  --ink-a05:rgba(17,20,23,.05);
  --ink-a06:rgba(17,20,23,.06);
  --ink-a09:rgba(17,20,23,.09);
  --ink-a10:rgba(17,20,23,.1);
  --ink-a13:rgba(17,20,23,.13);
  --ink-a14:rgba(17,20,23,.14);
  --ink-a22:rgba(17,20,23,.22);
  --ink-a72:rgba(17,20,23,.72);
  /* White glass at alpha \u2014 frosted surfaces and highlights. */
  --glass-a50:rgba(255,255,255,.5);
  --glass-a55:rgba(255,255,255,.55);
  --glass-a60:rgba(255,255,255,.6);
  --glass-a62:rgba(255,255,255,.62);
  --glass-a72:rgba(255,255,255,.72);
  --glass-a78:rgba(255,255,255,.78);
  --glass-a82:rgba(255,255,255,.82);
  /* Elevation + focus. */
  --shadow-pop:rgba(32,45,58,.16); /* floating cards/popovers */
  --focus-ring:rgba(35,44,55,.3);
  /* \u2500\u2500 Component surfaces (night-mode slice 2, 2026-07-13) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     The second sweep: surfaces the dark theme must flip. A few sites were
     MERGED onto these from imperceptibly-different one-offs (.9\u2192.92 pill,
     .97/.98\u2192.96 card, #717a84\u2192#717984, \u2026) \u2014 the first deliberate visual
     deltas of the retheme, all below noticeability. */
  --sidebar-bg:linear-gradient(180deg,rgba(244,248,250,.82),rgba(246,250,252,.56));
  --pill-bg:rgba(255, 255, 255, 0.92);        /* floating pills (jump chip) */
  --pill-bg-strong:rgba(255, 255, 255, 0.99);
  --bubble-user:rgba(236,238,240,.76);
  --bubble-herta:rgba(255, 255, 255, 0.64);
  --bubble-border:rgba(17, 20, 23, 0.105);
  --card-solid:rgba(255, 255, 255, 0.96);     /* approval panel, popovers */
  --nav-bg:rgba(246, 249, 250, .9);           /* settings nav column */
  /* Composer surface \u2014 shared with .connect-morph-clone, which must start
     pixel-identical to the composer. Was var(--glass-a62); split out
     (2026-07-18) so dark can lift the composer off the backdrop without
     moving the whole glass ladder. Light value preserved exactly. */
  --composer-bg:rgba(255,255,255,.62);
  --strip-bg:rgba(250, 252, 253, 0.6);        /* code-card head, disclaimer */
  --track:#cdd3d9;                            /* toggle off-track */
  --input-border:rgba(20, 30, 40, 0.12);
  --input-border-focus:rgba(20, 30, 40, 0.28);
  --backdrop:rgba(16, 24, 32, .10);           /* modal scrim */
  --wash-1:rgba(35, 44, 55, 0.04);            /* hover washes, lightest\u2192 */
  --wash-2:rgba(35, 44, 55, 0.065);
  --wash-3:rgba(35, 44, 55, 0.08);
  --label-soft:rgba(35, 44, 55, 0.55);        /* group labels */
  --label-soft-2:rgba(35, 44, 55, 0.5);       /* preview text */
  --btn-ink:rgba(17, 20, 23, 0.82);           /* the dark primary button */
  --btn-ink-hover:rgba(17, 20, 23, 0.92);
  --slate-deep:#334155;                       /* approval summary text */
  --wc-ink:#1d3a44;                           /* window-control glyphs */
  --accent-deep:#1f4fae;                      /* settings nav active */
  --mention-ink:#2f6fd0;                      /* @\u677F\u7816 mention text */
  --ink-a03:rgba(17,20,23,.03);
  --ink-a04:rgba(17,20,23,.04);
  --ink-a07:rgba(17,20,23,.07);
  --ink-a11:rgba(17,20,23,.11);
  --ink-a15:rgba(17,20,23,.15);
  --ink-a35:rgba(17,20,23,.35);
  --ink-a52:rgba(17,20,23,.52);
  --ink-a70:rgba(17,20,23,.7);
  --glass-a34:rgba(255,255,255,.34);
  --glass-a44:rgba(252,253,255,.44);
  /* \u2500\u2500 Motion vocabulary (2026-07-11) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     Shared easing + duration tokens. Every migrated rule keeps its exact
     previous computed value (pure aliasing; the one exception: two
     near-duplicate \`.2,.8,.2,1\` curves were normalized onto the signature
     curve \u2014 imperceptible at their 200ms durations). New animation work
     picks from these instead of minting new magic numbers. Duration bands
     for new work: ~120\u2013180ms micro (hovers, small fades), ~200\u2013320ms
     standard (panel enters/exits), 400\u2013800ms signature morphs. Durations
     NOT tokenized below are deliberate one-off tunings or are mirrored by
     JS timing constants \u2014 do not force-fit them onto tokens. */
  --ease-signature: cubic-bezier(0.2, 0.85, 0.2, 1); /* the house morph curve */
  --ease-pop: cubic-bezier(0.16, 1, 0.3, 1); /* fast-out entrance */
  --ease-out-soft: cubic-bezier(0.22, 0.61, 0.36, 1); /* gentle decelerate */
  --ease-accel: cubic-bezier(0.4, 0, 1, 1); /* exit accelerate */
  --ease-overshoot: cubic-bezier(0.34, 1.3, 0.5, 1); /* playful swap-in */
  --dur-micro: 140ms;
  --dur-morph: 800ms; /* the connect/disconnect signature move */
  /* The record's LEFT EDGE \u2014 where Herta's bubbles and the \u7CFB\u7EDF /
     \u5DEE\u5206\u534F\u5904\u7406\u5668 activity rows both begin. One token because they drifted
     apart: the bubble carried a 34px gutter from the lifted UX_v5
     stylesheet, where an avatar sat in it, and the avatar was removed while
     the gutter stayed (user 2026-07-30 \u2014 the two lanes were visibly
     unaligned). The value is the activity row's: 8px of clearance for the
     LED's pulse glow, which reaches 7px past the dot and is clipped by
     .conversation's overflow-x (measured 2026-07-12). */
  --record-left: 8px;
}
/* \u2500\u2500 Night mode (slice 2, 2026-07-13) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The dark palette: every theme token overridden in one block. The theme
   controller (renderer/lib/theme.ts) stamps data-theme on <html> from the
   \u5916\u89C2 setting (light / dark / system). Design keys:
   - ink flips to a cool off-white; the --ink-aXX hairline/scrim family
     flips with it (light lines on dark), alphas preserved;
   - white frosted glass (--glass-aXX) becomes dark slate glass;
   - the cosmic backdrop trades the cyan day-glass for a deep-space navy
     with the same nebula composition, so the frost still has something
     to blur;
   - the ink-surface buttons (send, approval allow) INVERT to light \u2014
     --btn-ink/--ink-inverse swap roles by value, no rule changes;
   - status/state palettes (LED, success/error glows, badge tints) are
     deliberately NOT overridden \u2014 saturated accents read on both themes.
   The opening splash stays light by design (its canvas glyphs are
   JS-drawn for a light field; see .opening-ascii). */
:host([data-theme="dark"]){
  --app-bg:
    radial-gradient(circle at 18% 35%,rgba(22,78,66,.5) 0 10%,transparent 28%),
    radial-gradient(circle at 58% 2%,rgba(26,84,74,.4) 0 8%,transparent 26%),
    radial-gradient(circle at 82% 18%,rgba(18,66,104,.55) 0 13%,transparent 33%),
    radial-gradient(circle at 38% 18%,rgba(14,54,102,.6) 0 22%,transparent 48%),
    linear-gradient(135deg,#0a1a2a 0%,#0d2233 46%,#081524 100%);
  --app-bg-bloom:
    radial-gradient(circle at 12% 78%,rgba(36,110,100,.25),transparent 22%),
    radial-gradient(circle at 66% 88%,rgba(10,60,130,.35),transparent 27%),
    radial-gradient(circle at 50% 40%,rgba(120,160,200,.08),transparent 38%);
  --ink:#e6ebf1;
  --muted:#7e8894;
  --hairline:rgba(226,236,246,.09);
  --hairline-strong:rgba(226,236,246,.15);
  --shell:rgba(13,17,22,.92);
  --panel:rgba(22,28,36,.72);
  --panel-solid:#14181e;
  --soft-gray:rgba(46,54,64,.62);
  --message:#242b34;
  /* Chrome-separation lift (user 2026-07-18, tiered per owner review):
     the chrome surfaces sat within a few luma points of the deep-navy
     backdrop and melted into it. The fix is a three-tier ladder \u2014 the
     composer lifts to grey slate (~#28303a), the sidebar sits halfway
     between it and the backdrop, and the device card deliberately stays
     on the deep tier (its glass + the device render read better sunken).
     Record surfaces (bubbles, cards) also stay deep. */
  --speech-card-bg:rgba(22,28,36,.8);
  --speech-border:rgba(226,236,246,.08);
  --speech-shadow:rgba(0,0,0,.4);
  --speech-ring:rgba(226,236,246,.28);
  --speech-wave-main:rgba(226,236,246,.55);
  --speech-wave-soft:rgba(226,236,246,.3);
  --speech-menu:rgba(226,236,246,.45);
  --accent:#5cb6ca;
  --accent-blue:#6b9dff;
  --ink-2:#cdd6df;
  --ink-3:#d5dce3;
  --ink-strong:#eef3f9;
  --muted-strong:#a7b1bd;
  --muted-slate:#97a3b2;
  --muted-deep:#8a94a1;
  --muted-2:#747e8a;
  --muted-3:#78828e;
  --muted-4:#6d7784;
  --muted-faint:#59626d;
  --ink-inverse:#10141a;
  --surface-pop:#1b222b;
  --ink-a05:rgba(226,236,246,.05);
  --ink-a06:rgba(226,236,246,.06);
  --ink-a09:rgba(226,236,246,.09);
  --ink-a10:rgba(226,236,246,.1);
  --ink-a13:rgba(226,236,246,.13);
  --ink-a14:rgba(226,236,246,.14);
  --ink-a22:rgba(226,236,246,.22);
  --ink-a72:rgba(226,236,246,.72);
  --glass-a50:rgba(18,24,31,.5);
  --glass-a55:rgba(18,24,31,.55);
  --glass-a60:rgba(18,24,31,.6);
  --glass-a62:rgba(18,24,31,.62);
  --glass-a72:rgba(18,24,31,.72);
  --glass-a78:rgba(18,24,31,.78);
  --glass-a82:rgba(18,24,31,.82);
  --shadow-pop:rgba(0,0,0,.5);
  --focus-ring:rgba(190,205,220,.35);
  --sidebar-bg:linear-gradient(180deg,rgba(27,34,42,.86),rgba(22,28,35,.61));
  --pill-bg:rgba(30,37,46,.94);
  --pill-bg-strong:rgba(36,44,54,.99);
  --bubble-user:rgba(40,48,58,.78);
  --bubble-herta:rgba(26,32,40,.72);
  --bubble-border:rgba(226,236,246,.09);
  --card-solid:rgba(24,30,38,.97);
  --composer-bg:rgba(40,48,58,.7);
  --nav-bg:rgba(18,23,30,.9);
  --strip-bg:rgba(15,20,26,.6);
  --track:#3a4450;
  --input-border:rgba(210,225,240,.14);
  --input-border-focus:rgba(210,225,240,.3);
  --backdrop:rgba(0,0,0,.4);
  --wash-1:rgba(200,215,230,.05);
  --wash-2:rgba(200,215,230,.08);
  --wash-3:rgba(200,215,230,.1);
  --label-soft:rgba(200,212,224,.6);
  --label-soft-2:rgba(200,212,224,.55);
  --btn-ink:rgba(230,238,246,.9);
  --btn-ink-hover:rgba(240,246,252,.98);
  --slate-deep:#b9c4d2;
  --wc-ink:#c2d2da;
  --accent-deep:#9db9ff;
  --mention-ink:#8cb2ff;
  --ink-a03:rgba(226,236,246,.04);
  --ink-a04:rgba(226,236,246,.05);
  --ink-a07:rgba(226,236,246,.07);
  --ink-a11:rgba(226,236,246,.11);
  --ink-a15:rgba(226,236,246,.15);
  --ink-a35:rgba(226,236,246,.35);
  --ink-a52:rgba(226,236,246,.52);
  --ink-a70:rgba(226,236,246,.7);
  --glass-a34:rgba(18,24,31,.34);
  --glass-a44:rgba(18,24,31,.44);
  /* The aura canvas reads these via getComputedStyle (JS-drawn wave).
     --aura-base is the glass-sheet base VALUE (0..1 gray) the shader mixes
     the tint into \u2014 the light theme draws dark sheets that darken a light
     backdrop; dark draws light sheets that lift a dark one. */
  --aura-color:#9fc4ce;
  --aura-base:0.84;
}
:host{
  --aura-color:#3c5a62; /* light default \u2014 mirrors AuraVisual's constant */
  --aura-base:0.16;     /* mirrors the shader's original hardcoded sheet gray */
}
/* Dark-mode raster/canvas companions (night mode 2026-07-13): surfaces the
   token flip can't reach. The galaxy-row transfer icons swap for the
   user-drawn white night set (2026-07-13) \u2014 the day PNGs are grayscaled +
   darkened and the earlier invert() rescue still read muddy on the dark
   shell. Both variants stay mounted so a theme flip swaps with no decode
   flash (same pattern as the device render below). The night icons are
   authored for the dark shell, so the day darkening filter stays off \u2014
   only the row's shared opacity mutes them. */
/* Compound selectors: the base .transfer-icon rule (filter + sizing) sits
   LATER in this sheet, so a lone one-class selector here loses the cascade
   tie \u2014 the compound (0,2,0) keeps the night icons unfiltered. */
.transfer-icon.transfer-icon--night {
  display: none;
  filter: none;
}
:host([data-theme="dark"]) .transfer-icon.transfer-icon--day {
  display: none;
}
:host([data-theme="dark"]) .transfer-icon.transfer-icon--night {
  display: block;
}
/* The HRT-001 device render swaps for its night version. Both are the 3D
   device rendered at the card's framing (ADR 0057 \xA72.14, replacing the
   hand-drawn art of 2026-07-13), their ring unlit \u2014 the DeviceGlow layer
   is the lamp. Both stay mounted so a theme flip swaps with no decode
   flash. */
.agent-device-img--night {
  display: none;
}
:host([data-theme="dark"]) .agent-device-img--day {
  display: none;
}
:host([data-theme="dark"]) .agent-device-img--night {
  display: block;
}
:host([data-theme="dark"]) .aura-fallback {
  background: radial-gradient(
    ellipse 55% 14% at 50% 92%,
    rgba(159, 196, 206, 0.5) 0%,
    rgba(159, 196, 206, 0.18) 48%,
    transparent 74%
  );
}
/* Status badges (user bug 2026-07-13): the alpha-tint badge family keeps
   deliberately theme-invariant HUES, but its light-tuned values die on the
   dark card \u2014 the \u786E\u8BA4\u5220\u9664 pill's 14% red capsule was INVISIBLE there, so
   its exit (label fades first by design, the shrinking capsule carries the
   motion) read as an instant vanish. Dark flips each pair to bright ink +
   a stronger tint. Modifier rules follow the base badge rule so they win
   at equal specificity. */
:host([data-theme="dark"]) .session-item__confirm-del {
  color: #ff9d92;
  background: rgba(214, 90, 80, 0.26);
}
:host([data-theme="dark"]) .session-item__confirm-del:hover {
  background: rgba(214, 90, 80, 0.36);
}
:host([data-theme="dark"]) .session-item__trash:hover .session-item__trash-svg {
  color: #ff9d92;
}
:host([data-theme="dark"]) .session-item__badge {
  color: #93b8ff;
  background: rgba(77, 134, 255, 0.2);
}
:host([data-theme="dark"]) .session-item__badge--warn {
  color: #ffc46b;
  background: rgba(217, 119, 6, 0.22);
}
:host([data-theme="dark"]) button.session-item__badge--dismiss {
  color: #ff9d92;
  background: rgba(214, 90, 80, 0.2);
}
:host([data-theme="dark"]) .sidebar-header-icon.is-armed {
  color: #ffc46b;
  background: rgba(217, 119, 6, 0.18);
}
:host([data-theme="dark"]) .card-menu-error,
:host([data-theme="dark"]) .settings-note.is-error,
:host([data-theme="dark"]) .settings-key-delete {
  color: #ff9d92;
}
:host([data-theme="dark"]) .settings-key-state.is-connected {
  color: #63d68e;
}
*{box-sizing:border-box}


/* Pre-blurred frost source (perf, 2026-07-13): .app used to carry
   \`backdrop-filter: blur(25px) saturate(145%)\`, live-sampling its backdrop
   EVERY FRAME \u2014 but the only content behind .app is the STATIC cosmic
   gradient + bloom, so the sampling was pure waste. Profiled during the
   reconnect morph at 3440\xD71440 (the user's fullscreen jank): avg frame
   56ms with the backdrop filter vs 24ms without \u2014 it was the dominant
   cost, scaling with window area. This ::after holds the SAME gradient
   stack and blurs it with a regular filter: static content, rendered
   once, composited from cache. Painted over the sharp body layers (kept \u2014
   body's own background still covers the pre-CSS first paint); .app's
   semi-opaque --shell then tints it exactly as the frost did.
   inset:-60px keeps the blur's edge falloff outside the viewport. */

.app{
  --topbar-h: 52px;
  /* Pin to the viewport edges (position:fixed; inset:0) rather than
     width/height:100vw/vh + body centering: in a RESTORED (non-maximized)
     frameless window the 100vh box ended up shorter than the viewport and
     \`\` split the slack into top+bottom gaps, where
     the raw cyan body gradient showed through (maximized filled exactly, so it
     was hidden). Fixed inset:0 fills the viewport in every window state. */
  position:fixed;
  inset:0;
  z-index:1;
  /* Ship as a full-window app (user 2026-06-20): the interface fills the window
     edge-to-edge. The gradient body stays BEHIND, blurred by the app's frost
     into a subtle calm tint \u2014 so no vibrant 'desk' margin shows. The OS rounds
     the window corners, so the app keeps square corners (no card radius / border
     / shadow). The .topbar (drag region) + the OS window controls overlay both
     live at the top. */
  display:grid;
  grid-template-columns:276px 1fr;
  grid-template-rows: var(--topbar-h) 1fr;
  overflow:hidden;
  background:var(--shell);
  /* backdrop-filter REMOVED (perf 2026-07-13): replaced by the body:after
     pre-blurred gradient above \u2014 identical look over a static backdrop,
     none of the per-frame re-filtering cost. */
}
/* \u2500\u2500 Selection policy (owner 2026-09-11) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Chrome is not selectable; content is \u2014 the line Codex draws. A drag or
   Ctrl+A across the window used to paint the sidebar's session names,
   dates and group labels, the composer's placeholder, the rail cards'
   labels and their \u2026 menu, the bubble timestamps, the record's fold
   rows \u2014 all blue, as if they were the conversation. \`user-select\` is
   inherited through \`auto\`, so the body says none and the content
   surfaces below opt back in with \`text\`. Editable controls (the
   composer textarea, the settings inputs, the history search) resolve to
   \`contain\` on their own and keep working under the body's none. Chrome
   nested INSIDE a content surface \u2014 a bubble's action row, a record
   row's \xD7, a code card's head, the viewer's gutters, grid heads, slide
   bars and every button \u2014 says none again. Portals (tooltips, the
   lightbox, the confirm pill) hang off body, so body is the root, not
   .app. */

.message-text,
.code-block,
.code-standalone,
.activity-step__text,
.activity-step__headline,
.activity-step__detail,
.activity-plan__text,
.diff-body,
.file-viewer__body {
  user-select: text;
}
button,
[role="button"],
[role="tab"],
.message-actions,
.streaming-caret,
.code-card__head,
.activity-step__icon,
.activity-step__fold-chevron,
.activity-step__remove,
.activity-step__detail-toggle,
.diff-body__gutter,
.file-viewer__gutter,
.file-viewer__anchor,
.file-viewer__gridhead,
.file-viewer__rowhead,
.file-viewer__colhead,
.file-viewer__corner,
.file-viewer__sheet-tabs,
.file-viewer__slides-bar,
.file-viewer__thumbs,
.log-view__tools,
.log-view__more {
  user-select: none;
}

.sidebar{
  /* Expanded content-box width: column 276 \u2212 margin-left 18 \u2212 padding 36.
     The collapse pins children to THIS width (see below) so text never
     re-wraps while the column animates. */
  --sidebar-content-w: 222px;
  margin:0 0 18px 18px;
  /* Asymmetric bottom: the top keeps its breathing room, but the bottom is
     tighter so the pinned Settings footer sits near the card edge instead of
     floating well above it (user 2026-06-20). */
  padding:26px 18px 13px;
  background:var(--sidebar-bg);
  border:1px solid var(--ink-a06);
  border-radius:16px;
  box-shadow:0 8px 24px rgba(34,45,57,.08);
  min-width: 0;
  /* Flex column: a fixed search header, the scrolling session list
     (.sidebar-list, which owns the scroll), and a pinned Settings footer.
     overflow:hidden clips the collapse (the .sidebar > * width-pin) and keeps
     the column itself from scrolling (user 2026-06-20). */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: padding 220ms ease, border-color 220ms ease, margin 220ms ease;
}
/* \`.sidebar > .sidebar-list\` (not a bare \`.sidebar-list\`) so this wins the
   \`transition\` property over the equal-specificity \`.sidebar > *\` collapse rule
   below \u2014 otherwise that rule (later in source order) would clobber the fog
   transition and the edges would snap instead of fading. We fold \`opacity\` back
   in here so the list still fades with the rest of the column on collapse. */
.sidebar > .sidebar-list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none; /* hidden bar; wheel / trackpad scroll still works */
  /* Scroll-edge content fade \u2014 the list dissolves at its top + bottom edges as
     it scrolls under the header / Settings footer, mirroring the conversation
     pane's mask. useScrollEdges toggles the fog classes so an edge only fades
     when content actually overflows it (user 2026-06-20). The --fog-* props are
     registered via @property near the conversation rules, so they animate. */
  --fog-top-h: 0px;
  --fog-bottom-h: 0px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fog-top-h),
    #000 calc(100% - var(--fog-bottom-h)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fog-top-h),
    #000 calc(100% - var(--fog-bottom-h)),
    transparent 100%
  );
  transition:
    opacity 150ms ease,
    --fog-top-h 180ms ease,
    --fog-bottom-h 180ms ease;
}
.sidebar-list::-webkit-scrollbar {
  display: none;
}
.sidebar-list.has-fog-top {
  --fog-top-h: 26px;
}
.sidebar-list.has-fog-bottom {
  --fog-bottom-h: 26px;
}
.sidebar-settings {
  flex: none;
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 4px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ink-2);
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-micro) ease;
}
.sidebar-settings:hover {
  background: var(--wash-2);
}
.sidebar-settings:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.sidebar-settings-svg {
  width: 20px;
  height: 20px;
  stroke-width: 1.6;
  opacity: 0.82;
  flex: none;
}
/* Codex-style collapse (adopted 2026-06-13): the column still animates (the
   workspace expansion is unchanged), but the content is PINNED at its
   expanded width \u2014 the narrowing card clips it at the right edge instead of
   re-measuring it, so characters never jump lines \u2014 and it fades out faster
   than the slide so the clipping reads as a dissolve, not a guillotine. */
.sidebar > * {
  width: var(--sidebar-content-w);
  transition: opacity 150ms ease;
}
.app.sidebar-collapsed .sidebar > * {
  opacity: 0;
}
.app {
  transition: grid-template-columns 220ms ease;
}
.app.sidebar-collapsed {
  grid-template-columns: 0 1fr;
}
/* Boot reveal: the workbench is HIDDEN while the opening splash plays \u2014 so its
   bootstrap (the connected\u2192disconnected settle) never shows through the frosted
   glass. At the dissolve start it SNAPS opaque (no opacity transition on .app
   above) BEHIND the still-opaque splash, then the SPLASH fades out over the
   [38%, 94%] window to reveal it. Snapping (not fading) .app is load-bearing:
   fading .app opacity would composite it over the raw vivid body gradient,
   bleeding cyan through for the whole dissolve; opaque, its own frost keeps the
   body a subtle calm tint (user 2026-06-20). */
.app.is-booting {
  opacity: 0;
}
.app.sidebar-collapsed .sidebar {
  padding-left: 0;
  padding-right: 0;
  margin-left: 0;
  border-color: transparent;
  box-shadow: none;
}
.side-top,.side-brand,.input-icons,.nav-row,.project-row,.profile-row{display:flex;align-items:center}
.side-top{justify-content:space-between;margin-bottom:58px}
.side-tools{display:flex;gap:20px}
.icon{width:22px;height:22px;color:var(--ink-2);opacity:.78}
.side-brand{gap:12px;margin-bottom:24px;font-size:15px}
.spark{width:19px;height:19px;border:1px solid rgba(0,0,0,.16);border-radius:999px;display:grid;place-items:center;font-size:11px;color:#323b44;background:rgba(255,255,255,.45)}
.section{margin:24px 0 0}.section-title{margin:0 0 10px;font-size:12px;color:var(--muted-2)}.chat-item{height:34px;display:flex;align-items:center;padding:0 12px;border-radius:8px;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-item.active{background:rgba(35,44,55,.065)}
.workspace{
  /* Positioning context for the morph overlay. Seamless: no card chrome \u2014
     the shell is the canvas (2026-06-12 seamless-workbench). */
  position:relative;
  height:100%;
  display:grid;
  grid-template-rows:1fr auto;
  /* Pin the implicit column: an auto track sizes to the MAX-CONTENT of every
     item in it, so one long nowrap line in the conversation (the live status
     line's patch-preview step, ~5000px) silently inflated the track \u2014 and
     with it the footer and the approval panel, pushing the flex:1 action
     buttons thousands of px past the overflow clip (the user's "missing
     3 buttons", root-caused live over CDP 2026-06-13). minmax(0,1fr) caps
     the track at the workspace's own width no matter what streams through
     the conversation. */
  grid-template-columns:minmax(0,1fr);
  /* NO overflow:hidden. The approval panel and composer sit flush on this
     box's edges; a clip here amputates their drop shadows everywhere except
     the border-radius cutouts, which then read as square grey corner notches
     (seen live 2026-06-13). The old card needed the clip for its rounded
     chrome; flattened, nothing requires it: the conversation clips itself,
     and the suppressed composer's slide-down is covered by its 0.18s opacity
     fade. */
}
/* Session title reveal \u2014 fade the placeholder out, then typewriter the title. */
.title-text{display:inline}
@keyframes hertaTitleFadeOut{from{opacity:1}to{opacity:0}}
.title-fade-out{animation:hertaTitleFadeOut 220ms ease forwards}
@keyframes hertaCaretBlink{0%,100%{opacity:.55}50%{opacity:0}}
.title-caret{display:inline-block;margin-left:2px;font-weight:400;color:currentColor;animation:hertaCaretBlink 850ms steps(1,end) infinite}
@media(prefers-reduced-motion:reduce){.title-fade-out{animation:none}.title-caret{animation:none;opacity:0}}
.workspace-body{
  min-height:0;
  display:grid;
  /* THREE tracks since ADR 0050: conversation | rail | file viewer. The
     viewer track rests at 0 and the old 24px column gap moved onto the
     conversation's margin-right (gap:0 below) \u2014 an explicit gap beside a
     0-width third track would shove the rail 24px off its resting spot.
     The conversation minimum is 584 = the 560px content floor + its own
     24px margin, so the CONTENT floor is unchanged. Same-count templates
     interpolate, which is what the open/close slide rides.
     --rail-w is the rail track's RESTING width; .utility-rail pins its own
     width to it (2026-09-02), so a collapsing track clips/uncovers a
     full-width card instead of re-centring the device in each frame's
     sliver. */
  --rail-w:338px;
  grid-template-columns:minmax(584px,1fr) var(--rail-w) 0px;
  /* Explicit definite row: without it the implicit auto row is sized by the
     utility rail's fixed card stack (~680px), .workspace{height:100%} can't
     resolve, and the footer + approval panel overflow past the .app clip on
     short viewports (the rail cards flex-shrink gracefully instead). */
  grid-template-rows:minmax(0,1fr);
  gap:0;
  /* The padding as tokens: the rail and the file viewer leave the grid for
     their slides (see the viewer block) and sit absolute on the SAME
     geometry as their tracks \u2014 the offsets below are those tokens, so the
     two can never drift apart (the \u22641200px media block re-tokens both). */
  --body-pad-top:0px;
  --body-pad-right:24px;
  --body-pad-bottom:26px;
  --body-pad-left:28px;
  padding:var(--body-pad-top) var(--body-pad-right) var(--body-pad-bottom) var(--body-pad-left);
  /* The overlay-mode sheet and the sliding rail/panel anchor here. */
  position:relative;
}
/* Mode A \u2014 the rail yields (ADR 0050, owner-picked): the rail track
   collapses while the viewer track opens to the dragged width; the same
   track interpolation the disconnect slide already animates. The min()
   cap is the HARD guarantee (owner 2026-08-31: a maximize\u2192restore left
   the panel wider than the window, its head buttons clipped outside):
   whatever the JS clamp last wrote, the track can never exceed the
   content width minus the conversation's 584px floor. */
.workspace-body.viewer-docked{
  grid-template-columns:minmax(584px,1fr) 0px min(var(--viewer-w,480px), calc(100% - 584px));
}
/* Divider drag: every frame writes --viewer-w; an eased track would lag
   the pointer, so the drag suppresses the slide transitions. */
.workspace-body.is-resizing,
.workspace-body.is-resizing .workspace,
.workspace-body.is-resizing .utility-rail{transition:none}
.conversation{position:relative;min-height:0;padding:4px 10px var(--approval-reserve,0px) 0;overflow-y:auto;overflow-x:hidden;overflow-anchor:none}
/* --approval-reserve (2026-07-27): the approval panel is absolute at the
   footer's bottom and TALLER than the footer, so its top reaches over the
   conversation \u2014 anything streaming while a gate is open (typically Herta's
   beat about the very operation being approved) landed in the covered band
   and "appeared all at once" when the panel exited. ApprovalPanel measures
   its overhang (panel height \u2212 footer height) into this var on the workspace
   node; the padding keeps the flow's tail above the panel. The pinned-follow
   comes FREE: the scroller's own ResizeObserver (Conversation) watches the
   content box, which a padding change resizes, so scrollToEndIfPinned fires
   without any new wiring \u2014 and unpinned readers are untouched by
   construction (bottom padding never moves content above the fold). */
/* Centered readable column (user feedback 2026-07-06): with the left sidebar
   hidden the pane widens and fixed-width bubbles hugging the left edge left
   the middle empty. Cap the flow at a readable measure and center it; at or
   below the cap this is width-neutral (100% width, auto margins collapse). */
.conversation-flow{max-width:var(--flow-measure);margin:0 auto;width:100%}
/* One readable measure for the whole column (owner 2026-08-17): the
   composer and the approval panel used to stretch to the pane's full width
   while the flow above them stayed at 880px centered, so on a maximized
   window the input ran far past both edges of the conversation. The footer
   now caps at the same measure and centers with the flow (the flow sits
   5px left of true centre because of .conversation's 10px scrollbar
   gutter \u2014 under the eye's threshold, and not worth a padding dance that
   would also shift the absolute approval panel). Below the cap nothing
   changes (100% width, auto margins collapse), so the sidebar-open layout
   is untouched. The approval panel is absolute inside the footer
   (left/right 0), so it inherits the same measure. */
.workspace{
  --flow-measure:880px;
  /* The old grid gap, as this item's own margin (ADR 0050 \u2014 see the
     three-track note on .workspace-body). Transitioned because the
     disconnect state zeroes it where it used to zero the gap. */
  margin-right:24px;
  min-width:0;
  transition:margin-right var(--dur-morph) var(--ease-signature);
}
.workspace-footer{width:100%;max-width:var(--flow-measure);margin:0 auto}
/* Turn headroom (2026-07-29): room reserved under the newest turn so a reply
   arrives into a region instead of crawling along the bottom edge. Sized
   imperatively by Conversation (see turn-headroom.ts) \u2014 0 until you send,
   0 again once the turn outgrows the pane. No transition: it is resized on
   the same frames the reply grows, and animating it would put the layout
   permanently behind the text landing in it. */
.turn-headroom{height:0;flex:none;pointer-events:none}
.conversation::-webkit-scrollbar {
  width: 10px;
}
.conversation::-webkit-scrollbar-track {
  background: transparent;
}
.conversation::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.conversation::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
/* \u2500\u2500 Scroll-edge fade (2026-06-12 seamless-workbench \xA74, rev 3) \u2500\u2500\u2500\u2500\u2500 */
/* The shell owns the grid cell; the scroll viewport fills it. */
.conversation-shell {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.conversation-shell > .conversation {
  flex: 1;
}
/* The fade masks the CONTENT itself instead of overlaying frost: text
   dissolves and reveals the true background \u2014 which over the app's
   varying gradient is the only artifact-free option. Overlay strips were
   tried and retired live (2026-06-12): Chromium cannot mask a
   backdrop-filter's output (hard-edged rectangle), stepped-blur stacks
   show their band boundaries, and no flat tint can match a gradient
   backdrop. Masks on normal elements work fine. The faded-zone heights
   are registered custom properties so useScrollEdges' class toggles
   animate smoothly instead of popping. The conversation's own scrollbar
   tips fade with the mask \u2014 accepted trade-off. */
@property --fog-top-h {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}
@property --fog-bottom-h {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}
.conversation-shell > .conversation {
  --fog-top-h: 0px;
  --fog-bottom-h: 0px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fog-top-h),
    #000 calc(100% - var(--fog-bottom-h)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fog-top-h),
    #000 calc(100% - var(--fog-bottom-h)),
    transparent 100%
  );
  transition:
    --fog-top-h 180ms ease,
    --fog-bottom-h 180ms ease;
}
.conversation.has-fog-top {
  --fog-top-h: 44px;
}
.conversation.has-fog-bottom {
  --fog-bottom-h: 40px;
}
/* \u2500\u2500 Jump-to-latest chip (2026-07-11) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   New content landed below a reader who scrolled up mid-stream: pinned
   autoscroll correctly stays off, so this floating pill is the one-click way
   back. Absolutely positioned over the shell's bottom fog. Presence-driven
   (usePresence): the base state is hidden, \`is-open\` slides it up on the
   frame after mount, and dropping \`is-open\` plays the same move in reverse
   while the element stays mounted \u2014 both directions animate (user
   2026-07-11: it used to pop). \`pointer-events: none\` while hidden so a
   half-melted chip can't be clicked. */
.jump-to-latest {
  position: absolute;
  left: 50%;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--ink-a10);
  border-radius: 999px;
  background: var(--pill-bg);
  color: var(--muted-strong);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 6px 18px var(--shadow-pop);
  backdrop-filter: blur(10px) saturate(130%);
  z-index: 3;
  opacity: 0;
  transform: translate(-50%, 8px);
  pointer-events: none;
  transition:
    opacity 0.2s var(--ease-pop),
    transform 0.2s var(--ease-pop);
}
.jump-to-latest.is-open {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}
.jump-to-latest:hover {
  background: var(--pill-bg-strong);
  color: var(--ink);
}
.jump-to-latest:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.jump-to-latest__arrow {
  font-size: 12px;
  line-height: 1;
}
/* Load-earlier paging row (long sessions, 2026-07-12): sits at the TOP of
   the flow when older blocks exist main-side; in-flow (scrolls with the
   history it extends), quiet until hovered. */
.load-earlier {
  display: block;
  margin: 2px auto 18px;
  padding: 5px 14px;
  border: 1px solid var(--hairline);
  border-radius: 999px;
  background: var(--glass-a60);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    background var(--dur-micro) ease,
    color var(--dur-micro) ease;
}
.load-earlier:hover {
  background: var(--pill-bg);
  color: var(--ink);
}
.load-earlier:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
/* \u2500\u2500 Topic guide rail (2026-07-12) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A slim column of horizontal ticks on the conversation's left edge, one
   per topic. Dock-style magnification: TopicRail sets each line's width
   inline (hovered widest, neighbors swelling less with distance); this
   transition is the whole animation \u2014 cursor movement re-targets the
   widths and LEAVING resets them to base, so the same transition plays the
   swell in reverse on the way out. */
.topic-rail {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  z-index: 3;
  /* The rail had no entrance: React mints it in its final state the moment a
     second topic exists, so it appeared between one frame and the next \u2014 next
     to a gutter that now eases open over 220ms, that read as half-animated
     (2026-07-30). Fades in over the same window so the ticks arrive WITH the
     room being made for them. Same @starting-style shape the plan strip uses;
     opacity only, so nothing about the tick geometry moves. */
  transition: opacity 220ms var(--ease-out-soft);
}
@starting-style {
  .topic-rail {
    opacity: 0;
  }
}
/* Reserve a left gutter for the rail ONLY when the centered flow's natural
   margin can't absorb it (user bug 2026-07-12: with the sidebar open the
   880px flow goes full-width and the ticks sat on top of the activity
   LEDs). The 100% is the pane width: at \u2265952px the natural margin is
   already \u226536px (6px rail offset + 28px max swelled line + breathing room)
   and this resolves to 0 \u2014 wide layouts stay perfectly centered; tighter
   panes indent by exactly the shortfall, capped at the gutter width. */
.conversation-flow {
  /* Declared on the BASE rule, not only on the has-rail one, so the property
     has a value to transition FROM. A transition needs both endpoints on the
     same element; setting the padding only in the qualified rule below made
     the rail's first appearance a jump from "no declaration" (user 2026-07-30:
     the bubbles were pushed rightward "suddenly, without animations"). */
  padding-left: 0;
  /* Standard band (see the easing tokens): long enough to read as the column
     making room, short enough not to hold up the reply landing in it. Padding
     is a layout property, so this DOES reflow \u2014 but only the flow's own width,
     once, and the alternative is the instant jump. */
  transition: padding-left 220ms var(--ease-out-soft);
}
/* The gutter itself: only when the centered flow's natural margin can't
   absorb the rail. */
.conversation-shell.has-topic-rail .conversation-flow {
  padding-left: clamp(0px, calc(36px - (100% - 880px) / 2), 36px);
}
/* The rail WINDOWS instead of folding (2026-07-27; the \u22EF fold and its inner
   scroller are gone \u2014 see TopicRail.tsx). A faded end means history continues
   that way: the ticks dissolve over ~2 pitches rather than stopping at a hard
   edge that would read as "this is the last one". Paint-only, so a faded tick
   is still hoverable and clickable. */
.topic-rail__list {
  display: flex;
  flex-direction: column;
  --rail-fade-top: 0px;
  --rail-fade-bottom: 0px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--rail-fade-top),
    #000 calc(100% - var(--rail-fade-bottom)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--rail-fade-top),
    #000 calc(100% - var(--rail-fade-bottom)),
    transparent 100%
  );
}
/* 28px = 2 \xD7 TICK_PITCH. */
.topic-rail__list.has-fade-top { --rail-fade-top: 28px; }
.topic-rail__list.has-fade-bottom { --rail-fade-bottom: 28px; }
.topic-rail__tick {
  border: 0;
  background: transparent;
  padding: 0;
  height: 14px; /* = TopicRail's TICK_PITCH */
  width: 44px; /* stable hit box \u2014 hover zones don't shift as lines swell */
  flex: none;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.topic-rail__line {
  display: block;
  height: 2px;
  border-radius: 999px;
  background: var(--ink-a22);
  transition:
    width 140ms var(--ease-out-soft),
    background 140ms ease;
}
.topic-rail__tick:hover .topic-rail__line,
.topic-rail__tick:focus-visible .topic-rail__line {
  background: var(--ink-a52);
}
/* Scrollspy (2026-07-14): the tick(s) whose topic region the viewport
   currently shows read in full ink \u2014 black on light, near-white on dark
   (the --ink token flips with the theme). Declared after :hover so a
   current tick keeps its ink under the hover swell. */
.topic-rail__tick.is-current .topic-rail__line {
  background: var(--ink);
}
.topic-rail__tick:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
  border-radius: 4px;
}
/* The hovered topic's label: title + anchoring user message, floating beside
   the rail at the hovered tick's height (\`top\` is inline, transitioned so
   it GLIDES between ticks while the pointer walks the rail). A compact
   chip deliberately unlike anything in the record (user 2026-07-12: the
   first white-card version read as another Herta bubble): bubbles and
   panels are frosted surfaces with 18px radii and no border, so the small
   radius, tight padding and hairline border mark it as overlay chrome.
   It was an inverted slate chip until 2026-09-13 (owner: a dark card in
   the light theme is a bug) \u2014 now it is the house pop, the same surface
   as the hover tip and the tooltip pill: --surface-pop, ink text, a
   hairline, so it follows the theme like every other pop. pointer-events
   none \u2014 it's a label, never a hover target, so it can't trap the
   cursor. */
.topic-rail__card {
  position: absolute;
  left: 52px;
  max-width: 250px;
  padding: 7px 11px;
  border: 1px solid var(--ink-a14);
  border-radius: 9px;
  background: var(--surface-pop);
  box-shadow: 0 8px 22px var(--shadow-pop);
  pointer-events: none;
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity 160ms var(--ease-pop),
    transform 160ms var(--ease-pop),
    top 140ms var(--ease-out-soft);
}
.topic-rail__card.is-open {
  opacity: 1;
  transform: translateX(0);
}
.topic-rail__card-title {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.topic-rail__card-preview {
  margin: 0;
  font-size: 11.5px;
  color: var(--muted-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
@media (prefers-reduced-motion: reduce) {
  .topic-rail,
  .topic-rail__line,
  .topic-rail__card,
  /* The rail's gutter appears instantly rather than easing the column over. */
  .conversation-flow {
    transition: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .conversation-shell > .conversation {
    transition: none;
  }
  /* The hover reveal still works; it just snaps instead of fading. */
  .message-actions {
    transition: none;
  }
  /* No withdraw lift under reduced motion (the rewind handler also skips it). */
  .message-row.is-withdrawing,
  .activity-line-group.is-withdrawing {
    animation: none;
  }
  .jump-to-latest {
    transition: none;
  }
}
.avatar-glow{width:45px;height:45px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.58);border:1px solid rgba(17,20,23,.07);box-shadow:0 5px 18px rgba(32,45,58,.06);color:var(--ink);font-size:18px}.avatar-glow::before{content:"\u2661";transform:translateY(-1px)}
.user-turn{display:flex;justify-content:flex-end;gap:14px;margin:0 0 26px}.user-bubble{max-width:430px;padding:15px 18px 13px;border-radius:18px;background:var(--bubble-user);box-shadow:inset 0 1px 0 var(--glass-a62);font-size:15px;line-height:1.42}.time{display:block;margin-top:7px;font-size:12px;color:var(--muted-3);text-align:right}.user-avatar{width:42px;height:42px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.52);border:1px solid var(--ink-a06);color:var(--ink);align-self:center}.assistant-turn{display:grid;grid-template-columns:50px minmax(280px,440px);gap:18px;margin:22px 0 34px 34px}.assistant-card{padding:20px 24px 16px;border-radius:18px;border:1px solid rgba(17,20,23,.105);background:rgba(255,255,255,.64);box-shadow:0 12px 32px rgba(32,45,58,.045),inset 0 1px 0 var(--glass-a72);font-size:16px;line-height:1.62}.assistant-card p{margin:0 0 6px}.assistant-card .time{text-align:left;margin-top:10px}.second-user{margin-top:8px;margin-right:0}.second-assistant{margin-top:14px;margin-left:34px}
.status-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;width:78%;margin:6px auto 26px;color:var(--muted-2);font-size:15px;letter-spacing:.16em}.status-row:before,.status-row:after{content:"";height:1px;background:var(--ink-a11)}.status-core{display:flex;gap:12px;align-items:center;white-space:nowrap}.transfer-icon{width:24px;height:24px;object-fit:contain;opacity:.68;filter:grayscale(1) brightness(.82);letter-spacing:0}.transfer-text{letter-spacing:.16em}
.composer{height:78px;margin-bottom:0;border-radius:18px;border:1px solid var(--hairline);background:var(--composer-bg);box-shadow:0 2px 8px rgba(32,45,58,.10),inset 0 1px 0 var(--glass-a78);padding:0 18px 0 22px;display:flex;align-items:center;justify-content:space-between}.placeholder{font-size:16px;color:var(--muted-4)}.send{width:42px;height:42px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(154,160,181,.55);color:white;font-size:22px;line-height:1;cursor:default}
/* The rail's box is PINNED at the resting track width (--rail-w on
   .workspace-body): its track animates to 0 for the disconnect and
   viewer-open slides, and an unpinned rail shrank with it \u2014 the device
   card re-centred its 216px PNG inside a 90px card (2026-09-02). Fixed
   tracks ignore item size, so the pin never widens the track; while the
   rail overflows its collapsed track it is translated off + faded. */
.utility-rail{grid-column:2;display:flex;flex-direction:column;gap:20px;min-width:0;width:var(--rail-w)}.device-card{position:relative;border-radius:18px;background:var(--speech-card-bg);border:1px solid var(--speech-border);box-shadow:0 18px 48px var(--speech-shadow),inset 0 1px 0 rgba(255,255,255,.82);backdrop-filter:blur(18px) saturate(140%);overflow:hidden;height:330px;display:grid;place-items:center}.device-card:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,var(--glass-a72),var(--glass-a44));pointer-events:none}
.agent-preview{position:relative;width:216px;height:270px;z-index:2}.agent-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none}.agent-shadow{z-index:1;opacity:.85}.agent-device-img{z-index:2}.agent-spill{position:absolute;z-index:3;left:44.56%;top:33.17%;width:41.9%;height:37.1%;transform:translate(-50%,-45%);opacity:.68;pointer-events:none;mix-blend-mode:screen;filter:blur(5px);background:radial-gradient(ellipse 20% 20% at 50% 38%,rgba(230,255,255,.64) 0%,rgba(126,236,255,.48) 42%,rgba(85,156,255,.20) 70%,rgba(85,156,255,0) 100%),radial-gradient(ellipse 42% 42% at 50% 38%,rgba(98,156,255,.54) 0%,rgba(72,133,255,.38) 38%,rgba(80,140,255,.18) 66%,rgba(80,140,255,0) 86%),radial-gradient(ellipse 54% 62% at 50% 44%,rgba(125,190,255,.34) 0%,rgba(95,150,255,.22) 46%,rgba(95,150,255,.08) 72%,rgba(95,150,255,0) 90%);animation:spillBreathe var(--agent-breathe-duration) ease-in-out infinite}.agent-ring{position:absolute;z-index:4;left:44.56%;top:33.17%;width:8.91%;height:7.49%;transform:translate(-50%,-50%);opacity:var(--agent-ring-opacity);animation:ringBreathe var(--agent-breathe-duration) ease-in-out infinite}.agent-ring svg{width:100%;height:100%;display:block;overflow:visible}@keyframes ringBreathe{0%,100%{opacity:.93;transform:translate(-50%,-50%) scale(.997);filter:brightness(.98) saturate(1.03)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.012);filter:brightness(1.10) saturate(1.12)}}@keyframes spillBreathe{0%,100%{opacity:.50;transform:translate(-50%,-45%) scale(.992)}50%{opacity:.66;transform:translate(-50%,-45%) scale(1.012)}}.disclaimer{height:34px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted-2);border-top:1px solid rgba(17,20,23,.045);background:var(--strip-bg)}
/* Morph-flight frost suspension (perf 2026-07-13): the device card's
   backdrop-filter re-samples its backdrop EVERY FRAME while the card is
   MOVING \u2014 and the rail slides exactly during the connect/reconnect
   morphs. Its backdrop is the app's near-uniform frosted shell, so
   dropping the blur for the ~800ms slide is invisible in motion; it
   restores the moment the morph classes clear. (Second-largest term in
   the 3440\xD71440 morph profile after .app's backdrop-filter.) */
.app:has(.workspace.is-reconnecting) .device-card,
.app:has(.workspace.is-morphing) .device-card {
  backdrop-filter: none;
}
@media(max-width:1200px){.app{grid-template-columns:230px 1fr}.sidebar{--sidebar-content-w:176px}.workspace-body{--rail-w:300px;grid-template-columns:minmax(0,1fr) var(--rail-w) 0px;gap:0;--body-pad-top:18px;--body-pad-right:18px;--body-pad-bottom:18px;--body-pad-left:18px}.workspace{margin-right:18px}.workspace-body.viewer-docked{grid-template-columns:minmax(0,1fr) 0px min(var(--viewer-w,420px), calc(100% - 440px))}.assistant-turn{margin-left:0}.status-row{width:90%}.device-card{height:300px}.composer{height:104px}}
@media(max-width:900px){.utility-rail{display:none}.workspace-body{grid-template-columns:minmax(0,1fr) 0px 0px}.workspace{margin-right:0}.app{grid-template-columns:210px 1fr}.sidebar{--sidebar-content-w:156px}}
/* Slice 3 additions \u2014 Conversation message rows and bubbles */
.message-row {
  position: relative; /* anchor for the hover-reveal timestamp below the bubble */
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin: 0 0 26px;
}
/* Long-session layout cost (user 2026-07-12: toggling the sidebar on a
   240-block session lagged visibly vs short ones \u2014 the 220ms grid-column
   animation re-lays-out and re-WRAPS every row on every frame, and the
   same storm hits the connect morph and composer-height moves). With
   content-visibility, off-screen rows skip layout and paint entirely, so
   each animation frame costs only the ~dozen visible rows regardless of
   session length. \`auto\` intrinsic sizing remembers a row's REAL height
   after its first layout \u2014 scroll geometry stays honest; 72px is only the
   pre-first-layout estimate for rows that have never been on screen.
   Chromium-only app, fully supported.

   ACTIVITY GROUPS ONLY \u2014 not .message-row: content-visibility imposes
   paint containment, which clips descendants to the row's padding box,
   and a bubble row's hover-reveal action row (.message-actions, absolute
   at top:100%) lives BELOW that box in the inter-row margin \u2014 the clip
   silently killed the hover timestamp + rewind tooltip (user 2026-07-12).
   Bubble rows are shallow (one wrapped paragraph) and the real toggle
   cost was scripting (fixed by memoizing the row tree), so they can
   afford per-frame layout; activity groups are the tall multi-line
   subtrees and have no overflowing hover UI, so they stay skipped. */
.activity-line-group {
  content-visibility: auto;
  contain-intrinsic-size: auto 72px;
}
.user-row {
  justify-content: flex-end;
}
.herta-row {
  /* Left edge shared with the activity rows (--record-left). This was 34px \u2014
     the avatar gutter of the lifted UX_v5 stylesheet, kept after the avatars
     went (bubbles.test.tsx pins that there are none), which left her bubbles
     indented 26px past the \u5DEE\u5206\u534F\u5904\u7406\u5668 line right under them. */
  margin: 22px 0 34px var(--record-left, 8px);
}
/* Bubble STACK (slice 5): one multi-paragraph utterance renders as several
   stacked bubbles over ONE record block. Non-final bubbles of a stack sit
   tight (intra-stack gap \u226A inter-message gap) so the stack reads as one
   speaker sending several messages in a burst. */
.herta-row.is-stack-mid {
  margin-bottom: 10px;
}
.message-bubble {
  /* common bubble shell */
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.42;
}
/* .user-bubble already defined in minified block above; supplement here */
.herta-bubble {
  /* FIXED wrap measure (bug 2026-07-09): this was min(76%, 630px), but the
     conversation column's width ANIMATES (the 800ms rail slide-in on
     connect, the 220ms sidebar collapse \u2014 both transition
     grid-template-columns), and a %-based max-width makes the text
     re-wrap live through the whole animation ("lines changing" on cold
     start / sidebar toggle). A fixed measure keeps the wrap stable
     whenever the column is \u2265 the cap \u2014 same trick as the sidebar's
     pinned content width. On columns narrower than the cap the flex row
     still constrains the bubble naturally. Within the 880px flow this
     tops out at ~630px (user feedback 2026-07-06). */
  max-width: 630px;
  padding: 20px 24px 16px;
  border-radius: 18px;
  border: 1px solid var(--bubble-border);
  background: var(--bubble-herta);
  box-shadow: 0 12px 32px rgba(32, 45, 58, 0.045), inset 0 1px 0 var(--glass-a72);
  font-size: 16px;
  line-height: 1.62;
}
.message-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
/* Leaked fenced code (slice 5 Q1): a frosted evidence card in the flow \u2014
   the same glass language as the herta bubble (translucent white, hairline
   border, inset top highlight, soft shadow) so it reads as part of the UX,
   with a slim header carrying the fence's lang tag as a slate chip. The
   CONTENT stays deliberately unrewarding (no highlighting, no copy
   affordance \u2014 the record is the prompt; heavy content belongs in the \u677F\u7816
   evidence lane). Renders OUTSIDE the speech bubble (user feedback
   2026-07-06: code is not speech) as its own row in the stack. */
.code-standalone {
  min-width: 0;
  /* Wider than a speech bubble (code wants line length), still bounded.
     FIXED (not %) for the same wrap-stability reason as .herta-bubble. */
  max-width: 720px;
  border-radius: 16px;
  border: 1px solid var(--ink-a09);
  background: var(--glass-a55);
  box-shadow:
    0 10px 28px rgba(32, 45, 58, 0.05),
    inset 0 1px 0 var(--glass-a72);
  overflow: hidden; /* clip the scrolling body to the card radius */
}
.code-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-bottom: 1px solid rgba(17, 20, 23, 0.055);
  background: var(--strip-bg);
}
.code-card__lang {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--muted-slate);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.code-block {
  margin: 0;
  padding: 12px 16px 14px;
  border: 0;
  background: transparent;
  color: var(--ink-2);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre;
  overflow-x: auto;
}
/* Match the conversation's slim scrollbar (user feedback 2026-07-06) \u2014 the
   default chunky OS bar broke the glass card. Same pill-thumb treatment,
   horizontal orientation. */
.code-block::-webkit-scrollbar {
  height: 10px;
}
.code-block::-webkit-scrollbar-track {
  background: transparent;
}
.code-block::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.code-block::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
/* Inline \`code\` spans: monospace, backticks left visible (the streamed and
   committed characters are identical \u2014 only the styling changes). */
.message-text .inline-code {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.92em;
  background: var(--ink-a05);
  border-radius: 4px;
  padding: 0 3px;
}
/* Hover-revealed action row \u2014 Codex/Claude-style: [rewind] \u2026 timestamp. It sits
   just below the bubble in the inter-message gap and stays hidden until the
   bubble (or the row itself) is hovered. Absolute so it never adds height or
   shifts the thread; opacity (not display:none) keeps the time in the
   accessibility tree. padding-top (not margin) keeps the row's box TOUCHING the
   bubble bottom, so there's no dead zone when the cursor travels down onto the
   rewind button. */
.message-actions {
  position: absolute;
  top: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 5px;
  opacity: 0;
  pointer-events: none; /* hidden row never intercepts gap clicks/scroll */
  transition: opacity var(--dur-micro) ease;
}
.user-row .message-actions {
  right: 0;
}
.herta-row .message-actions {
  left: 0;
}
.message-actions__time {
  font-size: 12px;
  color: var(--muted-3);
  white-space: nowrap;
}
.message-rewind {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin: -2px 0;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--muted-3);
  cursor: pointer;
  transition: background 130ms ease, color 130ms ease;
}
.message-rewind:hover {
  background: var(--wash-3);
  color: var(--ink-2);
}
.message-rewind:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
/* No rewinding a turn that is still running (2026-07-30). This was a withheld
   prop, which made the turn's status an input to every row's render \u2014 one
   send re-rendered the whole session for a control that lives on one row. The
   handler holds the real guard (it re-checks the store on click); this is only
   the affordance. \`display: none\` and not opacity, so it also leaves the tab
   order while it cannot be used. */
/* The attachment take-back hides the same way while a turn runs (2026-09-03):
   its factory used to be withheld mid-turn, which re-rendered every
   historical activity group at each turn boundary. The handler now checks
   the live status; the control just is not shown. */
.conversation-flow.is-busy .activity-step__remove {
  display: none;
}
.conversation-flow.is-busy .message-rewind {
  display: none;
}
.message-rewind-svg {
  width: 15px;
  height: 15px;
  stroke-width: 1.8;
  /* Point the u-turn arrow leftward (back/rewind) rather than down. */
  transform: rotate(90deg);
}
/* Revealed while hovering the bubble OR the row itself (so the cursor can land
   on the rewind button); the row turns interactive only while revealed. */
.message-bubble:hover + .message-actions,
.message-actions:hover {
  opacity: 1;
  pointer-events: auto;
}
/* Withdraw animation (rewind): the latest user turn + everything below it fades
   and lifts just before the record truncation unmounts the rows. */
@keyframes rewind-withdraw {
  to {
    opacity: 0;
    transform: translateY(-6px) scale(0.985);
  }
}
.message-row.is-withdrawing,
.activity-line-group.is-withdrawing {
  animation: rewind-withdraw 220ms ease forwards;
  pointer-events: none;
}
.system-row,
.backend-row {
  margin: 10px 0 14px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--ink-a03);
  border: 1px solid var(--ink-a06);
}
.system-label,
.backend-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 6px;
  text-transform: none;
}
.system-body,
.backend-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted-strong);
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
}

/* Slice 3 additions \u2014 SessionItem (sidebar list items) */
.session-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.session-item__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  /* Reserve the height of the tallest right-slot control (the \u786E\u8BA4\u5220\u9664 pill)
     so swapping trash \u2192 pill \u2014 or a single-line card showing the pill \u2014 never
     changes the row height. */
  min-height: 22px;
}
.session-item:hover {
  background: var(--wash-1);
}
.session-item.is-active {
  background: var(--wash-2);
}
/* Session separation (adopted D1, 2026-06-13, replacing the O1 outlines):
   a center-fading gradient crease between CONSECUTIVE cards within a group
   \u2014 group labels already separate across groups. Drawn in the inter-card
   gap via a ::before on the follower, so the rounded hover/active tints
   stay untouched. */
.session-group > .session-item + .session-item {
  position: relative;
  margin-top: 5px;
}
.session-group > .session-item + .session-item::before {
  content: "";
  position: absolute;
  top: -3px;
  left: 10px;
  right: 10px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--hairline-strong) 28%,
    var(--hairline-strong) 72%,
    transparent
  );
  pointer-events: none;
}
.session-group {
  margin-top: 12px;
}
.session-group-label {
  padding: 0 12px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--label-soft);
}

/* Slice 3 additions \u2014 Composer textarea + send button */
.composer-input-wrap {
  position: relative;
  flex: 1;
  display: flex;
}
.composer-input {
  flex: 1;
  resize: none;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: transparent;
  caret-color: var(--ink);
  line-height: 1.5;
  outline: none;
  padding: 0;
  /* Always-reserved gutter (overflow-y: scroll), never auto: the highlight
     layer below paints the visible text at the SAME wrap width, so the
     scrollbar must not appear/disappear and shift the textarea's content
     box out from under it \u2014 the highlight compensates with a constant
     padding-right matching the 10px gutter. Track is transparent; nothing
     paints until the input actually overflows. */
  overflow-y: scroll;
  overflow-x: hidden;
}
/* Match the conversation's slim scrollbar (user feedback 2026-07-23) \u2014 the
   default chunky OS bar (arrow buttons and all) sat inside the glass
   composer on multi-line input. Same pill-thumb treatment. */
.composer-input::-webkit-scrollbar {
  width: 10px;
}
.composer-input::-webkit-scrollbar-track {
  background: transparent;
}
.composer-input::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.composer-input::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
/* The textarea text is transparent (the highlight layer below shows it), so the
   browser's default selection paints an opaque band over that dark highlight
   text and muddies it. Paint a light translucent band + visible ink ON the
   textarea selection so the selected text stays legible. (Bubbles keep the
   browser default \u2014 their dark text IS the selected element.) */
.composer-input::selection {
  background: rgba(77, 134, 255, 0.3);
  color: var(--ink);
}
.composer-highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  font: inherit;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  pointer-events: none;
  /* Wrap-parity with the textarea's always-reserved 10px scrollbar gutter
     (see .composer-input) \u2014 without this the two layers wrap long lines at
     different columns and the caret drifts off the visible glyphs. */
  padding-right: 10px;
}
.composer-mention {
  background: rgba(77, 134, 255, 0.12);
  color: var(--mention-ink);
  border-radius: 6px;
  /* no padding; weight inherited (400) \u2014 metric-safe so the caret aligns */
}
.composer-ghost {
  color: rgba(77, 134, 255, 0.55);
}
.composer-input::placeholder {
  color: var(--muted-4);
}
/* Attachment take-back (ADR 0033). Hidden until the row is hovered or the
   button itself is focused \u2014 a persistent \u2715 on every attachment row would
   make a destructive action the most eye-catching thing in the history, and
   keyboard users still reach it via :focus-visible. */
.activity-step__remove {
  flex: none;
  align-self: flex-start;
  width: 20px;
  height: 20px;
  /* \`* { box-sizing: border-box }\` is set globally, so the UA's default
     button padding (1px 6px) is subtracted from the 20px box rather than
     added to it: the content box collapses to 8px wide and the glyph centres
     on THAT, sitting visibly off-centre in the hover square (owner
     2026-08-10). Zero the padding and the border-box IS the content box. */
  padding: 0;
  /* Buttons inherit a text line-height that adds phantom leading around an
     inline SVG child; \`display: block\` on the icon plus 0 here removes it. */
  line-height: 0;
  border: 0;
  border-radius: 5px;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--muted-4);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    color 0.12s ease,
    background 0.12s ease;
}
.activity-step__remove svg {
  display: block;
}
.activity-step:hover .activity-step__remove,
.activity-step__remove:focus-visible {
  opacity: 1;
}
.activity-step__remove:hover {
  color: var(--danger, #d9534f);
  background: var(--ink-a08, rgba(0, 0, 0, 0.06));
}
/* The \u2715 shares a row with the BODY, not with the whole text column (owner
   2026-08-10). The first cut shrank \`.activity-step__text\` instead, which
   worked until the detail pane opened \u2014 the column then sized to the pane's
   width and carried the \u2715 rightward with it. Pairing the control with the
   headline makes it track the filename in both states, and the toggle and
   detail below keep the column's full width. */
.activity-step__headline {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
/* The headline body is one line (the filename is middle-truncated in JS), so
   the \u2715 never gets pushed onto a wrap. \`.activity-step__body\` is pre-wrap for
   command output and diffs, which must keep their newlines \u2014 so this override
   is scoped to the headline of a REMOVABLE row rather than loosened there. */
.activity-step__headline:has(.activity-step__remove) .activity-step__body {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Attach (ADR 0033). A quiet ghost button, not a second primary: attaching is
   an occasional act beside an every-message one, and two filled circles either
   side of the input would read as a choice between them. Positioned for the
   same reason as .composer-send \u2014 the .composer-wave layer is a positioned
   first child, and non-positioned in-flow content slips beneath it. */
.composer-attach {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--muted-3);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    opacity 0.15s ease;
}
.composer-attach svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.composer-attach:hover:not(:disabled) {
  color: var(--ink);
  background: var(--ink-a08, rgba(0, 0, 0, 0.06));
}
.composer-attach:disabled {
  opacity: 0.4;
  cursor: default;
}
/* Drop target. Only the border and a faint wash change \u2014 the composer is a
   text field first, and a full-surface overlay during a drag would hide the
   draft the user is about to attach a file to. */
.composer.is-dragover {
  border-color: var(--mention-ink, #4d86ff);
  box-shadow: 0 0 0 1px var(--mention-ink, #4d86ff) inset;
}
.composer-send {
  /* Positioned so it paints above the .composer-wave layer (a positioned
     first child); non-positioned in-flow content would slip beneath it. */
  position: relative;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ink-a72);
  color: var(--ink-inverse);
  line-height: 1;
  cursor: pointer;
  /* background included: the disabled grey \u2194 active dark change rides the
     send \u2194 stop morph (turn start re-enables the button), so it must ease
     with the glyph cross-fade rather than snap. */
  transition:
    opacity 0.15s,
    background 0.2s ease;
}
/* The arrow is DRAWN (SendArrowIcon), not the \u2191 text character \u2014 font
   metrics rendered the character thin and small inside the circle and
   varied per font (same failure mode as the stop square below; owner
   2026-08-19 against Codex's button). 23px box + 2.1 viewBox-unit stroke
   are the owner's pick from the design-gallery playground (2026-08-20).
   Shared by the two morph clones that impersonate this button so the glyph
   cannot drift between them; the smaller connect-clone circle scales it
   down below (30/38 of the real button \u2014 the stroke, in viewBox units,
   scales with it). */
.composer-send__glyph--send svg,
.connect-morph-clone-send svg,
.reconnect-morph-clone-arrow svg {
  display: block;
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.1;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.connect-morph-clone-send svg {
  width: 18px;
  height: 18px;
}
.composer-send:disabled {
  background: rgba(154, 160, 181, 0.55);
  cursor: default;
}
/* SEND \u2194 STOP morph: one persistent button; the \u2191 arrow and the stop square
   are stacked in the same grid cell and cross-fade + scale on \`.is-stop\`, so
   the mode change reads as the button transforming instead of an abrupt
   element swap (user 2026-07-04). */
.composer-send__glyph {
  grid-area: 1 / 1;
  display: grid;
  place-items: center;
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.composer-send__glyph--send {
  opacity: 1;
  transform: scale(1);
}
.composer-send.is-stop .composer-send__glyph--send {
  opacity: 0;
  transform: scale(0.4);
}
/* A sized box, not a \u25A0 text glyph \u2014 the glyph's font metrics rendered it
   tiny (12px font \u2248 a 7px square) and varied per font; 13px reads as the
   conventional stop icon inside the 38px circle. */
.composer-send__glyph--stop {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  background: currentColor;
  opacity: 0;
  transform: scale(0.4);
}
.composer-send.is-stop .composer-send__glyph--stop {
  opacity: 1;
  transform: scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .composer-send,
  .composer-send__glyph {
    transition: none;
  }
}

/* Composing caret on the live streaming bubble: a soft pulsing bar at the
   text tail. Its job is to keep a verdict-gated HOLD (the paced stream parks
   near the end while the supervisor thinks) reading as "still composing"
   rather than frozen. Inline-block rides the text baseline; the pulse is
   opacity-only (composited, no layout). */
.streaming-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  /* Baseline-relative, NOT text-bottom: text-bottom pinned the bar's foot to
     the font's descender line, so next to CJK glyphs (which fill roughly
     -0.12em\u20260.88em of the em square) it hung too low and fell short at the
     top (user 2026-07-04). Dropping the 1em bar 0.12em below the baseline
     centers it on the ideograph's visual box. */
  vertical-align: -0.12em;
  background: currentColor;
  opacity: 0.6;
  animation: streaming-caret-pulse 1.1s ease-in-out infinite;
}
@keyframes streaming-caret-pulse {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 0.15;
  }
}
@media (prefers-reduced-motion: reduce) {
  .streaming-caret {
    animation: none;
    opacity: 0.4;
  }
}

/* Slice 3 additions \u2014 drag-to-lift settle-back transitions */
/* The lift group (device body + spill + ring) is the element that rises
   on drag and eases back on release. It fills .agent-preview so its
   absolutely-positioned children keep their percentage offsets. */
.agent-lift-group {
  position: absolute;
  inset: 0;
  transition: transform 300ms ease-out;
}
.agent-device-img {
  transition: transform 300ms ease-out;
}
.agent-shadow {
  transition: transform 300ms ease-out, opacity 300ms ease-out;
  /* Anchor the shrink to the ground contact so the shadow stays put and
     only gets smaller/fainter as the device lifts \u2014 scaling from the box
     center would drag the (below-center) shadow visibly upward. The
     shadow is the 3D scene's contact shadow (ADR 0057 \xA72.14), the soft
     band under the device's base, which sits at 83.2 % of the box. */
  transform-origin: 50% 84%;
}

/* Device LED shader layer (2026-07-12): one WebGL canvas replacing the
   .agent-spill gradient div + .agent-ring SVG stack. Sits above the device
   PNG (z2) exactly where the spill (z3) / ring (z4) layers lived; inside
   .agent-lift-group so drag-to-lift carries it. The legacy stack stays in
   the DOM as the no-WebGL fallback \u2014 hidden unless the canvas flags that
   GL init or the shader compile failed.
   Since ADR 0057 \xA72.14 the pass draws the 3D scene's own lamp layer \u2014
   the lamp's light on the device \u2014 and it is LIGHT: plus-lighter adds it
   to whatever is under it (the art, the card), the way emission adds in
   the scene. */
.device-glow-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
  mix-blend-mode: plus-lighter;
}
.device-glow-fallback {
  display: none;
}
.device-glow-canvas[data-fallback="true"] {
  display: none;
}
/* display: contents, not block: .agent-spill/.agent-ring position against
   the nearest positioned ancestor (.agent-lift-group) \u2014 an intermediate box
   would need its own inset:0 plumbing for nothing. */
.device-glow-canvas[data-fallback="true"] + .device-glow-fallback {
  display: contents;
}

/* 3D device card (ADR 0057): one canvas filling the card's content box \u2014
   the baked room is the card's background, the device framed to the flat
   render's silhouette height. Stacked under .agent-preview (z2, the drag
   surface) and .card-menu (z5), over the card's own frost. The flat stack
   stays in the DOM and is hidden only while the scene is LIVE (a frame has
   been presented), so the card is never blank: no GPU path, a load failure
   or a lost device drops the attribute and the renders return. */
.device-scene-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}
/* While a scene is EXPECTED (\xA72.13) the flat device shows THROUGH FROSTED
   GLASS \u2014 an 8 px blur of the art that is already there, the lamp still
   breathing behind it \u2014 so the card is never blank, and on the scene's
   first frame the glass clears: the flat stack sharpens and fades out
   over the 3D canvas fading in, the same silhouette, so it reads as the
   device coming into focus (owner 2026-09-07: an empty white card that
   "suddenly changed" to 3D). A prepared blurred 3D picture would have to
   match the live scene's theme, hour, weather and lamp, and go stale with
   every lighting tune; the live art matches by construction. Visibility
   follows the fade so the hidden stack costs nothing afterwards. */
.device-card[data-scene="pending"] .agent-lift-group,
.device-card[data-scene="pending"] .agent-shadow {
  filter: blur(8px);
  opacity: 0.92;
}
.device-card[data-scene="live"] .agent-lift-group,
.device-card[data-scene="live"] .agent-shadow {
  filter: blur(0);
  opacity: 0;
  visibility: hidden;
}
.device-card[data-scene] .agent-lift-group {
  transition:
    transform 300ms ease-out,
    filter 700ms ease,
    opacity 700ms ease,
    visibility 0s linear 700ms;
}
.device-card[data-scene] .agent-shadow {
  transition:
    transform 300ms ease-out,
    filter 700ms ease,
    opacity 700ms ease,
    visibility 0s linear 700ms;
}
.device-scene-canvas {
  opacity: 0;
  transition: opacity 700ms ease;
}
.device-card[data-scene="live"] .device-scene-canvas {
  opacity: 1;
}
/* The glass proper (\xA72.13, owner: the flat art is a different drawing of
   the device \u2014 "make the frosted images from the 3D rendered results"):
   the scene's own last rendering, a quarter-size JPEG kept per theme, or
   the bundled rendering of the scene until one exists (never the flat
   art, which is the device alone since \xA72.14), stretched over the canvas
   box and blurred; scaled up a little so the blur's transparent fringe
   stays outside the card. With it the flat stack is not shown at all. It
   clears with the same focus as the rest. */
.device-frost {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  object-fit: fill;
  transform: scale(1.06);
  filter: blur(8px);
  opacity: 1;
  transition:
    filter 700ms ease,
    opacity 700ms ease,
    visibility 0s linear 700ms;
}
.device-card[data-scene="live"] .device-frost {
  filter: blur(0);
  opacity: 0;
  visibility: hidden;
}
.device-card.has-frost[data-scene="pending"] .agent-lift-group,
.device-card.has-frost[data-scene="pending"] .agent-shadow {
  visibility: hidden;
  transition: none;
}

/* Slice 3 addition \u2014 reset UA button styles on .agent-preview (Task 13
   changed the element from <div> to <button> for a11y; UA defaults
   would otherwise distort the 4-layer composite). */
button.agent-preview {
  border: 0;
  background: transparent;
  padding: 0;
  appearance: none;
  -webkit-appearance: none;
  font: inherit;
  color: inherit;
  cursor: default;
}
/* The grab cursor only over the DEVICE (owner 2026-09-07: "the draggable
   area is obviously larger than the device"): the drag hook ignores a
   press off the silhouette, and the cursor says the same. The box is
   DEVICE_SILHOUETTE in dragTracker.ts \u2014 the flat art's opaque extent,
   which the 3D device is framed to. A pseudo-element carries the cursor
   so the button stays one element for events and a11y. */
.agent-preview::after {
  content: "";
  position: absolute;
  left: 24.91%;
  top: 16.79%;
  width: 50.18%;
  height: 66.43%;
  cursor: grab;
}
.agent-preview.is-lifting,
.agent-preview.is-lifting::after {
  cursor: grabbing;
}

/* Slice 3 additions \u2014 CardMenu */
.card-menu {
  position: absolute;
  top: 18px;
  right: 20px;
  z-index: 5;
}
.card-menu-button {
  background: transparent;
  border: 0;
  color: var(--speech-menu, rgba(17, 20, 23, 0.45));
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
}
.card-menu-button:hover {
  background: var(--ink-a06);
}
.card-menu-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  max-width: 280px;
  padding: 10px 12px;
  background: var(--card-solid);
  border: 1px solid var(--ink-a07);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(32, 45, 58, 0.12);
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-3);
  z-index: 10;
  transform-origin: top right;
  animation: cardMenuIn 130ms var(--ease-out-soft) both;
}
.card-menu-tooltip.is-leaving {
  animation: cardMenuOut 120ms ease both;
  pointer-events: none;
}
@keyframes cardMenuIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cardMenuOut {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
}
@media (prefers-reduced-motion: reduce) {
  .card-menu-tooltip,
  .card-menu-tooltip.is-leaving {
    animation: none;
  }
}

/* Task 10 \u2014 device-card workspace action menu (role="menu"). Reuses the
   tooltip's frame; the rules below restyle it into a vertical action list
   so the padded info copy gives way to a path readout + tappable items. */
.card-menu-tooltip[role="menu"] {
  /* Fixed width so the menu doesn't collapse to the buttons' width and
     char-wrap the path \u2014 fits inside the ~338px utility rail. */
  width: 280px;
  padding: 4px 0;
}
.card-menu-current {
  padding: 8px 12px;
}
.card-menu-label {
  display: block;
  font-size: 11px;
  color: var(--muted-3);
}
.card-menu-path {
  display: block;
  margin-top: 2px;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo,
    Consolas, "DejaVu Sans Mono", monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--ink-3);
  /* Wrap at the <wbr> separators emitted by breakablePath; fall back to
     breaking an over-long single segment rather than overflowing. */
  overflow-wrap: anywhere;
}
.card-menu-divider {
  height: 1px;
  background: var(--ink-a06);
  margin: 2px 0;
}
.card-menu-item {
  display: block;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  font-size: 12px;
  color: var(--ink-3);
}
.card-menu-item:hover {
  background: var(--ink-a06);
}
.card-menu-item:disabled {
  color: var(--muted-faint);
  cursor: default;
  background: transparent;
}
.card-menu-error {
  padding: 6px 12px 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #c0392b;
}
/* ADR 0030 \u2014 project command rules, managed in THIS menu (owner 2026-08-04:
   session-scoped state next to the workspace it binds to, not in Settings).
   Empty state is one dim line; many rules scroll inside a capped list so the
   menu never outgrows the rail. */
.card-menu-rules {
  padding: 6px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-menu-rules-empty {
  font-size: 11px;
  color: var(--muted-slate);
}
.card-menu-rules-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 96px;
  overflow-y: auto;
}
.card-menu-rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.card-menu-rule-text {
  font-family: var(--mono, ui-monospace, "SF Mono", Menlo, monospace);
  font-size: 11px;
  color: var(--slate-deep);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-menu-rule-remove {
  flex: none;
  border: 0;
  background: transparent;
  color: var(--muted-slate);
  font-size: 11px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 6px;
  cursor: pointer;
}
.card-menu-rule-remove:hover {
  color: #9a5b5b;
  background: rgba(154, 91, 91, 0.1);
}

/* Slice 3.1 addition \u2014 frameless-window drag strip (SPEC v0.3 \xA75.1.1).
   Full-width transparent strip pinned to the window top, behind the
   card (z-index 0). It only catches drags where the green margin shows;
   over the card (z-index 1) the card wins, so card interaction is
   unaffected. The native Windows Controls Overlay min/max/close buttons
   are OS-drawn at the top-right above all web content. Height matches
   titleBarOverlay.height (40px) in the main process. */
.titlebar-drag {
  position: fixed;
  top: 0;
  left: 0;
  /* Stop BEFORE the custom caption buttons (3 \xD7 46px + margin): a drag
     region reports its rect to the OS as title-bar caption, which swallows
     ALL mouse events there \u2014 relying on the buttons' no-drag to punch a
     hole through an overlapping drag rect proved unreliable (user bug
     2026-07-06: buttons visible but dead to hover/click). Geometric
     non-overlap is deterministic. On macOS (no custom buttons) this only
     costs a small non-draggable corner. */
  right: 140px;
  height: 40px;
  z-index: 0;
  -webkit-app-region: drag;
}
/* Custom caption buttons (user 2026-07-06 \u2014 replaces titleBarOverlay, whose
   Chromium tooltips could not be disabled and doubled on Windows). Windows
   metrics: 46\xD740 hit targets; the close button turns the system red on
   hover. No title attributes anywhere \u2192 nothing pops on hover. High z so
   the buttons stay clickable above modals/overlays (the native ones were). */
.window-controls {
  position: fixed;
  top: 0;
  right: 0;
  height: 40px;
  display: flex;
  z-index: 4000;
  -webkit-app-region: no-drag;
}
.window-controls__btn {
  width: 46px;
  height: 40px;
  border: 0;
  padding: 0;
  background: transparent;
  display: grid;
  place-items: center;
  color: var(--wc-ink);
  cursor: default;
  /* Belt-and-suspenders with the container's no-drag: the buttons must
     never be classified as caption area. */
  -webkit-app-region: no-drag;
}
.window-controls__btn:hover {
  background: var(--ink-a06);
}
.window-controls__btn:active {
  background: var(--ink-a11);
}
.window-controls__btn.is-close:hover {
  background: #e81123;
  color: var(--ink-inverse);
}
.window-controls__btn.is-close:active {
  background: #f1707a;
  color: var(--ink-inverse);
}
.window-controls__btn:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: -2px;
}

/* Slice 3.1 \u2014 WCO caption-button clearance (SPEC v0.3 \xA75.1.1).
   The native min/max/close buttons render at the window's top-right,
   ~40px tall (titleBarOverlay.height). The card's top-right column is
   the utility rail, whose DeviceCard has an interactive \u22EF menu near the
   top. To keep the buttons floating in the green gutter ABOVE the card
   (never over card content), the top gutter must stay \u2265 the button
   height. The full-size layout leaves ~52px, but the lifted
   @media(max-width:1200px) rule shrinks the card margin to 18px \u2014 this
   override restores \u226548px of vertical gutter (24px top) at that
   breakpoint. Overrides only \`height\`; the lifted rule's width and
   grid-template-columns still apply (later same-specificity rule wins). */
@media (max-width: 1200px) {
  .app {
    height: calc(100vh - 96px);
  }
}

/* Control-button styling. Shared by the TopBar buttons (the controls moved
   out of the sidebar into the full-width top bar on 2026-06-01); the class
   name is retained for low-churn reuse. */
.sidebar-header-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-2);
  opacity: 0.78;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.sidebar-header-icon:hover {
  background: var(--ink-a05);
  opacity: 1;
}
.sidebar-header-icon + .sidebar-header-icon {
  margin-left: 8px;
}
/* Inline outline SVG icons (TopBar/icons.tsx). Rendered inline so CSS owns
   stroke-width + color: a quiet, translucent light grey at rest (the button's
   opacity: 0.78 above keeps it soft), deepening to dark with a bolder outline
   on hover / keyboard focus / active. */
.sidebar-header-icon-svg {
  width: 18px;
  height: 18px;
  display: block;
  color: var(--muted);
  stroke-width: 1.5;
  transition:
    color 120ms ease,
    stroke-width 120ms ease;
}
.sidebar-header-icon:hover .sidebar-header-icon-svg,
.sidebar-header-icon:focus-visible .sidebar-header-icon-svg,
.sidebar-header-icon.is-active .sidebar-header-icon-svg {
  color: var(--ink-2);
  stroke-width: 2;
}
@media (prefers-reduced-motion: reduce) {
  .sidebar-header-icon-svg {
    transition: none;
  }
}
.sidebar-header-icon.is-active {
  /* Stronger tint than :hover (0.05) so an open/toggled state reads as
     distinct from a passing hover. */
  background: var(--ink-a10);
  opacity: 1;
}

/* \u2500\u2500 TopBar control strip (2026-06-01 topbar-controls-layout) \u2500\u2500 */
.topbar {
  grid-column: 1 / -1;
  /* Pin to row 1 explicitly so a future reorder of .app's children can't
     push the bar into the content row. */
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  /* Keep this SECOND drag rect clear of the custom caption buttons (its
     border box spanned the full width and re-covered the corner the
     buttons' no-drag had punched out \u2014 the 2nd dead-buttons bug,
     2026-07-06). Content is left-aligned, so the shrink is invisible. */
  margin-right: 140px;
  -webkit-app-region: drag;
}
/* macOS keeps its native traffic lights, and with titleBarStyle "hidden" the
   OS draws them INSIDE this window's top-left \u2014 over whatever we put there.
   The 18px gutter above put the sidebar-toggle straight under the red/yellow
   buttons (user report, against the native screencapture of run 31188467986).
   86px = the lights' own extent plus that same 18px gutter: they were measured
   off that capture at x=9..68, in CSS pixels (1024x768 image on a 1x display),
   not taken from the ~75px other apps reserve. Windows/Linux are untouched \u2014
   they have no lights, and the right-hand 140px above is what reserves room
   for OUR caption buttons. The class only exists in the desktop app; the
   website mounts this same stylesheet and must keep the bar flush left. */
.app.is-mac .topbar {
  padding-left: 86px;
}
.topbar .sidebar-header-icon {
  -webkit-app-region: no-drag;
}
.topbar-title {
  margin: 0 0 0 6px;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Fade in sync with the sidebar collapse (same 220ms): while the sidebar is
     open the title is redundant with the highlighted session card, so it fades
     out; it fades back in as the sidebar slides closed (user 2026-06-14). */
  transition: opacity 220ms ease;
}
.topbar-title.is-tucked {
  opacity: 0;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .topbar-title { transition: none; }
}

/* \u2500\u2500 Sidebar search + empty state (2026-06-01 sidebar-icon-buttons) \u2500\u2500 */
.sidebar-search {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--ink-2);
  background: var(--glass-a60);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  outline: none;
}
.sidebar-search:focus {
  border-color: var(--input-border-focus);
}
.sidebar-empty {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--muted-2);
}
.sidebar-search-wrap {
  /* max-height reveal (2026-06-13): the old grid 0fr\u21921fr clipped the field's
     TOP as it grew (revealing bottom-up \u2014 "search bar from the middle"), and
     its is-open margin-bottom jumped in un-transitioned so content shifted
     before the field appeared. max-height clips the BOTTOM, so the field
     wipes cleanly top-down, and animating margin-bottom alongside keeps the
     content push in lockstep with the reveal. The 44px ceiling clears the
     34px field with headroom (a tail with no visible change, harmless). The
     opacity term keeps the sidebar-collapse fade (.sidebar > *) working.
     The 38px ceiling hugs the ~34px field with just ~4px of headroom, so on
     close the content does not slide for ~10px of dead max-height before the
     field starts to clip (the wider 44px ceiling left a visible lead). */
  max-height: 0;
  margin-bottom: 0;
  overflow: hidden;
  transition: max-height 200ms ease, margin-bottom 200ms ease, opacity 150ms ease;
}
.sidebar-search-wrap.is-open {
  max-height: 38px;
  margin-bottom: 16px;
}
/* The FIELD shrinks with the reveal instead of being guillotined by it
   (owner 2026-08-17: on close, the wrap's max-height clip cut the field's
   bottom to a straight line under its still-rounded top \u2014 it read as a
   rectangle sliding up over the input). The inner compresses toward its
   top (scaleY, origin top) so the field keeps its own rounded shape at
   BOTH edges as it goes, and the fast opacity fade (120ms out vs the
   wrap's 200ms height) guarantees the residual clip line is never seen.
   On open the order flips: the field is already near-full shape as it
   fades in under the growing clip. Reduced motion: none of this \u2014 the
   wrap's existing transition:none override is extended below. */
.sidebar-search-inner {
  min-height: 0;
  transform-origin: top center;
  transform: scaleY(0.55);
  opacity: 0;
  transition: transform 200ms ease, opacity 120ms ease;
}
.sidebar-search-wrap.is-open .sidebar-search-inner {
  transform: none;
  opacity: 1;
  transition: transform 200ms ease, opacity 160ms ease 30ms;
}

/* \u2500\u2500 Slice 4: bootstrap error panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.app-error {
  display: grid;
  place-items: center;
  /* fills the same window card area as the normal .app layout */
}
.app-error-panel {
  max-width: 30rem;
  padding: 1.5rem 1.75rem;
  border-radius: 9px;
  background: var(--panel);
  border: 1px solid rgba(17, 20, 23, 0.075);
  box-shadow: 0 20px 60px rgba(32, 45, 58, 0.08), inset 0 1px 0 var(--glass-a82);
  backdrop-filter: blur(18px) saturate(140%);
  text-align: center;
}
.app-error-panel h2 { margin: 0 0 0.5rem; }
.app-error-panel code {
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
  background: var(--soft-gray);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-size: 0.9em;
}
/* Workbench crash fallback's reload action (audit 2026-07-13 T2.2). */
.app-error-reload {
  margin-top: 0.75rem;
  padding: 0.45rem 1.4rem;
  border: 1px solid rgba(17, 20, 23, 0.14);
  border-radius: 999px;
  background: var(--panel);
  font: inherit;
  cursor: pointer;
}
.app-error-reload:hover {
  background: var(--soft-gray);
}
/* Per-row render-crash fallback (audit 2026-07-13 T2.2): one broken block
   costs a muted line, not the conversation. */
.row-render-error {
  align-self: center;
  margin: 0.35rem 0;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  background: var(--soft-gray);
  font-size: 0.82rem;
  font-style: italic;
  opacity: 0.75;
}

/* \u2500\u2500 Message morph (composer_send_morph_demo) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
:host {
  --morph-shadow-rest: 0 8px 22px rgba(32, 45, 58, 0.045);
  --morph-shadow-float: 0 18px 42px rgba(32, 45, 58, 0.08);
  --morph-shadow-duration: 320ms;
}

.workspace-footer {
  position: relative;
  transition: opacity 280ms ease;
}
/* Herta's tide wave living at the composer's floor (glass-wave merge,
   2026-07-05). Inside the composer it tracks composer width when the
   sidebars change and leaves the area above free for approval/notification
   pop-ups. Clips itself (the composer can't clip \u2014 its rewind notice floats
   above via bottom:100%). Behind the positioned input-wrap/send/notice. */
.composer-wave {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}
.app.is-disconnected .workspace-footer {
  opacity: 0;
  pointer-events: none;
  /* Focusability kill (audit 2026-07-10, finding 9): the hidden textarea
     stayed tabbable on the connect screen \u2014 type + Enter set the optimistic
     echo, main resolved undefined ("no active session yet"), and
     submit-message clears the echo only on rejection/needsKey: the message
     was silently lost and a phantom bubble stranded. visibility flips after
     the 280ms fade (delayed step below); reconnecting falls back to the
     base .workspace-footer transition (no visibility entry) so the composer
     is focusable the moment it starts fading back in. The .is-morphing
     transition:none override below still wins (equal specificity, later in
     file) \u2014 during the disconnect morph everything, visibility included,
     flips instantly, which is exactly its contract. visibility:hidden keeps
     layout, so the morph's footer-rect measurement is unaffected. */
  visibility: hidden;
  transition: opacity 280ms ease, visibility 0s linear 280ms;
}
/* Skip the INVISIBLE composer's per-frame layout while the disconnect grid
   collapse animates (user 2026-07-13: fullscreen frame drops in the morph's
   final stage \u2014 the 400\u20131200ms grid-template-columns transition re-lays-out
   the workspace every frame, and the trace showed the hidden footer/rail
   subtrees paying for it). content-visibility goes on .composer, NOT the
   footer wrapper: the morph measures the COMPOSER's rect on the disconnect
   edge, and CV keeps the element's own box (explicit height) measurable
   while skipping its contents (textarea, wave canvas, highlight). Instant
   application is safe for the same reason. Reconnect removes the class and
   the contents lay out again before the footer slides up. */
.app.is-disconnected .composer {
  content-visibility: hidden;
}
/* During the disconnect MORPH the footer must vanish INSTANTLY \u2014 the flying
   clone is the visible riser, not a fade. Killing the 280ms opacity transition
   (the footer is already opacity:0 via .is-disconnected above) means the real
   composer never lingers behind the clone. Reconnect (no .is-morphing) keeps
   A5's fade-through. */
.workspace.is-morphing .workspace-footer {
  transition: none;
}
/* Reconnect (connect-button morph): the composer doesn't just fade in \u2014 it
   slides UP into place, staggered to begin partway through the cards' slide-back
   (~400ms into the ~800ms card slide), so the two motions don't run in lockstep
   (user 2026-06-17). Scoped to \`.is-reconnecting\` so the translateY never
   perturbs the disconnect morph's start-rect measurement (which reads the footer
   rect at the disconnect edge, where only \`.is-morphing\` is set). The send
   button stays held invisible (see \`.workspace.is-reconnecting .composer-send\`)
   until the clone hands off. */
.workspace.is-reconnecting .workspace-footer {
  transition:
    opacity 0.3s ease 0.4s,
    transform 0.46s var(--ease-signature) 0.4s;
}
.app.is-disconnected .workspace.is-reconnecting .workspace-footer {
  /* Start fully BELOW the app's bottom edge (clipped by .app overflow:hidden),
     then slide all the way up into place once .is-disconnected is removed \u2014
     vertical analogue of the cards' translateX(130%) (user 2026-06-17).
     transition:none here (higher specificity than the slide-up rule above) so
     the footer JUMPS to 130% instantly at morph start while it is still
     invisible. Without it, the delayed slide-up transition would still be
     travelling DOWN when the session loads (createSession resolves inside the
     0.4s delay), so removing .is-disconnected would animate from ~0 \u2014 no
     visible rise. The instant jump guarantees a real 130%\u21920 to slide up. */
  transform: translateY(130%);
  transition: none;
}

/* Workspace-level overlay holding the flying clone bubbles. Above the
   conversation, never captures pointer events. */
.morph-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 5;
}

/* A flying clone reuses the bubble look but is absolutely positioned and
   flown by a transform. Width is fixed by inline style at mount. */
.morph-clone {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  box-shadow: var(--morph-shadow-rest);
  transition: opacity 0.12s linear;
  will-change: auto;
}
.morph-clone.is-visible {
  opacity: 1;
}
/* The lift is a second shadow CROSS-FADING in, not the first one being
   interpolated (perf 2026-07-30). box-shadow cannot be composited, so
   transitioning it repainted the flying clone's whole box every frame for
   320ms of the 860ms flight \u2014 the one main-thread cost the transform
   migration left behind on the clone itself. An overlay pseudo-element
   whose OPACITY fades is composited, and reads the same: soft shadows sum
   rather than crossing, so the lift looks marginally fuller mid-fade and
   identical at both ends. */
.morph-clone::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--morph-shadow-float);
  opacity: 0;
  transition: opacity var(--morph-shadow-duration) var(--ease-signature);
  pointer-events: none;
}
.morph-clone.is-moving::after {
  opacity: 1;
  will-change: opacity;
}
.morph-clone.is-moving {
  /* The flight animates TRANSFORM (2026-07-30, useRiseAnimation's FLIP
     inversion). The old \`will-change: left, top\` was worse than useless:
     neither property can be composited, so it promoted nothing and only
     hinted at the properties that were forcing layout every frame. */
  will-change: transform;
}
.morph-clone.is-settled {
  will-change: auto;
  /* The landing (owner 2026-08-27): the swap is HELD for SHADOW_SETTLE_MS
     (Conversation.tsx) while the parked clone fades its flight shadows \u2014
     unmounting on the settle commit popped them off with no transition.
     The float (::after) fades because is-moving left; box-shadow joins the
     transition list here so the user-variant rule below can fade the rest
     shadow too. Animating box-shadow is fine HERE: the element is parked
     and small, unlike the per-frame flight repaint the ::after cross-fade
     exists to avoid. */
  transition:
    opacity 0.12s linear,
    box-shadow var(--morph-shadow-duration) var(--ease-signature);
}
/* The real user bubble carries NO drop shadow (only its inset highlight),
   so the user clone's rest shadow fades to a zero-alpha twin \u2014 a same-
   geometry shadow, because \`none\` does not interpolate. The herta clone
   keeps its rest shadow: the real herta bubble wears one just like it. */
.morph-clone.user-bubble.is-settled {
  box-shadow: 0 8px 22px rgba(32, 45, 58, 0);
}

/* \u2500\u2500 Disconnect morph: the composer rises + morphs into the connect button.
   The clone starts styled like the .composer (frosted, 18px radius) and CARRIES
   the composer's content (placeholder + send), so the rise reads as the
   composer itself becoming the button. The \`.is-target\` toggle transitions its
   shape/colour to the ink .connect-station button over MORPH_MS (800ms) while
   useConnectMorph drives left/top via rAF; over the same window the composer
   content (\`-input\`) cross-fades OUT and the centred label cross-fades IN.
   Reconnect never mounts this (A5's fade-through owns the connected direction).
   NOTE: the clone label deliberately never shimmers (only fades) \u2014 the looping
   shimmer lives on the STATIC .connect-station-label, which mounts post-morph. */
.connect-morph-clone {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  display: grid;
  /* Single cell: the \`-input\` row and the \`-label\` overlap so they cross-fade
     in place. The \`-input\` lays itself out (placeholder left / send right);
     the label centres. */
  grid-template-areas: "stack";
  place-items: center;
  opacity: 0;
  /* Composer start look. */
  border-radius: 18px;
  border: 1px solid var(--hairline);
  background: var(--composer-bg);
  color: transparent;
  box-shadow: 0 2px 8px rgba(32, 45, 58, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.78);
  transition:
    width var(--dur-morph) var(--ease-signature),
    height var(--dur-morph) var(--ease-signature),
    border-radius var(--dur-morph) var(--ease-signature),
    border-color 480ms ease,
    background 560ms ease,
    box-shadow 560ms ease,
    opacity 0.16s linear;
  will-change: left, top, width, height;
}
.connect-morph-clone.is-visible {
  opacity: 1;
}
.connect-morph-clone.is-target {
  /* Button target look (mirrors .connect-station). */
  border-radius: 28px;
  border-color: transparent;
  background: var(--ink);
  box-shadow: 0 10px 30px var(--shadow-pop);
}
/* Composer content the clone carries at the start (placeholder left, send
   right) \u2014 mirrors .composer's \`display:flex; justify-content:space-between\`
   with its ~16-22px horizontal padding. Fades OUT as the morph targets. */
.connect-morph-clone-input {
  grid-area: stack;
  align-self: stretch;
  justify-self: stretch;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px 0 22px;
  opacity: 1;
  transition: opacity 360ms ease;
}
.connect-morph-clone.is-target .connect-morph-clone-input {
  opacity: 0;
}
.connect-morph-clone-placeholder {
  font-size: 15px;
  line-height: 1.5;
  color: var(--muted-4);
}
/* Mirror .composer-send: a ~30px dark circle with a white \u2191 arrow. (Slightly
   smaller than the real 38px send so it reads proportionate inside the rising
   clone as it shrinks toward the button.) */
.connect-morph-clone-send {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ink-a72);
  color: var(--ink-inverse);
}
/* Centred button label \u2014 hidden at the start, fades IN as the morph targets
   (cross-fading with the \`-input\` row). Slightly delayed so the label appears
   as the shape settles into the button. */
.connect-morph-clone-label {
  grid-area: stack;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.5px;
  /* Uniformly dimmed while rising \u2014 FLAT 0.55 white with NO bright highlight,
     matching the dim regions of the settled label's shimmer so the text weight
     is consistent. There is no shimmer on the riser; the bright sweep only
     appears once the settled \`.connect-station-label\` mounts and animates
     (user 2026-06-17: the rising text should be dimmed WITHOUT a frozen
     highlight; the shimmer appears when it lands).
     Rendering parity by CONSTRUCTION (user bugs 2026-07-06): the label uses
     the exact clip-fill technique of the settled \`.connect-station-label\`
     (anything else renders CJK strokes at a different weight \u2014 plain text
     takes Windows subpixel AA and lands visibly bolder; font-smoothing is
     macOS-only and can't equalize). The clip-fill's squash-in-flight is
     prevented positionally, in the spirit of useRiseAnimation's "never
     transform text" rule: the label is pinned to the clone's box (inset:0 \u2014
     by settle that IS the button's 240\xD756 footprint, TARGET_W/H in
     useConnectMorph) on its OWN compositor layer, so its raster never
     resizes and never paints into the clone's stretching texture. It fades
     in from 220ms, by which time the clone is already near that footprint.
     Centering mirrors .connect-station exactly (same grid + line-height):
     inset:0 sits on the padding box (+1px each side inside the 1px border),
     and for CENTERED content that offset cancels \u2014 the text center equals
     the station's, so the hand-off is coordinate-exact (user 2026-07-06:
     the label hopped ~1px up-left at landing). */
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  line-height: 20px;
  transform: translateZ(0);
  background: var(--glass-a55);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  opacity: 0;
  transition: opacity 380ms ease 220ms;
}
.connect-morph-clone.is-target .connect-morph-clone-label {
  opacity: 1;
}

/* The reconnect clone STARTS as the connect button (240x56 ink pill) and is
   animated by useReconnectMorph (WAAPI) down to the 38px send button. Children
   cross-fade: the label out during the shrink, the \u2191 arrow in over the descent.
   The base left/top is set once; the TRAVEL is a compositor-driven transform
   (main-thread session-open work must not stutter it \u2014 2026-07-13) with
   size/radius/backgroundColor in separate imperative animations, so only the
   static look lives here. */
/* The layout-anchored flight frame (user insight 2026-07-14): sized and
   inset inline by useReconnectMorph to the send button's CONSTANT offsets
   from the overlay's right/bottom corner. Because the composer always spans
   the workspace column, those insets hold in every state \u2014 so the frame
   (and the flight/landing/reveal inside it) rides grid collapses, sidebar
   toggles, and window resizes exactly like the real button, with no
   pre-shift or correction machinery. */
.reconnect-morph-anchor {
  position: absolute;
  pointer-events: none;
}
.reconnect-morph-clone {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--ink);
  box-shadow: 0 10px 30px var(--shadow-pop);
}
.reconnect-morph-clone-label,
.reconnect-morph-clone-arrow {
  grid-area: 1 / 1;
  color: var(--ink-inverse);
  white-space: nowrap;
}
.reconnect-morph-clone-label {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.5px;
}
.reconnect-morph-clone-arrow {
  opacity: 0;
}

/* During the reconnect morph the traveling clone IS the only send affordance \u2014
   hold the real send button invisible until the clone hands off (see
   useReconnectMorph). The rest of the composer fades in normally. */
/* Hidden only while the clone is in FLIGHT; during the hand-off cross-fade
   (\`.is-revealing\`) the real send button is un-hidden and fades in (its own
   0.15s opacity transition above) beneath the fading clone. */
.workspace.is-reconnecting:not(.is-revealing) .composer-send {
  opacity: 0;
}
/* Hand-off cross-fade: the landed clone fades out \u2014 taking its drop-shadow with
   it \u2014 while the real send button fades in beneath, so the connect button
   dissolves into the send button instead of being swapped instantly. */
.workspace.is-revealing .reconnect-morph-clone {
  opacity: 0;
  transition: opacity 0.26s ease;
}
/* Waiting pulse (2026-07-13): the landed clone breathes while a slow session
   load holds the hand-off \u2014 "still connecting", not frozen. Delayed 250ms so
   a normal fast load never flashes a cycle; the hook strips the class before
   the reveal so this animation can't override the cross-fade's opacity
   transition. Paused with the other ambience loops when the window hides. */
@keyframes reconnect-wait-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.72;
  }
}
.reconnect-morph-clone.is-waiting {
  animation: reconnect-wait-pulse 1.2s ease-in-out 250ms infinite;
}

/* Composer glass + shrink (toggled imperatively during a morph). */
.composer {
  /* Anchor for the rewind file-edit spill (.composer-notice) that floats above. */
  position: relative;
  /* Bottom-anchored lines (ADR 0048 \xA74): the composer grows UPWARD when the
     staged-image strip is up, and the input row must not move while it does.
     With wrap already on (the strip rule below), align-content applies even
     to the single-line state \u2014 flex-end pins the line(s) to the bottom, and
     the padding-bottom values reproduce what align-items:center gave at each
     fixed height (78/104/60px), so the resting look is unchanged. */
  align-content: flex-end;
  padding-bottom: 15px;
  transition:
    height 0.44s var(--ease-signature),
    padding 0.44s var(--ease-signature),
    opacity 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.24s var(--ease-pop);
}
/* Rewind file-edit warning \u2014 a frosted spill that emerges from the composer and
   settles just above it (not an inline flex child, which read as cramped beside
   the input). Absolute so it never reflows the composer row; dismissed on the
   next keystroke. */
.composer-notice {
  position: absolute;
  left: 50%;
  bottom: 100%;
  /* Centered fit-content pill (base transform also centers it under reduced
     motion, where the emerge animation is off). */
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  margin-bottom: 12px;
  padding: 8px 18px;
  border-radius: 13px;
  /* Frosted glass: low white opacity so the conversation tints through, with a
     strong blur + saturate keeping the short text legible. */
  background: var(--glass-a34);
  border: 1px solid var(--glass-a50);
  box-shadow: 0 10px 26px rgba(32, 45, 58, 0.09);
  backdrop-filter: blur(22px) saturate(165%);
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted-slate);
  white-space: nowrap;
  text-align: center;
  pointer-events: none;
  z-index: 6;
  /* Enter: rise from behind the composer's top edge while fading in. */
  animation: notice-in 300ms var(--ease-pop) both;
}
/* Exit (held mounted by the Composer through the animation): slide back down
   into the composer and fade out. */
.composer-notice.is-exiting {
  animation: notice-out 240ms var(--ease-accel) both;
}
@keyframes notice-in {
  from {
    opacity: 0;
    transform: translate(-50%, 22px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}
@keyframes notice-out {
  from {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, 18px) scale(0.98);
  }
}
@media (prefers-reduced-motion: reduce) {
  .composer-notice,
  .composer-notice.is-exiting {
    animation: none;
  }
}
.composer.is-suppressed {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
  /* Focusability kill (audit 2026-07-10, finding 9): opacity:0 alone left
     the textarea and the ENABLED stop button in the tab order \u2014 during a
     permission gate, Shift+Tab reached the invisible stop button and Enter
     aborted the gated turn (the same teardown mainNavigationBlock exists to
     prevent). visibility flips as a step AFTER the 240ms slide-out via the
     restated transition below (\`transition\` is not additive \u2014 keep the list
     in sync with .composer's). Un-suppressing falls back to the base
     .composer transition, which has no visibility entry, so the composer is
     focusable again instantly while it slides back in. */
  visibility: hidden;
  transition:
    height 0.44s var(--ease-signature),
    padding 0.44s var(--ease-signature),
    opacity 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.24s var(--ease-pop),
    visibility 0s linear 0.24s;
}
.composer.is-glass {
  opacity: 0.42;
  border-color: var(--ink-a06);
  box-shadow: 0 12px 34px rgba(32, 45, 58, 0.035), inset 0 1px 0 rgba(255, 255, 255, 0.58);
}
.composer.is-glass .composer-input {
  opacity: 0;
}
/* Focus-keyed height (owner 2026-08-20, superseding shrink-after-send):
   the composer RESTS at this height and holds the full 78px only while
   focus is inside the form or a file drag is over it (Composer.tsx
   \`shrunk\`). The disable-blur at turn start shrinks it for the whole
   reply; the turn-end auto-refocus expands it again. Rides .composer's
   0.44s signature height transition both ways. */
.composer.is-shrunk {
  height: 60px;
  /* (58 \u2212 line)/2 \u2014 see the bottom-anchored note on .composer. */
  padding-bottom: 6px;
}

/* Galaxy transfer entrance. Opacity is deliberately LATE-weighted (user
   2026-07-31): a fast first token loud-cuts the row 100\u2013300ms into its
   entrance, and with a linear-ish curve that cut read as a flash. With the
   ease-in curve the row is still nearly invisible at that age, so an early
   cut shows almost nothing \u2014 while a real wait still reaches full presence
   by ~450ms. */
.status-row {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.45s cubic-bezier(0.55, 0, 0.8, 0.3), transform 0.45s ease;
}
.status-row.is-shown {
  opacity: 1;
  transform: translateY(0);
}
/* Quiet-hide exit fade (user 2026-07-31): rendered alongside is-shown so the
   row fades where it stands \u2014 later rule wins the opacity \u2014 then unmounts
   after IN_FLIGHT_EXIT_MS. Keep the duration in sync with that constant. */
.status-row.is-exiting {
  opacity: 0;
  transition: opacity 0.2s ease;
}
.status-row::before,
.status-row::after {
  transform: scaleX(0);
  transition: transform 0.42s ease 0.06s;
}
.status-row.is-shown::before,
.status-row.is-shown::after {
  transform: scaleX(1);
}

/* Session-switch stagger entrance (SPEC 2026-06-20-session-switch-transition).
   Visible rows of a newly switched-to conversation settle in; the 12px drift is
   the adopted value \u2014 keep it in sync with ENTRANCE_DRIFT_PX. Driven imperatively
   per-row (duration + staggered delay) from Conversation.tsx; reduced motion is
   handled there by skipping the effect entirely. */
@keyframes conv-switch-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* A live-attached document's group rides the SAME adopted entrance (ADR 0033,
   owner 2026-08-10: the row popped in with no motion). One keyframe, one feel;
   the class is set only for a mount whose newest block is seconds old, so a
   session switch never double-animates (its stagger targets the row wrapper,
   this targets the group \u2014 and the recency gate keeps them apart anyway). */
.activity-line-group.is-attach-enter {
  animation: conv-switch-in 350ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .morph-clone,
  .connect-morph-clone,
  .connect-morph-clone-label,
  .composer,
  .status-row,
  .status-row::before,
  .status-row::after {
    transition: none !important;
  }
  .composer-staged {
    animation: none;
  }
  .activity-line-group.is-pending {
    animation: none;
  }
  .app,
  .sidebar,
  .sidebar > *,
  .sidebar-search-wrap,
  .sidebar-search-inner {
    transition: none !important;
  }
  .transfer-text.is-shimmer,
  .activity-step.is-active .activity-step__body,
  .activity-line__summary.is-shimmer,
  .swap-text__in.is-shimmer:not(.is-entering) {
    animation: none;
    background: none;
    -webkit-text-fill-color: currentColor;
  }
  .agent-ring,
  .agent-spill,
  .agent-ring[class*="is-"],
  .agent-spill[class*="is-"] {
    animation: none !important;
  }
}

.opening-ascii {
  position: fixed;
  inset: 0;
  z-index: 50;
  opacity: 1;
  /* Near-white frosted background matching the main panel (var(--shell)) \u2014 NOT
     transparent: the workbench is hidden during the splash, so a transparent
     overlay would frost the cyan body gradient and the ASCII would play on blue.
     Matching --shell keeps the splash on-brand (close to white) and makes the
     splash\u2192panel hand-off seamless (same surface). (user 2026-06-20)
     Theme-aware since the night-mode bugfix (2026-07-13): the ASCII canvas
     picks light-ink glyphs + a dark veil when <html data-theme="dark"> \u2014
     stamped BEFORE React by the index.html localStorage hint \u2014 so var(--shell)
     is safe to flip here again. */
  background: var(--shell);
  backdrop-filter: blur(22px) saturate(140%);
}
.opening-ascii.is-out {
  opacity: 0;
  transition: opacity 700ms ease-in-out;
}
.opening-ascii-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* \u2500\u2500 Backend approval panel (user-only; D7) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.approval-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--card-solid);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22);
  border: 1px solid rgba(148, 163, 184, 0.35);
  animation: approval-rise 220ms var(--ease-pop);
}
.approval-panel.is-out {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 200ms ease-in, transform 200ms ease-in;
}
@keyframes approval-rise {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
.approval-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.approval-panel__title { font-weight: 600; font-size: 14px; color: var(--ink-strong); }
.approval-panel__risk {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  color: var(--muted-slate);
}
.approval-panel__risk.is-danger {
  background: rgba(154, 91, 91, 0.12);
  color: #9a5b5b;
}
/* The aria-describedby target (audit S13). It exists only to group the
   summary, command and file list into one description a screen reader reads
   out before the buttons \u2014 so it repeats the panel's own flex column and gap,
   leaving the rendered spacing exactly as it was. */
.approval-panel__desc {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.approval-panel__summary { margin: 0; font-size: 13px; color: var(--slate-deep); }
/* The other ask classes of a chained shell line (2026-08-17) \u2014 a dim line
   under the top label, same register as the project-rule note below. */
.approval-panel__also { margin: 0; font-size: 12px; color: var(--muted-slate); }
/* Consequence note (ADR 0049 \xA75): what this command does to work that cannot
   be recovered. One quiet warning line \u2014 informational, the tier enforces.
   Same amber register as the armed-switch warning badge. */
.approval-panel__consequence { margin: 0; font-size: 12px; color: #b45309; }
:host([data-theme="dark"]) .approval-panel__consequence { color: #ffc46b; }
.approval-panel__command {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  /* Fixed dark console well in BOTH themes (2026-07-23 sweep). The old
     \`var(--ink-strong)\` background was authored against light theme (where
     ink-strong is #0f172a); in dark theme ink-strong flips near-white and
     the hardcoded light text below became light-on-light. A command/write
     preview is a terminal well \u2014 it stays dark, like the light theme always
     rendered it. Hairline keeps it defined against the dark glass card. */
  background: #0f172a;
  border: 1px solid var(--ink-a09);
  color: #e2e8f0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  /* Large write previews must scroll inside the panel \u2014 unbounded they push
     the panel taller than the workspace and the action buttons out of view. */
  max-height: 240px;
  overflow-y: auto;
}
/* The diff behind a file-write ask (user 2026-07-24): same dark console
   well as the command preview, opened by the collapsed disclosure below \u2014
   long patches scroll inside the capped well instead of growing the panel.
   The dark chrome (background / border / radius) is NOT on this <pre> \u2014 it
   lives on the clip box below, see there for why; the pre is the scrolling
   text region inside it. */
/* The scroll container. Since 2026-08-25 evening it holds a <DiffBody>, not
   raw text, so the wrapping and the mono face live on the rows \u2014 what stays
   here is the height cap, the scroll, and the padding. Vertical only: the
   row tints are full-bleed bands, so side padding would leave an untinted
   margin down both edges of the well. */
.approval-panel__diff {
  margin: 0;
  padding: 6px 0;
  color: #e2e8f0;
  max-height: 240px;
  overflow-y: auto;
}
.approval-panel__diff-toggle {
  align-self: flex-start;
}
/* The diff disclosure animates (owner 2026-08-17: it used to snap open \u2014
   the well was mounted/unmounted). Grid-row interpolation 0fr \u2192 1fr sizes
   the open state to the well's own height (capped by its max-height), so
   the panel's top edge glides up instead of jumping; the panel's
   ResizeObserver republishes --approval-reserve every frame of it. Closed:
   the well is hidden after the collapse plays (visibility waits out the
   row transition), and the toggle's aria-expanded is the AT truth. The
   wrap's negative margin cancels the panel's flex gap while closed, so a
   collapsed disclosure adds no blank strip under the toggle. */
/* Asymmetric timing (owner 2026-08-19): the OPEN answers a click, so it
   stays quick (240ms on the house morph curve, declared on .is-open \u2014 the
   state being entered owns the transition); the CLOSE is dismissal,
   nothing is waiting on it, so it settles over 360ms.
   THE fr QUIRK (measured with an in-page rAF sampler, 2026-08-19): the
   0fr\u21941fr row does NOT follow its timing function \u2014 the track resolves
   the fr size twice (the grid's block size from the first pass is definite
   in the second), so the row height tracks the timing function SQUARED
   (close: 44% gone at 36ms of a 360ms ease-out-soft; open: 52% at 58ms of
   a 240ms signature = 0.72\xB2). Every "too fast" report on this collapse was
   that square. The close therefore runs \`linear\`, which the quirk turns
   into (1\u2212t)\xB2 \u2014 a clean quadratic ease-out that actually spans the 360ms
   (56% left at 90ms, 25% at 180, 6% at 270). The open keeps the signature
   curve: its square is still a front-loaded ease-out and it answers a
   click. Any future 0fr\u21941fr disclosure inherits this: tune the timing
   function for its square, not its face value. */
.approval-panel__diff-wrap {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: -8px;
  transition:
    grid-template-rows 360ms linear,
    margin-top 360ms linear;
}
.approval-panel__diff-wrap.is-open {
  grid-template-rows: 1fr;
  margin-top: 0;
  transition:
    grid-template-rows 240ms var(--ease-signature),
    margin-top 240ms var(--ease-signature);
}
/* The clip IS the dark rounded well (owner 2026-08-19, screenshots): the
   chrome used to sit on the <pre> inside a transparent clip, so the edge
   doing the cutting was the clip's straight bottom line slicing through an
   opaque box \u2014 a rectangle bottom sliding up while the panel's top edge
   (the panel is bottom-anchored) came down. With the background / border /
   radius on the clip box, the box that shrinks with the grid row is the
   shape itself: both corners stay rounded through the whole travel and the
   text simply disappears behind its own bottom border. (The earlier
   scaleY-toward-top + fast-fade recipe is only good for a short element
   like the sidebar search field; a 130\u2013240px opaque well needs the shrinking
   box to BE the chrome.) The close fades the box only over its last
   stretch (from ~1/5 height on) so the shrink is the story and it
   dissolves rather than snapping away as a 2px line; the open fades the
   box in WITH the space (no delay \u2014 a delayed fade left a half-open hole
   with nothing in it for the first ~60ms). */
.approval-panel__diff-clip {
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 8px;
  background: #0f172a;
  border: 1px solid var(--ink-a09);
  visibility: hidden;
  opacity: 0;
  transition:
    visibility 0s linear 360ms,
    opacity 160ms ease 200ms;
}
.approval-panel__diff-wrap.is-open .approval-panel__diff-clip {
  visibility: visible;
  opacity: 1;
  transition:
    visibility 0s linear 0s,
    opacity 140ms var(--ease-out-soft) 0s;
}
@media (prefers-reduced-motion: reduce) {
  .approval-panel__diff-wrap,
  .approval-panel__diff-clip {
    transition: none;
  }
}
/* Slim pill scrollbar (2026-07-23 sweep after the composer finding) \u2014 the
   default chunky OS bar sat inside the approval card on big previews. */
.approval-panel__command::-webkit-scrollbar,
.approval-panel__diff::-webkit-scrollbar {
  width: 10px;
}
.approval-panel__command::-webkit-scrollbar-track,
.approval-panel__diff::-webkit-scrollbar-track {
  background: transparent;
}
.approval-panel__command::-webkit-scrollbar-thumb,
.approval-panel__diff::-webkit-scrollbar-thumb {
  /* On the dark preview well the ink pill vanishes \u2014 use the preview's own
     light text color at low alpha instead. */
  background: rgba(226, 232, 240, 0.28);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.approval-panel__command::-webkit-scrollbar-thumb:hover,
.approval-panel__diff::-webkit-scrollbar-thumb:hover {
  background: rgba(226, 232, 240, 0.45);
  background-clip: padding-box;
}
.approval-panel__files {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--muted-slate);
}
/* ADR 0030: dim caption naming the exact project rule the \u300C\u672C\u9879\u76EE\u5141\u8BB8\u300D
   button would persist \u2014 the grant stays inspectable while the button label
   stays short (owner 2026-08-04). */
.approval-panel__rule {
  margin: 0;
  font-size: 12px;
  color: var(--muted-slate);
  word-break: break-all;
}
.approval-panel__actions { display: flex; gap: 8px; margin-top: 4px; }
.approval-btn {
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}
.approval-btn--allow { background: var(--btn-ink); color: var(--ink-inverse); }
.approval-btn--allow:hover { background: var(--btn-ink-hover); }
.approval-btn--always { background: var(--ink-a05); color: var(--ink-2); }
.approval-btn--always:hover { background: var(--ink-a09); }
.approval-btn--deny {
  background: transparent;
  color: var(--muted-slate);
  border-color: var(--hairline-strong);
}
.approval-btn--deny:hover { background: var(--ink-a04); }

/* \u2500\u2500 Sidebar two-line card: title row + message preview \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.session-item__title {
  flex: 1 1 auto;
  min-width: 0; /* let the title shrink inside the flex row */
  overflow: hidden;
  white-space: nowrap;
  font-weight: 600;
  /* Fade the right edge instead of a hard ellipsis, so a long title dissolves
     toward the trash / \u786E\u8BA4\u5220\u9664 control rather than abruptly clipping (or
     colliding with it). Short titles end before the fade zone, so they're
     unaffected. */
  -webkit-mask-image: linear-gradient(
    to right,
    #000 calc(100% - 18px),
    transparent
  );
  mask-image: linear-gradient(to right, #000 calc(100% - 18px), transparent);
}
/* Full-title pop-out (user 2026-07-16): the fade mask above hides a long
   title's tail with no way to read it \u2014 resting the pointer on the card (or
   keyboard-focusing it) shows the WHOLE title in a fixed tip beside the
   sidebar, only when the masked line actually overflows (SessionItem gates
   on scrollWidth). A label, not a control: no pointer events, aria-hidden
   (the full text is already in the DOM for screen readers). Portaled to
   <body> \u2014 the sidebar scroller clips/masks its own contents. */
.session-title-tip {
  position: fixed;
  z-index: 60; /* the popover layer \u2014 above the sidebar, below nothing it meets */
  transform: translateY(-50%);
  max-width: 340px;
  padding: 7px 12px;
  border-radius: 10px;
  background: var(--card-solid);
  color: var(--ink);
  border: 1px solid var(--hairline-strong);
  box-shadow: 0 10px 28px var(--shadow-pop);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere; /* a spaceless CJK title wraps instead of overflowing */
  pointer-events: none;
  animation: title-tip-in 120ms ease-out;
}
@keyframes title-tip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .session-title-tip {
    animation: none;
  }
}
.session-item__badge {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
  /* Entrance settle for the plain badge (\u5F85\u6279\u51C6) \u2014 it used to pop in with
     no motion (user 2026-07-11). Enter-only: its exit coincides with the
     approval panel's own dismissal, where attention already is. The
     variants opt out: --dismiss keeps actionSwapIn (higher specificity),
     --warn's width growth IS its entrance. */
  animation: badge-pop-in 180ms var(--ease-pop);
}
@keyframes badge-pop-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}
/* Mid-turn switch guard (2026-07-11): the armed first click's warning \u2014
   switching away interrupts the reply (and any running \u677F\u7816 task). A SPAN
   (clicks bubble to the card: the second click is the confirm).
   Width-animated exactly like the \u786E\u8BA4\u5220\u9664 pill above: collapsed base,
   \`is-open\` (rAF-armed via usePresence) grows it out of the trash slot,
   and disarming drops is-open so it melts away while still mounted \u2014
   the exit fade rides the back half, mirroring the pill's timing. */
.session-item__badge--warn {
  background: rgba(217, 119, 6, 0.14);
  color: #b45309;
  animation: none;
  max-width: 0;
  padding-inline: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  transition:
    max-width 140ms ease,
    padding 140ms ease,
    opacity 70ms ease 70ms;
}
/* Armed top-bar new-chat (mid-turn two-step, 2026-07-12): the icon tints
   amber while the tooltip carries the warning \u2014 same palette as the
   sidebar's armed switch badge. */
.sidebar-header-icon.is-armed {
  color: #b45309;
  background: rgba(217, 119, 6, 0.12);
}
.session-item__badge--warn.is-open {
  /* Comfortably wider than the rendered badge (the zh/en warning text +
     padding stays well under this) so the end-state never clips. */
  max-width: 240px;
  padding-inline: 7px;
  opacity: 1;
  transition:
    max-width 140ms ease,
    padding 140ms ease,
    opacity 140ms ease;
}
/* Live pulse on the ACTIVE row while a turn is in flight \u2014 the peripheral
   "Herta is mid-reply here" signal (its click-side counterpart is the
   armed switch badge above). Split in two: the OUTER span owns presence
   (fade + width, where the collapsed state's negative margin cancels the
   title-row gap so the title never jumps sideways at mount/unmount); the
   INNER dot owns the infinite pulse, paused while the window is hidden
   (see the ambience-pause block at the end of this file). */
.session-item__live {
  flex: none;
  width: 10px;
  height: 10px;
  max-width: 0;
  margin-left: -8px; /* cancel the title-row gap while collapsed */
  opacity: 0;
  overflow: hidden;
  transition:
    max-width 160ms ease,
    margin-left 160ms ease,
    opacity 160ms ease;
}
.session-item__live.is-on {
  max-width: 10px;
  margin-left: 0;
  opacity: 1;
}
/* A miniature SPEECH WAVE (owner 2026-07-27, dot-redesign round two). Round
   one made this a steady dot \u2014 the blink had been one of three identical
   pulses during a dispatch \u2014 but steady read as DEAD, and the fix for
   sameness was never stillness, it was a different FORM in a different
   motion vocabulary. The turn in flight is Herta speaking, so the indicator
   wears the app's voice language (the device card's waves / wave-engine) at
   sidebar scale: three bars breathing scaleY at staggered NEGATIVE delays
   (mid-motion from the first frame, no synchronized pop) and slightly
   different periods, so the pattern never visibly repeats. Nothing here
   blinks \u2014 the record's activity LED keeps being the only pulse.

   --accent-blue, DELIBERATELY not --banzhuan-led: this signal is turn-level
   (it shows for pure chat replies too), so it does not wear the
   coprocessor's exact colour. */
.session-item__live-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 10px;
}
.session-item__live-bar {
  width: 2px;
  border-radius: 1px;
  background: var(--accent-blue);
  animation: session-live-wave 1.15s ease-in-out infinite;
}
/* Natural heights carry the glyph: under reduced-motion the animation is
   removed and the bars simply REST at 6/10/7 \u2014 a static equalizer mark,
   still legibly "activity", not a degraded blob. */
.session-item__live-bar:nth-child(1) {
  height: 6px;
  animation-duration: 1.05s;
  animation-delay: -0.9s;
}
.session-item__live-bar:nth-child(2) {
  height: 10px;
  animation-duration: 1.25s;
  animation-delay: -0.45s;
}
.session-item__live-bar:nth-child(3) {
  height: 7px;
  animation-delay: -0.15s;
}
@keyframes session-live-wave {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .session-item__badge {
    animation: none;
  }
  .session-item__badge--warn,
  .session-item__badge--warn.is-open,
  .session-item__live,
  .session-item__live.is-on {
    /* Snap width and fades in both directions (each state carries its own
       transition list, so all need the override). */
    transition: none;
  }
  .session-item__live-bar {
    /* The bars rest at their natural staggered heights \u2014 the static wave is
       a designed glyph, not a stopped animation. */
    animation: none;
  }
}
/* The corrupt-archive badge is a BUTTON: clicking it dismisses the notice
   and restores the trash immediately (no waiting out the fallback timer).
   Hover-gated like the trash/confirm (user bug 2026-07-06: it used to
   linger on an unhovered card, then swap to an invisible trash at the 4 s
   fallback \u2014 a sudden pop out of nowhere). It appears under the cursor
   (the failed click) so the reveal is immediate; leaving the card fades it
   out in place and the leave timer swaps in the trash once invisible. */
button.session-item__badge--dismiss {
  border: 0;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  background: rgba(190, 60, 60, 0.13);
  color: #b03a3a;
  opacity: 0;
  transition: opacity 120ms ease;
}
.session-item.is-pending-approval { font-weight: 600; }

/* \u2500\u2500 Delete affordance: hover trash \u2192 reddish \u786E\u8BA4\u5220\u9664 confirm \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Stable-width action slot (user bug 2026-07-11): the slot's controls have
   different intrinsic widths \u2014 the hover-hidden trash is 19px (15px svg +
   2px padding) and OCCUPIES layout even invisible, while the confirm pill
   and the switch-guard badge collapse to 0 \u2014 so control swaps flickered the
   row's layout: a pill exit went 19 \u2192 0 (dot drifts right past its resting
   spot) \u2192 19 when the trash swapped back (a sudden leftward jump). The
   min-width floors the slot at the trash's width, so every "visually empty"
   state measures identically; wider controls (open pill/badges) still grow
   past it and squeeze the title as designed. flex-end keeps the shrinking
   pill hugging the right edge, exactly as before. */
.session-item__action-slot {
  flex: none;
  display: flex;
  justify-content: flex-end;
  min-width: 19px;
}
.session-item__trash {
  flex: none;
  border: 0;
  background: transparent;
  padding: 2px;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease;
}
/* Reveal the trash on card hover, or on KEYBOARD focus (focus-visible) \u2014 not
   plain :focus-within. The trash/confirm share one reused <button> DOM node
   (same element type, same JSX slot), so a MOUSE click leaves focus on it;
   :focus-within would then keep the trash revealed even after the cursor
   leaves. :focus-visible ignores mouse-retained focus, so the trash hides on
   mouse-out while still appearing for keyboard users. */
.session-item:hover .session-item__trash,
.session-item:hover .session-item__badge--dismiss,
.session-item:focus-visible .session-item__trash,
.session-item:focus-visible .session-item__badge--dismiss,
.session-item:has(:focus-visible) .session-item__trash,
.session-item:has(:focus-visible) .session-item__badge--dismiss {
  opacity: 1;
}
/* The confirm pill is NOT in the hover-reveal group (2026-07-10): its
   visibility is driven by \`.is-open\` \u2014 width AND a synchronized 140ms fade.
   The hover group's independent 120ms fade used to race the width shrink
   and win (the pill turned invisible before the shrink was perceptible,
   reading as a sudden pop); one driver, one duration keeps the collapse
   and the fade finishing together. */
.session-item__trash-svg {
  width: 15px;
  height: 15px;
  color: var(--muted);
  stroke-width: 1.5;
  transition:
    color 120ms ease,
    stroke-width 120ms ease;
}
.session-item__trash:hover .session-item__trash-svg {
  color: #b4453a; /* reddish \u2014 telegraph the destructive action */
  stroke-width: 2;
}
.session-item__confirm-del {
  flex: none;
  border: 0;
  border-radius: 999px;
  padding: 2px 0;
  font-size: 12px;
  font-weight: 600;
  color: #b4453a;
  background: rgba(214, 90, 80, 0.14);
  cursor: pointer;
  white-space: nowrap;
  /* Width-animated pill (user 2026-07-10): the pill GROWS out of the trash
     position on click and SHRINKS back to nothing on leave, so the squeezed
     title \u2014 and its right-edge fade mask \u2014 follows continuously in both
     directions. Pre-fix the pill mounted at full width (title snapped
     narrower with the mask suddenly over visible characters) and on leave
     faded opacity-only while KEEPING its flex width, leaving frames of a
     blurred title next to an invisible pill. Collapsed state: zero width +
     zero inline padding; \`.is-open\` (rAF-armed by SessionItem so the mount
     frame renders collapsed) expands both. */
  max-width: 0;
  overflow: hidden;
  /* Fade rides the SAME driver as the width (is-open; user 2026-07-10) \u2014
     never the hover reveal, whose independent fade outran the shrink and
     read as a pop (702001a). Direction-specific timing: this BASE rule's
     transition governs the EXIT (going to collapsed), where the fade is
     DELAYED to the back half (hold opacity 120ms, dissolve over the last
     120ms) so the narrowing is visible at full strength before the pill
     melts away \u2014 a full-length exit fade was mostly transparent by
     mid-shrink and still read as a pop. Exit slowed 140\u2192240ms (user
     2026-07-13: even with the dark-contrast fix, 140ms still read as an
     instant vanish); the ENTER stays the snappy 140ms (\`.is-open\` below),
     matching the asymmetric enter-fast/exit-calm convention. Timer twin:
     SessionItem's CONFIRM_LEAVE_RESET_MS must exceed this. */
  opacity: 0;
  transition:
    max-width 240ms ease,
    padding 240ms ease,
    opacity 120ms ease 120ms;
}
.session-item__confirm-del.is-open {
  /* Comfortably wider than the rendered pill (\u786E\u8BA4\u5220\u9664 + padding \u2248 70px) so
     the transition end-state never clips; the real width is content-sized. */
  max-width: 120px;
  padding-inline: 10px;
  opacity: 1;
  /* Enter timing (see the base rule): fade-in across the whole grow. */
  transition:
    max-width 140ms ease,
    padding 140ms ease,
    opacity 140ms ease;
}
.session-item__confirm-del:hover {
  background: rgba(214, 90, 80, 0.22);
}
/* The LABEL fades on its own clock (user 2026-07-10): on EXIT it dissolves
   over the FIRST 90ms of the shrink (base rule, no delay) \u2014 text sliding
   under the narrowing clip edge read rough; with the label gone early, the
   capsule's collapse + back-half fade carry the exit (90ms \u2248 the same
   early fraction of the 240ms exit that 60ms was of the old 140ms). On
   ENTER (.is-open) the label fades in slightly behind the capsule's growth
   (40ms delay, done by 140ms), so the pill opens first and the words
   settle into it. */
.session-item__confirm-del__text {
  display: inline-block;
  opacity: 0;
  transition: opacity 90ms ease;
}
.session-item__confirm-del.is-open .session-item__confirm-del__text {
  opacity: 1;
  transition: opacity 100ms ease 40ms;
}
/* State swap in the card's action slot (trash \u2194 \u786E\u8BA4\u5220\u9664 \u2194 \u5B58\u6863\u635F\u574F): the
   incoming control settles in with a quick scale-spring instead of popping
   (user feedback 2026-07-06). Enter-only \u2014 the outgoing element unmounts and
   the newcomer's settle reads as one control morphing. TRANSFORM only:
   opacity belongs to the hover-reveal system above, and a keyframe touching
   it would fight the card-hover fade (the trash mounts opacity-0 on
   unhovered cards; its invisible scale-in is harmless). */
@keyframes actionSwapIn {
  from {
    transform: scale(0.6);
  }
  to {
    transform: scale(1);
  }
}
.session-item__trash,
button.session-item__badge--dismiss {
  animation: actionSwapIn 170ms var(--ease-overshoot);
}
/* The confirm pill's entrance is its width GROWTH (above) \u2014 the scale pop
   on top of it read as a double animation, so the pill is no longer in the
   actionSwapIn group (2026-07-10). */
@media (prefers-reduced-motion: reduce) {
  .session-item__trash,
  .session-item__trash-svg {
    transition: none;
  }
  .session-item__trash,
  button.session-item__badge--dismiss {
    animation: none;
  }
  .session-item__confirm-del,
  .session-item__confirm-del.is-open,
  .session-item__confirm-del__text,
  .session-item__confirm-del.is-open .session-item__confirm-del__text {
    /* Snap width and fades in both directions (each state carries its own
       direction-specific transition list, so all need the override). */
    transition: none;
  }
}
/* Message preview: collapsed (single-line pill) \u2192 expanded (two-line) via an
   animated grid row, so the pill grows and pushes the pills below it down. */
.session-item__preview-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 280ms ease;
}
.session-item__preview-wrap.is-open {
  grid-template-rows: 1fr;
}
.session-item__preview {
  min-height: 0; /* required so the 0fr row can fully collapse */
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--label-soft-2);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  transition: opacity 150ms ease;
}
/* Cross-fade the message when it changes (e.g. switching away flips the
   preview from the activation's first message to the last message). */
.session-item__preview.is-fading {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .session-item__preview-wrap {
    transition: none;
  }
  .session-item__preview {
    transition: none;
  }
}

/* \u2500\u2500 Collapsible diff disclosure \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.collapsible-body { display: flex; flex-direction: column; gap: 4px; }
.diff-disclosure {
  align-self: flex-start;
  padding: 2px 8px;
  border: none;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--muted-slate);
  font-size: 12px;
  cursor: pointer;
}
.diff-disclosure:hover { background: rgba(148, 163, 184, 0.28); }

/* \u2500\u2500 Navigation guard while an approval gate is pending \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* The session card is a <div role="button"> (a <button> can't nest the
   delete <button>), so \`:disabled\` never matches it \u2014 the guard sets
   \`aria-disabled\` instead. Without an attribute-keyed rule the freeze was
   invisible (cards kept full hover + pointer), reading as "not frozen"
   (diagnosed live 2026-06-12). Dim every gated card EXCEPT the active one,
   which owns the pending request and shows the \u5F85\u6279\u51C6 badge. */
.session-item[aria-disabled="true"]:not(.is-active) {
  opacity: 0.5;
  cursor: not-allowed;
}
.session-item[aria-disabled="true"]:not(.is-active):hover {
  background: transparent;
}
.sidebar-header-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* \u2500\u2500 Hover tooltip (styled white pill; replaces native title) \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.tooltip-wrap {
  position: relative;
  display: inline-flex;
  /* Tooltip-wrapped controls are fixed-size icon/send buttons that must not
     shrink when they become the flex item in their toolbar/composer row. */
  flex: none;
}
.tooltip {
  position: absolute;
  background: var(--surface-pop);
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.4;
  padding: 5px 9px;
  border-radius: 8px;
  border: 1px solid var(--hairline);
  box-shadow: 0 6px 18px var(--shadow-pop);
  white-space: nowrap;
  pointer-events: none;
  z-index: 50;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms ease, visibility 0s linear 120ms;
}
/* Muted second line (e.g. the attach hint's supported-formats note). Its own
   block line under the label; both lines keep the pill's nowrap. */
.tooltip-sub {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--muted-3);
}
.tooltip-bottom .tooltip {
  top: 100%;
  margin-top: 6px;
}
.tooltip-top .tooltip {
  bottom: 100%;
  margin-bottom: 6px;
}
.tooltip-align-center .tooltip {
  left: 50%;
  transform: translateX(-50%);
}
.tooltip-align-start .tooltip {
  left: 0;
  transform: none;
}
.tooltip-align-end .tooltip {
  right: 0;
  left: auto;
  transform: none;
}
.tooltip-wrap:hover .tooltip,
.tooltip-wrap:has(:focus-visible) .tooltip {
  opacity: 1;
  visibility: visible;
  transition: opacity 120ms ease;
  transition-delay: 400ms;
}
/* After the control is clicked, force the tooltip hidden even while the
   cursor still hovers (the Tooltip component toggles is-suppressed on
   pointerdown, clears it on pointerleave). Placed last so it overrides the
   equal-specificity hover/focus rule above. */
.tooltip-wrap.is-suppressed .tooltip {
  opacity: 0;
  visibility: hidden;
  transition: none;
}
/* Portal pill (Tooltip \`portal\`): lifted to <body> and positioned from the
   trigger's viewport rect, so no ancestor overflow, mask or paint order can
   reach it \u2014 the attachment \u2715 sits inside the activity history panel inside
   the conversation scroller, and the in-flow pill was cut there twice by two
   different causes. Its presence IS the hover state (decided in JS), so the
   opacity/visibility dance above must not apply to it. Placed AFTER the
   align rules: those set \`transform\`, and at equal specificity the later
   rule wins \u2014 the portal's own centering has to be the last word. */
.tooltip.tooltip--portal {
  position: fixed;
  transform: translateX(-50%);
  opacity: 1;
  visibility: visible;
  transition: none;
  z-index: 1000;
}

/* \u2500\u2500 \u677F\u7816 live status line (2026-06-12 seamless-workbench \xA76) \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.activity-line-group {
  margin: 10px 0 14px;
}
/* The row owns the full width and the right-anchored duration; the BUTTON
   inside it shrinks to its content (2026-07-27). Before this the button was
   \`width: 100%\`, so the wide gap between the summary and the right edge was
   a click target with nothing in it \u2014 the cursor turned into a pointer over
   empty space and clicking there expanded the row. */
.activity-line-row {
  display: flex;
  align-items: center;
  width: 100%;
}
.activity-line {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Shrink to content, but yield when the summary is long: \`min-width: 0\`
     lets the flex item shrink below its content size so
     .activity-line__summary's ellipsis still engages instead of pushing the
     duration off the row. */
  flex: 0 1 auto;
  min-width: 0;
  /* Glow clearance: the LED's pulse glow reaches 7px (6px blur + 1px
     spread) past the dot, and two edges clip it \u2014 .conversation clips at
     overflow-x (hence 8px left), and the group's content-visibility
     imposes paint containment clipping at ITS padding box (top/bottom).
     At 2px vertical padding the LED sat 6px from the group edge (measured
     2026-07-12) \u2014 1px of blur tail shaved; 3px gives the full reach.
     The left clearance IS the record's left edge (--record-left): the
     bubbles align to it, so it can't be retuned here alone. */
  padding: 3px 0 3px var(--record-left, 8px);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  text-align: left;
  font-size: 12px;
  color: var(--muted-4);
}
.activity-line-group.is-pending .activity-line {
  cursor: default;
}
/* \u5904\u7406\u4E2D\u2026 entrance (user 2026-07-31): the placeholder used to pop in the same
   commit the galaxy row left \u2014 a hard swap. Now the galaxy exits through its
   fade first (Conversation defers this mount), and this fades in where it
   stood. Also softens the placeholder's arrival on backend starts that never
   showed a galaxy at all. */
.activity-line-group.is-pending {
  animation: pending-activity-in 0.3s ease both;
}
@keyframes pending-activity-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* A terminal-marker-only group (e.g. \u5B8C\u6210 \xB7 1 file) has nothing to reveal \u2014
   the line isn't a toggle, so it shouldn't look clickable (bug 1). */
.activity-line.is-static {
  cursor: default;
}
.activity-line__led {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c2c8d0;
}
.activity-line-group.is-active .activity-line__led {
  background: var(--banzhuan-led);
}
.activity-line__led.is-pulsing {
  animation: led-pulse 1.6s ease-in-out infinite;
}
@keyframes led-pulse {
  0%, 100% { opacity: 0.45; box-shadow: 0 0 0 0 color-mix(in srgb, var(--banzhuan-led) 0%, transparent); }
  50% { opacity: 1; box-shadow: 0 0 6px 1px color-mix(in srgb, var(--banzhuan-led) 55%, transparent); }
}
.activity-line__label {
  flex: none;
  font-weight: 500;
  color: var(--muted-3);
}
.activity-line__summary {
  /* Shrink-to-text, never stretch: a stretched summary shoved the chevron
     to the far edge of the row, detached from the content it toggles
     (user 2026-07-07). It still ellipsizes under pressure. */
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-line__duration {
  flex: none;
  /* The ONLY right-anchored element (2026-06 decision preserved); the
     chevron now sits inline after the summary. Since 2026-07-27 it is a
     sibling of the button rather than its last child \u2014 the \`auto\` margin
     now pushes it against the ROW's right edge, which is why the button no
     longer needs to span the row (and no longer swallows the gap). */
  margin-left: auto;
  padding-left: 8px;
  font-size: 11px;
  color: var(--muted-faint);
}
.activity-line__chevron {
  flex: none;
  color: var(--muted-4);
}
.activity-line__history {
  /* Animated reveal (bug 2): clipped to max-height so a measured height
     transition pushes the blocks below DOWN smoothly instead of jumping.
     The px target is set by the JS in ActivityBlock; the conversation
     scroller's overflow-anchor:none keeps the growth pointing downward. */
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 240ms var(--ease-out-soft),
    opacity 160ms ease;
}
.activity-line__history.is-open {
  opacity: 1;
}
.activity-line__history-inner {
  /* The LED's centre: the row's left edge + half the 7px dot (\u224811px at the
     default --record-left). Derived, so the gutter tracks the edge. */
  margin: 2px 0 0 calc(var(--record-left, 8px) + 3px);
  padding-left: 12px;
  border-left: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* \u2500\u2500 Live plan strip (2026-07-26) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   \u677F\u7816's \u4EFB\u52A1\u6E05\u5355 while the dispatch runs: one quiet row per todo item,
   under the status line. The header answers "what is it doing this
   second"; this answers "where are we in the plan".

   Same hairline family as the history panel above \u2014 identical margin (the
   LED's centre, derived from --record-left) + 12px padding + 1px rule \u2014 so
   the two read as one gutter even though the strip is deliberately OUTSIDE
   the collapsible panel (its measured max-height animation must not see
   this growth). */
.activity-plan {
  margin: 3px 0 0 calc(var(--record-left, 8px) + 3px);
  /* The 3px bottom clearance predates the 2026-07-27 caret (the in-progress
     mark used led-pulse, whose glow reached past the row and was clipped by
     the group's content-visibility padding box). Kept: it is breathing room
     now, and removing it would nudge every strip's height for no gain. */
  padding: 1px 0 3px 12px;
  border-left: 1px solid var(--hairline);
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.activity-plan__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--muted-4);
}
.activity-plan__text {
  /* One line per item, always: the strip is a glance at the plan's shape,
     not a place to read a paragraph. The full text rides \`title\`. */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-plan__mark {
  flex: none;
  /* 7px = the LED's diameter, so the markers sit on the same visual grid. */
  width: 7px;
  height: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-faint);
}
.activity-plan__check {
  width: 9px;
  height: 9px;
  /* The check overflows the 7px marker box by 1px each side \u2014 centered, so
     it stays optically aligned with the dots above and below it. */
  flex: none;
}
.activity-plan__row.is-pending .activity-plan__mark {
  border: 1px solid var(--muted-faint);
  border-radius: 50%;
}
.activity-plan__row.is-in-progress {
  color: var(--muted-strong);
}
.activity-plan__row.is-in-progress .activity-plan__mark {
  /* Caret, not a pulsing dot (2026-07-27, same rule as .plan-card__caret):
     the header LED four rows up is the pulse; the strip states which step
     in form. */
  color: var(--banzhuan-led);
}
.activity-plan__caret {
  width: 7px;
  height: 9px;
  flex: none;
  fill: currentColor;
}
.activity-plan__more {
  /* Aligned with the text column (7px marker + 8px gap), not the markers:
     it is chrome about the list, not an item of it. */
  padding-left: 15px;
  color: var(--muted-faint);
}
/* The inline strip is the NARROW-window fallback for the rail plan card
   (2026-07-26). Above 900px the rail is visible and owns the plan \u2014 showing
   it twice is noise, and the rail's copy is the better one (fixed, so it does
   not scroll away mid-run). Below 900px \`.utility-rail\` is display:none, so
   without this the plan would vanish entirely on a small window. A media
   query decides, not JS: nothing to keep in sync, nothing to go stale. */
@media (min-width: 901px) {
  .activity-plan { display: none; }
}
/* The strip had no entrance either \u2014 it was minted by React already in its
   final state, so it appeared between one frame and the next. @starting-style
   gives that first paint an origin to move from. It fades and settles rather
   than sliding: this one lives INSIDE the transcript, where a horizontal move
   would fight the column it sits in.

   The strip's DISAPPEARANCE stays instant, and deliberately so. It is owned by
   its activity group, and a Herta beat ENDS that group \u2014 the strip is not
   hidden, its host is finished, and a new group's strip takes over below the
   beat. That discontinuity is exactly what moving the plan to the rail solved;
   re-solving it here would mean duplicating the rail's hold/retract machinery
   into a surface that only appears under 900px. */
.activity-plan {
  transition: opacity 260ms ease;
}
@starting-style {
  .activity-plan {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .activity-line__led.is-pulsing { animation: none; opacity: 1; }
  .activity-line__history { transition: none; }
}

/* \u2500\u2500 \u677F\u7816 plan card (rail, 2026-07-26) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A sibling of the device card, not a new kind of object: same 18px radius,
   same frosted --speech-* surface, so the two read as one instrument \u2014 the
   machine, and what it is working through.

   Every colour is a token with a [data-theme="dark"] override, so dark mode
   is automatic. The one thing NOT copied from .device-card is its
   \`inset 0 1px 0 rgba(255,255,255,.82)\` top highlight: that literal is a
   bright white hairline in dark mode. --glass-a72 flips with the theme. */
.plan-card {
  position: relative;
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 12px;
  border-radius: 18px;
  background: var(--speech-card-bg);
  border: 1px solid var(--speech-border);
  box-shadow:
    0 18px 48px var(--speech-shadow),
    inset 0 1px 0 var(--glass-a72);
  backdrop-filter: blur(18px) saturate(140%);
  /* Slide-out from the rail's own edge, on the house easing
     (--ease-signature) so it belongs to the connect/disconnect family. 640ms,
     not the 800ms signature move: this card comes and goes several times a
     session and the full ceremony would wear. An earlier 420ms/260ms pass
     read as a POP rather than a slide \u2014 at rail width the travel is ~390px,
     and under ~600ms the eye never resolves it as motion. */
  transform: translateX(115%);
  opacity: 0;
  pointer-events: none;
  transition:
    transform 640ms var(--ease-signature),
    opacity 300ms ease;
  /* Retracted, the card keeps its content (so the slide-back has something to
     animate) but must stop costing layout/paint. Delayed past the slide, the
     same technique \u2014 and the same allow-discrete shape \u2014 the rail itself uses
     for the disconnected state. */
  content-visibility: hidden;
  transition-property: transform, opacity, content-visibility;
  transition-duration: 640ms, 300ms, 0s;
  transition-delay: 0s, 0s, 680ms;
  transition-behavior: allow-discrete;
}
.plan-card.is-open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
  content-visibility: visible;
  /* Opacity LEADS the entrance (fades in over the first half of the travel)
     and trails on the way out, so the card is never a hard-edged rectangle
     sliding across the rail. */
  transition-duration: 640ms, 420ms, 0s;
  transition-delay: 0s, 0s, 0s;
}
/* THE entrance fix. The card is created by React only once a plan exists, and
   it mounts with \`is-open\` ALREADY set \u2014 so there was no previous state to
   transition from and the browser painted it at its final position on the
   first frame. However slow the transition, it could never run: the card did
   not slide in, it appeared. @starting-style gives that first paint a real
   origin, so the mount animates like every later toggle. */
@starting-style {
  .plan-card.is-open {
    transform: translateX(115%);
    opacity: 0;
  }
}
.plan-card::before {
  /* Matches the device card's glass wash so the pair share one surface. */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, var(--glass-a72), var(--glass-a44));
  pointer-events: none;
}
.plan-card > * {
  position: relative; /* above the wash */
  z-index: 1;
}
.plan-card__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.plan-card__title {
  font-size: 12.5px;
  color: var(--muted-2);
  letter-spacing: .04em;
}
.plan-card__count {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--muted-4);
  font-variant-numeric: tabular-nums;
}
.plan-card__meter {
  height: 3px;
  border-radius: 999px;
  background: var(--hairline-strong);
  overflow: hidden;
}
.plan-card__meter-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--banzhuan-led);
  transition: width 420ms var(--ease-signature);
}
.plan-card__list {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
  /* The rail has vertical room, so a long plan SCROLLS rather than hiding
     its tail behind a "+n more" the way the cramped inline strip must. */
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* Scroll-edge fog, same construction as .sidebar-list and .conversation:
     the list dissolves at whichever edge has content past it, so a scrolled
     plan never ends in a hard cut against the card's padding. useScrollEdges
     toggles the classes, and the --fog-* customs are @property-registered
     (near the conversation rules) so the reveal animates instead of jumping. */
  --fog-top-h: 0px;
  --fog-bottom-h: 0px;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fog-top-h),
    #000 calc(100% - var(--fog-bottom-h)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 var(--fog-top-h),
    #000 calc(100% - var(--fog-bottom-h)),
    transparent 100%
  );
  transition:
    --fog-top-h 180ms ease,
    --fog-bottom-h 180ms ease;
}
.plan-card__list.has-fog-top { --fog-top-h: 18px; }
.plan-card__list.has-fog-bottom { --fog-bottom-h: 18px; }
/* The house scrollbar \u2014 identical to .conversation / .composer-input, so the
   rail does not introduce a third bar style. (The sidebar hides its bar and
   leans on the fog alone; here the plan can outrun the card by a lot, so the
   thumb is worth keeping as a position cue.) */
.plan-card__list::-webkit-scrollbar { width: 10px; }
.plan-card__list::-webkit-scrollbar-track { background: transparent; }
.plan-card__list::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.plan-card__list::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
.plan-card__row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.45;
  /* A step changing status EASES. \u677F\u7816 sometimes lands two flips in one
     todo_write (it does the work, then updates the list once), and an
     instant recolour of two rows at once reads as a glitch; the same change
     eased over a beat reads as what it is \u2014 the plan catching up. */
  transition: color 260ms ease;
  /* --muted-2, not the --muted-4 the inline strip uses: measured on the
     composited card surface, --muted-4 lands at 3.1:1 in light mode. That is
     fine for the strip (a glanceable echo of a line the transcript already
     spells out) and not fine here \u2014 this card IS the plan now, and its rows
     are meant to be read. The three tiers survive: pending at this weight,
     completed dimmed below, in-flight promoted to full --ink. */
  color: var(--muted-2);
}
.plan-card__mark {
  flex: none;
  width: 8px;
  height: 8px;
  /* Optical centre of the first text line (12.5px \xD7 1.45 \u2248 18px). */
  margin-top: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-faint);
  transition:
    color 260ms ease,
    background-color 260ms ease,
    border-color 260ms ease,
    opacity 260ms ease;
}
.plan-card__mark svg {
  width: 10px;
  height: 10px;
  flex: none;
}
.plan-card__row.is-pending .plan-card__mark {
  border: 1px solid var(--muted-faint);
  border-radius: 50%;
}
/* Done rows are marked, not faded. An earlier \`opacity: .72\` here bought
   recession by fading the text toward the card surface \u2014 measured, that put
   completed items at 2.65:1, i.e. the steps you might want to re-read became
   the hardest to read. The \u2713 already says "done" unambiguously, and the
   in-flight row is promoted to full --ink, so the hierarchy survives without
   spending contrast on it. The mark carries the tint instead. */
.plan-card__row.is-completed .plan-card__mark {
  color: var(--banzhuan-led);
  opacity: .75;
}
.plan-card__row.is-in-progress {
  color: var(--ink);
}
/* The current step is a CARET, not a pulsing dot (owner 2026-07-27: three
   identical blue pulses \u2014 sidebar, activity LED, this \u2014 ran at once during a
   dispatch). The redesign's rule: motion means "the live thing" and only the
   record's activity LED may claim it; every other surface states its fact in
   FORM. The caret is the CLI plan strip's own in-progress mark (\u2713 / \u25B8 / \xB7),
   so the two frontends point at the current step the same way \u2014 and it needs
   no motion to read as "you are here". */
.plan-card__row.is-in-progress .plan-card__mark {
  color: var(--banzhuan-led);
}
/* Size comes from the \`.plan-card__mark svg\` rule above (10px box, same
   1px overflow-and-center as the \u2713); the 8\xD710 viewBox letterboxes the
   triangle back to its true proportions inside it. */
.plan-card__caret {
  fill: currentColor;
}
/* Parked on a permission gate: the step is the current one but nothing is
   being done to it \u2014 it is waiting on the user. The caret goes hollow, same
   move as the pending ring, keeping the LED tint so it still reads as the
   CURRENT step rather than a not-started one. */
.plan-card.is-waiting .plan-card__caret {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linejoin: round;
}
.plan-card__text {
  min-width: 0;
  /* Wraps, unlike the inline strip's single line: the rail is a column with
     room to spend, and a truncated task name is the one thing this card
     exists to show. */
  overflow-wrap: anywhere;
}
.plan-card__unknown {
  margin: 0;
  font-size: 12px;
  color: var(--muted-faint);
}

/* \u2500\u2500 \u64CD\u4F5C\u8F68\u8FF9 rail card (2026-08-17) \u2014 rides the .plan-card chrome \u2500\u2500\u2500\u2500\u2500\u2500
   The plan card's fallback for dispatches with no \u4EFB\u52A1\u6E05\u5355 (every \u6781\u7B80 run).
   Same glass, slide, fog and mark triad; what differs lives under the
   \`trace-card\` variant class below. */
/* No denominator, so no fill fraction: a slow edge-to-edge sweep is the
   live state (and the card's ONE moving element \u2014 the row marks stay
   static per the 2026-07-27 form-not-motion rule); settled, the meter
   rests as a solid full line, the same "done" register as the plan meter
   reaching its end. */
.trace-card__meter-fill {
  display: block;
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: var(--banzhuan-led);
  opacity: .55;
  transition: opacity 420ms ease;
}
.trace-card__meter-fill.is-live {
  opacity: 1;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--banzhuan-led) 35%,
    var(--banzhuan-led) 65%,
    transparent 100%
  );
  background-size: 45% 100%;
  background-repeat: no-repeat;
  animation: trace-meter-sweep 1.6s ease-in-out infinite;
}
@keyframes trace-meter-sweep {
  0% { background-position: -80% 0; }
  100% { background-position: 180% 0; }
}
/* Parked on a permission gate: nothing is being worked \u2014 the sweep stops
   mid-flight (paused, not removed: resuming continues rather than
   restarting). Same discipline as the plan caret going hollow. */
.plan-card.is-waiting .trace-card__meter-fill.is-live {
  animation-play-state: paused;
}
/* Rows are append-only within a dispatch, so each mounts exactly once \u2014
   a small rise-and-fade entrance makes the trace visibly GROW instead of
   rows teleporting in. */
/* The per-mount fade this row used to carry gave way to the family's
   shared row motion (ADR 0058 \xA75.7): an appended op enters with it, the
   first trace lands still with the card's slide. */
.trace-card__row {
  align-items: center;
}
/* A long-run dispatch lands hundreds of ops (owner 2026-08-17): the list
   caps its VISIBLE height (~6 rows) and scrolls inside \u2014 with the fog
   edges and the follow-tail pin, the card reaches this size and then
   stays, instead of creeping down the rail. trace-context caps the DOM
   rows separately (TRACE_MAX_ROWS); the header count still covers the
   whole run. The plan card keeps its grow-then-flex behaviour \u2014 a todo
   list is finite and its tail is the payoff. */
.trace-card .plan-card__list {
  max-height: 168px;
}
/* One line per op, ellipsized \u2014 a command line can be arbitrarily long and
   the row is a pointer, not the record (hover carries the full text via
   title; the record's own rows keep everything). Unlike plan items, which
   wrap: a task NAME is the card's content, an op ARG is its address. */
.trace-card__text {
  min-width: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trace-card__verb {
  color: var(--muted-4);
}
.trace-card__row.is-running {
  color: var(--ink);
}
.trace-card__row.is-running .plan-card__mark {
  color: var(--banzhuan-led);
}
.trace-card__row.is-ok .plan-card__mark {
  color: var(--banzhuan-led);
  opacity: .75;
}
.trace-card__row.is-fail .plan-card__mark {
  color: #9a5b5b;
}
/* The optical-centre nudge is for the plan card's wrapping rows; these are
   single-line and centre-aligned. */
.trace-card__row .plan-card__mark {
  margin-top: 0;
}
.trace-card__note {
  flex: none;
  margin-left: auto;
  padding-left: 8px;
  font-size: 11.5px;
  color: var(--muted-4);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* \u2500\u2500 \u4ED3\u5E93 rail card (ADR 0058) \u2014 rides the .plan-card chrome \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The workspace's repository under the device: the branch line reads at
   a glance (name, upstream, \u2191\u2193), the rows are the uncommitted files with
   git's own status letter as the mark, the last line the last commit.
   Facts in FORM, nothing moves; the list caps like the trace card's. */
.repo-card__branch {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 13.5px;
  color: var(--ink);
}
.repo-card__branch-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.repo-card__upstream {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: var(--muted-4);
}
.repo-card__upstream.is-gone {
  text-decoration: line-through;
  text-decoration-color: var(--muted-faint);
}
/* The upstream was deleted on the remote (ADR 0058 \xA77): a small word in the
   row's muted ink, beside the struck name \u2014 a fact, not an alarm. */
.repo-card__gone {
  flex: none;
  font-size: 10.5px;
  color: var(--muted-4);
  border: 1px solid var(--muted-faint);
  border-radius: 3px;
  padding: 0 4px;
  line-height: 15px;
}
.repo-card__delta {
  flex: none;
  margin-left: auto;
  font-size: 12px;
  color: var(--muted-2);
  font-variant-numeric: tabular-nums;
  letter-spacing: .02em;
}
/* An operation left mid-flight (merge, rebase, \u2026): a fact the next commit
   would conclude, stated in the row's ink, not in an alarm colour \u2014 the
   command card says what a commit would do (ADR 0049 \xA75). */
.repo-card__flag {
  margin: 0;
  font-size: 12px;
  color: var(--ink);
}
.repo-card .plan-card__list {
  max-height: 168px;
}
.repo-card__row {
  align-items: center;
}
.repo-card__row .plan-card__mark {
  margin-top: 0;
  width: auto;
  min-width: 10px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted-4);
}
.repo-card__row.is-added .plan-card__mark {
  color: var(--banzhuan-led);
}
.repo-card__row.is-untracked .plan-card__mark {
  color: var(--muted-faint);
}
.repo-card__row.is-conflict .plan-card__mark {
  color: #9a5b5b;
}
/* One line per path, ellipsized \u2014 a path is an address, not the content
   (the hover title carries it whole). A button where the viewer can open
   it (ADR 0050), a span where it cannot; same look either way. */
.repo-card__path {
  min-width: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
}
button.repo-card__path {
  cursor: pointer;
}
button.repo-card__path:hover {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.repo-card__more,
.repo-card__scope,
.repo-card__commit {
  margin: 0;
  font-size: 11.5px;
  color: var(--muted-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* A row for a path OUTSIDE a subfolder workspace (ADR 0058 amendment):
   stated, spelled with ../, not openable \u2014 quieter than its siblings. */
.repo-card__row.is-outside .repo-card__path {
  color: var(--muted-4);
}
/* The recent commits (ADR 0058 \xA75.4): a small section label, then rows
   with the abbreviated id as the mark and the subject as the commit tab's
   opener (ADR 0059) \u2014 the same row grammar as the dirty list, capped a
   little shorter so both lists fit the card. The label's right end opens
   the full history (ADR 0059 \xA76). */
.repo-card__section {
  margin: 4px 0 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
  letter-spacing: .02em;
  color: var(--muted-4);
}
.repo-card__all {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: 0;
  padding: 1px 4px;
  margin-right: -4px;
  border-radius: 6px;
  font: inherit;
  letter-spacing: inherit;
  color: var(--muted-4);
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease;
}
.repo-card__all:hover,
.repo-card__all:focus-visible {
  color: var(--ink);
  background: var(--ink-a13);
  outline: none;
}
.repo-card__all svg {
  transition: transform 180ms var(--ease-signature);
}
.repo-card__all:hover svg {
  transform: translateX(1px);
}
.repo-card .repo-card__log {
  max-height: 118px;
}
.repo-card__log-row .plan-card__mark.repo-card__sha {
  min-width: 0;
  font-weight: 500;
  letter-spacing: 0;
}
.repo-card__subject {
  font-size: 12px;
  color: var(--muted-2);
}
/* Not on the upstream yet (ADR 0058 \xA75.6): the header's \u2191n says how many,
   the mark says which. The LED tint, so it reads with the count above. */
.repo-card__unpushed {
  flex: none;
  font-size: 11px;
  line-height: 1;
  color: var(--banzhuan-led);
  opacity: .85;
}

/* \u2500\u2500 The card's motion (ADR 0058 \xA75.7) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Change and touch move; facts do not pulse (the 2026-07-27 rule). A row
   under the pointer lifts as the record's own glass pill; a row that
   arrives eases in where it sits, a row that leaves eases out where it was
   \u2014 the list's height follows the row, so nothing below it jumps. The
   header's count, the branch and \u2191\u2193 swap in place (SwapText). Lengths
   match REPO_ROW_ENTER_MS / REPO_ROW_LEAVE_MS in RepoCard.tsx. */
/* The pill bleeds 6px into the card's padding on both sides. The LIST
   carries the negative margin and the ROW the matching padding \u2014 a row
   with its own negative margin overflows the scroll container sideways,
   and \`overflow-y: auto\` then paints a horizontal bar under every list
   (seen in the built app, 2026-09-07). */
.repo-card .plan-card__list {
  margin-left: -6px;
  margin-right: -6px;
}
.repo-card__row {
  position: relative;
  border-radius: 6px;
  padding: 1px 6px;
  transition: background-color 140ms ease, color 260ms ease;
}
.repo-card__row:has(> button:hover),
.repo-card__row:has(> button:focus-visible) {
  background: var(--ink-a13);
}
.repo-card__row:has(> button:active) {
  background: var(--ink-a22);
  transition-duration: 60ms;
}
.repo-card__row:has(> button:hover) .plan-card__mark,
.repo-card__row:has(> button:hover) .repo-card__path {
  color: var(--ink);
}
button.repo-card__path:hover {
  text-decoration: none;
}
button.repo-card__path,
.repo-card__row .plan-card__mark {
  transition: color 140ms ease;
}
/* Row entrance / exit, shared by every card in the family (repository,
   plan, trace \u2014 card-motion.ts). The height animates to and from \`auto\`
   (\`interpolate-size\`, Chromium 129+): a plan step that wraps to two
   lines opens to its own height, not to a guessed cap. The 7px list gap
   collapses with the row (the negative margin) so the rows below settle
   without a jump; opacity leads the exit so the row is gone before its
   space closes. */
.plan-card__row.is-entering,
.plan-card__row.is-leaving {
  interpolate-size: allow-keywords;
  overflow: hidden;
}
.plan-card__row.is-entering {
  animation: card-row-in 300ms var(--ease-signature) both;
}
.plan-card__row.is-leaving {
  animation: card-row-out 220ms ease both;
  pointer-events: none;
}
@keyframes card-row-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
    height: 0;
    margin-top: -7px;
  }
  60% {
    height: auto;
    margin-top: 0;
  }
  to {
    opacity: 1;
    transform: none;
    height: auto;
    margin-top: 0;
  }
}
@keyframes card-row-out {
  from {
    opacity: 1;
    transform: none;
    height: auto;
    margin-top: 0;
  }
  40% {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 0;
    transform: translateY(-3px);
    height: 0;
    margin-top: -7px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .plan-card__row.is-entering,
  .plan-card__row.is-leaving { animation: none; }
  .plan-card__row.is-leaving { display: none; }
  .repo-card__all svg { transition: none; }
}
.trace-card__note.is-fail {
  color: #9a5b5b;
}

@media (prefers-reduced-motion: reduce) {
  .plan-card,
  .plan-card__list,
  .plan-card__meter-fill { transition: none; }
  .trace-card__meter-fill { transition: none; }
  .trace-card__meter-fill.is-live {
    animation: none;
    background: var(--banzhuan-led);
  }
  .trace-card__row { animation: none; }
  .plan-card__row { animation: none; }
}
.activity-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--muted-strong);
}
.activity-step.is-continuation {
  padding-left: 22px;
  color: var(--muted);
}
.activity-step__icon {
  flex: none;
  margin-top: 2px;
  color: var(--muted-4);
  display: inline-flex;
}
.activity-step__text {
  min-width: 0;
  flex: 1;
}
.activity-step__body {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted-strong);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas,
    "DejaVu Sans Mono", monospace;
}
/* Failure rows (tool-fail digest, incl. tool_crashed containment results,
   2026-07-23): the same amber the armed-switch warning badge uses, so a
   crash reads as a warning at a glance instead of a dim success twin. */
.activity-step.is-failure .activity-step__body,
.activity-step.is-failure .activity-step__icon {
  color: #b45309;
}
:host([data-theme="dark"]) .activity-step.is-failure .activity-step__body,
:host([data-theme="dark"]) .activity-step.is-failure .activity-step__icon {
  color: #d99a4e;
}
/* Diff magnitude (2026-08-25) \u2014 the \`\u21B3 +96 \u22125\` a write finally answers with.
   Desaturated on purpose: this sits in a column of muted monospace, and a
   saturated git-green would shout louder than the failure amber above, which
   is the one colour in this block that must win. */
.diff-stat {
  display: inline-flex;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}
/* The entrance belongs to a LIVE append only \u2014 DiffStat stamps this class off
   the block's own \`at\`, the same recency gate as the live-attach entrance, so
   a reloaded session's history renders settled instead of replaying every
   dispatch's count-up at once (2026-08-25). */
.diff-stat--live {
  animation: diffStatIn 260ms var(--ease-pop) both;
}
.diff-stat__n {
  /* Fixed-width digits do not reflow the row as the count climbs. */
  font-variant-numeric: tabular-nums;
}
.diff-stat__n--add {
  color: #3f7d50;
}
.diff-stat__n--del {
  color: #a4544c;
}
/* The roll-up on the done marker: the same shape as the rows it sums, one
   step stronger so it reads as their total rather than another row. */
.diff-stat--rollup {
  font-weight: 500;
  animation-delay: 90ms;
}
:host([data-theme="dark"]) .diff-stat__n--add {
  color: #6fa86f;
}
:host([data-theme="dark"]) .diff-stat__n--del {
  color: #c4736b;
}
@keyframes diffStatIn {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  /* The digits also stop counting \u2014 see useCountUp. */
  .diff-stat--live {
    animation: none;
  }
}

/* \u2500\u2500 A write's row, with its diff folded in (2026-08-25 evening) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   \`patch.preview\` is published by the permission RULE, which runs BEFORE the
   tool \u2014 so the record holds the diff and THEN the \`\u5199\u5165\` that produced it,
   and the history read backwards (owner). The row folds them back together:
   the action and its magnitude on one line, the evidence one click below.

   The whole headline is the control, not a separate "expand" link: the thing
   the reader wants to open is the file row itself. */
.activity-step__fold-head {
  appearance: none;
  border: none;
  background: none;
  /* Negative margin against the padding, so the text still lines up with the
     rows above and below while the hit area is comfortably larger. */
  margin: 0 -6px;
  padding: 1px 6px;
  width: calc(100% + 12px);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  font-size: 12px;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition: background 140ms var(--ease-out-soft);
}
.activity-step__fold-head:hover {
  background: color-mix(in srgb, var(--muted-faint) 14%, transparent);
}
.activity-step__fold-head .activity-step__body {
  flex: 1;
  min-width: 0;
}
.activity-step__fold-head .diff-stat {
  flex: none;
  line-height: 1.5;
}
.activity-step__fold-chevron {
  flex: none;
  margin-top: 4px;
  color: var(--muted-4);
  transition: transform 200ms var(--ease-signature), color 140ms ease;
}
.activity-step__fold-head:hover .activity-step__fold-chevron {
  color: var(--muted-strong);
}
.activity-step__fold-head.is-open .activity-step__fold-chevron {
  transform: rotate(90deg);
}
/* Measured max-height reveal, same as the activity history panel: the px
   target is set by the JS in ActivityStep (a transition needs a length, and
   \`auto\` is not one). Shared by the folded patch and the evidence-detail
   pane (2026-08-26 \u2014 the \u660E\u7EC6 used to pop with no animation while the diff
   beside it eased). */
.activity-step__fold {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 240ms var(--ease-out-soft), opacity 160ms ease;
}
.activity-step__fold.is-open {
  opacity: 1;
}

/* \u2500\u2500 Rendered diff (2026-08-25 evening) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Was a single <pre> of the raw fenced body \u2014 every line the same weight,
   the \`+\`/\`-\` doing all the work, and the \`\`\` fences on screen (owner: "the
   diff block is plain"). Now one row per line, tinted by role, with the sign
   lifted out of the text into a fixed gutter.

   The tints are the SAME desaturated pair as .diff-stat above, at low alpha:
   a full-strength git-green block would out-shout the failure amber, which is
   the one colour in this panel that must win. */
.diff-body {
  margin: 6px 0 2px;
  border: 1px solid var(--hairline);
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--muted-faint) 6%, transparent);
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas,
    "DejaVu Sans Mono", monospace;
  font-size: 11.5px;
  line-height: 1.55;
}
.diff-body__line {
  display: flex;
  gap: 8px;
  padding-right: 8px;
  /* A blank line is still a line: without this it collapses to nothing and
     the diff appears to skip rows it did not skip. */
  min-height: 1.55em;
}
.diff-body__gutter {
  flex: none;
  width: 18px;
  text-align: center;
  color: var(--muted-4);
  background: color-mix(in srgb, var(--muted-faint) 9%, transparent);
  user-select: none;
}
.diff-body__text {
  flex: 1;
  min-width: 0;
  color: var(--muted-3);
  white-space: pre-wrap;
  word-break: break-word;
}
.diff-body__line.is-add {
  background: rgba(63, 125, 80, 0.1);
}
.diff-body__line.is-add .diff-body__gutter {
  color: #3f7d50;
  background: rgba(63, 125, 80, 0.16);
}
.diff-body__line.is-add .diff-body__text {
  color: var(--muted-strong);
}
.diff-body__line.is-del {
  background: rgba(164, 84, 76, 0.1);
}
.diff-body__line.is-del .diff-body__gutter {
  color: #a4544c;
  background: rgba(164, 84, 76, 0.16);
}
.diff-body__line.is-del .diff-body__text {
  color: var(--muted-strong);
}
.diff-body__line.is-hunk .diff-body__text,
.diff-body__line.is-file .diff-body__text {
  color: var(--muted-4);
}
.diff-body__line.is-hunk {
  background: color-mix(in srgb, var(--muted-faint) 12%, transparent);
}
/* \`\\ 412 unchanged lines omitted\` \u2014 a statement ABOUT the diff, not part of
   it, so it reads as an aside rather than as content. */
.diff-body__line.is-meta .diff-body__text {
  color: var(--muted-4);
  font-style: italic;
}
:host([data-theme="dark"]) .diff-body__line.is-add {
  background: rgba(111, 168, 111, 0.13);
}
:host([data-theme="dark"]) .diff-body__line.is-add .diff-body__gutter {
  color: #6fa86f;
  background: rgba(111, 168, 111, 0.2);
}
:host([data-theme="dark"]) .diff-body__line.is-del {
  background: rgba(196, 115, 107, 0.13);
}
:host([data-theme="dark"]) .diff-body__line.is-del .diff-body__gutter {
  color: #c4736b;
  background: rgba(196, 115, 107, 0.2);
}
/* Inside the approval card's dark preview well: the well supplies the box, so
   this drops its own chrome, and its colours are FIXED \u2014 that well is #0f172a
   in both themes, so theme-token tints would wash out in light mode. Written
   after the dark overrides above so it wins in either theme. */
.diff-body--on-dark {
  margin: 0;
  border: none;
  border-radius: 0;
  background: none;
  font-size: 12px;
}
.diff-body--on-dark .diff-body__text {
  color: #94a3b8;
  /* A path or a minified line has no spaces to break at; the well is narrow
     and must never scroll sideways. */
  word-break: break-all;
}
.diff-body--on-dark .diff-body__gutter {
  color: #64748b;
  background: rgba(226, 232, 240, 0.05);
}
.diff-body--on-dark .diff-body__line.is-add {
  background: rgba(74, 222, 128, 0.11);
}
.diff-body--on-dark .diff-body__line.is-add .diff-body__gutter {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.18);
}
.diff-body--on-dark .diff-body__line.is-del {
  background: rgba(248, 113, 113, 0.11);
}
.diff-body--on-dark .diff-body__line.is-del .diff-body__gutter {
  color: #f87171;
  background: rgba(248, 113, 113, 0.18);
}
.diff-body--on-dark .diff-body__line.is-add .diff-body__text,
.diff-body--on-dark .diff-body__line.is-del .diff-body__text {
  color: #e2e8f0;
}
.diff-body--on-dark .diff-body__line.is-hunk {
  background: rgba(226, 232, 240, 0.07);
}
.diff-body--on-dark .diff-body__line.is-hunk .diff-body__text,
.diff-body--on-dark .diff-body__line.is-file .diff-body__text,
.diff-body--on-dark .diff-body__line.is-meta .diff-body__text {
  color: #64748b;
}
@media (prefers-reduced-motion: reduce) {
  .activity-step__fold,
  .activity-step__fold-chevron,
  .activity-step__fold-head {
    transition: none;
  }
}
/* Evidence-detail expander (2026-07-23): the block's evidenceDetail \u2014
   command-output tail, \u6539\u52A8\u6587\u4EF6 / \u98CE\u9669 / \u5F85\u529E roll-ups, what Herta's prompt
   reads \u2014 collapsed by default to keep the screen terse. */
.activity-step__detail-toggle {
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  margin-top: 2px;
  font-size: 11px;
  color: var(--muted-4);
  cursor: pointer;
  text-decoration: underline dotted;
}
.activity-step__detail-toggle:hover {
  color: var(--muted-strong);
}
.activity-step__detail {
  margin: 4px 0 2px;
  padding: 6px 8px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--muted-3);
  background: color-mix(in srgb, var(--muted-faint) 12%, transparent);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas,
    "DejaVu Sans Mono", monospace;
}

/* \u2500\u2500 SwapText: in-place line swap (2026-06-12 seamless-workbench \xA76.2) \u2500\u2500 */
.swap-text {
  position: relative;
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.swap-text__in,
.swap-text__out {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.swap-text__in.is-entering {
  animation: swap-in 240ms ease;
}
/* The live \u677F\u7816 working step shimmers \u2014 continuous with the pending \u5904\u7406\u4E2D\u2026
   shimmer \u2014 so the line reads as active even when the step text is static
   between backend events (the LED pulse alone wasn't enough; live
   verification 2026-06-13). \`:not(.is-entering)\` yields to the 240ms in-place
   swap, then the shimmer resumes once the new step settles. */
.swap-text__in.is-shimmer:not(.is-entering) {
  background: linear-gradient(90deg, var(--muted-strong) 0%, var(--muted-deep) 35%, var(--muted-faint) 50%, var(--muted-deep) 65%, var(--muted-strong) 100%);
  background-size: 250% 100%;
  background-position: 150% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: text-shimmer 2.8s linear infinite;
}
.swap-text__out {
  position: absolute;
  left: 0;
  top: 0;
  animation: swap-out 240ms ease forwards;
}
@keyframes swap-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: none; }
}
@keyframes swap-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateY(-5px); }
}
@media (prefers-reduced-motion: reduce) {
  .swap-text__in.is-entering { animation: none; }
  .swap-text__out { display: none; }
}

/* \u2500\u2500 Shared text shimmer (active backend step + galaxy text) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes text-shimmer {
  0% { background-position: 150% 0; }
  100% { background-position: -150% 0; }
}
.activity-step.is-active .activity-step__body {
  background: linear-gradient(90deg, var(--muted-strong) 0%, var(--muted-deep) 35%, var(--muted-faint) 50%, var(--muted-deep) 65%, var(--muted-strong) 100%);
  background-size: 250% 100%;
  background-position: 150% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: text-shimmer 2.8s linear infinite;
}
.transfer-text.is-shimmer {
  background: linear-gradient(90deg, var(--muted-2) 0%, #949ba6 35%, #c8cdd5 50%, #949ba6 65%, var(--muted-2) 100%);
  background-size: 250% 100%;
  background-position: 150% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: text-shimmer 2.4s linear infinite reverse;
}
.activity-line__summary.is-shimmer {
  background: linear-gradient(90deg, var(--muted-strong) 0%, var(--muted-deep) 35%, var(--muted-faint) 50%, var(--muted-deep) 65%, var(--muted-strong) 100%);
  background-size: 250% 100%;
  background-position: 150% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: text-shimmer 2.8s linear infinite;
}

/* \u2500\u2500 \u677F\u7816 device-card states \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Smooth color cross-fades between states: the state COLOR lives in a
   static, SAME-SHAPE \`filter\` (drop-shadow + brightness + saturate) so
   \`transition: filter\` interpolates it between states; the breathe PULSE
   animates ONLY opacity/scale (devPulse) and never touches \`filter\`, so the
   colored halo persists and eases instead of snapping when the state swaps
   (CSS can't transition between two different keyframe animations \u2014 that was
   the abruptness). idle = a transparent halo, so idle\u2194working\u2194waiting fade.
   The spill carries a secondary recolored aura under the blur. Error/success
   are one-shot flashes whose held final filter shares the same shape, so the
   settle back to idle also fades. */
.agent-ring {
  transition: filter 0.5s ease;
}

@keyframes devPulse {
  0%, 100% { opacity: 0.93; transform: translate(-50%, -50%) scale(0.997); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.012); }
}

/* steady states: static colored halo + opacity/scale pulse (no filter anim)
   Slice 5: the fine working states (reading / writing / runningCommand /
   verifying) SHARE the delegated blue halo \u2014 the split is in the label
   (device.state.*), not a new palette. Grouped selectors keep the visuals
   from regressing to no-halo now that useDeviceState produces them. */
.agent-ring.is-idle,
.agent-ring.is-delegated,
.agent-ring.is-reading,
.agent-ring.is-writing,
.agent-ring.is-runningCommand,
.agent-ring.is-verifying,
.agent-ring.is-waitingApproval {
  animation: devPulse var(--agent-breathe-duration) ease-in-out infinite;
}
.agent-ring.is-idle {
  filter: drop-shadow(0 0 0 rgba(90, 165, 255, 0)) brightness(1) saturate(1);
}
.agent-ring.is-delegated,
.agent-ring.is-reading,
.agent-ring.is-writing,
.agent-ring.is-runningCommand,
.agent-ring.is-verifying {
  filter: drop-shadow(0 0 8px rgba(95, 170, 255, 0.92)) brightness(1.12) saturate(1.15);
  animation-duration: 1.3s;
}
.agent-ring.is-waitingApproval {
  filter: drop-shadow(0 0 8px rgba(255, 200, 105, 0.95)) brightness(1.05) saturate(1.2);
  animation-duration: 1.9s;
}

/* spill auras (gradient recolor; idle = the base blue spill) */
.agent-spill.is-delegated,
.agent-spill.is-reading,
.agent-spill.is-writing,
.agent-spill.is-runningCommand,
.agent-spill.is-verifying {
  animation: spillBreathe 1.3s ease-in-out infinite;
}
.agent-spill.is-waitingApproval {
  background:
    radial-gradient(ellipse 30% 30% at 50% 38%, rgba(255, 236, 175, 0.8) 0%, rgba(255, 205, 110, 0.55) 45%, rgba(255, 190, 80, 0) 80%),
    radial-gradient(ellipse 54% 60% at 50% 42%, rgba(255, 200, 110, 0.5) 0%, rgba(255, 185, 80, 0.22) 55%, rgba(255, 185, 80, 0) 88%);
  animation: spillBreathe 1.9s ease-in-out infinite;
}
.agent-spill.is-failed {
  background:
    radial-gradient(ellipse 30% 30% at 50% 38%, rgba(255, 150, 140, 0.82) 0%, rgba(245, 90, 85, 0.55) 45%, rgba(235, 70, 70, 0) 80%),
    radial-gradient(ellipse 54% 60% at 50% 42%, rgba(245, 100, 95, 0.5) 0%, rgba(235, 75, 75, 0.22) 55%, rgba(235, 75, 75, 0) 88%);
}
.agent-spill.is-succeeded {
  background:
    radial-gradient(ellipse 30% 30% at 50% 38%, rgba(170, 255, 195, 0.82) 0%, rgba(95, 235, 150, 0.55) 45%, rgba(70, 220, 130, 0) 80%),
    radial-gradient(ellipse 54% 60% at 50% 42%, rgba(110, 235, 160, 0.5) 0%, rgba(90, 220, 140, 0.22) 55%, rgba(90, 220, 140, 0) 88%);
}

/* error: red double-flash \u2192 steady dim red (forwards); idle then fades it out */
.agent-ring.is-failed {
  filter: drop-shadow(0 0 6px rgba(255, 95, 85, 0.85)) brightness(0.97) saturate(1.3);
  animation: devError 1.6s ease-out forwards;
}
@keyframes devError {
  0% { filter: drop-shadow(0 0 10px rgba(255, 90, 80, 1)) brightness(1.12) saturate(1.4); }
  12% { filter: drop-shadow(0 0 3px rgba(255, 90, 80, 0.4)) brightness(0.82) saturate(1.2); }
  24% { filter: drop-shadow(0 0 10px rgba(255, 90, 80, 1)) brightness(1.12) saturate(1.4); }
  38% { filter: drop-shadow(0 0 3px rgba(255, 90, 80, 0.4)) brightness(0.82) saturate(1.2); }
  100% { filter: drop-shadow(0 0 6px rgba(255, 95, 85, 0.85)) brightness(0.97) saturate(1.3); }
}

/* success: bright green flash, then HOLDS green a beat (longer-lived) before
   idle fades it. Pairs with SUCCESS_FLASH_MS (1800) in useDeviceState. */
.agent-ring.is-succeeded {
  filter: drop-shadow(0 0 8px rgba(115, 240, 165, 0.9)) brightness(1.08) saturate(1.2);
  animation: devSuccess 1.5s ease-out;
}
@keyframes devSuccess {
  0% { filter: drop-shadow(0 0 4px rgba(115, 240, 165, 0.45)) brightness(0.96) saturate(1.1); }
  22% { filter: drop-shadow(0 0 13px rgba(150, 255, 190, 1)) brightness(1.2) saturate(1.3); }
  60% { filter: drop-shadow(0 0 9px rgba(120, 245, 170, 0.92)) brightness(1.12) saturate(1.25); }
  100% { filter: drop-shadow(0 0 8px rgba(115, 240, 165, 0.9)) brightness(1.08) saturate(1.2); }
}

/* Aura slice additions \u2014 the WebGL aura fills the dotted ring.
   (The legacy .waveform bar-meter and .speech-menu rules were removed
   from the lifted UX_v5 reference block above when the aura replaced them.) */
/* The aura fills the ring (canvas) with a static graphite-glass fallback behind
   it when WebGL is unavailable (AuraVisual sets data-fallback). */
.aura-frame {
  position: absolute;
  inset: 0;
  isolation: isolate;
}
.aura-canvas,
.aura-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.aura-canvas {
  z-index: 1;
}
.aura-fallback {
  z-index: 0;
  display: none;
  /* Static stand-in for the tide wave: a soft line hugging the composer's
     bottom edge. */
  background: radial-gradient(
    ellipse 55% 14% at 50% 92%,
    rgba(60, 90, 98, 0.45) 0%,
    rgba(60, 90, 98, 0.16) 48%,
    transparent 74%
  );
}
.aura-canvas[data-fallback="true"] + .aura-fallback {
  display: block;
}

/* \u2500\u2500 @\u677F\u7816 mention chip (bubbles \u2014 full pill; spec 2026-06-16) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Metric-safe pill: padding draws the pill, the matching negative margin
   cancels its contribution to inline advance width, and the weight is left
   inherited (400). So when \`@\u677F\u7816\` swaps from plain streaming text to the
   finalized chip, the token's layout width is unchanged \u2014 no line reflow,
   no bubble-height jump (2026-06-28). The pill background bleeds ~6px into
   the adjacent whitespace/punctuation on each side, which is the intended
   look. */
.banzhuan-mention {
  background: rgba(77, 134, 255, 0.12);
  color: var(--mention-ink);
  border-radius: 6px;
  padding: 1px 6px;
  margin: 0 -6px;
  white-space: nowrap;
}

/* \u2500\u2500 Disconnected state: right rail slides off; workspace expands \u2500\u2500\u2500\u2500\u2500\u2500
   Mirrors the sidebar collapse (.app.sidebar-collapsed): collapse the rail
   grid column while its content translates right + fades (spec 2026-06-16).
   STAGGERED (post-test 2026-06-17): the cards begin sliding 400ms AFTER the
   disconnect starts and slide over 800ms \u2014 the composer\u2192button morph leads,
   the layout reflow follows. The gap is zeroed too so the workspace reclaims
   the full width cleanly (no centre/gap residue). On RECONNECT the cards slide
   back snappily (no delay). */
.workspace-body {
  transition:
    grid-template-columns var(--dur-morph) var(--ease-signature),
    gap var(--dur-morph) var(--ease-signature);
}
.app.is-disconnected .workspace-body {
  /* Three tracks since ADR 0050 \u2014 counts must match the base template or
     the collapse JUMPS instead of interpolating. */
  grid-template-columns: minmax(0, 1fr) 0 0;
  gap: 0;
  transition:
    grid-template-columns var(--dur-morph) var(--ease-signature) 400ms,
    gap var(--dur-morph) var(--ease-signature) 400ms;
}
/* The old gap-to-zero reclaim, now on the margin that replaced the gap. */
.app.is-disconnected .workspace {
  margin-right: 0;
  transition: margin-right var(--dur-morph) var(--ease-signature) 400ms;
}
.utility-rail {
  transition:
    transform var(--dur-morph) var(--ease-signature),
    opacity 360ms ease;
}
.app.is-disconnected .utility-rail {
  /* A PIXEL distance, not a percentage: 130% resolved against the rail's
     own box, and that box rode the collapsing track \u2014 a %-translate times
     a shrinking width is a hump, not a slide (2026-09-02; the viewer rule
     below has the full account). Same 1.3 \xD7 rail width as before. */
  transform: translateX(calc(var(--rail-w) * 1.3));
  opacity: 0;
  pointer-events: none;
  /* Once the fade completes (400ms delay + 360ms) the rail is invisible but
     its subtree still re-laid-out EVERY FRAME of the 400\u20131200ms grid-column
     collapse (and kept costing in the steady disconnected state). Skip its
     contents from 780ms \u2014 the allow-discrete delayed flip keeps the cards
     rendered through their visible slide-out (verified through the real
     delete\u2192disconnect flow: computed CV holds \`visible\` until exactly
     +780ms). Longhands keep allow-discrete scoped per-property next to the
     var()-based entries. Removing the class reverts to the base transition
     list (no content-visibility entry), so on reconnect the contents lay
     out again INSTANTLY, before the slide-in. */
  content-visibility: hidden;
  transition-property: transform, opacity, content-visibility;
  transition-duration: var(--dur-morph), 360ms, 0s;
  transition-timing-function: var(--ease-signature), ease, linear;
  transition-delay: 400ms, 400ms, 780ms;
  transition-behavior: normal, normal, allow-discrete;
}
@media (prefers-reduced-motion: reduce) {
  .workspace-body,
  .workspace,
  .utility-rail,
  .file-viewer {
    transition: none;
  }
}

/* \u2500\u2500 File viewer (ADR 0050): the rail parks behind the docked panel \u2500\u2500\u2500\u2500\u2500\u2500
   The disconnect choreography, reused for viewer-open: content translates
   right + fades, and content-visibility flips once the fade lands so the
   parked subtree stops costing layout/paint \u2014 the WebGL loops are gated in
   JS on the same signal (useRailParked). Closing reverts to the base
   transition list: contents lay out again instantly, before the slide-in,
   exactly like reconnect.

   2026-09-02 (owner: on every toggle the device card "bounced" left-right
   and its PNG sat in the middle of a half-width card, then drifted to the
   card's true middle as the card widened). Two causes, traced by seeking
   the transitions frame by frame: translateX(130%) resolved against the
   rail's OWN box, which rode the collapsing 338px\u21920 track \u2014 130% \xD7 a
   shrinking width is a hump, and the card's place-items:center re-centred
   the device in each frame's sliver. The rail was pinned at --rail-w (see
   .utility-rail) and the translate added --viewer-w to cancel the slot's
   own drift \u2014 which held only while the two moved in lockstep.

   2026-09-11 (owner: on close the cards "suddenly appear in the middle of
   the empty space", get "pushed to the edge of the app", then "jump back";
   most often after a width drag or with several tabs open). The transform
   runs on the COMPOSITOR thread; the grid-template-columns slide that
   moved the rail's slot runs on the MAIN thread. A busy main thread at
   close \u2014 the record re-wrapping to a wider column every frame, the tabs'
   views unmounting \u2014 lets the rail finish its slide over a FROZEN slot,
   and when layout catches up the slot drags the rail to the edge and it
   snaps back (reproduced with a 350ms stall: screencast frames 437/660/803
   are the owner's three pictures). No compensation term can hold two
   threads in step, so the rail LEAVES the grid for both slides: absolute
   on its rest geometry (the padding tokens \u2014 the same box as its track),
   translated a constant 777px (2.3 \xD7 --rail-w, the disconnect slide's
   338 + 1.3 \xD7 338) with no --viewer-w term, because the slot no longer
   moves under it. The shell holds \`viewer-closing\` for the close slide's
   length (the grid's own transitionend), and only then does the rail
   become the track item again \u2014 at the same place and width. Under any
   stall the rail now arrives at its rest and waits for the conversation.
   The transform starts WITH the track (delay 0); the fade keeps its 120ms
   stagger. */
.workspace-body.viewer-docked .utility-rail,
.workspace-body.viewer-closing .utility-rail {
  position: absolute;
  /* An absolute grid child's containing block is the grid AREA its
     placement names; auto names the padding box, which the offsets below
     are written against. */
  grid-column: auto;
  top: var(--body-pad-top);
  right: var(--body-pad-right);
  bottom: var(--body-pad-bottom);
}
.workspace-body.viewer-docked .utility-rail {
  transform: translateX(calc(var(--rail-w) * 2.3));
  opacity: 0;
  pointer-events: none;
  content-visibility: hidden;
  transition-property: transform, opacity, content-visibility;
  transition-duration: var(--dur-morph), 360ms, 0s;
  transition-timing-function: var(--ease-signature), ease, linear;
  transition-delay: 0s, 120ms, 500ms;
  transition-behavior: normal, normal, allow-discrete;
}

/* The panel itself: a glass card in the rail cards' family. No
   backdrop-filter \u2014 it MOVES during the slide, and a moving blur
   re-samples its backdrop every frame (the device-card morph lesson). */
.file-viewer {
  position: relative;
  /* Placed by NAME, as is the rail (grid-column: 2): the rail leaves the
     grid (position: absolute) while the viewer is docked, and an absolute
     child takes no cell, so an auto-placed panel slid into the rail's 0px
     column and collapsed \u2014 caught live 2026-09-11. The absolute states
     below reset the placement to auto so their offsets resolve against
     the body's padding box, not a track. */
  grid-column: 3;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--glass-a72);
  border-radius: 18px;
  box-shadow:
    0 12px 32px rgba(32, 45, 58, 0.045),
    inset 0 1px 0 var(--glass-a72);
  opacity: 0;
  transition: opacity 360ms ease;
}
/* The panel takes programmatic focus on open (so Escape lands); the
   focus is functional, not navigational \u2014 no ring. */
.file-viewer:focus,
.file-viewer:focus-visible {
  outline: none;
}
.workspace-body.viewer-docked .file-viewer {
  opacity: 1;
  transition-delay: 180ms;
}
/* The open slide moves a FINISHED layout (owner 2026-09-11: the panel was
   sized by its track on every frame, so the text re-wrapped as the track
   widened and only settled at the end \u2014 Codex lays the panel out at its
   final width first, then slides it in). While the shell holds
   \`viewer-opening\` \u2014 exactly the track transition's length \u2014 the panel
   LEAVES the grid: absolute at its final place (the track's area, the
   overlay sheet's coordinates) and its final width, and it slides in by
   transform on the track's own clock and curve, so it rides the yielding
   conversation edge to the pixel. Out of flow on purpose: a grid item
   with an explicit width feeds that width into the workspace's intrinsic
   size, the .app 1fr column grows past the window to fit it, the body
   re-measures wider, the 40% default chases it \u2014 measured live as a
   stuttering slide whose width kept changing. When the hold drops the
   panel is the track item again, at the same place and width (the
   track's min() cap keeps ruling the steady state \u2014 the three-layer
   width guarantee is untouched; --viewer-w is already clamped to it). */
.workspace-body.viewer-opening .file-viewer {
  position: absolute;
  grid-column: auto;
  top: var(--body-pad-top);
  bottom: var(--body-pad-bottom);
  right: var(--body-pad-right);
  width: var(--viewer-w, 480px);
  animation: fileViewerDockIn var(--dur-morph) var(--ease-signature) both;
}
@keyframes fileViewerDockIn {
  from {
    transform: translateX(
      calc(var(--viewer-w, 480px) + var(--body-pad-right, 24px))
    );
  }
  to { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-body.viewer-opening .file-viewer { animation: none; }
}
/* Threshold fallback (ADR 0050): the sheet floats over the right side \u2014
   nothing reflows, the rail stays live. */
.workspace-body.viewer-overlay .file-viewer {
  position: absolute;
  grid-column: auto;
  top: var(--body-pad-top);
  bottom: var(--body-pad-bottom);
  right: var(--body-pad-right);
  width: min(var(--viewer-w, 420px), calc(100% - 160px));
  z-index: 40;
  opacity: 1;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
  animation: fileViewerSheetIn 280ms var(--ease-signature) both;
}
@keyframes fileViewerSheetIn {
  from { transform: translateX(18px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-body.viewer-overlay .file-viewer { animation: none; }
}

.file-viewer__divider {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 9px;
  cursor: col-resize;
  z-index: 3;
}
.file-viewer__divider::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  bottom: 0;
  width: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background-color 140ms ease;
}
.file-viewer__divider:hover::after { background: var(--ink-a22); }

.file-viewer__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px 9px 16px;
  border-bottom: 1px solid var(--hairline);
  flex: none;
  min-width: 0;
}
/* The tab strip (ADR 0050 v1.5): bounded chips, active one raised on
   glass; each chip's \xD7 closes that file, the header \xD7 closes the panel. */
.file-viewer__tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.file-viewer__tab {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 180px;
  border-radius: 8px;
  padding: 0 2px 0 0;
  transition: background-color 140ms ease;
}
.file-viewer__tab.is-active {
  background: var(--glass-a78);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.file-viewer__tab:not(.is-active):hover { background: var(--ink-a13); }
.file-viewer__tab-name {
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 4px 2px 4px 9px;
  font-size: 12px;
  color: var(--muted-slate);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.file-viewer__tab.is-active .file-viewer__tab-name {
  color: var(--slate-deep);
  font-weight: 600;
}
.file-viewer__tab-x {
  flex: none;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  /* Chromium's default button padding (1px 6px) is INSIDE the 18px box,
     so the 9px glyph sat 6px in, off-centre (owner 2026-09-03). */
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted-slate);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease, background-color 140ms ease;
}
.file-viewer__tab:hover .file-viewer__tab-x,
.file-viewer__tab.is-active .file-viewer__tab-x,
.file-viewer__tab-x:focus-visible { opacity: 1; }
.file-viewer__tab-x:hover { background: var(--ink-a13); color: var(--slate-deep); }
.file-viewer__actions { display: flex; gap: 2px; flex: none; }
.file-viewer__action {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted-slate);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}
.file-viewer__action:hover { background: var(--ink-a13); color: var(--slate-deep); }

.file-viewer__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.file-viewer__code {
  flex: 1;
  min-height: 0;
  overflow: auto;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}
/* House scrollbars, both axes (owner 2026-08-31: the panel showed the OS
   defaults) \u2014 the conversation's pill thumb, plus a transparent corner so
   the axes' junction doesn't paint a system-grey square. */
.file-viewer__code::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.file-viewer__code::-webkit-scrollbar-track {
  background: transparent;
}
.file-viewer__code::-webkit-scrollbar-corner {
  background: transparent;
}
.file-viewer__code::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.file-viewer__code::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
/* The scroll content: gutter + text side by side over one relative box so
   the cite-anchor band (absolute, full row width) can sit behind both.
   width:max-content + min-width:100% keeps the band covering the full
   scrollable row even when long lines scroll horizontally. */
.file-viewer__code-inner {
  position: relative;
  display: flex;
  width: max-content;
  min-width: 100%;
}
/* Cite anchor (ADR 0050 v1.5): the cited lines' highlight band. */
.file-viewer__anchor {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(37, 99, 235, 0.10);
  border-left: 2px solid var(--accent-blue);
  pointer-events: none;
}
.file-viewer__gutter {
  margin: 0;
  padding: 10px 8px 18px 14px;
  text-align: right;
  color: var(--muted-slate);
  opacity: 0.55;
  user-select: none;
  flex: none;
}
.file-viewer__text {
  margin: 0;
  padding: 10px 18px 18px 10px;
  white-space: pre;
  color: var(--slate-deep);
  flex: 1;
}
.file-viewer__notice {
  margin: 0;
  padding: 10px 16px 14px;
  font-size: 12px;
  color: var(--muted-slate);
}

/* \u2500\u2500 The rich renderers (ADR 0054) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One scroller class shared by every kind that is not the code layout;
   the house scrollbar from .file-viewer__code, repeated on it. */
.file-viewer__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.file-viewer__scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.file-viewer__scroll::-webkit-scrollbar-track { background: transparent; }
.file-viewer__scroll::-webkit-scrollbar-corner { background: transparent; }
.file-viewer__scroll::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.file-viewer__scroll::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}

/* \u2500\u2500 The commit tab (ADR 0059) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The message and its facts, then one section per file: git's letter as
   the mark, the path, the counts, the hunks in the record's own diff
   rendering. Review, not action \u2014 nothing here touches the repository. */
.commit-view {
  padding: 14px 18px 24px;
  font-size: 12.5px;
  color: var(--slate-deep);
}
.commit-view__head {
  margin: 0 0 14px;
}
.commit-view__subject {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.commit-view__meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11.5px;
  color: var(--muted-4);
}
.commit-view__sha {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  color: var(--muted-2);
}
.commit-view__message {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-left: 2px solid var(--hairline);
  font: inherit;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--muted-2);
}
.commit-view__stat {
  margin: 10px 0 0;
  display: flex;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted-4);
  font-variant-numeric: tabular-nums;
}
.commit-view__totals {
  color: var(--muted-2);
}
.commit-view__file {
  margin: 0 0 12px;
}
.commit-view__file-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 4px 0;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11.5px;
}
.commit-view__mark {
  flex: none;
  min-width: 10px;
  font-weight: 600;
  color: var(--muted-4);
}
.commit-view__file.is-added .commit-view__mark { color: #3f7d50; }
.commit-view__file.is-deleted .commit-view__mark { color: #a4544c; }
.commit-view__file.is-unmerged .commit-view__mark { color: #9a5b5b; }
.commit-view__path {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--slate-deep);
  text-align: left;
}
button.commit-view__path {
  cursor: pointer;
}
button.commit-view__path:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.commit-view__counts {
  flex: none;
  color: var(--muted-4);
  font-variant-numeric: tabular-nums;
}
.commit-view .diff-body {
  margin: 0;
}

/* \u2500\u2500 The history tab (ADR 0059 \xA76) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One row per commit, the commit tab's opener whole; the unpushed mark in
   the LED tint; a page's rows ease in one after another, and "load more"
   appends the next page the same way. */
.log-view__head {
  margin-bottom: 8px;
}
.log-view__branch {
  color: var(--slate-deep);
  font-weight: 600;
}
/* The read-only controls (ADR 0059 \xA76 amendment): the branch picker rides
   the Settings Select (menu opening LEFT-aligned here, capped and
   scrolling for a repository with many branches); the search is a quiet
   glass field that fills the rest of the row. */
.log-view__tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.log-view__pick .settings-select-trigger {
  font-size: 12px;
  padding: 4px 8px 4px 9px;
  max-width: 200px;
}
.log-view__pick .settings-select__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.log-view__pick .settings-select-menu {
  left: 0;
  right: auto;
  transform-origin: top left;
  max-height: 260px;
  overflow-y: auto;
}
.log-view__search {
  flex: 1;
  min-width: 0;
  padding: 4px 9px;
  border: 1px solid var(--hairline);
  border-radius: 8px;
  background: var(--glass-a44);
  font: inherit;
  font-size: 12px;
  color: var(--slate-deep);
  transition: border-color 120ms ease, background-color 120ms ease;
}
.log-view__search::placeholder {
  color: var(--muted-4);
}
.log-view__search:focus {
  outline: none;
  border-color: var(--accent, #2f7d92);
  background: var(--glass-a82);
}
.log-view__search::-webkit-search-cancel-button {
  cursor: pointer;
}
.log-view__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.log-view__row {
  margin: 0 -8px;
}
.log-view__row.is-entering {
  animation: log-row-in 260ms var(--ease-signature) both;
}
@keyframes log-row-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
.log-view__commit {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  font: inherit;
  text-align: left;
  color: var(--slate-deep);
  cursor: pointer;
  transition: background-color 140ms ease;
}
.log-view__commit:hover,
.log-view__commit:focus-visible {
  background: var(--ink-a13);
  outline: none;
}
.log-view__commit:active {
  background: var(--ink-a22);
  transition-duration: 60ms;
}
.log-view__sha {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11.5px;
  color: var(--muted-4);
}
.log-view__subject {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}
.log-view__unpushed {
  font-size: 11px;
  color: var(--banzhuan-led);
}
.log-view__row:not(.is-unpushed) .log-view__unpushed {
  display: none;
}
.log-view__who {
  display: inline-flex;
  gap: 5px;
  font-size: 11px;
  color: var(--muted-4);
  white-space: nowrap;
}
.log-view__more {
  display: block;
  margin: 10px auto 0;
  padding: 5px 14px;
  border: 1px solid var(--hairline);
  border-radius: 999px;
  background: var(--glass-a44);
  font: inherit;
  font-size: 12px;
  color: var(--muted-2);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, transform 180ms var(--ease-signature);
}
.log-view__more:hover:not(:disabled) {
  background: var(--ink-a13);
  color: var(--ink);
}
.log-view__more:active:not(:disabled) {
  transform: translateY(1px);
}
.log-view__more:disabled {
  opacity: .6;
  cursor: default;
}
.log-view__end {
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .log-view__row.is-entering { animation: none; }
  .log-view__more { transition: none; }
}
.file-viewer__action.is-on {
  background: var(--ink-a13);
  color: var(--slate-deep);
}

/* Code tokens (highlight.js classes) in house ink \u2014 both themes read the
   same tokens, so the palette lives here once and follows the ink. */
.file-viewer .hljs-comment,
.file-viewer .hljs-quote { color: var(--muted-3); font-style: italic; }
.file-viewer .hljs-keyword,
.file-viewer .hljs-selector-tag,
.file-viewer .hljs-doctag,
.file-viewer .hljs-meta { color: #7c3aed; }
.file-viewer .hljs-string,
.file-viewer .hljs-regexp,
.file-viewer .hljs-addition,
.file-viewer .hljs-template-tag { color: #0f766e; }
.file-viewer .hljs-number,
.file-viewer .hljs-literal,
.file-viewer .hljs-symbol,
.file-viewer .hljs-bullet { color: #b45309; }
.file-viewer .hljs-title,
.file-viewer .hljs-title.function_,
.file-viewer .hljs-title.class_,
.file-viewer .hljs-section,
.file-viewer .hljs-name { color: #1d4ed8; }
.file-viewer .hljs-attr,
.file-viewer .hljs-attribute,
.file-viewer .hljs-variable,
.file-viewer .hljs-template-variable,
.file-viewer .hljs-property { color: #0e7490; }
.file-viewer .hljs-built_in,
.file-viewer .hljs-type,
.file-viewer .hljs-selector-class,
.file-viewer .hljs-selector-id { color: #9d174d; }
.file-viewer .hljs-deletion { color: #b91c1c; }
.file-viewer .hljs-emphasis { font-style: italic; }
.file-viewer .hljs-strong { font-weight: 700; }
:host([data-theme="dark"]) .file-viewer .hljs-keyword,
:host([data-theme="dark"]) .file-viewer .hljs-selector-tag,
:host([data-theme="dark"]) .file-viewer .hljs-doctag,
:host([data-theme="dark"]) .file-viewer .hljs-meta { color: #c4b5fd; }
:host([data-theme="dark"]) .file-viewer .hljs-string,
:host([data-theme="dark"]) .file-viewer .hljs-regexp,
:host([data-theme="dark"]) .file-viewer .hljs-addition,
:host([data-theme="dark"]) .file-viewer .hljs-template-tag { color: #5eead4; }
:host([data-theme="dark"]) .file-viewer .hljs-number,
:host([data-theme="dark"]) .file-viewer .hljs-literal,
:host([data-theme="dark"]) .file-viewer .hljs-symbol,
:host([data-theme="dark"]) .file-viewer .hljs-bullet { color: #fcd34d; }
:host([data-theme="dark"]) .file-viewer .hljs-title,
:host([data-theme="dark"]) .file-viewer .hljs-title.function_,
:host([data-theme="dark"]) .file-viewer .hljs-title.class_,
:host([data-theme="dark"]) .file-viewer .hljs-section,
:host([data-theme="dark"]) .file-viewer .hljs-name { color: #93c5fd; }
:host([data-theme="dark"]) .file-viewer .hljs-attr,
:host([data-theme="dark"]) .file-viewer .hljs-attribute,
:host([data-theme="dark"]) .file-viewer .hljs-variable,
:host([data-theme="dark"]) .file-viewer .hljs-template-variable,
:host([data-theme="dark"]) .file-viewer .hljs-property { color: #67e8f9; }
:host([data-theme="dark"]) .file-viewer .hljs-built_in,
:host([data-theme="dark"]) .file-viewer .hljs-type,
:host([data-theme="dark"]) .file-viewer .hljs-selector-class,
:host([data-theme="dark"]) .file-viewer .hljs-selector-id { color: #f9a8d4; }
:host([data-theme="dark"]) .file-viewer .hljs-deletion { color: #fca5a5; }

/* Markdown as the page: the record's reading measure, house type. */
.file-viewer__doc {
  padding: 18px 22px 28px;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--ink-3);
  overflow-wrap: anywhere;
}
.file-viewer__doc > :first-child { margin-top: 0; }
.file-viewer__doc h1,
.file-viewer__doc h2,
.file-viewer__doc h3,
.file-viewer__doc h4,
.file-viewer__doc h5,
.file-viewer__doc h6 {
  margin: 1.5em 0 0.5em;
  line-height: 1.3;
  color: var(--ink-2);
  font-weight: 650;
}
.file-viewer__doc h1 { font-size: 1.55em; padding-bottom: 0.3em; border-bottom: 1px solid var(--hairline); }
.file-viewer__doc h2 { font-size: 1.3em; padding-bottom: 0.25em; border-bottom: 1px solid var(--hairline); }
.file-viewer__doc h3 { font-size: 1.12em; }
.file-viewer__doc h4 { font-size: 1em; }
.file-viewer__doc h5,
.file-viewer__doc h6 { font-size: 0.92em; color: var(--muted-slate); }
.file-viewer__doc p,
.file-viewer__doc ul,
.file-viewer__doc ol,
.file-viewer__doc blockquote,
.file-viewer__doc pre,
.file-viewer__doc table { margin: 0 0 0.9em; }
.file-viewer__doc ul,
.file-viewer__doc ol { padding-left: 1.6em; }
.file-viewer__doc li + li { margin-top: 0.2em; }
.file-viewer__doc li > p { margin-bottom: 0.35em; }
.file-viewer__doc input[type="checkbox"] { margin: 0 0.4em 0 -1.3em; vertical-align: -1px; }
.file-viewer__doc a { color: var(--accent-blue); text-decoration: underline; text-decoration-color: var(--ink-a22); text-underline-offset: 2px; cursor: default; }
.file-viewer__doc code {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.9em;
  background: var(--ink-a06);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}
.file-viewer__doc pre {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ink-a05);
  box-shadow: inset 0 0 0 1px var(--hairline);
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
}
.file-viewer__doc pre code { background: transparent; padding: 0; font-size: inherit; }
.file-viewer__doc blockquote {
  padding: 0.1em 0 0.1em 0.9em;
  border-left: 3px solid var(--ink-a13);
  color: var(--muted-slate);
}
.file-viewer__doc hr { border: 0; border-top: 1px solid var(--hairline); margin: 1.4em 0; }
.file-viewer__doc img { max-width: 100%; height: auto; border-radius: 8px; }
.file-viewer__doc table { border-collapse: collapse; font-size: 0.93em; display: block; max-width: 100%; overflow: auto; }
.file-viewer__doc th,
.file-viewer__doc td { padding: 5px 10px; border: 1px solid var(--hairline-strong); text-align: left; vertical-align: top; }
.file-viewer__doc th { background: var(--ink-a05); font-weight: 600; color: var(--ink-2); }
.file-viewer__doc tr:nth-child(even) td { background: var(--ink-a03); }
.file-viewer__diagram {
  margin: 0 0 1em;
  padding: 12px;
  border-radius: 10px;
  background: var(--glass-a55);
  box-shadow: inset 0 0 0 1px var(--hairline);
  overflow: auto;
  text-align: center;
}
.file-viewer__diagram svg { max-width: 100%; height: auto; }
.file-viewer__diagram-failed {
  margin: 0 0 0.4em;
  font-size: 12px;
  color: var(--muted-slate);
}

/* Pictures: fit by default, 1:1 on click, centred on the glass. */
.file-viewer__image-wrap {
  display: grid;
  place-items: center;
  padding: 16px;
}
.file-viewer__image-btn {
  border: 0;
  padding: 0;
  background: transparent;
  cursor: zoom-in;
  max-width: 100%;
  line-height: 0;
}
.file-viewer__image-wrap.is-actual { place-items: start; }
.file-viewer__image-wrap.is-actual .file-viewer__image-btn { cursor: zoom-out; max-width: none; }
.file-viewer__image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  background:
    linear-gradient(45deg, var(--ink-a05) 25%, transparent 25%, transparent 75%, var(--ink-a05) 75%),
    linear-gradient(45deg, var(--ink-a05) 25%, transparent 25%, transparent 75%, var(--ink-a05) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
.file-viewer__image-wrap.is-actual .file-viewer__image { max-width: none; }
.file-viewer__image-meta,
.file-viewer__pdf-meta { padding-top: 6px; padding-bottom: 10px; font-variant-numeric: tabular-nums; }

/* PDF pages: paper on the glass, one column, fit to width. */
.file-viewer__pdf { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.file-viewer__pdf-page {
  /* A flex item in a column of definite height SHRINKS to fit by default,
     and overflow:hidden lets it shrink to nothing: a 52-page PDF rendered
     as 52 hairlines (owner 2026-09-03). Pages keep their size. */
  flex: none;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.file-viewer__pdf-page canvas { display: block; }

/* Word: docx-preview's page wrapper, restyled to the glass. The renderer
   sets widths/fonts inline; only the frame is ours. */
.file-viewer__docx { padding: 12px 16px 24px; }
.file-viewer__docx .docx-wrapper { background: transparent; padding: 0; display: block; }
.file-viewer__docx .docx-wrapper > section.docx {
  width: auto !important;
  min-height: 0 !important;
  margin: 0 0 14px;
  padding: 28px 30px !important;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.06);
  border-radius: 4px;
  background: #fff;
  color: #111417;
  box-sizing: border-box;
  overflow-wrap: anywhere;
}
.file-viewer__docx .docx-wrapper > section.docx img { max-width: 100%; height: auto; }
.file-viewer__docx .docx-wrapper > section.docx table { max-width: 100%; }
.file-viewer__docx a { pointer-events: none; }

/* The grid (spreadsheets, CSV): sticky letters and numbers, virtualized
   rows on a fixed height (GridView.ROW_H). */
.file-viewer__grid {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--slate-deep);
}
.file-viewer__grid-canvas { position: relative; }
.file-viewer__gridhead {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 24px;
  background: var(--glass-a78);
  border-bottom: 1px solid var(--hairline-strong);
}
.file-viewer__corner {
  position: sticky;
  left: 0;
  z-index: 3;
  display: inline-block;
  height: 24px;
  background: var(--glass-a78);
  border-right: 1px solid var(--hairline-strong);
}
.file-viewer__colhead {
  position: absolute;
  top: 0;
  height: 24px;
  line-height: 24px;
  text-align: center;
  color: var(--muted-slate);
  border-right: 1px solid var(--hairline);
  box-sizing: border-box;
  overflow: hidden;
  font-weight: 600;
}
.file-viewer__row {
  position: absolute;
  left: 0;
  height: 24px;
  border-bottom: 1px solid var(--hairline);
  box-sizing: border-box;
}
.file-viewer__rowhead {
  position: sticky;
  left: 0;
  z-index: 1;
  display: inline-block;
  height: 24px;
  line-height: 23px;
  text-align: center;
  color: var(--muted-slate);
  background: var(--glass-a78);
  border-right: 1px solid var(--hairline-strong);
  box-sizing: border-box;
  font-weight: 600;
}
.file-viewer__cell {
  position: absolute;
  top: 0;
  height: 24px;
  line-height: 23px;
  padding: 0 6px;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid var(--hairline);
}
.file-viewer__cell.is-n,
.file-viewer__cell.is-d { text-align: right; }
.file-viewer__cell.is-b { text-align: center; color: var(--muted-slate); }
.file-viewer__cell.is-e { color: #b91c1c; }
.file-viewer__sheet-tabs {
  flex: none;
  display: flex;
  gap: 4px;
  padding: 6px 12px;
  border-top: 1px solid var(--hairline);
  overflow-x: auto;
}
.file-viewer__sheet-tab {
  border: 0;
  border-radius: 7px;
  padding: 3px 10px;
  font-size: 12px;
  background: transparent;
  color: var(--muted-slate);
  cursor: pointer;
  white-space: nowrap;
}
.file-viewer__sheet-tab:hover { background: var(--ink-a13); }
.file-viewer__sheet-tab.is-active {
  background: var(--glass-a78);
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--slate-deep);
  font-weight: 600;
}

/* Decks: thumbnail strip, the current slide fit to width, a page bar. */
.file-viewer__slides { outline: none; }
.file-viewer__slides-row {
  flex: 1;
  min-height: 0;
  display: flex;
}
.file-viewer__thumbs {
  flex: none;
  width: 164px;
  overflow-y: auto;
  padding: 12px 10px;
  border-right: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.file-viewer__thumbs::-webkit-scrollbar { width: 8px; }
.file-viewer__thumbs::-webkit-scrollbar-track { background: transparent; }
.file-viewer__thumbs::-webkit-scrollbar-thumb { background: var(--ink-a13); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
.file-viewer__thumb {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.file-viewer__thumb-n {
  flex: none;
  width: 14px;
  font-size: 11px;
  line-height: 14px;
  color: var(--muted-slate);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.file-viewer__thumb-box {
  display: block;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 0 0 1px var(--hairline-strong);
  transition: box-shadow 140ms ease;
}
.file-viewer__thumb:hover .file-viewer__thumb-box { box-shadow: 0 0 0 1px var(--ink-a35); }
.file-viewer__thumb.is-active .file-viewer__thumb-box { box-shadow: 0 0 0 2px var(--accent-blue); }
.file-viewer__slide-main {
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.file-viewer__slide {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.06);
  background: #fff;
  flex: none;
}
.file-viewer__slide-inner {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  font-family: Calibri, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Inter, sans-serif;
  color: #111417;
}
.file-viewer__shape {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
}
.file-viewer__shape.is-picture img { max-width: none; }
.file-viewer__shape.is-line { pointer-events: none; }
.file-viewer__shape.is-placeholder {
  display: grid;
  place-items: center;
  border: 1.5px dashed rgba(17, 20, 23, 0.25);
  border-radius: 6px;
  color: rgba(17, 20, 23, 0.45);
  font-size: 18px;
}
.file-viewer__textbody {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  box-sizing: border-box;
  overflow: hidden;
}
.file-viewer__textbody.is-middle { justify-content: center; }
.file-viewer__textbody.is-bottom { justify-content: flex-end; }
.file-viewer__textbody.is-vertical { writing-mode: vertical-rl; }
.file-viewer__pp { min-width: 0; }
.file-viewer__bullet { flex: none; display: inline-block; }
.file-viewer__runs { flex: 1 1 auto; min-width: 0; }
.file-viewer__slide-table {
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 18px;
}
.file-viewer__slide-table td {
  border: 1px solid rgba(17, 20, 23, 0.25);
  padding: 4px 8px;
  vertical-align: top;
  overflow: hidden;
}
.file-viewer__slides-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-top: 1px solid var(--hairline);
}
.file-viewer__slides-bar .file-viewer__action:disabled { opacity: 0.35; cursor: default; }
.file-viewer__slides-count {
  font-size: 12px;
  color: var(--muted-slate);
  font-variant-numeric: tabular-nums;
  min-width: 54px;
  text-align: center;
}
.file-viewer__slides-bar .file-viewer__notice { padding: 0 0 0 8px; }

/* \u2500\u2500 The clickable file NAME in a record row (ADR 0050 \xA71) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The name, not the row, and not a blue link: ink text with a faint dotted
   underline; hover firms the underline and raises a soft glass pill. */
.file-open-name {
  cursor: pointer;
  border-radius: 5px;
  padding: 0 2px;
  margin: 0 -2px;
  text-decoration: underline dotted;
  text-decoration-color: var(--ink-a22);
  text-underline-offset: 3px;
  transition: background-color 140ms ease, text-decoration-color 140ms ease;
}
.file-open-name:hover,
.file-open-name:focus-visible {
  background: var(--ink-a13);
  text-decoration-color: var(--muted-slate);
  outline: none;
}

/* \u2500\u2500 Launch-disconnected: static (no connect transition) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The app opens directly ON the connect screen, which is the INITIAL state \u2014
   not a connected\u2192disconnected transition. Snap the rail/composer collapse and
   skip the connect button's entrance so nothing slides or morphs at launch (the
   button morph is gated separately in useConnectMorph). Applied by App while
   disconnected and never yet connected; mirrors the reduced-motion suppressions
   (user 2026-06-20). */
.app.is-launch-static .workspace-body,
.app.is-launch-static .utility-rail,
.app.is-launch-static .workspace-footer {
  transition: none;
}
.app.is-launch-static .connect-station-wrap {
  animation: none;
}

/* \u2500\u2500 Connect-station button (disconnected centre target; spec 2026-06-16) \u2500\u2500 */
.connect-station-wrap {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  animation: connectIn 260ms var(--ease-signature) both;
}
/* Post-morph hand-off: the flying clone already played the entrance, so the
   static button appears in place with no \`connectIn\` (suppresses the settle
   dip). The exit \`is-leaving\` still wins (it comes after / overrides). */
.connect-station-wrap.is-instant {
  animation: none;
}
.connect-station-wrap.is-leaving {
  animation: connectOut 200ms ease both;
  pointer-events: none;
}
@keyframes connectIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
@keyframes connectOut {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateY(-8px); }
}
.connect-station {
  pointer-events: auto;
  width: 240px;
  height: 56px;
  border: 0;
  /* EXPLICIT centering, mirrored 1:1 by .connect-morph-clone-label: the UA
     button defaults (padding 1px 6px + inline centering) put the label a
     sub-pixel off the clone's grid centering, so the text hopped ~1px at
     the morph hand-off (user 2026-07-06). Same grid, same line-height on
     both sides \u2192 the glyphs land on identical coordinates. */
  padding: 0;
  display: grid;
  place-items: center;
  line-height: 20px;
  border-radius: 28px;
  background: var(--ink);
  color: var(--ink-inverse);
  /* Buttons do NOT inherit font-family: the UA's Arial gives the label's
     CJK run different ascent/descent than the clone's Inter context \u2014 a
     1px vertical baseline hop at hand-off even with identical centering. */
  font-family: inherit;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 10px 30px var(--shadow-pop);
  transition:
    transform 150ms ease,
    box-shadow 150ms ease;
}
.connect-station:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(32, 45, 58, 0.22);
}
/* Press-down (post-test 2026-06-17): a quick downward push on click. After
   \`:hover\` in source order so it overrides the lift while held. */
.connect-station:active {
  transform: translateY(1px);
  box-shadow: 0 4px 14px rgba(32, 45, 58, 0.18);
  transition:
    transform 80ms ease,
    box-shadow 80ms ease;
}
/* Text shimmer (user 2026-06-17): the settled button is the ONLY place the
   bright sweep lives. Its dim stops (0.55) match the rising clone label's flat
   0.55 fill (see \`.connect-morph-clone-label\`), so the text holds a constant
   dimmed weight from rise to settle; the moving highlight simply APPEARS here
   once the button lands. */
.connect-station-label {
  font-weight: 500;
  letter-spacing: 0.5px;
  /* A SINGLE highlight (no-repeat) over a 0.55 dim base. background-size is 300%
     so the image always fully covers the text for background-position 0%\u2192100%
     (no transparent gaps), while leaving room for one bright band to travel from
     off-left to off-right. Because the band is non-repeating, the sweep always
     begins cleanly at the first character on each fresh mount \u2014 no tiled/phase
     "resumed from a recorded position" artifact (user 2026-06-17). */
  background: linear-gradient(
    100deg,
    var(--glass-a55) 0%,
    var(--glass-a55) 42%,
    #ffffff 50%,
    var(--glass-a55) 58%,
    var(--glass-a55) 100%
  );
  background-size: 300% 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: connectShimmer 2.8s ease-in-out infinite;
}
/* A create that failed (audit BL20). Under the button, in the wrap's flow \u2014
   the button keeps its size and position, so the notice reads as an answer to
   the click rather than a layout jump. */
.connect-station-error {
  margin: 14px 0 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--danger, #b23b3b);
}
@keyframes connectShimmer {
  /* 100% \u2192 bright off the LEFT (text uniformly dim; matches the rising clone);
     0% \u2192 bright off the RIGHT. So the highlight enters at the 1st character and
     sweeps to the last, then holds off-right as a gap before repeating. */
  0% { background-position: 100% 0; }
  55% { background-position: 0% 0; }
  100% { background-position: 0% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .connect-station-label,
  .connect-morph-clone-label { animation: none; -webkit-text-fill-color: var(--ink-inverse); }
  .connect-station:hover,
  .connect-station:active { transform: none; }
  .connect-station-wrap,
  .connect-station-wrap.is-instant,
  .connect-station-wrap.is-leaving { animation: none; }
  .workspace-footer { transition: none; }
}

/* \u2500\u2500 Settings modal (SPEC 2026-06-23 settings-modal) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--backdrop);
  backdrop-filter: blur(15px) saturate(140%);
  -webkit-backdrop-filter: blur(15px) saturate(140%);
  animation: settings-backdrop-in 160ms ease both;
}
.settings-backdrop.is-out {
  animation: none;
  opacity: 0;
  transition: opacity 180ms ease;
}
.settings-card {
  display: flex;
  /* 660 \u2192 700 (owner 2026-08-03): EN prose runs longer than zh, and at 660
     the Coprocessor pane wrapped one line further in EN than zh \u2014 the pane
     height (and so the card) depended on the locale. */
  width: 700px;
  max-width: calc(100vw - 56px);
  max-height: calc(100vh - 96px);
  overflow: hidden;
  background: var(--panel-solid);
  border: 1px solid var(--hairline);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(18, 28, 42, .30);
  animation: settings-card-in 200ms var(--ease-signature) both;
}
.settings-backdrop.is-out .settings-card {
  animation: none;
  opacity: 0;
  transform: translateY(8px) scale(.985);
  transition: opacity 180ms ease, transform 180ms ease;
}
.settings-card:focus { outline: none; }
.settings-nav {
  width: 152px;
  flex: none;
  padding: 14px 10px;
  border-right: 1px solid var(--hairline);
  background: var(--nav-bg);
}
.settings-nav-eyebrow {
  margin: 4px 8px 9px;
  font-size: 10.5px;
  letter-spacing: .05em;
  text-transform: uppercase;
  color: var(--muted);
}
/* Grouped nav (user feedback 2026-07-06 \u2014 the flat list read as random):
   small dim group labels split the sections into \u901A\u7528 / \u9ED1\u5854 / \u5F15\u64CE. */
.settings-nav-group-label {
  margin: 14px 8px 5px;
  font-size: 10.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
  opacity: 0.85;
}
.settings-nav-group-label:first-of-type {
  margin-top: 6px;
}
.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  margin: 2px 0;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-size: 13.5px;
  color: var(--muted-strong);
  text-align: left;
  cursor: pointer;
}
.settings-nav-item:hover { background: var(--ink-a05); }
.settings-nav-item.is-active { background: rgba(77, 134, 255, .12); color: var(--accent-deep); }
.settings-nav-item:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 1px;
}
.settings-content {
  flex: 1;
  min-width: 0;
  /* Stable floor so switching sections doesn't resize the card \u2014 covers the
     tallest pane (\u5DEE\u5206\u534F\u5904\u7406\u5668: intro + thinking row + demo card + caption +
     legend) in BOTH UI locales: EN prose wraps further than zh, so the floor
     must be measured across locales, not just zh. MEASURED in the live app
     (settings-height lab, 2026-08-03, card width 700): EN Coprocessor 506px,
     zh 486px, every other pane \u2264 486. Re-measure before changing \u2014 a floor
     below the tallest pane brings back the resize-on-switch jump the owner
     flagged twice (zh 08-03 morning, EN 08-03 evening). The ADR 0030 rules
     well briefly lived in this pane (floor 641) before moving to the device
     card's \u22EF menu (owner 2026-08-04) \u2014 don't re-add pane content without
     re-running the lab.
     RE-MEASURED 2026-08-17 (ADR 0040 added the \u5DE5\u5177\u5951\u7EA6 row above the demo
     card, live app, CDP, card width 700): zh Coprocessor 591px, EN 630px,
     every other pane \u2264 506. Floor raised to the new EN tallest. */
  min-height: 630px;
  padding: 20px 22px;
  position: relative;
  overflow-y: auto;
}
/* Slim pill scrollbar (2026-07-23 sweep after the composer finding) \u2014 short
   windows scroll the settings pane and showed the chunky OS bar on the
   glass card. Same treatment as .conversation. */
.settings-content::-webkit-scrollbar {
  width: 10px;
}
.settings-content::-webkit-scrollbar-track {
  background: transparent;
}
.settings-content::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
/* A pane whose option rows scroll (owner 2026-09-06: the Coprocessor pane
   had grown past the floor with its third row, so the card resized on
   every switch into it). The pane becomes a column; every child keeps its
   size except .settings-rows, which gives way and scrolls \u2014 with the same
   slim pill bar as the pane, never the OS bar. Flex items do not collapse
   margins, so the intro\u2192rows gap is carried by the intro alone. On a
   short window the floor shrinks with the card and the rows give way
   first, down to about one row; past that the pane itself scrolls. */
.settings-content:has(> .settings-rows) {
  display: flex;
  flex-direction: column;
  /* Floor AND ceiling: the pane is exactly the floor (its stretched height
     was otherwise its own content's, and the rows never had to give way). */
  min-height: min(630px, calc(100vh - 98px));
  max-height: min(630px, calc(100vh - 98px));
}
.settings-content:has(> .settings-rows) > * { flex: none; }
.settings-content > .settings-rows {
  flex: 0 1 auto;
  min-height: 84px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.settings-rows > .settings-row:first-child { margin-top: 0; }
.settings-rows::-webkit-scrollbar { width: 10px; }
.settings-rows::-webkit-scrollbar-track { background: transparent; }
.settings-rows::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.settings-rows::-webkit-scrollbar-thumb:hover {
  background: var(--ink-a22);
  background-clip: padding-box;
}
.settings-close {
  position: absolute;
  right: 13px;
  top: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.settings-close:hover { background: var(--ink-a05); color: var(--ink); }
.settings-close:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 1px;
}
.settings-section-title {
  margin: 2px 0 16px;
  font-size: 16px;
  font-weight: 500;
  color: var(--ink);
}
.settings-intro {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted);
}
.settings-intro strong { font-weight: 500; color: var(--ink); }
/* Card-group rows (2026-07-12): naked flex rows read as one merged blob \u2014
   the settings idiom elsewhere (Codex et al.) is rows on a shared rounded
   card with hairline separators. CSS-only: every row is a card; ADJACENT
   rows fuse \u2014 the leading row flattens its bottom corners (:has), the
   following row flattens its top, drops its own top border, and draws an
   inset hairline instead. A note/intro between rows breaks the group. */
.settings-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 15px;
  border: 1px solid var(--ink-a09);
  border-radius: 12px;
  background: var(--glass-a50);
  margin-top: 10px;
}
.settings-row:has(+ .settings-row) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.settings-row + .settings-row {
  margin-top: 0;
  border-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: inset 0 1px 0 var(--ink-a06);
}
.settings-row-text { min-width: 0; }
.settings-row-title { margin: 0 0 3px; font-size: 14px; color: var(--ink); }
.settings-row-desc { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
.settings-row-control { flex: none; }
/* Voice volume slider (2026-07-11): native range input tinted via
   accent-color, with the current percentage beside it. Dimmed (and disabled
   via the input's own attribute) while the master mute is on \u2014 volume has
   nothing to scale then. */
.settings-slider-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: opacity var(--dur-micro) ease;
}
.settings-slider-wrap.is-disabled {
  opacity: 0.45;
}
/* Custom range slider (2026-07-23) \u2014 the last native OS control in Settings;
   \`accent-color\` alone kept the default chunky track/thumb shape. Styled to
   pair with .settings-toggle: same track/LED colors, same surface-pop knob.
   The LED fill width comes from the \`--slider-fill\` var VoiceSettings sets
   inline (CSS can't read a range input's value). Webkit-only pseudos are
   fine \u2014 this renderer only ever runs in Electron's Chromium. */
.settings-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 16px; /* hit target; the visible track is the 4px pseudo below */
  background: transparent;
  cursor: pointer;
}
.settings-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--banzhuan-led) var(--slider-fill, 50%),
    var(--track) var(--slider-fill, 50%)
  );
}
.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px; /* (4px track \u2212 16px thumb) / 2 \u2014 centers on the track */
  border-radius: 50%;
  border: none;
  background: var(--surface-pop);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.settings-slider:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 2px;
}
.settings-slider:disabled {
  cursor: default;
}
.settings-slider-value {
  min-width: 38px;
  font-size: 12.5px;
  color: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.settings-note {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}
.settings-note.is-error { color: #b23b3b; }
/* Attribution (audit S12). Set off from the update status above it by a rule
   and a wider gap \u2014 it is a standing statement about what this project is,
   not another line of transient update chatter. */
.settings-fan-notice {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid var(--hairline, rgba(148, 163, 184, 0.22));
  line-height: 1.55;
}
/* Model-choice sub-section on the DeepSeek panel (2026-08-17): a second
   topic under the same engine, so it gets the same rule-and-gap set-off as
   the attribution above rather than running on from the key controls. */
.settings-models-intro {
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px solid var(--hairline, rgba(148, 163, 184, 0.22));
}
/* \u2500\u2500 \u5DEE\u5206\u534F\u5904\u7406\u5668 (\u677F\u7816) lifecycle section \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.settings-intro code {
  font-family: var(--mono, ui-monospace, "SF Mono", Menlo, monospace);
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(77, 134, 255, 0.1);
  color: var(--accent-deep);
}
.settings-bz-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 2px 0 10px;
}
/* Strip the rail card's panel chrome \u2014 show only the (scaled) device visual. */
.device-card.settings-bz-card {
  height: auto;
  background: none;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  border-radius: 0;
  overflow: visible;
}
.settings-bz-card::before { display: none; }
.settings-bz-card .agent-preview {
  width: 132px;
  height: 165px;
  cursor: default;
}
.settings-bz-card .agent-preview::after {
  cursor: default;
}
.settings-bz-caption {
  text-align: center;
  min-height: 40px;
}
.settings-bz-caption-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
}
.settings-bz-caption-meaning {
  display: block;
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--muted);
}
.settings-bz-legend {
  display: grid;
  /* 3 columns \u2192 the five states fit in two rows (3 + 2). */
  grid-template-columns: repeat(3, 1fr);
  gap: 7px 14px;
  /* 14 \u2192 11 with the demo's bottom margin 14 \u2192 10 and the caption 42 \u2192 40
     (2026-09-06): the three-row pane fits the 630 floor in zh exactly, so
     its rows scroll only where the prose runs longer (EN). */
  padding-top: 11px;
  border-top: 1px solid var(--hairline);
}
.settings-bz-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--muted-strong);
}
.settings-bz-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
/* \u2500\u2500 DeepSeek key section \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.settings-key-host { color: var(--ink); }
.settings-key-status { margin: 0 0 12px; }
.settings-key-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}
.settings-key-state.is-muted { color: var(--muted); }
.settings-key-state.is-connected { color: #1f7a3d; }
.settings-key-state.is-rejected { color: #b23b3b; }
.settings-key-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #1f9d4d;
}
.settings-key-form {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
/* A key as one card row (the voice pane's two MiniMax keys, owner
   2026-09-08 \u2014 "a card with a form hanging under it is ugly"): the field
   sits inside the row under the description, compact; the masked status
   and the delete link stack in the control column; a note a save leaves
   stays inside the row, so the card group never breaks around it. */
/* The text column takes the row's width in a key row (its content would
   otherwise size it, and a short description left the second key's field
   a hundred pixels narrower than the first's \u2014 measured 387 vs 286). */
.settings-row--key .settings-row-text { flex: 1 1 auto; }
.settings-key-inline {
  display: flex;
  gap: 8px;
  align-items: stretch;
  margin-top: 8px;
  max-width: 420px;
}
.settings-key-input.is-compact {
  height: 30px;
  font-size: 12.5px;
  border-radius: 8px;
}
.settings-key-save.is-compact {
  height: 30px;
  padding: 0 13px;
  font-size: 12.5px;
  border-radius: 8px;
}
.settings-key-control {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.settings-key-delete.is-inline { margin: 0; font-size: 12px; }
.settings-note.is-inline { margin-top: 8px; }
/* The "?" help circle after a row title (owner 2026-09-08: the two MiniMax
   keys' roles wanted a word in place). Hover and keyboard focus open the
   tip through CSS; a click pins it (\`.is-open\`). The tip floats ABOVE the
   circle inside the scrolling rows box \u2014 the rows above the first key row
   give it room, and the box's overflow clip is why it does not float
   below, where the next rows would hide it. */
.settings-help {
  position: relative;
  display: inline-flex;
  margin-left: 6px;
  vertical-align: 1px;
}
.settings-help-btn {
  width: 15px;
  height: 15px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  color: var(--muted);
  background: var(--ink-a03);
  border: 1px solid var(--ink-a22);
  border-radius: 50%;
  cursor: help;
  transition: color .15s, border-color .15s;
}
.settings-help-btn:hover,
.settings-help-btn:focus-visible,
.settings-help.is-open .settings-help-btn {
  color: var(--ink);
  border-color: var(--ink-a40);
}
.settings-help-btn:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 2px;
}
.settings-help-tip {
  display: none;
  position: absolute;
  left: -10px;
  bottom: calc(100% + 9px);
  width: 330px;
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--ink);
  background: var(--surface-pop);
  border: 1px solid var(--ink-a14);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(17, 20, 23, 0.18);
  z-index: 5;
  white-space: normal;
}
.settings-help:hover .settings-help-tip,
.settings-help:focus-within .settings-help-tip,
.settings-help.is-open .settings-help-tip {
  display: block;
}
/* The app's hover tip (owner 2026-09-09: the commit rows raised the OS
   tooltip). One fixed box, rendered by HoverTipLayer at the app root and
   positioned from the anchor's rectangle, so no scrolling card clips it.
   The settings "?" tip's face, floating. */
.hover-tip {
  position: fixed;
  z-index: 60;
  padding: 7px 10px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink);
  background: var(--surface-pop);
  border: 1px solid var(--ink-a14);
  border-radius: 9px;
  box-shadow: 0 10px 30px rgba(17, 20, 23, 0.16);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  pointer-events: none;
  animation: hover-tip-in 120ms ease-out both;
}
@keyframes hover-tip-in {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: none; }
}
.hover-tip.is-below { animation-name: hover-tip-in-below; }
@keyframes hover-tip-in-below {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .hover-tip { animation: none; }
}
.settings-key-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 34px;
  padding: 0 11px;
  font-size: 13px;
  font-family: inherit;
  color: var(--ink);
  background: var(--ink-a03);
  border: 1px solid var(--ink-a14);
  border-radius: 9px;
  outline: none;
  transition: border-color .15s, background .15s;
}
.settings-key-input:focus {
  border-color: var(--banzhuan-led);
  background: var(--surface-pop);
}
.settings-key-input:disabled { opacity: .55; cursor: not-allowed; }
.settings-key-save {
  flex: none;
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-inverse);
  background: var(--banzhuan-led);
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: opacity .15s, filter .15s;
}
.settings-key-save:hover:not(:disabled) { filter: brightness(1.05); }
.settings-key-save:disabled { opacity: .5; cursor: not-allowed; }
.settings-key-save:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 2px;
}
/* Generic settings action button (2026-07-10, first used by the Update
   pane): the key-save look, reusable. \`--primary\` is the filled call-to-
   action (restart-and-install); the base is a quiet outline button. */
.settings-btn {
  flex: none;
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink, var(--ink));
  background: var(--glass-a60);
  border: 1px solid var(--ink-a14);
  border-radius: 9px;
  cursor: pointer;
  transition: opacity 0.15s, filter 0.15s;
}
.settings-btn:hover:not(:disabled) { filter: brightness(0.98); }
.settings-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.settings-btn:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 2px;
}
.settings-btn--primary {
  color: var(--ink-inverse);
  background: var(--banzhuan-led);
  border: none;
}
.settings-btn--primary:hover:not(:disabled) { filter: brightness(1.05); }
.settings-key-delete {
  margin: 12px 0 0;
  padding: 0;
  font-size: 12.5px;
  font-family: inherit;
  color: #b23b3b;
  background: none;
  border: none;
  cursor: pointer;
}
.settings-key-delete:hover:not(:disabled) { text-decoration: underline; }
.settings-key-delete:disabled { opacity: .5; cursor: not-allowed; }
/* \u2500\u2500 No-key onboarding card (KeyPrompt) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.keyprompt-card {
  width: 380px;
  max-width: calc(100vw - 48px);
  padding: 24px 24px 20px;
  background: var(--panel, #fff);
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(17, 20, 23, .28);
  animation: settings-card-in 200ms var(--ease-signature) both;
}
.keyprompt-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--ink);
}
.keyprompt-body {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted);
}
/* Where to get a key (audit BL19). Sits between the body and the input,
   quieter than the body \u2014 it is a pointer, not part of the ask. */
.keyprompt-where {
  margin: -8px 0 16px;
  font-size: 12.5px;
  color: var(--muted);
  opacity: 0.85;
}
.keyprompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.keyprompt-cancel {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  font-family: inherit;
  color: var(--muted);
  background: none;
  border: 1px solid var(--ink-a14);
  border-radius: 9px;
  cursor: pointer;
}
.keyprompt-cancel:hover { background: var(--ink-a04); }
@media (prefers-reduced-motion: reduce) {
  .keyprompt-card { animation: none; }
}
.settings-toggle {
  position: relative;
  flex: none;
  width: 42px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--track);
  cursor: pointer;
  transition: background .18s;
}
.settings-toggle[aria-checked="true"] { background: var(--banzhuan-led); }
/* The setting cannot apply on this install (ADR 0042: real-time voice with
   no model bundle). Same dimming as .settings-slider-wrap.is-disabled, so
   the two inert controls read alike. */
.settings-toggle.is-disabled {
  opacity: 0.45;
  cursor: default;
}
/* The voice model's download progress (ADR 0061): a hairline under the
   model row, LED-filled like the volume slider's track. It exists only
   while a download runs \u2014 the settings pane's motion rule (2026-07-27):
   motion means the live thing. */
.settings-progress {
  height: 3px;
  margin: -6px 0 10px;
  border-radius: 2px;
  background: var(--panel-line);
  overflow: hidden;
}
.settings-progress__fill {
  display: block;
  height: 100%;
  background: var(--banzhuan-led);
  transition: width 0.25s ease-out;
}
/* An action inside a note's sentence (ADR 0062: the clone's retry) \u2014 the
   note's own type, underlined, no chrome. */
.settings-note-action {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--banzhuan-led);
  text-decoration: underline;
  cursor: pointer;
}
.settings-note-action:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 2px;
}
.settings-toggle:focus-visible {
  outline: 2px solid var(--banzhuan-led);
  outline-offset: 2px;
}
.settings-toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface-pop);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .25);
  /* transform, not \`left\` (2026-07-11): same 18px travel (21px \u2212 3px base),
     but compositor-only \u2014 animating \`left\` relayouts per frame. */
  transition: transform .18s;
}
.settings-toggle[aria-checked="true"] .settings-toggle-knob {
  transform: translateX(18px);
}
@keyframes settings-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes settings-card-in {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to { opacity: 1; transform: none; }
}
/* \u2500\u2500 Language section \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Custom Select (2026-07-12): the native <select> popup was OS chrome \u2014
   Chromium draws it outside the page, so it ignored the app's design
   language entirely. The trigger keeps the old select's look; the MENU is
   the app's own presence-animated popover (frosted card, hover rows, a
   check on the selected option), so open/close and hover all speak the
   same visual dialect as the rest of the chrome. */
.settings-select-wrap {
  position: relative;
  display: inline-flex;
}
.settings-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px 5px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  border-radius: 8px;
  border: 1px solid var(--hairline, rgba(0, 0, 0, 0.12));
  background: var(--glass-a55);
  color: inherit;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
}
.settings-select-trigger:hover,
.settings-select-trigger.is-open {
  border-color: var(--accent, #2f7d92);
  background: var(--glass-a82);
}
.settings-select-trigger:focus-visible {
  outline: none;
  border-color: var(--accent, #2f7d92);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #2f7d92) 18%, transparent);
}
.settings-select__chevron {
  width: 11px;
  height: 11px;
  color: var(--muted-4);
  transition: transform 160ms var(--ease-out-soft);
}
.settings-select-trigger.is-open .settings-select__chevron {
  transform: rotate(180deg);
}
.settings-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 100%;
  padding: 4px;
  border: 1px solid var(--ink-a10);
  border-radius: 10px;
  background: var(--card-solid);
  box-shadow: 0 10px 28px var(--shadow-pop);
  backdrop-filter: blur(12px) saturate(130%);
  z-index: 30;
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
  transform-origin: top right;
  transition:
    opacity 150ms var(--ease-pop),
    transform 150ms var(--ease-pop);
}
.settings-select-menu.is-open {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.settings-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 6px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.settings-select__option:hover,
.settings-select__option:focus-visible {
  background: var(--wash-2);
  outline: none;
}
.settings-select__option.is-selected {
  font-weight: 600;
}
.settings-select__check {
  flex: none;
  width: 13px;
  height: 13px;
  color: var(--accent, #2f7d92);
}
@media (prefers-reduced-motion: reduce) {
  .settings-backdrop,
  .settings-card { animation: none; }
  .settings-backdrop.is-out,
  .settings-backdrop.is-out .settings-card { transition: none; }
  .settings-toggle,
  .settings-toggle-knob { transition: none; }
  .settings-select-menu,
  .settings-select__chevron { transition: none; }
}

/* \u2500\u2500 Ambience pause while the window is hidden (2026-07-11) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Close-to-tray keeps the app alive for hours, and Chromium's background
   throttling suspends rAF/timers but NOT compositor-driven CSS animations \u2014
   the device aura (blurred radial gradients) and ring (filter keyframes)
   kept the GPU warm from the tray. \`is-window-hidden\` (App.tsx \u2190
   useWindowHidden \u2190 visibilitychange) pauses every INFINITE loop;
   play-state freezes mid-frame and resumes exactly there, so nothing pops
   when the window returns. One-shot entrances/exits and turn-driven state
   classes are deliberately untouched. Placed last so these outrank the
   equal-or-lower-specificity \`animation:\` shorthands above. */
.app.is-window-hidden .agent-spill,
.app.is-window-hidden .agent-ring,
.app.is-window-hidden .title-caret,
.app.is-window-hidden .streaming-caret,
.app.is-window-hidden .activity-line__led.is-pulsing,
.app.is-window-hidden .session-item__live-bar,
.app.is-window-hidden .swap-text__in.is-shimmer,
.app.is-window-hidden .activity-step.is-active .activity-step__body,
.app.is-window-hidden .transfer-text.is-shimmer,
.app.is-window-hidden .activity-line__summary.is-shimmer,
.app.is-window-hidden .connect-station-label,
.app.is-window-hidden .reconnect-morph-clone.is-waiting {
  animation-play-state: paused;
}

/* \u2500\u2500 Window-snap veil (user 2026-07-14) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A maximize/restore is animated by the OS as a ~250ms crossfade-zoom
   between the OLD and NEW window surfaces. Top/left-anchored content sits
   at the same spot in both frames, but the BOTTOM-anchored composer footer
   and RIGHT-anchored utility rail land at different viewport positions \u2014
   mid-crossfade they read as an obvious DOUBLE composer. The app can't
   reach the OS animation; instead these edge-anchored surfaces blink out
   INSTANTLY on a snap-sized viewport jump (\`is-window-snap\`, App.tsx \u2190
   useWindowSnap; \u2265120px in one resize event, so interactive edge-drags
   never trigger it) and fade back through their own base opacity
   transitions once the snap settles. Placed last for the cascade tie with
   the base .workspace-footer/.utility-rail transitions. */
.app.is-window-snap .workspace-footer,
.app.is-window-snap .utility-rail {
  opacity: 0;
  transition: none;
}

/* \u2500\u2500 Staged images (ADR 0048 \xA74) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Pictures waiting in the composer for the message they belong to. The strip
   sits ABOVE the input, inside the composer's own box, and the composer GROWS
   to hold it (.has-staged below) \u2014 the picture and the sentence about it stay
   one object.

   The composer is a flex ROW (attach \xB7 input \xB7 send); this strip is a full-
   width sibling, so the row is wrapped and the strip claims its own line.
   The lines are bottom-anchored (see .composer's align-content), so the
   growth extends the top edge upward and the input row never moves. */
.composer {
  flex-wrap: wrap;
}
/* 78px base + 56px thumbs + 10px strip gap. Owner report 2026-08-27: without
   this the fixed 78px box kept its height and the strip painted OVER the
   input. Rides the 0.44s signature height transition both ways; the strip
   itself fades in under the grow (below). */
.composer.has-staged {
  height: 144px;
}
@media (max-width: 1200px) {
  /* The 104px media height, same growth. And the bottom-anchor padding that
     reproduces centering at 104px \u2014 (102 \u2212 line)/2. */
  .composer {
    padding-bottom: 28px;
  }
  .composer.has-staged {
    height: 170px;
  }
}
.composer-staged {
  order: -1; /* before the attach button, whatever the DOM order */
  flex-basis: 100%;
  display: flex;
  /* ONE row, always: wrapping would make the composer's grown height depend
     on the count, and the 0.44s height transition needs a fixed target.
     Overflow pans horizontally, Codex-style. */
  flex-wrap: nowrap;
  overflow-x: auto;
  max-width: 100%;
  gap: 8px;
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
  /* Above .composer-wave, which is a positioned first child \u2014 non-positioned
     in-flow content slips beneath it (same reason .composer-attach is
     positioned). */
  position: relative;
  /* The strip mounts at its final slot while the box is still growing over
     it \u2014 fading in under the grow keeps the first frames from showing
     thumbnails outside the glass. */
  animation: staged-strip-in 0.28s ease 0.14s both;
}
@keyframes staged-strip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
/* Same slim pill scrollbar as .composer-input, for the overflow pan. */
.composer-staged::-webkit-scrollbar {
  height: 8px;
}
.composer-staged::-webkit-scrollbar-track {
  background: transparent;
}
.composer-staged::-webkit-scrollbar-thumb {
  background: var(--ink-a13);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.composer-staged__item {
  position: relative;
  flex: 0 0 auto; /* nowrap strip: never squeezed by its siblings */
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--ink-a10);
  background: var(--ink-a05);
}
/* The thumb's click surface (click-to-enlarge, ADR 0048 \xA74a): a reset
   button filling the item; the \xD7 floats above it. */
.composer-staged__open {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
}
.composer-staged__open:focus-visible {
  outline: 2px solid var(--accent, #4d86ff);
  outline-offset: -2px;
}
.composer-staged__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  /* A staged picture is not a link and not draggable content \u2014 dragging one
     out of the strip would start a file drag back into the composer. */
  user-select: none;
}
/* The \u2715 that truly un-happens it. Always visible rather than hover-revealed:
   this is the ONLY moment the picture can be taken back before it enters an
   append-only record, so the control must not be a discovery. */
.composer-staged__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--scrim-strong, rgba(20, 26, 34, 0.62));
  color: #fff;
  cursor: pointer;
  opacity: 0.86;
  transition:
    opacity 0.15s ease,
    background 0.15s ease;
}
.composer-staged__remove:hover {
  opacity: 1;
  background: rgba(20, 26, 34, 0.82);
}
.composer-staged__remove svg {
  width: 10px;
  height: 10px;
}

/* \u2500\u2500 Sent images, above their bubble (ADR 0048 \xA74) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The record holds these blocks AFTER the user block (inside the turn's span,
   so a rewind takes both); the screen reads better with the picture above the
   words, the way the \u5F00\u62D3\u8005 sent it. Same record, different overlay \u2014 D7. */
/* \`.message-row\` is a flex ROW (bubble, then the hover action row), so an
   images div dropped in becomes a COLUMN beside the bubble \u2014 which is what it
   did on first live run: the picture sat to the left of the text instead of
   above it. Wrapping the row and claiming a full basis puts the pictures on
   their own line; \`order: -1\` puts that line first whatever the DOM order. */
.user-row:has(.message-images) {
  flex-wrap: wrap;
}
.message-images {
  order: -1;
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end; /* user side of the thread */
  gap: 8px;
  margin-bottom: 6px;
}
/* THUMBNAILS, the composer strip's own design (owner 2026-08-27): the first
   cut rendered natural-size images up to 320\xD7240, and a few of them ate the
   whole pane. The sent row now reads like the strip it lifted off from \u2014
   fixed cover-cropped squares \u2014 and with the five-picture cap it is always
   one quiet line over the bubble. The pixels stay one click away in the
   store; the caption (alt/title below) is the record's textual truth. */
.message-images__thumb {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  border: 1px solid var(--ink-a10);
  background: var(--ink-a05);
  display: block;
  object-fit: cover;
  user-select: none;
}
/* The send morph's copy of the strip (ADR 0048 \xA74): the pictures fly WITH
   the bubble. Absolutely hung off the clone's top edge so the flight
   geometry \u2014 which aims the BUBBLE at its measured slot \u2014 is untouched;
   right-aligned to the bubble's right edge, which is exactly where the
   landed row's strip sits (the row justifies its images flex-end against
   the same edge). bottom:100% + the 6px margin reproduce the row strip's
   6px gap, so the settle swap is seamless. */
.morph-clone-images {
  position: absolute;
  bottom: 100%;
  right: 0;
  /* The landed row separates its wrapped lines by .message-row's row-gap
     (the 14px \`gap\` shorthand) PLUS the strip's own 6px margin \u2014 the clone
     must hang its strip at the same 20px, or the pictures jump upward by
     the row-gap at the swap (owner 2026-08-27: "suddenly moving upwards").
     Keep in sync with .message-row's gap and .message-images' margin. */
  margin: 0 0 20px;
  /* Width comes inline, measured off the hidden pending row's strip, so the
     clone wraps its pictures exactly like the row it swaps for. Wrapping and
     flex-end justification are inherited from .message-images. */
}
/* The sent thumb's click surface (click-to-enlarge, ADR 0048 \xA74a). */
.message-images__open {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  border-radius: 10px;
  cursor: zoom-in;
}
.message-images__open:focus-visible {
  outline: 2px solid var(--accent, #4d86ff);
  outline-offset: 1px;
}

/* \u2500\u2500 Image lightbox (ADR 0048 \xA74a, the Codex reference) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A thumbnail opens the whole picture in an in-app overlay: dark ground,
   the image centered (scrolling when zoomed past the pane), a \u2212/percent/+
   pill at the bottom, \u2715 top-right. Sits ABOVE the settings/key-prompt
   backdrops (an intentional viewer the user just opened) and below the
   floating menus \u2014 keep in sync with OVERLAY_Z.lightbox. */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 64;
  background: rgba(10, 14, 20, 0.82);
  animation: lightbox-in 0.18s ease both;
}
@keyframes lightbox-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.lightbox-viewport {
  position: absolute;
  inset: 0;
  overflow: auto;
  display: flex;
  padding: 44px;
}
/* Drag-to-pan (owner 2026-08-28) \u2014 the grab cursor appears only while the
   picture actually overflows, so it never promises a drag that does
   nothing. \`is-pannable\` is toggled per zoom commit by the component. */
.lightbox-viewport.is-pannable {
  cursor: grab;
}
.lightbox-viewport.is-pannable:active {
  cursor: grabbing;
}
/* The house scrollbar (same geometry as .conversation / .composer-input),
   in its light-on-dark form: a zoomed image panned with the OS's chunky
   default bars, arrow buttons and all, on top of the frosted app (owner
   2026-08-27) \u2014 and the ink-tinted thumb the light surfaces use would be
   invisible on this ground. */
.lightbox-viewport::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.lightbox-viewport::-webkit-scrollbar-track {
  background: transparent;
}
.lightbox-viewport::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.lightbox-viewport::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.36);
  background-clip: padding-box;
}
/* Both bars up (zoomed past the pane on BOTH axes) meet in a corner square
   that defaults to opaque white on the dark ground. */
.lightbox-viewport::-webkit-scrollbar-corner {
  background: transparent;
}
.lightbox-img {
  /* margin:auto in a flex container BOTH centers a small image and keeps a
     zoomed-past-the-pane one scrollable from its true top-left: auto margins
     resolve to zero once free space goes negative, so the image sits at the
     start edge and overflows to the end (plain centering clips the far edges
     of overflowing flex content). */
  margin: auto;
  /* THE ZOOM CAP BUG (owner 2026-08-28): a flex item shrinks by default, so
     past the viewport's width the inline \`width\` this component sets was
     shrunk straight back \u2014 the picture stopped growing at whatever filled
     the pane while the percentage kept counting to 500%. \`flex: none\` makes
     the written width authoritative and lets the viewport scroll instead. */
  flex: none;
  display: block;
  border-radius: 6px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  user-select: none;
}
.lightbox-close {
  position: absolute;
  /* Below the window titlebar controls \u2014 top:16 sat the \u2715 directly on the
     app's own close button (seen live 2026-08-27). */
  top: 52px;
  right: 18px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
  /* The mount focuses this button (keyboard users land in the dialog); the
     UA default ring read as a highlighted control. Keep a ring for the
     keyboard, styled, and none for pointer opens. */
  outline: none;
}
.lightbox-close:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.55);
  outline-offset: 2px;
}
.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.22);
}
.lightbox-close svg {
  width: 12px;
  height: 12px;
}
.lightbox-zoom {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 999px;
  background: rgba(20, 26, 34, 0.72);
  backdrop-filter: blur(14px);
}
.lightbox-zoom__btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}
.lightbox-zoom__btn:hover {
  background: rgba(255, 255, 255, 0.14);
}
.lightbox-zoom__label {
  min-width: 46px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .lightbox-backdrop {
    animation: none;
  }
}`;

// src/host/narrative-hints.js
var FORCED_SPEECH_OPEN_TAG = "\uFF08\u6211 \u8BF4\uFF09";
var STOP_SPEECH_CLOSE = "\uFF08/\u6211 \u8BF4\uFF09";
var STOP_THOUGHT_CLOSE = "\uFF08/\u6211 \u60F3\uFF09";
var THOUGHT_OPEN_TAG = "\uFF08\u6211 \u60F3\uFF09";
function thoughtBeforeSpeechTag(text) {
  const splitIdx = String(text).indexOf(FORCED_SPEECH_OPEN_TAG);
  const thoughtPart = splitIdx < 0 ? String(text) : String(text).slice(0, splitIdx);
  return thoughtPart.replaceAll(STOP_THOUGHT_CLOSE, "").replaceAll(THOUGHT_OPEN_TAG, "").trim();
}
function truncateAtClose(text, close) {
  const s = String(text);
  const idx = s.indexOf(close);
  return idx < 0 ? s : s.slice(0, idx);
}
function splitThoughtFences(text) {
  const raw = String(text);
  const thoughtParts = [];
  const speechParts = [];
  let rest = raw;
  for (; ; ) {
    const open = rest.indexOf(THOUGHT_OPEN_TAG);
    if (open < 0) {
      speechParts.push(rest);
      break;
    }
    speechParts.push(rest.slice(0, open));
    const afterOpen = rest.slice(open + THOUGHT_OPEN_TAG.length);
    const close = afterOpen.indexOf(STOP_THOUGHT_CLOSE);
    if (close < 0) {
      thoughtParts.push(afterOpen);
      break;
    }
    thoughtParts.push(afterOpen.slice(0, close));
    rest = afterOpen.slice(close + STOP_THOUGHT_CLOSE.length);
  }
  return {
    thought: thoughtParts.join("\n").trim(),
    // 零散片段按原样拼（间隔的换行都在片段里），末了再剥掉孤立的闭围栏记号。
    speech: speechParts.join("").replaceAll(STOP_THOUGHT_CLOSE, "").trim()
  };
}
var BEAT_NO_BANZHUAN_CLAUSE = "\u4E0D\u8981\u5728\u8FD9\u4E00\u53E5\u91CC\u5199 `@\u677F\u7816` \u2014\u2014 \u677F\u7816\u6B63\u5728\u5DE5\u4F5C\u4E2D\uFF0C\u65B0\u4EFB\u52A1\u7B49\u5B83\u505A\u5B8C\u518D\u8BF4\uFF0C\u73B0\u5728\u53EA\u70B9\u8BC4\u773C\u524D\u8FD9\u4E00\u6B65\u3002";
var BEAT_HINT_PATCH_PREVIEW = `\u3014\u677F\u7816\u521A\u628A\u8865\u4E01\u4EAE\u5728\u8BB0\u5F55\u4E0A\u65B9\u4E86\u3002\u73B0\u5728\u6211\u8BF4\u4E00\u53E5\u8BDD\u70B9\u8BC4\uFF1A\u770B diff \u7684\u5F62\u72B6\u662F\u4E0D\u662F\u5E72\u51C0 / \u54EA\u91CC\u503C\u5F97\u63D0\u4E00\u5634 / \u6709\u6CA1\u6709\u53EF\u7591\u7684\u5730\u65B9\u3002\u4E0D\u590D\u8FF0\u4EE3\u7801\uFF08\u5F00\u62D3\u8005\u81EA\u5DF1\u80FD\u770B\u89C1\uFF09\uFF0C\u4E0D\u89E3\u91CA diff \u5728\u505A\u4EC0\u4E48\u3002\u77ED\u4FC3\u3001\u5E26\u5224\u65AD\u3002${BEAT_NO_BANZHUAN_CLAUSE}\u5FC5\u987B\u4EE5\uFF08\u6211 \u8BF4\uFF09\u5F00\u59CB\uFF0C\u4EE5\uFF08/\u6211 \u8BF4\uFF09\u7ED3\u675F\u3002\u3015`;
var BEAT_HINT_VERIFICATION_FINISHED = `\u3014\u677F\u7816\u521A\u8DD1\u5B8C\u4E86\u4E00\u6B65\u9A8C\u8BC1\uFF08\u6D4B\u8BD5 / \u7F16\u8BD1 / lint\uFF09\u3002\u7ED3\u679C\u5C31\u5728\u8BB0\u5F55\u4E0A\u65B9\u3002\u73B0\u5728\u6211\u8BF4\u4E00\u53E5\u8BDD\uFF1A\u8FC7\u4E86\u5C31\u70B9\u4E00\u4E0B\uFF0C\u6302\u4E86\u5C31\u6307\u51FA\u54EA\u91CC\u6302\u4E86 / \u53EF\u7591\u3002\u4E0D\u590D\u8FF0\u5168\u90E8\u8F93\u51FA\uFF0C\u4E0D\u8BFB stack trace\u3002\u77ED\u4FC3\u3001\u51B7\u9759\u3002${BEAT_NO_BANZHUAN_CLAUSE}\u5FC5\u987B\u4EE5\uFF08\u6211 \u8BF4\uFF09\u5F00\u59CB\uFF0C\u4EE5\uFF08/\u6211 \u8BF4\uFF09\u7ED3\u675F\u3002\u3015`;
var BEAT_HINT_TOOL_FAIL = `\u3014\u677F\u7816\u521A\u4E00\u6B65\u5931\u8D25\u4E86\u3002\u5931\u8D25\u539F\u56E0\u5199\u5728\u8BB0\u5F55\u4E0A\u65B9\u3002\u73B0\u5728\u6211\u8BF4\u4E00\u53E5\u8BDD\uFF1A\u628A\u5931\u8D25\u70B9\u62CE\u51FA\u6765\u7528\u4EBA\u8BDD\u8BB2\uFF08\u4E0D\u8981\u7167\u642C\u9519\u8BEF\u4FE1\u606F\uFF09\uFF0C\u6001\u5EA6\u53EF\u4EE5\u51B7 / \u5632\u8BBD\uFF0C\u4F46\u4E0D\u8981\u88C5\u4F5C\u8FD9\u4E8B\u4E0D\u8981\u7D27\u3002\u4E00\u53E5\u8BDD\u3002${BEAT_NO_BANZHUAN_CLAUSE}\u5FC5\u987B\u4EE5\uFF08\u6211 \u8BF4\uFF09\u5F00\u59CB\uFF0C\u4EE5\uFF08/\u6211 \u8BF4\uFF09\u7ED3\u675F\u3002\u3015`;
function splitSurfaces(text) {
  const raw = String(text);
  const speechIdx = raw.indexOf(FORCED_SPEECH_OPEN_TAG);
  const thoughtIdx = raw.indexOf(THOUGHT_OPEN_TAG);
  if (speechIdx >= 0) {
    const before = raw.slice(0, speechIdx);
    const thought = thoughtBeforeSpeechTag(before);
    const speech = truncateAtClose(
      raw.slice(speechIdx + FORCED_SPEECH_OPEN_TAG.length),
      STOP_SPEECH_CLOSE
    ).trim();
    return {
      thought,
      speech,
      hasThought: thought.length > 0,
      hasSpeech: speech.length > 0
    };
  }
  if (thoughtIdx >= 0) {
    const { thought, speech } = splitThoughtFences(raw);
    return {
      thought,
      speech,
      hasThought: thought.length > 0,
      hasSpeech: speech.length > 0
    };
  }
  return { thought: "", speech: raw.trim(), hasThought: false, hasSpeech: raw.trim().length > 0 };
}

// src/shared/mapping.js
function textOf(content) {
  if (!Array.isArray(content)) return "";
  return content.filter(
    (b) => typeof b === "object" && b !== null && b.type === "text" && typeof b.text === "string"
  ).map((b) => b.text).join("\n");
}
function isoOf(time) {
  return typeof time === "number" && Number.isFinite(time) ? new Date(time).toISOString() : void 0;
}
function stampOf(time) {
  const at = isoOf(time);
  return at === void 0 ? {} : { at };
}
function toBubbles(nodes) {
  const bubbles = [];
  const droppedKinds = [];
  const voiceCues = [];
  for (const raw of nodes) {
    const node = raw ?? {};
    if (node.kind === "user" || node.kind === "steering") {
      const text = textOf(node.content);
      if (text !== "") bubbles.push({ role: "user", text, ...stampOf(node.time) });
      continue;
    }
    if (node.kind === "assistant") {
      const raw2 = (node.blocks ?? []).filter((b) => b.kind === "text" && typeof b.text === "string").map((b) => b.text).join("");
      const { thought, speech } = splitSurfaces(raw2);
      if (speech !== "") {
        bubbles.push({ role: "herta", text: speech, ...stampOf(node.time) });
      } else {
        droppedKinds.push(thought !== "" ? "assistant:thought-only" : "assistant:reasoning-only");
      }
      continue;
    }
    if (node.kind === "tool-result") {
      const voice = node.meta?.hertaVoice;
      if (typeof voice?.url === "string" && typeof node.seq === "number") {
        voiceCues.push({
          seq: node.seq,
          url: voice.url,
          clip: voice.clip ?? "",
          category: voice.category ?? ""
        });
      }
      droppedKinds.push("tool-result");
      continue;
    }
    droppedKinds.push(String(node.kind ?? "unknown"));
  }
  return {
    bubbles,
    dropped: { total: droppedKinds.length, kinds: droppedKinds },
    voiceCues
  };
}
function nodesToRecord(nodes) {
  const record = [];
  for (const raw of nodes) {
    const node = raw ?? {};
    const stamp = stampOf(node.time);
    if (node.kind === "user" || node.kind === "steering") {
      const text = textOf(node.content);
      if (text !== "") record.push({ kind: "user", text, ...stamp });
      continue;
    }
    if (node.kind === "assistant") {
      const raw2 = (node.blocks ?? []).filter((b) => b.kind === "text" && typeof b.text === "string").map((b) => b.text).join("");
      const speech = splitSurfaces(raw2).speech;
      if (speech !== "") {
        record.push({ kind: "herta", surface: "speech", text: speech, ...stamp });
      }
      continue;
    }
    if (node.kind === "tool-result") {
      const name2 = node.call?.name ?? "\u5DE5\u5177";
      const body = node.isError === true ? `${name2} \u5931\u8D25` : `${name2} \u5DF2\u8FD4\u56DE`;
      record.push({ kind: "system", label: "\u7CFB\u7EDF", body, ...stamp });
      continue;
    }
    if (node.kind === "turn-error") {
      const body = typeof node.message === "string" && node.message !== "" ? node.message : "\u672C\u8F6E\u5931\u8D25";
      record.push({ kind: "system", label: "\u7CFB\u7EDF", body, ...stamp });
      continue;
    }
    if (node.kind === "compaction") {
      record.push({ kind: "system", label: "\u7CFB\u7EDF", body: "\uFF08\u6B64\u5904\u53D1\u751F\u8FC7\u4E00\u6B21\u4E0A\u4E0B\u6587\u538B\u7F29\uFF09", ...stamp });
    }
  }
  return record;
}
function fullSnapshot(sessionId, record) {
  const id = typeof sessionId === "string" ? sessionId : "";
  return {
    sessionId: id,
    workspaceRoot: `dsh://session/${id === "" ? "current" : id}`,
    record,
    overlay: null,
    title: null,
    lang: "zh",
    backendWorkspace: "~/.herta/workspaces/dsh",
    backendWorkspaceIsDefault: true
  };
}

// src/host/voice-settings-shared.js
var DEFAULT_VOICE_SETTINGS = Object.freeze({
  engine: "local",
  realtimeVoice: true
});
function emptyKeyStatus() {
  return { set: false, hint: null, encrypted: false };
}
function isVoiceEngine(value) {
  return typeof value === "string" && VOICE_ENGINES.includes(value);
}
function normalizeVoiceSettings(section) {
  const src = section !== null && typeof section === "object" ? section : {};
  return {
    engine: isVoiceEngine(src.engine) ? src.engine : DEFAULT_VOICE_SETTINGS.engine,
    realtimeVoice: typeof src.realtimeVoice === "boolean" ? src.realtimeVoice : DEFAULT_VOICE_SETTINGS.realtimeVoice
  };
}
var FALLBACK_HOST_FACTS = Object.freeze({
  bundle: false,
  runtime: false,
  failed: false,
  modelPhase: "absent",
  minimaxKey: Object.freeze(emptyKeyStatus()),
  minimaxPlanKey: Object.freeze(emptyKeyStatus()),
  minimaxVoice: Object.freeze({ phase: "absent" }),
  minimaxRefusal: null,
  mimoKey: Object.freeze(emptyKeyStatus()),
  mimoVoice: Object.freeze({ phase: "absent" })
});
function buildRealtimeVoiceState(settings, facts = FALLBACK_HOST_FACTS) {
  const s = normalizeVoiceSettings(settings);
  const f = facts !== null && typeof facts === "object" ? facts : FALLBACK_HOST_FACTS;
  const m = f.model !== null && typeof f.model === "object" ? f.model : {};
  const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
  const phase = typeof m.phase === "string" ? m.phase : typeof f.modelPhase === "string" ? f.modelPhase : "absent";
  return {
    enabled: s.realtimeVoice,
    bundle: f.bundle === true,
    runtime: f.runtime === true,
    failed: f.failed === true,
    model: {
      phase,
      receivedBytes: num(m.receivedBytes),
      totalBytes: num(m.totalBytes),
      unpackedBytes: num(m.unpackedBytes)
    },
    engine: s.engine,
    minimax: {
      key: f.minimaxKey ?? emptyKeyStatus(),
      planKey: f.minimaxPlanKey ?? emptyKeyStatus(),
      voice: f.minimaxVoice ?? { phase: "absent" },
      refusal: f.minimaxRefusal ?? null
    },
    mimo: {
      key: f.mimoKey ?? emptyKeyStatus(),
      voice: f.mimoVoice ?? { phase: "absent" }
    }
  };
}

// src/client/opus.ts
function clipUrl(rel) {
  return `/herta-voice/${String(rel).split("/").map(encodeURIComponent).join("/")}`;
}
function markVoice(field, value) {
  const mark = globalThis.__DSH_HERTA__;
  if (mark !== void 0) mark[field] = value;
}
function playUrl(url) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.9;
    const p = audio.play();
    if (p !== void 0) p.catch(() => {
    });
    markVoice("lastVoiceUrl", url);
    markVoice("voicePlays", (globalThis.__DSH_HERTA__?.voicePlays ?? 0) + 1);
  } catch {
    markVoice("lastVoiceError", url);
  }
}
function playClip(rel) {
  playUrl(clipUrl(rel));
}

// src/client/ui.ts
function currentDshTheme() {
  return document.documentElement.style.colorScheme === "dark" ? "dark" : "light";
}
function ensureShadowMount(host) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (shadow.querySelector("style[data-herta]") === null) {
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.setAttribute("data-herta", "");
    style.textContent = reference_ux_default;
    shadow.append(style);
  }
  if (shadow.querySelector("style[data-herta-click]") === null) {
    const clickStyle = document.createElement("style");
    clickStyle.setAttribute("data-herta-click", "");
    clickStyle.textContent = ".message-bubble,.code-standalone{cursor:pointer}";
    shadow.append(clickStyle);
  }
  const existing = shadow.querySelector("[data-herta-mount]");
  if (existing instanceof HTMLElement) return existing;
  const mount = document.createElement("div");
  mount.setAttribute("data-herta-mount", "");
  shadow.append(mount);
  return mount;
}
var spokenAudio = /* @__PURE__ */ new Map();
function recallSpokenAudio(text) {
  return spokenAudio.get(text.trim());
}
var awaitingSpokenTexts2 = /* @__PURE__ */ new Map();
async function speakText(text) {
  const body = text.trim();
  if (body === "") return;
  localQueue.stopAll();
  const hit = recallSpokenAudio(body);
  if (hit !== void 0) {
    playLocalVoice(`cached-${Date.now()}`, 0, hit.samples, hit.sampleRate, hit.durationMs);
    return;
  }
  const token = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36)}`;
  awaitingSpokenTexts2.set(token, body);
  await postMiniMaxAction("say", { text: body, exact: true, token });
}
function paragraphUnderPointer(event, fallback) {
  try {
    const target = event?.target;
    if (typeof target?.closest !== "function") return fallback;
    const bubble = target.closest(".message-bubble") ?? target.closest(".code-standalone");
    if (bubble === null) return null;
    const row = bubble.closest(".message-row") ?? bubble;
    const body = row.querySelector(".message-text") ?? row.querySelector(".code-block") ?? bubble;
    const text = (body.textContent ?? "").trim();
    return text === "" ? fallback : text;
  } catch {
    return fallback;
  }
}
function renderBubbleList(bubbles) {
  const children = bubbles.map((b, i) => {
    if (b.role === "user") {
      return (0, import_react12.createElement)(UserBubble, {
        key: `${i}-user`,
        text: b.text,
        ...b.at === void 0 ? {} : { at: b.at }
      });
    }
    return (0, import_react12.createElement)(
      "div",
      {
        key: `${i}-herta`,
        onClick: (event) => {
          const hit = paragraphUnderPointer(event, b.text);
          if (hit === null) return;
          void speakText(hit);
        },
        title: "\u70B9\u4E00\u4E0B\uFF0C\u8BFB\u8FD9\u4E00\u6BB5"
      },
      (0, import_react12.createElement)(HertaBubble, {
        text: b.text,
        lang: "zh",
        ...b.at === void 0 ? {} : { at: b.at }
      })
    );
  });
  return (0, import_react12.createElement)("div", null, children);
}
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function HertaPanel(props) {
  const [index, setIndex] = (0, import_react12.useState)(null);
  const [muted, setMuted] = (0, import_react12.useState)(false);
  const [notice, setNotice] = (0, import_react12.useState)("");
  const [autoVoice, setAutoVoice] = (0, import_react12.useState)(true);
  (0, import_react12.useEffect)(() => {
    let alive = true;
    fetch("/herta-voice/index.json").then((r) => r.ok ? r.json() : null).then((data) => {
      if (alive) setIndex(data?.categories ?? null);
    }).catch(() => {
      if (alive) setIndex(null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const hertaBubbles = props.bubbles.filter((b) => b.role === "herta").length;
  const playParticle = (0, import_react12.useCallback)(() => {
    if (index === null) return;
    const particles = index.particle ?? [];
    if (particles.length === 0) return;
    playClip(pick(particles));
    setNotice(`\u8BED\u6C14\uFF1A${pick(particles).split("/")[1]}`);
  }, [index]);
  const seen = (0, import_react12.useRef)(0);
  (0, import_react12.useEffect)(() => {
    if (!muted && autoVoice && index !== null && hertaBubbles > seen.current && seen.current > 0) {
      playParticle();
    }
    seen.current = hertaBubbles;
  }, [hertaBubbles, muted, autoVoice, index, playParticle]);
  const playedSeqs = (0, import_react12.useRef)(/* @__PURE__ */ new Set());
  (0, import_react12.useEffect)(() => {
    if (muted) return;
    for (const cue of props.voiceCues) {
      if (playedSeqs.current.has(cue.seq)) continue;
      playedSeqs.current.add(cue.seq);
      playUrl(cue.url);
      setNotice(`\u5979\u8BF4\uFF08${cue.category}\uFF09`);
    }
  }, [props.voiceCues, muted]);
  const total = index === null ? 0 : Object.values(index).reduce((n, l) => n + l.length, 0);
  const button = (label, onClick, key) => (0, import_react12.createElement)(
    "button",
    {
      key,
      type: "button",
      onClick,
      style: {
        font: "inherit",
        padding: "4px 10px",
        borderRadius: "6px",
        border: "1px solid currentColor",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        opacity: muted ? 0.5 : 1
      }
    },
    label
  );
  const bar = (0, import_react12.createElement)(
    "div",
    {
      style: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "8px 16px",
        opacity: 0.85,
        color: "var(--dsw-alias-label-primary)"
      }
    },
    [
      button("\u5F00\u573A", () => {
        const openings = index?.openings ?? [];
        if (openings.length > 0) {
          playClip(pick(openings));
          setNotice("\u5F00\u573A\u767D");
        }
      }, "open"),
      button("\u8BED\u6C14", playParticle, "particle"),
      button(muted ? "\u{1F507} \u5DF2\u9759\u97F3" : "\u{1F50A} \u6709\u58F0", () => {
        setMuted((m) => !m);
        setNotice("");
      }, "mute"),
      button(autoVoice ? "\u81EA\u52A8\u914D\u97F3\uFF1A\u5F00" : "\u81EA\u52A8\u914D\u97F3\uFF1A\u5173", () => setAutoVoice((v) => !v), "auto"),
      (0, import_react12.createElement)(
        "span",
        { key: "info", style: { fontSize: "12px", opacity: 0.7 } },
        index === null ? "\u8BED\u97F3\u8D44\u4EA7\u4E0D\u53EF\u7528" : `\u8BED\u97F3\u8D44\u4EA7 ${total} \u6761${notice === "" ? "" : ` \xB7 ${notice}`}`
      )
    ]
  );
  return (0, import_react12.createElement)("div", { style: { padding: "8px 0 16px" } }, [
    bar,
    (0, import_react12.createElement)("div", { key: "bubbles", style: { padding: "0 16px" } }, renderBubbleList(props.bubbles))
  ]);
}
var NO_NODES = [];
function HertaView(props) {
  const hostRef = (0, import_react12.useRef)(null);
  const rootRef = (0, import_react12.useRef)(null);
  const chat = typeof props.useHertaChat === "function" ? props.useHertaChat((s) => s) : void 0;
  const nodes = chat?.legacy?.nodes ?? NO_NODES;
  const { bubbles, dropped, voiceCues } = (0, import_react12.useMemo)(() => toBubbles(nodes), [nodes]);
  (0, import_react12.useEffect)(
    () => () => {
      rootRef.current?.root.unmount();
      rootRef.current = null;
    },
    []
  );
  (0, import_react12.useEffect)(() => {
    const host = hostRef.current;
    if (host === null) return;
    const mount = ensureShadowMount(host);
    if (rootRef.current === null || rootRef.current.host !== host) {
      rootRef.current = { host, root: (0, import_client.createRoot)(mount) };
    }
    const theme = currentDshTheme();
    if (theme === "dark") host.setAttribute("data-theme", "dark");
    else host.removeAttribute("data-theme");
    rootRef.current.root.render(
      (0, import_react12.createElement)(
        LocaleProvider,
        { locale: "zh", onLocaleChange: () => {
        } },
        // HertaPanel 的位置与类型都稳定，所以外层每次重渲只会更新 props，
        // 面板自己的语音状态（索引/静音/已播 seq）不会被重置。
        (0, import_react12.createElement)(HertaPanel, { bubbles, voiceCues })
      )
    );
    const mark = globalThis.__DSH_HERTA__;
    if (mark !== void 0) {
      mark.viewMounted = true;
      mark.theme = theme;
      mark.cssWhere = host.shadowRoot !== null ? "shadow" : "none";
      mark.bubbles = bubbles.length;
      mark.droppedNodes = dropped.total;
      mark.droppedKinds = [...new Set(dropped.kinds)];
    }
  }, [bubbles, dropped]);
  return (0, import_react12.createElement)("div", { ref: hostRef, "data-dsh-herta-view": "ready" });
}
function HertaFullView(props) {
  const frameRef = (0, import_react12.useRef)(null);
  const chat = typeof props.useHertaChat === "function" ? props.useHertaChat((s) => s) : void 0;
  const nodes = chat?.legacy?.nodes ?? NO_NODES;
  const record = (0, import_react12.useMemo)(() => nodesToRecord(nodes), [nodes]);
  const title = (0, import_react12.useMemo)(() => null, []);
  const latest = (0, import_react12.useRef)({ record, nodes, sessionId: props.sessionId, title });
  latest.current = { record, nodes, sessionId: props.sessionId, title };
  const push = (event, payload) => {
    const win = frameRef.current?.contentWindow;
    if (win === null || win === void 0) return;
    win.postMessage({ __herta: true, kind: "event", event, payload }, window.location.origin);
  };
  (0, import_react12.useEffect)(() => {
    const { record: r, nodes: n, sessionId, title: t } = latest.current;
    if (r.length === 0 && n.length === 0) {
      push("reset", { noSession: true });
      return;
    }
    push("reset", fullSnapshot(sessionId, r));
    const mark = globalThis.__DSH_HERTA__;
    if (mark !== void 0) {
      mark.fullViewPushed = (mark.fullViewPushed ?? 0) + 1;
      mark.fullViewBlocks = r.length;
    }
  }, [record, nodes, props.sessionId]);
  (0, import_react12.useEffect)(() => {
    let alive = true;
    void refreshVoiceModel().then((s) => {
      if (!alive) return;
      push("voiceModel", s);
      const mark = globalThis.__DSH_HERTA__;
      if (mark !== void 0) {
        mark.voiceModelPushed = true;
        mark.voiceModelPhase = s?.phase ?? null;
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  (0, import_react12.useEffect)(() => {
    const reply = (id, value) => frameRef.current?.contentWindow?.postMessage(
      { __herta: true, kind: "reply", id, value },
      window.location.origin
    );
    const fail = (id, error) => frameRef.current?.contentWindow?.postMessage(
      { __herta: true, kind: "reply", id, error },
      window.location.origin
    );
    const onMessage = (event) => {
      const msg = event.data;
      if (msg === null || typeof msg !== "object" || msg.__herta !== true) return;
      if (msg.kind === "hello") {
        const { record: r, nodes: n, sessionId, title: t } = latest.current;
        push("reset", r.length === 0 && n.length === 0 ? { noSession: true } : fullSnapshot(sessionId, r));
        const mark = globalThis.__DSH_HERTA__;
        if (mark !== void 0) mark.fullViewBooted = true;
        return;
      }
      if (msg.kind !== "call" || typeof msg.id !== "number") return;
      switch (msg.method) {
        // ── 设置（全部读写同一个设置命名空间）────────────────────────────
        //
        // **以前这几个是坏的**：`getLocale` / `getCloseToTray` / `getDreamConfig`
        // 返回硬编码常量，三个 setter 根本没进 switch（落到 default 的
        // 「还没有实现」分支）。也就是她的设置面板能点、点了不报错、值却永远不变 ——
        // 典型假绿。现在统一读写 `ctx.configForms.get("herta")`，
        // 与 DSH 设置页里的「黑塔」一页是同一份值、同一条写入路径。
        //
        // ## 为什么她的设置页删了，这里的分支还留着
        //
        // 删掉 `Herta-src` 那套 `components/Settings/*` 之后，`getDreamConfig` /
        // `getCloseToTray` / `getAutoUpdate` / `getBackendConfig` / `getModelConfig`
        // / `getInteractionLanguage` / `getRealtimeVoice` / `getVoiceEngine` 与
        // 各自的 setter **在渲染层里已经没有调用方**了。它们留在这里有两个理由：
        //   · `HertaBridge` 契约把这些成员声明为**必填**（`bridge-types.ts:617-672`），
        //     少一个就是类型错，而它是上游文件 —— 我们不改它的形状；
        //   · 这些正是「暂未接线」那组字段的接线点：将来把消费方接回来时，
        //     落地处就是这些分支，不是别处。
        // 字段表里对应项的 `wired: false` + `note` 记的才是事实，别把「有分支」
        // 误读成「有人调」。
        case "getLocale": {
          const locale = machineValues().locale;
          if (typeof locale === "string" && locale !== "") return reply(msg.id, locale);
          return reply(msg.id, navigator.language?.startsWith("zh") === true ? "zh" : "en");
        }
        case "setLocale": {
          const next = msg.params?.locale;
          if (next === "zh" || next === "en") void writeMachineField("locale", next);
          return reply(msg.id, void 0);
        }
        case "getTheme":
          return reply(msg.id, currentDshTheme());
        case "getCloseToTray":
          return reply(msg.id, machineValues().closeToTray);
        case "setCloseToTray": {
          const next = msg.params?.enabled;
          if (typeof next === "boolean") void writeMachineField("closeToTray", next);
          return reply(msg.id, void 0);
        }
        case "getDreamConfig":
          return reply(msg.id, { enabled: machineValues().dreamEnabled });
        case "setDreamConfig": {
          const next = msg.params?.cfg?.enabled;
          if (typeof next === "boolean") void writeMachineField("dreamEnabled", next);
          return reply(msg.id, void 0);
        }
        case "getDeepSeekKeyStatus": {
          void credentialStatus("DEEPSEEK_API_KEY").then((status) => {
            reply(msg.id, {
              set: status?.configured === true,
              hint: status === void 0 ? null : "DSH \u7684\u6A21\u578B\u914D\u7F6E",
              encrypted: true
            });
          });
          return;
        }
        case "listSessions":
          return reply(msg.id, []);
        case "maybePlayEasterEgg":
          return reply(msg.id, void 0);
        // ── 语音（VoiceSettings 的 12 个应答器，见 Herta-语音模块-交接.md §2.2）──
        // 上游 bridge 契约里这些方法原本全部缺失，整块静默失败（能选但不生效）。
        //
        // **引擎与开关现在是真的**：来自 DSH 设置命名空间 `herta` 的两个字段
        // （`voiceEngine` / `realtimeVoice`），也就是 DSH 设置页里「黑塔」那一页
        // 改的是同一份值。写入落进 profile 的 `cordis.patch.yml`，并由宿主侧
        // 同步进整机自己的 `settings.json`。
        //
        // 其余字段是**宿主事实**（模型在不在、密钥设没设）。三个引擎现在都还没
        // 接线（第三步离线引擎、第四步触发点），所以如实报告「不可用」——
        // 这修掉了上一版硬编码 `bundle: true, runtime: true` 的假绿：
        // 那会让设置面板把离线引擎显示成「已就绪」，而 DSH 一个音都合成不出来。
        case "getRealtimeVoice":
          return reply(
            msg.id,
            buildRealtimeVoiceState(
              normalizeVoiceSettings(voiceScope.getSnapshot().value),
              // 宿主事实：离线模型的真实阶段与进度（runtime 仍如实报 false）。
              voiceModelFacts()
            )
          );
        case "setRealtimeVoice": {
          const next = msg.params?.next;
          if (typeof next === "boolean") void voiceScope.set("realtimeVoice", next);
          return reply(msg.id, void 0);
        }
        case "getVoiceEngine":
          return reply(msg.id, normalizeVoiceSettings(voiceScope.getSnapshot().value).engine);
        case "setVoiceEngine": {
          const engine = msg.params?.engine;
          if (isVoiceEngine(engine)) void voiceScope.set("engine", engine);
          return reply(msg.id, void 0);
        }
        case "downloadVoiceModel":
          void postVoiceModel("download").then((s) => reply(msg.id, s));
          return;
        case "onVoiceModel": {
          const sub = (state) => push("voiceModel", state);
          voiceModelSubs.add(sub);
          void refreshVoiceModel().then(() => push("voiceModel", voiceModelState));
          return reply(msg.id, void 0);
        }
        case "getVoicePrefs": {
          const volume = Number(machineField("voiceVolume"));
          return reply(msg.id, {
            muted: machineField("voiceMuted") === true,
            volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume / 100)) : 1
          });
        }
        case "setVoiceMuted": {
          const next = msg.params?.muted;
          if (typeof next === "boolean") void writeMachineField("voiceMuted", next);
          return reply(msg.id, void 0);
        }
        case "setVoiceVolume": {
          const next = msg.params?.volume;
          if (typeof next === "number" && Number.isFinite(next)) {
            const percent = Math.round(Math.min(1, Math.max(0, next)) * 100);
            void writeMachineField("voiceVolume", percent);
          }
          return reply(msg.id, void 0);
        }
        case "prepareMiniMaxVoice":
          return reply(msg.id, { phase: "absent" });
        case "onMiniMaxVoice":
          return reply(msg.id, void 0);
        case "clearMiniMaxKey": {
          void clearCredential("MINIMAX_API_KEY").then((failure) => {
            reply(msg.id, {
              ok: failure === null,
              status: { set: false, hint: failure, encrypted: true }
            });
          });
          return;
        }
        case "setMiniMaxKey": {
          const value = msg.params?.key;
          if (typeof value !== "string" || value.trim().length === 0) {
            return reply(msg.id, { ok: false, reason: "empty" });
          }
          void saveCredential("MINIMAX_API_KEY", value.trim()).then((failure) => {
            reply(
              msg.id,
              failure === null ? { ok: true, status: { set: true, hint: "DSH \u51ED\u636E\u5B58\u50A8", encrypted: true } } : { ok: false, reason: failure }
            );
          });
          return;
        }
        case "cancelVoiceModelDownload":
          void postVoiceModel("cancel").then(() => reply(msg.id, void 0));
          return;
        case "removeVoiceModel":
          void postVoiceModel("remove").then((s) => reply(msg.id, s));
          return;
        default:
          return fail(msg.id, `\u6574\u673A\u89C6\u56FE\u8FD8\u6CA1\u6709\u5B9E\u73B0 ${String(msg.method)}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      voiceModelSubs.clear();
      stopVoiceModelTimer();
    };
  }, []);
  return (0, import_react12.createElement)("iframe", {
    // 回调 ref 而不是 `ref={frameRef}`：挂载/卸载的那一刻就把这份 iframe
    // 登记成 MiniMax PCM 的语音出口（卸载时自动退回父窗口那条路）。
    // 用 `useEffect` 做不到这一点 —— 它读到的 `frameRef.current` 在首次渲染时
    // 还是 null。
    ref: (node) => {
      frameRef.current = node;
      registerVoiceSink(node);
    },
    "data-dsh-herta-view": "full",
    src: "/herta-ui/",
    title: "\u9ED1\u5854 \xB7 \u6574\u673A",
    style: {
      width: "100%",
      // 槽位不一定给出确定高度，所以两个都给：父容器有高度就用 100%，
      // 没有就退到视口高度减掉顶栏/输入区的估值。
      height: "100%",
      minHeight: "70vh",
      border: "0",
      display: "block"
    }
  });
}

// src/client/settings.ts
var import_react13 = require("react");
var UNWIRED_HINT = "\u4E0B\u9762\u8FD9\u4E9B\u9879\u5728 DSH \u91CC\u6539\u5F97\u52A8\u3001\u5199\u5F97\u8FDB\uFF0C\u4F46**\u6574\u673A\u5F53\u524D\u4E0D\u4F1A\u8C03\u7528\u5B83\u4EEC**\uFF1A\u5B83\u4EEC\u539F\u672C\u53EA\u88AB\u5979\u81EA\u5DF1\u7684\u8BBE\u7F6E\u9875\u8BFB\u5199\uFF0C\u6216\u8005\u53EA\u88AB\u300C\u5199\u56DE\u5979\u81EA\u5DF1\u7684 settings.json\u300D\u8FD9\u6761\u5DF2\u5220\u9664\u7684\u94FE\u8DEF\u6D88\u8D39\u3002\u9010\u884C\u7684\u539F\u56E0\u89C1\u6BCF\u4E00\u9879\u4E0B\u9762\u90A3\u884C\u5C0F\u5B57\u3002";
var CREDENTIALS = [
  {
    ref: "MIMO_API_KEY",
    label: "MiMo \u5BC6\u94A5",
    hint: "MiMo \u8BED\u97F3\u5408\u6210\u7528\u3002\u5B83\u5199\u8FDB DSH \u51ED\u636E\u5B58\u50A8\uFF1B\u5BBF\u4E3B\u4FA7\u7684 MiMo \u5408\u6210\u5668\u76EE\u524D\u8FD8\u6CA1\u6709\u63A5\u7EBF\uFF08\u5B83\u53EA\u8BFB\u73AF\u5883\u53D8\u91CF\uFF09\uFF0C\u6240\u4EE5\u73B0\u5728\u586B\u4E86\u4E5F\u4E0D\u4F1A\u6709\u4EBA\u8BFB \u2014\u2014 \u4F46\u90A3\u4E2A\u5408\u6210\u5668\u76EE\u524D\u8FD8\u6CA1\u6709\u8C03\u7528\u70B9\uFF0C\u6240\u4EE5\u5B58\u4E0B\u6765\u6682\u65F6\u4E0D\u4F1A\u53D1\u58F0\uFF08\u89C1\u300C\u8BED\u97F3\u5F15\u64CE\u300D\u90A3\u4E00\u884C\uFF09\u3002",
    placeholder: "MiMo \u63A7\u5236\u53F0\u91CC\u7684\u5BC6\u94A5"
  },
  {
    ref: "MINIMAX_API_KEY",
    label: "MiniMax \u5BC6\u94A5",
    hint: "MiniMax \u4E91\u7AEF\u8BED\u97F3\u7528\u3002\u5BBF\u4E3B\u4FA7\u4F1A\u8BFB\u5B83\u53BB\u8BA4\u9886\u4F60\u5DF2\u6709\u7684\u514B\u9686\uFF08\u53EA\u8BA4\u9886\u3001\u4E0D\u514B\u9686\uFF09\uFF0C\u6CA1\u586B\u5C31\u7528\u4E0D\u4E86\u4E91\u7AEF\u5F15\u64CE\u3002",
    placeholder: "sk-api-\u2026"
  },
  {
    ref: "MINIMAX_PLAN_API_KEY",
    label: "MiniMax \u5957\u9910\u5BC6\u94A5",
    hint: "MiniMax Token \u5957\u9910\uFF08`sk-cp-\u2026`\uFF09\u3002\u540C\u6837\u88AB\u5BBF\u4E3B\u8BFB\u53D6\uFF1B\u4E24\u628A\u90FD\u586B\u65F6\u5408\u6210\u4F18\u5148\u7528\u5957\u9910\u5BC6\u94A5\u3002",
    placeholder: "sk-cp-\u2026"
  },
  {
    ref: "FISH_API_KEY",
    label: "Fish \u5BC6\u94A5",
    hint: "Fish Audio \u4E91\u7AEF\u8BED\u97F3\u7528\uFF08\u300C\u8BED\u97F3\u5F15\u64CE\u300D\u9009 Fish \u65F6\u624D\u8BFB\uFF09\u3002\u586B\u5728\u8FD9\u91CC**\u4F18\u5148**\u4E8E `C:\\herta-ai\\fish_key.txt` \u2014\u2014 \u90A3\u4EFD\u660E\u6587\u53EA\u662F\u6CA1\u586B\u8FD9\u91CC\u7684\u515C\u5E95\u3002",
    placeholder: "Fish Audio \u63A7\u5236\u53F0\u91CC\u7684 API Key"
  }
];
var NETDISK_URL = "https://pan.baidu.com/s/1k-47zy6TTDWl0OaT2WCFUg?pwd=y195";
var ENGINE_META = FIELDS.voiceEngine.engine;
function engineLabel(engine) {
  const value = typeof engine === "string" ? engine : "";
  const labels = FIELDS.voiceEngine.enumLabels ?? {};
  return labels[value] ?? value;
}
var EMPTY_WORKSPACES = Object.freeze([]);
var SECTION_STYLE = { display: "grid", gap: 28, padding: "4px 2px 32px", maxWidth: 720 };
var GROUP_TITLE_STYLE = {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--dsw-alias-label-secondary)",
  letterSpacing: "0.02em"
};
var ROW_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  padding: "10px 0",
  borderTop: "1px solid var(--dsw-alias-border-l1)"
};
var LABEL_STYLE = { fontSize: 13, color: "var(--dsw-alias-label-primary)", lineHeight: "20px" };
var HINT_STYLE = { marginTop: 3, fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: "17px" };
var NOTE_STYLE = { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: "18px" };
var INPUT_STYLE = {
  width: 300,
  maxWidth: "42vw",
  boxSizing: "border-box",
  padding: "5px 9px",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  outline: "none"
};
var SUGGEST_STYLE = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--dsw-alias-brand-primary)",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  textAlign: "left"
};
var UNWIRED_NOTE_STYLE = {
  marginTop: 4,
  fontSize: 12,
  color: "var(--dsw-alias-label-secondary)",
  lineHeight: "17px",
  fontStyle: "italic"
};
var BADGE_STYLE = {
  marginLeft: 8,
  padding: "1px 6px",
  fontSize: 11,
  fontWeight: 400,
  color: "var(--dsw-alias-label-secondary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l1)",
  borderRadius: 4
};
var ACTION_BUTTON_STYLE = {
  padding: "4px 10px",
  fontSize: 12,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  cursor: "pointer"
};
function loadSeedModule(id) {
  return require(id);
}
function createSettingsSection(ui) {
  const { Switch, SegmentedControl } = ui;
  function Row(props) {
    return (0, import_react13.createElement)(
      "div",
      { style: ROW_STYLE },
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        (0, import_react13.createElement)("div", { style: LABEL_STYLE }, props.label),
        props.hint === void 0 ? null : (0, import_react13.createElement)("div", { style: HINT_STYLE }, props.hint),
        // 「暂未接线」的逐行标注。文案来自字段表的 `note`，页面只负责摆位置。
        props.note === void 0 ? null : (0, import_react13.createElement)("div", { style: UNWIRED_NOTE_STYLE }, props.note)
      ),
      (0, import_react13.createElement)("div", { style: { flex: "0 0 auto", paddingTop: 1 } }, props.control)
    );
  }
  function EnumControl(props) {
    const spec = FIELDS[props.field];
    const labels = spec.enumLabels ?? {};
    const options = spec.values.map((value) => ({
      value,
      label: labels[value] ?? value
    }));
    return (0, import_react13.createElement)(SegmentedControl, {
      id: `herta-setting-${props.field}`,
      value: typeof props.value === "string" ? props.value : spec.def,
      options,
      label: spec.label,
      disabled: props.disabled === true,
      onChange: props.onChange
    });
  }
  function NumberControl(props) {
    const spec = FIELDS[props.field];
    const current = typeof props.value === "number" ? props.value : spec.def;
    return (0, import_react13.createElement)(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 10 } },
      (0, import_react13.createElement)("input", {
        type: "range",
        min: spec.min,
        max: spec.max,
        step: spec.step,
        value: current,
        disabled: props.disabled === true,
        "aria-label": spec.label,
        style: { width: 180 },
        onChange: (event) => props.onChange(Number(event.target.value))
      }),
      (0, import_react13.createElement)(
        "span",
        {
          style: {
            fontSize: 12,
            color: "var(--dsw-alias-label-secondary)",
            minWidth: 30,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums"
          }
        },
        String(current)
      )
    );
  }
  function CredentialRow(props) {
    const [status, setStatus] = (0, import_react13.useState)({ kind: "loading" });
    const [draft, setDraft] = (0, import_react13.useState)("");
    const [busy, setBusy] = (0, import_react13.useState)(false);
    const [error, setError] = (0, import_react13.useState)(null);
    const reprobe = (0, import_react13.useCallback)(() => {
      void credentialStatus(props.spec.ref).then((next) => {
        setStatus(next === void 0 ? { kind: "unavailable" } : { kind: "ok", ...next });
      });
    }, [props.spec.ref]);
    (0, import_react13.useEffect)(() => {
      const unsubscribe = subscribeCredentials(reprobe);
      reprobe();
      return unsubscribe;
    }, [reprobe]);
    const save = () => {
      const value = draft.trim();
      if (value.length === 0 || busy) return;
      setBusy(true);
      setError(null);
      void saveCredential(props.spec.ref, value).then((failure) => {
        setBusy(false);
        if (failure !== null) {
          setError(failure);
          return;
        }
        setDraft("");
        reprobe();
      });
    };
    const clear = () => {
      if (busy) return;
      setBusy(true);
      setError(null);
      void clearCredential(props.spec.ref).then((failure) => {
        setBusy(false);
        if (failure !== null) {
          setError(failure);
          return;
        }
        reprobe();
      });
    };
    const badgeText = status.kind === "loading" ? "\u8BFB\u53D6\u4E2D\u2026" : status.kind === "unavailable" ? "\u51ED\u636E\u670D\u52A1\u4E0D\u53EF\u7528" : status.configured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E";
    const canWrite = status.kind === "ok" && status.writable && !busy;
    return (0, import_react13.createElement)(
      "div",
      { style: ROW_STYLE, key: props.spec.ref },
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        (0, import_react13.createElement)(
          "div",
          { style: LABEL_STYLE },
          props.spec.label,
          (0, import_react13.createElement)("span", { style: BADGE_STYLE }, badgeText)
        ),
        (0, import_react13.createElement)("div", { style: HINT_STYLE }, props.spec.hint),
        (0, import_react13.createElement)("div", { style: HINT_STYLE }, `\u5B58\u653E\u4F4D\u7F6E\uFF1ADSH \u51ED\u636E\u5B58\u50A8\uFF08ref = ${props.spec.ref}\uFF09`),
        error === null ? null : (0, import_react13.createElement)("div", { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-error, #c0392b)" } }, error)
      ),
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "0 0 auto", display: "grid", gap: 6, justifyItems: "end" } },
        (0, import_react13.createElement)("input", {
          type: "password",
          value: draft,
          disabled: busy || status.kind === "unavailable",
          spellCheck: false,
          autoComplete: "off",
          placeholder: status.kind === "ok" && status.configured ? "\u5DF2\u5B58\uFF08\u586B\u5165\u5373\u8986\u76D6\uFF09" : props.spec.placeholder,
          "aria-label": props.spec.label,
          style: { ...INPUT_STYLE, width: 220 },
          onChange: (event) => setDraft(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") save();
          }
        }),
        (0, import_react13.createElement)(
          "div",
          { style: { display: "flex", gap: 8 } },
          (0, import_react13.createElement)(
            "button",
            {
              type: "button",
              style: ACTION_BUTTON_STYLE,
              disabled: draft.trim().length === 0 || !canWrite,
              onClick: save
            },
            busy ? "\u5904\u7406\u4E2D\u2026" : "\u4FDD\u5B58"
          ),
          (0, import_react13.createElement)(
            "button",
            {
              type: "button",
              style: ACTION_BUTTON_STYLE,
              disabled: !canWrite || status.kind !== "ok" || !status.configured,
              onClick: clear
            },
            "\u6E05\u9664"
          )
        )
      )
    );
  }
  function VoiceModelRow() {
    const [state, setState] = (0, import_react13.useState)(voiceModelState);
    const [busy, setBusy] = (0, import_react13.useState)(false);
    (0, import_react13.useEffect)(() => {
      const sub = (next) => {
        setState(next ?? null);
      };
      voiceModelSubs.add(sub);
      void refreshVoiceModel().then(() => setState(voiceModelState));
      return () => {
        voiceModelSubs.delete(sub);
      };
    }, []);
    const phase = typeof state?.phase === "string" ? state.phase : "absent";
    const phaseText = phase === "ready" ? "\u5DF2\u5B89\u88C5" : phase === "downloading" ? "\u4E0B\u8F7D\u4E2D\u2026" : phase === "failed" ? `\u4E0A\u6B21\u5931\u8D25\uFF08\u539F\u56E0\uFF1A${String(state?.error ?? "\u672A\u77E5")}\uFF09` : "\u672A\u5B89\u88C5";
    const received = typeof state?.receivedBytes === "number" ? state.receivedBytes : 0;
    const total = typeof state?.totalBytes === "number" ? state.totalBytes : 0;
    const percent = total > 0 ? Math.min(100, Math.round(received / total * 100)) : 0;
    const runtimeReady = state?.runtime?.available === true;
    const act = (action) => {
      if (busy) return;
      setBusy(true);
      void postVoiceModel(action).then(() => {
        setBusy(false);
        setState(voiceModelState);
      });
    };
    return (0, import_react13.createElement)(
      "div",
      { style: ROW_STYLE },
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        (0, import_react13.createElement)("div", { style: LABEL_STYLE }, "\u672C\u5730\u8BED\u97F3\u6A21\u578B"),
        (0, import_react13.createElement)(
          "div",
          { style: HINT_STYLE },
          `\u79BB\u7EBF TTS \u7684\u6A21\u578B\u5F52\u6863\u3002\u72B6\u6001\uFF1A${phaseText}${phase === "downloading" ? `\uFF08${percent}%\uFF0C${Math.round(received / 1048576)} / ${Math.round(total / 1048576)} MB\uFF09` : ""}`
        ),
        (0, import_react13.createElement)(
          "div",
          { style: HINT_STYLE },
          runtimeReady ? "\u8FD0\u884C\u65F6\u5DF2\u5C31\u7EEA\uFF08\u5BBF\u4E3B\u771F\u7684\u52A0\u8F7D\u8FC7 addon \u5E76\u63A2\u6D4B\u901A\u8FC7\uFF09\u3002" : "\u8FD0\u884C\u65F6**\u672A\u5C31\u7EEA** \u2014\u2014 \u5BBF\u4E3B\u63A2\u6D4B addon \u6CA1\u6210\u529F\uFF0C\u6240\u4EE5\u73B0\u5728\u5408\u6210\u4E0D\u51FA\u58F0\u97F3\u3002\u8FD9\u4E0D\u662F\u6309\u94AE\u7684\u95EE\u9898\uFF0C\u662F\u8FD0\u884C\u65F6\u8FD8\u6CA1\u88C5\u597D\u3002"
        )
      ),
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "0 0 auto", display: "flex", gap: 8, paddingTop: 1 } },
        (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase === "downloading" || phase === "ready",
            onClick: () => act("download")
          },
          "\u4E0B\u8F7D"
        ),
        (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase !== "downloading",
            onClick: () => act("cancel")
          },
          "\u53D6\u6D88"
        ),
        (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase === "absent" || phase === "downloading",
            onClick: () => act("remove")
          },
          "\u5220\u9664"
        )
      )
    );
  }
  function VoiceEngineRow(props) {
    const [model, setModel] = (0, import_react13.useState)(voiceModelState);
    const [mini, setMini] = (0, import_react13.useState)(miniMaxState);
    const [busy, setBusy] = (0, import_react13.useState)(false);
    const [result, setResult] = (0, import_react13.useState)(null);
    const [detailOpen, setDetailOpen] = (0, import_react13.useState)(false);
    (0, import_react13.useEffect)(() => {
      const sub = (next) => {
        setModel(next ?? null);
      };
      voiceModelSubs.add(sub);
      void refreshVoiceModel().then(() => setModel(voiceModelState));
      return () => {
        voiceModelSubs.delete(sub);
      };
    }, []);
    (0, import_react13.useEffect)(() => subscribeMiniMax(setMini), []);
    const engine = typeof props.value === "string" ? props.value : String(FIELDS.voiceEngine.def);
    const phase = typeof model?.phase === "string" ? model.phase : "absent";
    const phaseText = phase === "ready" ? "\u5DF2\u5C31\u7EEA\uFF08herta-best-e72\uFF09" : phase === "downloading" ? "\u4E0B\u8F7D\u4E2D\u2026" : phase === "failed" ? "\u4E0A\u6B21\u5B89\u88C5\u5931\u8D25" : "\u672A\u4E0B\u8F7D";
    const runtimeReady = model?.runtime?.available === true;
    const workerState = mini?.localWorker?.state;
    const workerText = workerState === "running" ? "\u5DF2\u9884\u70ED" : workerState === "starting" ? "\u542F\u52A8\u4E2D\u2026" : "\u672A\u542F\u52A8\uFF08\u9996\u6B21\u5408\u6210\u5C31\u5730\u52A0\u8F7D\uFF0C\u7EA6 3 \u79D2\uFF09";
    const chooseEngine = (next) => {
      props.setField("voiceEngine", next);
      if (next === "local") void postMiniMaxAction("warm");
    };
    const preview = () => {
      if (busy) return;
      setBusy(true);
      setResult(null);
      void postMiniMaxAction("preview").then((next) => {
        setBusy(false);
        const out = next?.preview ?? null;
        if (out === null) {
          setResult("\u8BD5\u542C\u6CA1\u6709\u56DE\u6267\uFF1A\u5BBF\u4E3B\u7684\u8BED\u97F3\u5C42\u53EF\u80FD\u6CA1\u6302\u8F7D\uFF08\u770B\u5BBF\u4E3B\u65E5\u5FD7\uFF09\u3002");
          return;
        }
        if (out.ok === true) {
          setResult(`\u8BD5\u542C\u5DF2\u7ECF\u63A8\u7ED9\u754C\u9762\uFF08\u7528 ${engineLabel(out.engine ?? engine)}\uFF09\u3002`);
          return;
        }
        setResult(
          `\u8BD5\u542C\u6CA1\u6709\u51FA\u58F0\uFF1A${typeof out.note === "string" && out.note !== "" ? out.note : "\u539F\u56E0\u672A\u77E5\uFF08\u770B\u5BBF\u4E3B\u65E5\u5FD7\uFF09"}`
        );
      });
    };
    const badge = (text, i) => (0, import_react13.createElement)(
      "span",
      {
        key: `b${i}`,
        style: {
          display: "inline-block",
          padding: "1px 8px",
          borderRadius: 9,
          fontSize: 11,
          lineHeight: "17px",
          background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.14))",
          color: "var(--dsw-alias-label-secondary)",
          whiteSpace: "nowrap"
        }
      },
      text
    );
    const facts = [
      ...ENGINE_META.facts[engine] ?? [],
      // 本机事实：两个云端档也会回落本地，所以这几项对它们同样有用。
      ["\u672C\u5730\u6A21\u578B", phaseText],
      ["\u8FD0\u884C\u65F6", runtimeReady ? "\u53EF\u7528" : "\u7F3A\u5931"],
      ["\u5408\u6210\u8FDB\u7A0B", workerText]
    ];
    const factGrid = (0, import_react13.createElement)(
      "div",
      {
        style: {
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          columnGap: 16,
          rowGap: 10
        }
      },
      ...facts.map(
        ([k, v], i) => (0, import_react13.createElement)(
          "div",
          { key: `f${i}`, style: { minWidth: 0 } },
          (0, import_react13.createElement)(
            "div",
            { style: { fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-secondary)" } },
            k
          ),
          (0, import_react13.createElement)(
            "div",
            { style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-primary)", wordBreak: "break-word" } },
            v
          )
        )
      )
    );
    return (0, import_react13.createElement)(
      "div",
      // 整行改成**纵向三段**，不再「左文字 | 右控件」两列 —— 文字因此拿到整宽，
      // 同样的字数从 6 行降到 1~2 行，右侧控件下方也不会再留空白。
      { style: { display: "block" } },
      // ── ① 标题 + 控件（同一行，垂直居中对齐） ──
      (0, import_react13.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
        (0, import_react13.createElement)(
          "div",
          { style: { ...LABEL_STYLE, flex: "1 1 auto", minWidth: 0 } },
          FIELDS.voiceEngine.label
        ),
        (0, import_react13.createElement)(EnumControl, {
          field: "voiceEngine",
          value: props.value,
          disabled: props.disabled === true,
          onChange: chooseEngine
        }),
        (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || props.disabled === true,
            onClick: preview
          },
          busy ? "\u8BD5\u542C\u4E2D\u2026" : "\u8BD5\u542C"
        ),
        props.muted ? (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: props.disabled === true,
            onClick: () => props.setField("voiceMuted", false)
          },
          "\u53D6\u6D88\u9759\u97F3"
        ) : null
      ),
      // ── ② 徽章摘要 + 「详情」开关（整宽一行） ──
      (0, import_react13.createElement)(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--dsw-alias-border-l)"
          }
        },
        ...(ENGINE_META.badges[engine] ?? []).map(badge),
        (0, import_react13.createElement)(
          "span",
          { style: { ...HINT_STYLE, marginTop: 0, flex: "1 1 auto", minWidth: 0 } },
          ENGINE_META.summary[engine] ?? ""
        ),
        (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: {
              ...ACTION_BUTTON_STYLE,
              padding: "2px 8px",
              fontSize: 12
            },
            onClick: () => setDetailOpen((v) => !v)
          },
          detailOpen ? "\u6536\u8D77\u8BE6\u60C5" : "\u8BE6\u60C5"
        )
      ),
      // ── ③ 展开后的事实网格 ──
      detailOpen ? factGrid : null,
      props.muted ? (0, import_react13.createElement)(
        "div",
        { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-warning, #b7791f)" } },
        "\u5F53\u524D\u662F\u9759\u97F3\uFF0C\u8BD5\u542C\u4E0D\u4F1A\u51FA\u58F0\u3002"
      ) : null,
      result === null ? null : (0, import_react13.createElement)("div", { style: HINT_STYLE }, result)
    );
  }
  function MiniMaxVoiceRow() {
    const [state, setState] = (0, import_react13.useState)(miniMaxState);
    const [busy, setBusy] = (0, import_react13.useState)(false);
    (0, import_react13.useEffect)(() => {
      return subscribeMiniMax(setState);
    }, []);
    const engine = typeof state?.engine === "string" ? state.engine : "\u672A\u77E5";
    const engineNote = typeof state?.engineReason === "string" && state.engineReason !== "" ? state.engineReason : null;
    const keyKnown = state?.keyKnown === true;
    const voice = state?.voice ?? {};
    const synth = state?.synth ?? {};
    const pipeline = state?.pipeline ?? {};
    const maxTurnChars = typeof state?.maxTurnChars === "number" ? state.maxTurnChars : null;
    const clients = typeof state?.clients === "number" ? state.clients : null;
    const phase = typeof voice.phase === "string" ? voice.phase : "absent";
    const phaseText = phase === "ready" ? `\u5DF2\u8BA4\u9886\uFF1A${String(voice.voiceId ?? "\uFF08\u6CA1\u6709 id\uFF09")} @ ${String(voice.host ?? "\u672A\u77E5\u7AEF\u70B9")}` : phase === "preparing" ? "\u8BA4\u9886\u4E2D\u2026" : phase === "failed" ? `\u8BA4\u9886\u5931\u8D25\uFF1A${miniMaxErrorText(voice.lastError)}` : "\u8FD8\u6CA1\u6709\u8BA4\u9886\uFF08\u6216\u5BC6\u94A5\u8FD8\u6CA1\u586B\uFF09";
    const retryText = phase === "failed" ? miniMaxRetryText(voice.retryAt) : null;
    const adopt = () => {
      if (busy) return;
      setBusy(true);
      void postMiniMaxAction("adopt").then((next) => {
        setBusy(false);
        setState(next);
      });
    };
    return (0, import_react13.createElement)(
      "div",
      { style: ROW_STYLE },
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        (0, import_react13.createElement)("div", { style: LABEL_STYLE }, "MiniMax \u8BED\u97F3"),
        (0, import_react13.createElement)(
          "div",
          { style: HINT_STYLE },
          `\u5F53\u524D\u5F15\u64CE\uFF1A${engineLabel(engine)}\u3000\xB7\u3000\u5BC6\u94A5\uFF1A${keyKnown ? "\u5DF2\u586B" : "\u672A\u586B"}`
        ),
        // 「语音状态」要显式说 —— 否则用户只会觉得"她的声音变了"，说不出为什么。
        // 措辞必须中性：fish 明确不回落，写成「已回落：Fish Audio 不可用…」会自相矛盾。
        engineNote === null ? null : (0, import_react13.createElement)(
          "div",
          { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-warning, #b7791f)" } },
          `\u8BED\u97F3\u72B6\u6001\uFF1A${engineNote}`
        ),
        (0, import_react13.createElement)("div", { style: HINT_STYLE }, phaseText),
        retryText === null ? null : (0, import_react13.createElement)("div", { style: HINT_STYLE }, `\u4E0B\u6B21\u53EF\u91CD\u8BD5\uFF1A${retryText}`),
        synth.refusal === null || synth.refusal === void 0 ? null : (0, import_react13.createElement)("div", { style: HINT_STYLE }, `MiniMax \u62D2\u7EDD\uFF1A${miniMaxErrorText(synth.refusal)}`),
        synth.lastFailure === null || synth.lastFailure === void 0 ? null : (0, import_react13.createElement)(
          "div",
          { style: HINT_STYLE },
          `\u4E0A\u6B21\u5408\u6210\u5931\u8D25\uFF1A${miniMaxErrorText(synth.lastFailure)}\uFF08\u5728\u98DE ${String(synth.inFlight ?? 0)}\uFF09`
        ),
        (0, import_react13.createElement)(
          "div",
          { style: HINT_STYLE },
          `\u6BCF\u8F6E\u4E0A\u9650\uFF1A${maxTurnChars === null ? "\u672A\u77E5" : `${maxTurnChars} \u5B57`}\u3000\xB7\u3000\u5DF2\u5230\u4E0A\u9650\u7684\u8F6E\u6570\uFF1A${String(pipeline.cappedUtterances ?? 0)}\u3000\xB7\u3000SSE \u5BA2\u6237\u7AEF\uFF1A${clients === null ? "\u672A\u77E5" : clients}` + (pipeline.lastCap ? `\u3000\xB7\u3000\u26A0\uFE0F \u4E0A\u4E00\u8F6E\u592A\u957F\uFF1A\u53EA\u5FF5\u4E86\u524D ~${String(pipeline.lastCap.spokenChars)} \u5B57\uFF08\u4E0A\u9650 ${String(pipeline.lastCap.limit)} \u5B57\uFF09\uFF0C\u540E\u9762\u7684\u5185\u5BB9\u53EA\u663E\u793A\u3001\u6CA1\u53D1\u58F0` : "") + (voice?.billedCharsTotal ? `\u3000\xB7\u3000\u5DF2\u8BA1\u8D39 ${String(voice.billedCharsTotal)} \u5B57` : "")
        )
      ),
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "0 0 auto", paddingTop: 1 } },
        (0, import_react13.createElement)(
          "button",
          { type: "button", style: ACTION_BUTTON_STYLE, disabled: busy, onClick: adopt },
          busy ? "\u8BA4\u9886\u4E2D\u2026" : "\u91CD\u65B0\u8BA4\u9886"
        )
      )
    );
  }
  function NetdiskRow() {
    return (0, import_react13.createElement)(
      "div",
      { style: ROW_STYLE },
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        (0, import_react13.createElement)("div", { style: LABEL_STYLE }, "\u5B89\u88C5\u5305\u7F51\u76D8"),
        (0, import_react13.createElement)(
          "div",
          { style: HINT_STYLE },
          "\u6574\u673A\u5B89\u88C5\u5305\u7684\u7F51\u76D8\u955C\u50CF\uFF08\u7F51\u7EDC\u5230\u4E0D\u4E86 GitHub \u65F6\u7528\uFF09\u3002**\u4E0D\u542B\u8BED\u97F3\u6A21\u578B**\uFF08\u6A21\u578B\u53EA\u80FD\u4ECE GitHub \u4E0B\uFF09\u3002\u5728\u65B0\u6807\u7B7E\u9875\u91CC\u6253\u5F00\u3002"
        )
      ),
      (0, import_react13.createElement)(
        "div",
        { style: { flex: "0 0 auto", paddingTop: 1 } },
        (0, import_react13.createElement)(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            onClick: () => {
              window.open(NETDISK_URL, "_blank", "noopener,noreferrer");
            }
          },
          "\u6253\u5F00\u7F51\u76D8"
        )
      )
    );
  }
  function WorkspacePicker(props) {
    const items = props.useWorkspaces((snapshot) => snapshot?.items ?? EMPTY_WORKSPACES);
    if (!Array.isArray(items) || items.length === 0) return null;
    return (0, import_react13.createElement)(
      "div",
      { style: { marginTop: 8, display: "grid", gap: 4 } },
      (0, import_react13.createElement)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "\u4ECE DSH \u5DF2\u767B\u8BB0\u7684\u5DE5\u4F5C\u533A\u91CC\u9009\uFF1A"),
      ...items.filter((item) => typeof item?.path === "string").slice(0, 8).map(
        (item) => (0, import_react13.createElement)(
          "button",
          {
            key: item.path,
            type: "button",
            style: SUGGEST_STYLE,
            disabled: props.disabled === true,
            onClick: () => props.onPick(item.path)
          },
          `${item.title ?? item.path} \u2014 ${item.path}`
        )
      )
    );
  }
  function WorkspaceInput(props) {
    const [draft, setDraft] = (0, import_react13.useState)(props.value);
    (0, import_react13.useEffect)(() => {
      setDraft(props.value);
    }, [props.value]);
    return (0, import_react13.createElement)(
      "div",
      null,
      (0, import_react13.createElement)("input", {
        type: "text",
        value: draft,
        disabled: props.disabled === true,
        spellCheck: false,
        placeholder: props.placeholder ?? "\u4F8B\u5982 D:\\\u9879\u76EE\\\u6211\u7684\u4ED3\u5E93",
        style: INPUT_STYLE,
        onChange: (event) => setDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") props.onCommit(draft);
        },
        onBlur: () => {
          if (draft !== props.value) props.onCommit(draft);
        }
      }),
      props.useWorkspaces === void 0 ? null : (0, import_react13.createElement)(WorkspacePicker, {
        useWorkspaces: props.useWorkspaces,
        disabled: props.disabled,
        onPick: (path) => {
          setDraft(path);
          props.onCommit(path);
        }
      })
    );
  }
  return function HertaSettingsSection(props) {
    const snapshot = typeof props.useHertaMachine === "function" ? props.useHertaMachine((s) => s) : void 0;
    const values = (0, import_react13.useMemo)(() => normalizeSettings(snapshot?.value), [snapshot]);
    const header = (0, import_react13.createElement)(
      "div",
      null,
      (0, import_react13.createElement)("div", { style: { fontSize: 15, fontWeight: 600, marginBottom: 6 } }, "\u9ED1\u5854"),
      (0, import_react13.createElement)(
        "div",
        { style: NOTE_STYLE },
        "\u9ED1\u5854\u7684\u8BBE\u7F6E**\u53EA\u6709\u8FD9\u4E00\u5904**\u3002\u5979\u7684\u6574\u673A\u754C\u9762\u91CC\u90A3\u5957\u8BBE\u7F6E\u9762\u677F\u5DF2\u7ECF\u5220\u9664\uFF0C\u6240\u4EE5\u8FD9\u91CC\u6539\u7684\u503C\u5C31\u662F\u5979\u8BFB\u5230\u7684\u503C\u3002"
      ),
      (0, import_react13.createElement)(
        "div",
        { style: NOTE_STYLE },
        "\u5199\u5165\u843D\u8FDB DSH \u7684 profile \u914D\u7F6E\uFF08`cordis.patch.yml` \u7684 `herta` \u6761\u76EE\uFF09\u3002\u5BC6\u94A5\u662F\u552F\u4E00\u7684\u4F8B\u5916\uFF1A\u5B83\u4EEC\u8FDB DSH \u7684\u51ED\u636E\u5B58\u50A8\uFF0C\u4E0D\u8FDB\u8FD9\u4EFD\u660E\u6587\u914D\u7F6E\u3002"
      )
    );
    if (snapshot?.status !== "ready") {
      const why = snapshot?.status === "unavailable" ? "\u5BBF\u4E3B\u6CA1\u6709\u5411\u8FD9\u4E2A\u9875\u9762\u63D0\u4F9B\u8BBE\u7F6E\uFF08\u53EF\u80FD\u5F53\u524D\u90E8\u7F72\u628A\u8BBE\u7F6E\u5B58\u5728\u672C\u5730\uFF09\u3002" : "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026";
      return (0, import_react13.createElement)("div", { style: SECTION_STYLE }, header, (0, import_react13.createElement)("div", { style: NOTE_STYLE }, why));
    }
    const disabled = snapshot.writable === false;
    const setField = (field, value) => props.setHertaField?.(field, value);
    const fieldRow = (field) => {
      const spec = FIELDS[field];
      const value = values[field];
      if (spec.widget === "engineRow") {
        return (0, import_react13.createElement)(VoiceEngineRow, {
          key: field,
          value,
          disabled,
          muted: values.voiceMuted === true,
          setField
        });
      }
      let control;
      if (spec.kind === "boolean") {
        control = (0, import_react13.createElement)(Switch, {
          checked: value === true,
          label: spec.label,
          disabled,
          onChange: (next) => setField(field, next)
        });
      } else if (spec.kind === "enum") {
        control = (0, import_react13.createElement)(EnumControl, {
          field,
          value,
          disabled,
          onChange: (next) => setField(field, next)
        });
      } else if (spec.kind === "number") {
        control = (0, import_react13.createElement)(NumberControl, {
          field,
          value,
          disabled,
          onChange: (next) => setField(field, next)
        });
      } else {
        control = (0, import_react13.createElement)(WorkspaceInput, {
          value: typeof value === "string" ? value : "",
          disabled,
          onCommit: (next) => setField(field, next),
          // `kind: "text"` 用字段自己的占位符；其余（`path`）保持原样。
          placeholder: typeof spec.placeholder === "string" ? spec.placeholder : void 0,
          // 只有路径字段才给工作区选择器 —— 模型 ID 那一类看了会莫名其妙。
          useWorkspaces: spec.kind === "path" ? props.useWorkspaces : void 0
        });
      }
      return (0, import_react13.createElement)(Row, {
        key: field,
        label: spec.label,
        hint: spec.hint,
        // 「暂未接线」的逐行原因来自字段表本身（`FIELDS[field].note`）——
        // 页面不抄第二遍，所以字段表改了这里跟着改。
        note: typeof spec.note === "string" ? spec.note : void 0,
        control
      });
    };
    const group = (title, hint, rows) => (0, import_react13.createElement)(
      "section",
      { key: title },
      (0, import_react13.createElement)("h3", { style: GROUP_TITLE_STYLE }, title),
      hint === void 0 ? null : (0, import_react13.createElement)("div", { style: { ...NOTE_STYLE, marginTop: -6, marginBottom: 6 } }, hint),
      ...rows
    );
    const GROUP_TRAILERS = {
      "minimax-voice": MiniMaxVoiceRow
    };
    const wiredGroups = SETTINGS_GROUPS.map((entry) => {
      const trailer = GROUP_TRAILERS[entry.trailer ?? ""];
      const rows = entry.fields.map(fieldRow);
      return group(
        entry.title,
        entry.hint,
        // 「语音」那一栏末尾多一行宿主事实（认领状态 + 重新认领）。它**不是**设置
        // 字段，所以不来自字段表；挂在组尾是因为它讲的是上面那几行的**后果**
        // （谁在说话、为什么回落、到没到上限）—— 先选，再看状态。
        trailer === void 0 ? rows : [...rows, (0, import_react13.createElement)(trailer, { key: entry.trailer })]
      );
    });
    const credentialsGroup = group(
      "\u5BC6\u94A5",
      "\u5BC6\u94A5\u5B58\u8FDB DSH \u7684\u51ED\u636E\u5B58\u50A8\uFF08`$DSH_HOME/.credentials.yaml`\uFF0C\u6743\u9650 0600\uFF09\uFF0C\u4E0D\u5199\u8FDB profile \u7684\u660E\u6587\u914D\u7F6E\u3002\u4E0A\u9762\u90A3\u884C\u72B6\u6001\u8BFB\u7684\u662F\u5BBF\u4E3B\u7684\u4E8B\u5B9E\uFF0C\u4E0D\u662F\u672C\u5730\u7684\u4E50\u89C2\u503C\u3002",
      CREDENTIALS.map((spec) => (0, import_react13.createElement)(CredentialRow, { key: spec.ref, spec }))
    );
    const actionsGroup = group(
      "\u6574\u673A\u52A8\u4F5C",
      "\u4E0B\u9762\u4E24\u4E2A\u90FD\u662F**\u771F\u52A8\u4F5C**\uFF1A\u5BBF\u4E3B\u4FA7\u7684\u5B9E\u73B0\u5DF2\u7ECF\u5B58\u5728\uFF0C\u6309\u4E0B\u53BB\u4F1A\u6709\u5B9E\u9645\u540E\u679C\u3002",
      [(0, import_react13.createElement)(VoiceModelRow, { key: "voice-model" }), (0, import_react13.createElement)(NetdiskRow, { key: "netdisk" })]
    );
    const unwiredGroup = group("\u6682\u672A\u63A5\u7EBF", UNWIRED_HINT, UNWIRED_FIELD_NAMES.map(fieldRow));
    return (0, import_react13.createElement)(
      "div",
      { style: SECTION_STYLE },
      header,
      ...wiredGroups,
      credentialsGroup,
      actionsGroup,
      unwiredGroup
    );
  };
}

// src/client/index.tsx
var name = "herta";
var inject = ["uiConversation", "slots"];
var VIEW_ID = "herta";
var FULL_VIEW_ID = "herta-full";
var MACHINE_NS = SETTINGS_NAMESPACE;
function installSettingsSection(ctx, mark) {
  watchCredentials(ctx, mark);
  ctx.inject(["configForms", "slots"], (scoped) => {
    const form = scoped.configForms.get(MACHINE_NS);
    bindMachineForm(form);
    mark.settingsBound = true;
    mark.settingsNamespace = MACHINE_NS;
    let Component;
    try {
      const ui = loadSeedModule("@deepseek-ai/dsh-client-ui-primitives");
      if (typeof ui?.Switch !== "function" || typeof ui?.SegmentedControl !== "function") {
        throw new Error(`\u539F\u8BED\u6A21\u5757\u7F3A\u5C11 Switch / SegmentedControl\uFF08\u62FF\u5230\u7684\u662F ${Object.keys(ui ?? {}).slice(0, 8).join(", ") || "\u7A7A\u5BF9\u8C61"}\uFF09`);
      }
      Component = createSettingsSection(ui);
    } catch (error) {
      mark.settingsSectionError = String(error?.message ?? error);
      console.log(`[dsh-herta] \u8BBE\u7F6E\u9875\u672A\u6302\u8F7D\uFF1A${String(error?.message ?? error)}`);
      return;
    }
    scoped.effect(
      () => (
        // `slots.inject` 而不是裸 register：`settings.section` 这个槽是由
        // ui-settings-general 的 `sidebar.settings` 一并声明的，不等声明到位
        // 就 register 会静默落空。inject 会在槽坍塌时自动撤下贡献。
        scoped.slots.inject(
          "settings.section",
          () => scoped.slots.register(
            {
              name: "settings.section",
              id: MACHINE_NS,
              // account(-10) / general(0) / models(10) / plugins(15) / agent-presets(20)
              order: 30,
              label: () => "\u9ED1\u5854",
              inject: () => ({
                hooks: { hertaMachine: form },
                setHertaField: (field, value) => {
                  void writeMachineField2(field, value);
                }
              })
            },
            Component
          )
        )
      ),
      "dsh-herta: settings section"
    );
    mark.settingsSectionRegistered = true;
  });
}
function apply(ctx) {
  const mark = {
    applyRan: true,
    slotsResolved: true,
    viewRegistered: false,
    viewMounted: false,
    viewId: VIEW_ID,
    plugin: name
  };
  globalThis.__DSH_HERTA__ = mark;
  installSettingsSection(ctx, mark);
  ctx.effect?.(() => startMiniMaxStream(), "dsh-herta: MiniMax PCM \u6D41");
  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: VIEW_ID,
        order: 20,
        label: () => "\u9ED1\u5854",
        // 首个订阅会激活 chat target；此后它随会话常驻。
        inject: (sessionId) => ({
          hooks: { hertaChat: ctx.uiConversation.binding(sessionId).target("chat") }
        })
      },
      HertaView
    );
    mark.viewRegistered = true;
    return disposer;
  });
  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: FULL_VIEW_ID,
        order: 30,
        label: () => "\u9ED1\u5854\xB7\u6574\u673A",
        // `sessionId` 由会话作用域的槽自带，不用 inject 再返回一次。
        inject: (sessionId) => ({
          hooks: { hertaChat: ctx.uiConversation.binding(sessionId).target("chat") }
        })
      },
      HertaFullView
    );
    mark.fullViewRegistered = true;
    return disposer;
  });
}
return module.exports;
}});
