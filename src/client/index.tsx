/**
 * dsh-herta 的 client（浏览器）半侧。
 *
 * 里程碑 3：把 DSH 的真实会话数据接进 Herta 的渲染组件。
 *
 * 数据来自官方扩展点，不是猜的：
 *   ctx.uiConversation.binding(sessionId)      → ConversationBinding
 *     .target('chat')                          → ObservableSnapshot<ChatSnapshot>
 *       .legacy.nodes                          → readonly ConversationNode[]
 *
 * `binding().target(id)` 是 `ConversationBinding` 的公开方法
 * （ui-conversation/src/client/conversation/assembly.ts:27-44）：第一个订阅者
 * 会激活该 target，之后它随会话生命周期常驻。所以我的视图可以在「对话」页签
 * 没被选中时也读到同一份组装结果。
 *
 * 组件拿数据的方式是 `inject` 返回的 `hooks` 隔间：里面每个 name 会被渲染器绑成
 * 一个 `use<Name>` 选择器钩子（ui-slots/src/renderer.ts:75-76），组件永远看不到
 * 订阅机制本身 —— 这是 DSH 客户端「业务组件不含订阅机器」那条硬规则。
 *
 * 样式仍然关在 shadow root 里，理由见 scripts/build.mjs 的 CSS 转换说明。
 */
// 本文件不再直接渲染气泡或持有字段表：设置页在 `settings.ts`、视图与面板在
// `ui.ts`、语音在 `voice.ts`，字段表与宿主共用 `../host/settings-schema.js`。
// 这里只留装配需要的东西 —— 2026-10-17 删整机视图之后，原先那串 react/@gui
// import 已全部没人用（esbuild 本来也会摇掉，留着只会误导）。
import { SETTINGS_NAMESPACE } from "../host/settings-schema.js";

/** Cordis 插件名，与 cordis.patch.yml 里的 loader 条目 id 一致。 */
const name = "herta";

/** 客户端服务：槽位注册表 + Conversation 组装。 */
const inject = ["uiConversation", "slots"];

/**
 * 视图 id：`conversation.view` 槽内的唯一键。
 * 壳会把用户选中的视图偏好按这个 id 持久化，所以改它等于换一个页签。
 */
const VIEW_ID = "herta";

/**
 * 设置命名空间 = 宿主那条 profile 条目的 id。
 *
 * 从 `settings-schema.js` import（**不是**在客户端重写一遍字面量）：那个模块
 * 零 import，esbuild 直接内联，与 `FIELDS` 走同一条路。客户端包不得依赖**宿主包**，
 * 但共享的纯数据模块可以 —— 这也是 2026-10-03 之前那段注释自相矛盾的地方：
 * 它一边说「不 import 宿主模块」，一边这个文件已经在 import 同一份字段表。
 *
 * 两处必须是同一个字符串（宿主 `HERTA_SETTINGS_NAMESPACE` 也从这里取），
 * 否则客户端拿到 undefined：设置页空白、写入静默无效。测试钉着这条。
 */
const MACHINE_NS = SETTINGS_NAMESPACE;

/** `ctx.configForms.get(ns)` 返回的那张表单（只列本文件用到的成员）。 */
// 「机器」那一层（设置表单 / 凭据服务 / 机器字段）已拆到独立文件（#2 第一步）。
import {
  bindMachineForm,
  setFormValueListener,
  watchCredentials,
  writeMachineField,
  type MachineForm,
} from "./machine.js";


/**
 * 设置命名空间与 DSH 设置页共享同一份表单：写入落进 profile 的
 * `cordis.patch.yml`，设置页与插件内的读取方永远同值。
 */

/**
 * 本地语音模型（离线 TTS）状态页面在设置页里读 —— 宿主侧 `/herta-voice-model`
 * 的镜像由 `voice.ts` 维护；本文件不再持有 iframe 那条同步应答的缓存。
 */
// 「语音」那一层（SSE / PCM / 播放 / 音色状态）已拆到独立文件（#2 第二步）。
import {
  applyMuteNow,
  startMiniMaxStream,
} from "./voice.js";


/** 从 DSH 的 ContentBlock[] 里取纯文本；图片/文件/工具块这一版先不处理。 */
/** DSH 把生效主题写在 documentElement 的 inline colorScheme 上（ui-theme/boot-theme.ts:19）。 */
// 「界面」那一层（面板 / 视图 / 气泡 / 点击朗读）已拆到独立文件（#2 第三步）。
import {
  HertaView,
  notifyMuteChanged,
} from "./ui.js";


