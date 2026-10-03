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
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HertaBubble } from "@gui/components/Workspace/HertaBubble";
import { UserBubble } from "@gui/components/Workspace/UserBubble";
import { LocaleProvider } from "@gui/i18n/LocaleProvider";
import hertaCss from "@gui/styles/reference-ux.css";
// 两个方向的映射都在共享模块里（纯函数，Node 里可直接单测：
// scripts/test-mapping.mjs）。客户端只负责订阅与渲染。
import { fullSnapshot, nodesToRecord, toBubbles } from "../shared/mapping.js";
// 语音偏好：默认值、归一化、iframe 要的 RealtimeVoiceState 都由这个纯模块给出
// —— 与宿主侧 `src/host/voice-settings.js` 共用同一份，而它无 import，
// 所以既能 Node 单测，也能被 esbuild 打进这份 bundle。
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
// 设置字段表：与宿主**同一份**（无 import 的纯数据模块，esbuild 直接内联）。
// 页面的标签、枚举选项、默认值、「哪些字段整机真的会读」、**展示元数据**
// （分组归属 / 枚举中文 / 行内提示 / 引擎行逐档文案）全部从它读 ——
// 客户端不再自持第二份字段清单或展示表（2026-10-03 收编，原先散着六张）。
import {
  FIELDS,
  normalizeSettings,
  SETTINGS_GROUPS,
  SETTINGS_NAMESPACE,
  UNWIRED_FIELD_NAMES,
} from "../host/settings-schema.js";
// MiniMax 语音的两件纯逻辑：base64 → Int16 PCM 的解码，与按 utteranceId/seq 交付的
// 播放队列状态机。**零 import** 是刻意的 —— 它能被 Node 直接单测
// （`scripts/test-minimax-pcm.mjs`），所以「顺序 / 去重 / 打断 / 停止」这些最容易
// 写错的地方不靠浏览器验证。
import { createSerialPlaybackQueue, decodePcmFrame } from "./minimax-pcm.ts";

/** Cordis 插件名，与 cordis.patch.yml 里的 loader 条目 id 一致。 */
const name = "herta";

/** 客户端服务：槽位注册表 + Conversation 组装。 */
const inject = ["uiConversation", "slots"];

/**
 * 视图 id：`conversation.view` 槽内的唯一键。
 * 壳会把用户选中的视图偏好按这个 id 持久化，所以改它等于换一个页签。
 */
const VIEW_ID = "herta";

/** 整机页签的视图 id（甲方案，iframe）。 */
const FULL_VIEW_ID = "herta-full";

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
  clearCredential,
  credentialStatus,
  credentialsRemote,
  machineField,
  machineForm,
  machineValues,
  resolveCredentials,
  saveCredential,
  subscribeCredentials,
  watchCredentials,
  writeMachineField,
  type MachineForm,
} from "./machine.js";


/**
 * 语音偏好的读写口 —— iframe 那边的语音应答器读它。
 *
 * **对外形状刻意保持不变**（`{getSnapshot().value, set(field, value)}`）。
 *
 * 0.1.7-rc.2 起背后是 DSH 的设置表单（`ctx.configForms.get("herta")`）：
 * 同一个命名空间既喂这些应答器、也喂 DSH 自己设置页里的「黑塔」一页，
 * 而且写入会落进 profile 的 `cordis.patch.yml`。
 */
const voiceScope = {
  getSnapshot(): { value?: unknown } {
    const values = machineValues();
    return { value: { engine: values.voiceEngine, realtimeVoice: values.realtimeVoice } };
  },
  async set(field: string, value: unknown): Promise<void> {
    // 字段名在这里翻译一次：bridge 的契约叫 `engine`，DSH 的字段叫 `voiceEngine`。
    const name = field === "engine" ? "voiceEngine" : field;
    await writeMachineField(name, value);
  },
};

/**
 * 本地语音模型（离线 TTS）状态 —— 宿主 `/herta-voice-model` 的镜像。
 *
 * 为什么要有本地镜像 + 轮询，而不是每次现问：
 *   · 整机 iframe 的 `getRealtimeVoice` 是**同步应答**的（它读 `RealtimeVoiceState`
 *     里的 `model` 字段），不能在里面 await 一次 HTTP
 *   · 下载要显示进度，而进度只能靠轮询拿（宿主是 GET 状态 / POST 动作的形态）
 *
 * 轮询**只在 `downloading` 时开**：平时一个定时器都不留，下载一结束就清掉。
 */
const VOICE_MODEL_URL = "/herta-voice-model";

/** 当前状态；null = 还没问过宿主。 */
// 「语音」那一层（SSE / PCM / 播放 / 音色状态）已拆到独立文件（#2 第二步）。
import {
  stopVoiceModelTimer,
  localQueue,
  miniMaxErrorText,
  miniMaxRetryText,
  miniMaxState,
  playLocalVoice,
  postMiniMaxAction,
  postVoiceModel,
  refreshVoiceModel,
  registerVoiceSink,
  startMiniMaxStream,
  subscribeMiniMax,
  voiceModelFacts,
  voiceModelState,
  voiceModelSubs,
  voiceModelTimer,
} from "./voice.js";


/** 从 DSH 的 ContentBlock[] 里取纯文本；图片/文件/工具块这一版先不处理。 */
/** DSH 把生效主题写在 documentElement 的 inline colorScheme 上（ui-theme/boot-theme.ts:19）。 */
// 「界面」那一层（面板 / 视图 / 气泡 / 点击朗读）已拆到独立文件（#2 第三步）。
import {
  HertaFullView,
  HertaView,
} from "./ui.js";


// ── 设置页：「黑塔」（`settings.section` 的独立一页）──────────────────────────
//
// 为什么是独立一页而不是靠 schema 自动生成：
//   · 这一页有 14 项、分四组，自动表单一长条读不动；
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
 * 绑定设置表单并挂上「黑塔」设置页。
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
              label: () => "黑塔",
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

  // 设置：绑定 DSH 的设置表单 + 在设置里挂上「黑塔」一页。
  // `voiceScope` 也从这一份表单读，所以整机面板与 DSH 设置页永远同值。
  installSettingsSection(ctx, mark);

  // MiniMax 的 PCM 流：**插件级订阅**，不是某个视图里的订阅。
  //
  // 理由：声音该在用户停在任何页签时都响。挂在整机视图里的话，切走页签就哑了 ——
  // 那正是「这功能只在开着某个页签时有效」的毛病。这里的退订随插件 fiber 释放
  // （`ctx.effect`），页面卸载时连接跟着关掉。
  ctx.effect?.(() => startMiniMaxStream(), "dsh-herta: MiniMax PCM 流");

  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: VIEW_ID,
        order: 20,
        label: () => "黑塔",
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

  // 第二个页签：整机（甲）。它同样订阅 chat target —— 数据由这个组件映射成
  // 她的记录后用 postMessage 推给 iframe，而不是让 iframe 自己去连 DSH 的传输层。
  ctx.slots.inject("conversation.view", () => {
    const disposer = ctx.slots.register(
      {
        name: "conversation.view",
        id: FULL_VIEW_ID,
        order: 30,
        label: () => "黑塔·整机",
        // `sessionId` 由会话作用域的槽自带，不用 inject 再返回一次。
        inject: (sessionId: string) => ({
          hooks: { hertaChat: ctx.uiConversation.binding(sessionId).target("chat") },
        }),
      },
      HertaFullView,
    );
    mark.fullViewRegistered = true;
    return disposer;
  });
}

export { apply, inject, name };