// ── 设置页：「Herta」（`settings.section` 的独立一页）──────────────────────────
//
// 为什么是独立一页而不是靠 schema 自动生成：
//   · 这一页有十几项、分几组，自动表单一长条读不动；
//   · 枚举项（语言、主题、引擎、模型）要的是分段选择器，不是文本框；
//   · 「工作区」那组还要说明「留空 = 不同步」，那是文案不是 schema 能表达的。
// 宿主侧因此声明了 `configure({auto:false})`（与所有官方自带页插件一致），
// 免得将来某个客户端按 schema 生成页时多出一页。
//
// 页面**不自持状态**：值全部来自 `ctx.configForms.get("herta")` 的快照，
// 写入直接 `form.set(field, value)`（它自己带 revision 栅栏、串行化、失败重读）。
// 乐观更新是没必要的 —— 宿主接受后镜像会自己推进一帧。

// 分组表、枚举中文、行内提示、引擎行逐档文案**都在字段描述符里**
// （`src/host/settings-schema.js`），本文件 2026-10-03 之前那六张平行表
// （`ENUM_LABELS` / `FIELD_HINTS` / `ENGINE_NOTES|BADGES|SUMMARY|FACTS`）已删除。
// 教训：`voiceEngine` / `realtimeVoice` 被标成 `wired: true` 之后从「暂未接线」组
// 掉出去、又没人加进分组表 —— 两个字段在页面上**一行都不渲染**；`theme` /
// `deviceScene` 摘出分组时两边名单不同步，**渲染了两遍**。现在一处声明。

/**
 * 「暂未接线」那一组的说明。逐行的原因写在字段表的 `note` 里 ——
 * 那是「谁该读它、现在缺什么」的备忘，不是免责声明。
 */
// 「设置页」那一层（字段表 / 样式 / 各行 / 整个表单）已拆到独立文件（#2 第四步）。
import {
  createSettingsSection,
  loadSeedModule,
} from "./settings.js";


/**
 * 绑定设置表单并挂上「Herta」设置页。
 *
 * 三件事都是**惰性**的，这是有意的：
 *   · `ctx.inject(["configForms","slots"], …)` 而不是写进 `inject` 数组 ——
 *     没有设置 UI 的组合（无头 / SDK）里这两个服务不存在，硬依赖会让
 *     整个客户端插件永不挂载，连她的对话页签一起没。
 *   · 凭据缝既不进 `inject` 数组、**也不用 `inject` 取**：它是握手之后挂到
 *     `remote` 上的命名空间，注入时机的行为实测不可靠（见 `resolveCredentials`）。
 *     走 `ctx.get("remote.credentials")` + 有界轮询，缺席时只是密钥那几行显示
 *     「不可用」，其余设置照常可用。
 *   · 原语用动态 import —— 解析失败只损失这一页，不影响其余界面。
 *
 * @param ctx - 客户端 cordis 上下文（`inject` + 服务解析）。
 * @param mark - 诊断标记对象（DSH 不把客户端上下文暴露到 window）。
 */
function installSettingsSection(
  ctx: {
    inject(names: readonly string[], callback: (scoped: any) => unknown): unknown;
    /** cordis 的服务解析（凭据缝靠它取，见 `resolveCredentials`）。 */
    get?(name: string): unknown;
    remote?: unknown;
    effect?(callback: () => unknown, label?: string): unknown;
  },
  mark: Record<string, unknown>,
): void {
  // 凭据缝：**不用 inject**（实测不可靠，见 `resolveCredentials` 的注释），
  // 改成有界轮询 `ctx.get("remote.credentials")`。服务缺席时它永远保持 null ——
  // 页面把密钥行显示成「不可用」并给出原因，而不是假装能用。
  watchCredentials(ctx, mark);

  ctx.inject(["configForms", "slots"], (scoped) => {
    const form = scoped.configForms.get(MACHINE_NS) as MachineForm;
    bindMachineForm(form);
    mark.settingsBound = true;
    mark.settingsNamespace = MACHINE_NS;

    // ── 静音立刻生效（2026-10-10：用户反馈「要等她念完当前这句才停」）──────────
    //
    // 装配在这里是有原因的：这一层**同时**认识设置表单（`machine`）与语音层
    // （`voice`），而那两个互不认识 —— 让它们直接互相 import 会绕出一圈循环依赖。
    // 谁把两者接到一起，谁就住在这儿。
    //
    // 只认 `voiceMuted` 这一个字段：监听器每次拿到的都是"**真的变了**"的字段名
    // （见 `onFormChanged`），所以动别的设置不会误掐她正在念的那一句。
    setFormValueListener((changed) => {
      if (!changed.includes("voiceMuted")) return;
      // ① 立刻闭嘴：增益归零 + 停掉已排的源。
      applyMuteNow();
      // ② 工具条那个按钮只是**镜像**（真相在设置里），得让它把标签换过来 ——
      //    设置页改的、宿主回写的，都要同步。
      notifyMuteChanged();
    });
    // 表单绑定那一刻先对一次：静音**本来就是开着的**时，增益也该当场归零
    // （比如刚重启应用，而设置里一直存着静音）。
    applyMuteNow();

    // 原语走模块加载器（见 `loadSeedModule` 的注释）；拿不到就只损失这一页。
    let Component: unknown;
    try {
      const ui = loadSeedModule("@deepseek-ai/dsh-client-ui-primitives");
      if (typeof ui?.Switch !== "function" || typeof ui?.SegmentedControl !== "function") {
        throw new Error(`原语模块缺少 Switch / SegmentedControl（拿到的是 ${Object.keys(ui ?? {}).slice(0, 8).join(", ") || "空对象"}）`);
      }
      Component = createSettingsSection(ui);
    } catch (error) {
      mark.settingsSectionError = String((error as Error)?.message ?? error);
      console.log(`[dsh-herta] 设置页未挂载：${String((error as Error)?.message ?? error)}`);
      return;
    }

    scoped.effect(
      () =>
        // `slots.inject` 而不是裸 register：`settings.section` 这个槽是由
        // ui-settings-general 的 `sidebar.settings` 一并声明的，不等声明到位
        // 就 register 会静默落空。inject 会在槽坍塌时自动撤下贡献。
        scoped.slots.inject("settings.section", () =>
          scoped.slots.register(
            {
              name: "settings.section",
              id: MACHINE_NS,
              // account(-10) / general(0) / models(10) / plugins(15) / agent-presets(20)
              order: 30,
              label: () => "Herta",
              inject: () => ({
                hooks: { hertaMachine: form },
                setHertaField: (field: string, value: unknown) => {
                  void writeMachineField(field, value);
                },
              }),
            },
            Component,
          ),
        ),
      "dsh-herta: settings section",
    );
    mark.settingsSectionRegistered = true;
  });
}

/**
 * 注册视图。
 *
 * `slots.inject(name, register)` 是 DSH 唯一支持的组合方式（见仓库
 * `packages/client/AGENTS.md` 的「Slot and props discipline」第 1 条）：
 * 它等真正的槽声明出现，槽坍塌时自动撤下贡献，重声明后重跑，
 * 并且随调用方插件的 fiber 一起释放。
 */
function apply(ctx: {
  uiConversation: { binding(sessionId: string): { target(id: string): unknown } };
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(options: Record<string, unknown>, component: unknown): unknown;
  };
  /** 按需注入一个服务（服务缺席时回调不触发，不会卡住已注册的视图）。 */
  inject(names: readonly string[], callback: (scoped: any) => unknown): unknown;
  /**
   * 登记一个随插件 fiber 释放的副作用（回调返回退订函数）。
   *
   * MiniMax 的 SSE 订阅用它：插件卸载时连接必须跟着关，否则每挂一次就留一条
   * 永不关闭的 `EventSource`（浏览器对同源并发连接数是有限的）。
   */
  effect?(callback: () => unknown, label?: string): unknown;
}): void {
  // 诊断标记。DSH 不把客户端的 cordis 上下文暴露到 window，所以这是从外部
  // （无头浏览器 / CDP）确认插件走到哪一步的唯一可靠信号。
  const mark: Record<string, unknown> = {
    applyRan: true,
    slotsResolved: true,
    viewRegistered: false,
    viewMounted: false,
    viewId: VIEW_ID,
    plugin: name,
  };
  (globalThis as Record<string, unknown>).__DSH_HERTA__ = mark;

  // 设置：绑定 DSH 的设置表单 + 在设置里挂上「Herta」一页。
  // 语音层与设置页读的是同一份表单，所以两处永远同值。
  installSettingsSection(ctx, mark);

  // MiniMax 的 PCM 流：**插件级订阅**，不是某个视图里的订阅。
  //
  // 理由：声音该在用户停在任何页签时都响。挂在对话视图里的话，切走页签就哑了 ——
  // 那正是「这功能只在开着某个页签时有效」的毛病。这里的退订随插件 fiber 释放
  // （`ctx.effect`），页面卸载时连接跟着关掉。
  ctx.effect?.(() => startMiniMaxStream(), "dsh-herta: MiniMax PCM 流");

  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: VIEW_ID,
        order: 20,
        label: () => "Herta",
        // 首个订阅会激活 chat target；此后它随会话常驻。
        inject: (sessionId: string) => ({
          hooks: { hertaChat: ctx.uiConversation.binding(sessionId).target("chat") },
        }),
      },
      HertaView,
    );
    mark.viewRegistered = true;
    return disposer;
  });
}

export { apply, inject, name };
