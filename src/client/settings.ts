/**
 * 「设置页」那一层：字段表 / 样式 / 凭据与音色那几行 / 整个表单（#2 拆出的四个 region 之四）。
 *
 * 为什么单独一个文件：这一段是**表单与字段表**，与机器层（bridge/凭据通道）、语音层（SSE/PCM）、
 * 界面层（面板/视图）三项各不相干 —— 加一个设置项不必碰播放那条路的 diff。
 *
 * 从 `index.tsx` 原样搬来：只改了所在文件与 export。
 */
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HertaBubble } from "@gui/components/Workspace/HertaBubble";
import { UserBubble } from "@gui/components/Workspace/UserBubble";
import { LocaleProvider } from "@gui/i18n/LocaleProvider";
import hertaCss from "@gui/styles/reference-ux.css";
import { fullSnapshot, nodesToRecord, toBubbles } from "../shared/mapping.js";
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
import {
  FIELDS,
  normalizeSettings,
  SETTINGS_GROUPS,
  SETTINGS_NAMESPACE,
  UNWIRED_FIELD_NAMES,
} from "../host/settings-schema.js";
import { createSerialPlaybackQueue, decodePcmFrame } from "./minimax-pcm.ts";
const UNWIRED_HINT =
  "下面这些项在 DSH 里改得动、写得进，但**整机当前不会调用它们**：它们原本只被她自己的设置页读写，或者只被「写回她自己的 settings.json」这条已删除的链路消费。逐行的原因见每一项下面那行小字。";

/**
 * 要进 DSH 凭据存储的三个密钥。
 *
 * 值本身**不进** Config —— profile 的 `cordis.patch.yml` 是明文 YAML，
 * 密钥写进去等于公开。它们走 DSH 的凭据缝（`ctx.remote.credentials`），
 * 落在 `$DSH_HOME/.credentials.yaml`（0600，file 层，可写）。
 *
 * `ref` 是 POSIX 环境变量名：DSH 的凭据按这个名字索引，宿主代码也按它取值
 * （`src/host/mimo-tts.js` 读的就是 `MIMO_API_KEY`）。
 */
const CREDENTIALS = [
  {
    ref: "MIMO_API_KEY",
    label: "MiMo 密钥",
    hint: "MiMo 语音合成用。它写进 DSH 凭据存储；宿主侧的 MiMo 合成器目前还没有接线（它只读环境变量），所以现在填了也不会有人读 —— 但那个合成器目前还没有调用点，所以存下来暂时不会发声（见「语音引擎」那一行）。",
    placeholder: "MiMo 控制台里的密钥",
  },
  {
    ref: "MINIMAX_API_KEY",
    label: "MiniMax 密钥",
    hint: "MiniMax 云端语音用。宿主侧会读它去认领你已有的克隆（只认领、不克隆），没填就用不了云端引擎。",
    placeholder: "sk-api-…",
  },
  {
    ref: "MINIMAX_PLAN_API_KEY",
    label: "MiniMax 套餐密钥",
    hint: "MiniMax Token 套餐（`sk-cp-…`）。同样被宿主读取；两把都填时合成优先用套餐密钥。",
    placeholder: "sk-cp-…",
  },
  {
    ref: "FISH_API_KEY",
    label: "Fish 密钥",
    hint: "Fish Audio 云端语音用（「语音引擎」选 Fish 时才读）。填在这里**优先**于 `C:\\herta-ai\\fish_key.txt` —— 那份明文只是没填这里的兜底。",
    placeholder: "Fish Audio 控制台里的 API Key",
  },
];

/**
 * 「打开网盘」的目标。
 *
 * 抄自 `Herta-src/packages/gui/src/shared/links.ts` 的 `NETDISK_URL` ——
 * 客户端 bundle 不能 import 上游源码，所以这里是**第三份**副本（另两份是
 * 那个常量本身与官网下载页）。它几乎不会变；真变了改三处。
 */
const NETDISK_URL = "https://pan.baidu.com/s/1k-47zy6TTDWl0OaT2WCFUg?pwd=y195";

/**
 * 引擎那一行的逐档文案。**住在字段描述符里**（`FIELDS.voiceEngine.engine`），
 * 这里只是取出来给下面几处用 —— 2026-10-03 之前它是本文件里的四张
 * `ENGINE_NOTES|BADGES|SUMMARY|FACTS` 平行表。
 *
 * 结构（为什么不是段落）：原来 84 字的说明堆在卡片左列折成 4~6 行 ——
 * `badges` 短标签一行扫完、`summary` 一句不超行、`facts` 展开后整宽三列。
 * 文案要短：`fish` 第一版 84 字是当时最长的一条，那正是那段 UI 变难看的直接原因。
 */
const ENGINE_META = (
  FIELDS.voiceEngine as {
    engine: {
      notes: Record<string, string>;
      badges: Record<string, readonly string[]>;
      summary: Record<string, string>;
      facts: Record<string, readonly (readonly [string, string])[]>;
    };
  }
).engine;

/** 引擎值 → 中文档位名（缺了就原样显示，与 `EnumControl` 同口径）。 */
function engineLabel(engine: unknown): string {
  const value = typeof engine === "string" ? engine : "";
  const labels = (FIELDS.voiceEngine.enumLabels ?? {}) as Record<string, string>;
  return labels[value] ?? value;
}

/** 选择器要用的空数组常量：引用必须稳定，否则 useSyncExternalStore 会自激。 */
const EMPTY_WORKSPACES = Object.freeze([]);

const SECTION_STYLE = { display: "grid", gap: 28, padding: "4px 2px 32px", maxWidth: 720 };
const GROUP_TITLE_STYLE = {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--dsw-alias-label-secondary)",
  letterSpacing: "0.02em",
};
const ROW_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  padding: "10px 0",
  borderTop: "1px solid var(--dsw-alias-border-l1)",
};
const LABEL_STYLE = { fontSize: 13, color: "var(--dsw-alias-label-primary)", lineHeight: "20px" };
const HINT_STYLE = { marginTop: 3, fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: "17px" };
const NOTE_STYLE = { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-label-secondary)", lineHeight: "18px" };
const INPUT_STYLE = {
  width: 300,
  maxWidth: "42vw",
  boxSizing: "border-box",
  padding: "5px 9px",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  outline: "none",
};
const SUGGEST_STYLE = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--dsw-alias-brand-primary)",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};
/** 「暂未接线」的逐行小字。刻意用斜体，好和上面那句「它是什么」分开读。 */
const UNWIRED_NOTE_STYLE = {
  marginTop: 4,
  fontSize: 12,
  color: "var(--dsw-alias-label-secondary)",
  lineHeight: "17px",
  fontStyle: "italic",
};
/** 密钥状态的徽标。 */
const BADGE_STYLE = {
  marginLeft: 8,
  padding: "1px 6px",
  fontSize: 11,
  fontWeight: 400,
  color: "var(--dsw-alias-label-secondary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l1)",
  borderRadius: 4,
};
/** 次要按钮：密钥的存/清、模型动作、打开网盘。 */
const ACTION_BUTTON_STYLE = {
  padding: "4px 10px",
  fontSize: 12,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-2)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  cursor: "pointer",
};

/**
 * 运行时从模块加载器取一个种子模块。
 *
 * ## 为什么不用 `import()`
 *
 * 客户端 bundle 被包成 `__ModuleLoader__.load({ factory: (require) => … })`：
 * 外壳**冻结的模块表只通过工厂参数 `require` 暴露**。esbuild 会把**外部**模块的
 * 动态 `import()` 原样保留（实测产物里就是 `import("@deepseek-ai/…")`），
 * 于是浏览器自己拿原生解析器去解析 —— 那里没有这张表，报
 * `Failed to resolve module specifier '@deepseek-ai/dsh-client-ui-primitives'`。
 *
 * ## 为什么也不直接静态 import
 *
 * 静态 import 会正确变成 `require("…")`（见产物里 `require("react")`），
 * 但它发生在**求值期**：模块不在表里就让整份 bundle 失败 —— 连她的两个对话
 * 页签一起没了。所以这里用**变量 specifier** 调一次运行时的 `require`：
 * 落到工厂参数上（正确通道），又不被构建期解析，于是失败能被 caller 的 try 关住。
 *
 * @param id - 包名。
 * @returns 该模块的命名空间；调用方自己核对要用到的导出。
 */
export function loadSeedModule(id: string): any {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- 工厂参数，不是全局 require
  return require(id);
}

/**
 * 造「黑塔」设置页组件。
 *
 * @param ui - 模块加载器给的 `@deepseek-ai/dsh-client-ui-primitives`。
 * @returns 组件。
 */
export function createSettingsSection(ui: unknown) {
  const { Switch, SegmentedControl } = ui as { Switch: any; SegmentedControl: any };

  /** 一行：左标签 + 说明（+ 可选的「暂未接线」小字），右控件。 */
  function Row(props: { label: string; hint?: string; note?: string; control: unknown }): unknown {
    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, props.label),
        props.hint === undefined ? null : createElement("div", { style: HINT_STYLE }, props.hint),
        // 「暂未接线」的逐行标注。文案来自字段表的 `note`，页面只负责摆位置。
        props.note === undefined ? null : createElement("div", { style: UNWIRED_NOTE_STYLE }, props.note),
      ),
      createElement("div", { style: { flex: "0 0 auto", paddingTop: 1 } }, props.control),
    );
  }

  /** 分段选择器；取值域直接来自字段表，所以加一项不用改这里。 */
  function EnumControl(props: { field: string; value: unknown; disabled?: boolean; onChange: (next: string) => void }): unknown {
    const spec = FIELDS[props.field];
    const labels = (spec.enumLabels ?? {}) as Record<string, string>;
    const options = (spec.values as readonly string[]).map((value) => ({
      value,
      label: labels[value] ?? value,
    }));
    return createElement(SegmentedControl, {
      id: `herta-setting-${props.field}`,
      value: typeof props.value === "string" ? props.value : spec.def,
      options,
      label: spec.label,
      disabled: props.disabled === true,
      onChange: props.onChange,
    });
  }

  /** 数值项（目前只有音量）：滑杆 + 读数。范围与步长来自字段表。 */
  function NumberControl(props: {
    field: string;
    value: unknown;
    disabled?: boolean;
    onChange: (next: number) => void;
  }): unknown {
    const spec = FIELDS[props.field];
    const current = typeof props.value === "number" ? props.value : (spec.def as number);
    return createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 10 } },
      createElement("input", {
        type: "range",
        min: spec.min,
        max: spec.max,
        step: spec.step,
        value: current,
        disabled: props.disabled === true,
        "aria-label": spec.label,
        style: { width: 180 },
        onChange: (event: { target: { value: string } }) => props.onChange(Number(event.target.value)),
      }),
      createElement(
        "span",
        {
          style: {
            fontSize: 12,
            color: "var(--dsw-alias-label-secondary)",
            minWidth: 30,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          },
        },
        String(current),
      ),
    );
  }

  /**
   * 一行密钥：状态徽标 + 密码框 + 存/清。
   *
   * 值的去处是 DSH 的凭据缝（`$DSH_HOME/.credentials.yaml`），**不是** Config ——
   * 理由见 `CredentialsRemote` 的注释。所以这一行不读写 `machineForm`，
   * 也不参与 `normalizeSettings`。
   */
  function CredentialRow(props: {
    spec: { ref: string; label: string; hint: string; placeholder: string };
  }): unknown {
    type Status =
      | { kind: "loading" }
      | { kind: "unavailable" }
      | { kind: "ok"; configured: boolean; writable: boolean };
    const [status, setStatus] = useState<Status>({ kind: "loading" });
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reprobe = useCallback((): void => {
      void credentialStatus(props.spec.ref).then((next) => {
        setStatus(next === undefined ? { kind: "unavailable" } : { kind: "ok", ...next });
      });
    }, [props.spec.ref]);

    useEffect(() => {
      // 挂载先查一次；凭据缝若是稍后才挂上来的（见 `installSettingsSection`），
      // 那一次查询会白跑，所以再订阅一次「它到了」。
      const unsubscribe = subscribeCredentials(reprobe);
      reprobe();
      return unsubscribe;
    }, [reprobe]);

    const save = (): void => {
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

    const clear = (): void => {
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

    const badgeText =
      status.kind === "loading"
        ? "读取中…"
        : status.kind === "unavailable"
          ? "凭据服务不可用"
          : status.configured
            ? "已配置"
            : "未配置";
    const canWrite = status.kind === "ok" && status.writable && !busy;

    return createElement(
      "div",
      { style: ROW_STYLE, key: props.spec.ref },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement(
          "div",
          { style: LABEL_STYLE },
          props.spec.label,
          createElement("span", { style: BADGE_STYLE }, badgeText),
        ),
        createElement("div", { style: HINT_STYLE }, props.spec.hint),
        createElement("div", { style: HINT_STYLE }, `存放位置：DSH 凭据存储（ref = ${props.spec.ref}）`),
        error === null ? null : createElement("div", { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-error, #c0392b)" } }, error),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", display: "grid", gap: 6, justifyItems: "end" } },
        createElement("input", {
          type: "password",
          value: draft,
          disabled: busy || status.kind === "unavailable",
          spellCheck: false,
          autoComplete: "off",
          placeholder: status.kind === "ok" && status.configured ? "已存（填入即覆盖）" : props.spec.placeholder,
          "aria-label": props.spec.label,
          style: { ...INPUT_STYLE, width: 220 },
          onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
          onKeyDown: (event: { key: string }) => {
            if (event.key === "Enter") save();
          },
        }),
        createElement(
          "div",
          { style: { display: "flex", gap: 8 } },
          createElement(
            "button",
            {
              type: "button",
              style: ACTION_BUTTON_STYLE,
              disabled: draft.trim().length === 0 || !canWrite,
              onClick: save,
            },
            busy ? "处理中…" : "保存",
          ),
          createElement(
            "button",
            {
              type: "button",
              style: ACTION_BUTTON_STYLE,
              disabled: !canWrite || status.kind !== "ok" || !status.configured,
              onClick: clear,
            },
            "清除",
          ),
        ),
      ),
    );
  }

  /**
   * 本地语音模型的下载/删除。
   *
   * 这是**真动作**：宿主侧 `/herta-voice-model`（`src/host/voice-model-route.js`
   * + `voice-model.js`）真的会去上游地址取归档、解到 `$DSH_HOME/tts/`。
   * 状态与进度靠轮询（下载中才开定时器），复用 iframe 那侧同一套镜像。
   */
  function VoiceModelRow(): unknown {
    const [state, setState] = useState<Record<string, unknown> | null>(voiceModelState);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      const sub = (next: unknown): void => {
        setState((next as Record<string, unknown> | null) ?? null);
      };
      voiceModelSubs.add(sub);
      // 挂载就先问一次宿主，别让首屏停在「未知」。
      void refreshVoiceModel().then(() => setState(voiceModelState));
      return () => {
        voiceModelSubs.delete(sub);
      };
    }, []);

    const phase = typeof state?.phase === "string" ? state.phase : "absent";
    const phaseText =
      phase === "ready"
        ? "已安装"
        : phase === "downloading"
          ? "下载中…"
          : phase === "failed"
            ? `上次失败（原因：${String(state?.error ?? "未知")}）`
            : "未安装";
    const received = typeof state?.receivedBytes === "number" ? (state.receivedBytes as number) : 0;
    const total = typeof state?.totalBytes === "number" ? (state.totalBytes as number) : 0;
    const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
    const runtimeReady = (state?.runtime as { available?: boolean } | undefined)?.available === true;

    const act = (action: string): void => {
      if (busy) return;
      setBusy(true);
      void postVoiceModel(action).then(() => {
        setBusy(false);
        setState(voiceModelState);
      });
    };

    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, "本地语音模型"),
        createElement(
          "div",
          { style: HINT_STYLE },
          `离线 TTS 的模型归档。状态：${phaseText}${phase === "downloading" ? `（${percent}%，${Math.round(received / 1048576)} / ${Math.round(total / 1048576)} MB）` : ""}`,
        ),
        createElement(
          "div",
          { style: HINT_STYLE },
          runtimeReady
            ? "运行时已就绪（宿主真的加载过 addon 并探测通过）。"
            : "运行时**未就绪** —— 宿主探测 addon 没成功，所以现在合成不出声音。这不是按钮的问题，是运行时还没装好。",
        ),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", display: "flex", gap: 8, paddingTop: 1 } },
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase === "downloading" || phase === "ready",
            onClick: () => act("download"),
          },
          "下载",
        ),
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase !== "downloading",
            onClick: () => act("cancel"),
          },
          "取消",
        ),
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || phase === "absent" || phase === "downloading",
            onClick: () => act("remove"),
          },
          "删除",
        ),
      ),
    );
  }

  /**
   * 「语音引擎」那一行 —— 分段控件 + 试听 + 逐档现状 + 本地就绪。
   *
   * ## 为什么不走通用的 `Row` + `fieldRow`
   *
   * 这一行要多三样**不是字段**的东西：
   *   ① 逐档「现在到底会不会出声、要付什么代价」的一句说明（`FIELDS.voiceEngine.engine.notes`）；
   *   ② 本地模型 / 运行时的**真探测**结果 —— 同一份 `/herta-voice-model` 镜像，
   *      与「整机动作 › 本地语音模型」那行共用（不另开一次 HTTP）；
   *   ③ 试听按钮与它的结果。
   *
   * 静音提示也挂在这里：试听走的是浏览器播放路径，而那条路有静音闸门
   * （`machineField("voiceMuted")` 为真就 return）。不提示的话，按下去就是
   * "没反应" —— 用户分不清"静音"和"坏了"，所以这里同时给一个一键取消静音。
   */
  function VoiceEngineRow(props: {
    value: unknown;
    disabled?: boolean;
    muted: boolean;
    setField: (field: string, value: unknown) => void;
  }): unknown {
    const [model, setModel] = useState<Record<string, unknown> | null>(voiceModelState);
    const [mini, setMini] = useState<Record<string, unknown> | null>(miniMaxState);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    /** 「详情」展开与否。默认收起 —— 这一行的高度不该由最长的那段文案决定。 */
    const [detailOpen, setDetailOpen] = useState(false);

    useEffect(() => {
      const sub = (next: unknown): void => {
        setModel((next as Record<string, unknown> | null) ?? null);
      };
      voiceModelSubs.add(sub);
      // 挂载就先问一次宿主，别让首屏停在「未知」。
      void refreshVoiceModel().then(() => setModel(voiceModelState));
      return () => {
        voiceModelSubs.delete(sub);
      };
    }, []);

    // 常驻合成进程的状态来自宿主快照（与「MiniMax 语音」那一行是同一份，订阅按引用计数
    // 共用一条 5 秒轮询，不会开出第二条定时器）。
    useEffect(() => subscribeMiniMax(setMini), []);

    const engine = typeof props.value === "string" ? props.value : String(FIELDS.voiceEngine.def);
    const phase = typeof model?.phase === "string" ? model.phase : "absent";
    const phaseText =
      phase === "ready"
        ? "已就绪（herta-best-e72）"
        : phase === "downloading"
          ? "下载中…"
          : phase === "failed"
            ? "上次安装失败"
            : "未下载";
    const runtimeReady = (model?.runtime as { available?: boolean } | undefined)?.available === true;
    const workerState = (mini?.localWorker as { state?: unknown } | undefined)?.state;
    const workerText =
      workerState === "running"
        ? "已预热"
        : workerState === "starting"
          ? "启动中…"
          : "未启动（首次合成就地加载，约 3 秒）";

    /**
     * 换引擎。切到「本地模型」时顺手把常驻进程热起来 —— 那 ~3 秒的模型加载就落在
     * 用户还在选的这几秒里，而不是落在他第一次真的想听的那一刻。
     *
     * `warm` 是 fire-and-forget：回执会经同一条快照通道回来，上面那行
     * 「合成进程：」自己会从「未启动」变成「启动中…」再到「已预热」。
     */
    const chooseEngine = (next: string): void => {
      props.setField("voiceEngine", next);
      if (next === "local") void postMiniMaxAction("warm");
    };

    const preview = (): void => {
      if (busy) return;
      setBusy(true);
      setResult(null);
      // 复用 `POST /herta-minimax-state {action:"preview"}`：宿主拿固定台词走一遍
      // **当前引擎**的合成，PCM 仍从那条 SSE 回来（与她的自动念回复同一条路），
      // 所以这里不自己造第二条播放通道。
      void postMiniMaxAction("preview").then((next) => {
        setBusy(false);
        const out = (next?.preview ?? null) as { ok?: unknown; engine?: unknown; note?: unknown } | null;
        if (out === null) {
          setResult("试听没有回执：宿主的语音层可能没挂载（看宿主日志）。");
          return;
        }
        if (out.ok === true) {
          setResult(`试听已经推给界面（用 ${engineLabel(out.engine ?? engine)}）。`);
          return;
        }
        setResult(
          `试听没有出声：${typeof out.note === "string" && out.note !== "" ? out.note : "原因未知（看宿主日志）"}`,
        );
      });
    };

    /**
     * 一行里的窄元素：小标签（徽章）。
     *
     * 用 `inline-block` + 圆角，视觉上跟按钮区分开（按钮有边框，徽章只有底色）。
     */
    const badge = (text: string, i: number): unknown =>
      createElement(
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
            whiteSpace: "nowrap",
          },
        },
        text,
      );

    /** 展开后的「标签 / 值」小格。整宽三列 —— 不是横贯的长句。 */
    const facts = [
      ...(ENGINE_META.facts[engine] ?? []),
      // 本机事实：两个云端档也会回落本地，所以这几项对它们同样有用。
      ["本地模型", phaseText] as [string, string],
      ["运行时", runtimeReady ? "可用" : "缺失"] as [string, string],
      ["合成进程", workerText] as [string, string],
    ];

    const factGrid = createElement(
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
          rowGap: 10,
        },
      },
      ...facts.map(([k, v], i) =>
        createElement(
          "div",
          { key: `f${i}`, style: { minWidth: 0 } },
          createElement(
            "div",
            { style: { fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-secondary)" } },
            k,
          ),
          createElement(
            "div",
            { style: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-primary)", wordBreak: "break-word" } },
            v,
          ),
        ),
      ),
    );

    return createElement(
      "div",
      // 整行改成**纵向三段**，不再「左文字 | 右控件」两列 —— 文字因此拿到整宽，
      // 同样的字数从 6 行降到 1~2 行，右侧控件下方也不会再留空白。
      { style: { display: "block" } },

      // ── ① 标题 + 控件（同一行，垂直居中对齐） ──
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
        createElement(
          "div",
          { style: { ...LABEL_STYLE, flex: "1 1 auto", minWidth: 0 } },
          FIELDS.voiceEngine.label,
        ),
        createElement(EnumControl, {
          field: "voiceEngine",
          value: props.value,
          disabled: props.disabled === true,
          onChange: chooseEngine,
        }),
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            disabled: busy || props.disabled === true,
            onClick: preview,
          },
          busy ? "试听中…" : "试听",
        ),
        props.muted
          ? createElement(
              "button",
              {
                type: "button",
                style: ACTION_BUTTON_STYLE,
                disabled: props.disabled === true,
                onClick: () => props.setField("voiceMuted", false),
              },
              "取消静音",
            )
          : null,
      ),

      // ── ② 徽章摘要 + 「详情」开关（整宽一行） ──
      createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--dsw-alias-border-l)",
          },
        },
        ...(ENGINE_META.badges[engine] ?? []).map(badge),
        createElement(
          "span",
          { style: { ...HINT_STYLE, marginTop: 0, flex: "1 1 auto", minWidth: 0 } },
          ENGINE_META.summary[engine] ?? "",
        ),
        createElement(
          "button",
          {
            type: "button",
            style: {
              ...ACTION_BUTTON_STYLE,
              padding: "2px 8px",
              fontSize: 12,
            },
            onClick: () => setDetailOpen((v: boolean) => !v),
          },
          detailOpen ? "收起详情" : "详情",
        ),
      ),

      // ── ③ 展开后的事实网格 ──
      detailOpen ? factGrid : null,

      props.muted
        ? createElement(
            "div",
            { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-warning, #b7791f)" } },
            "当前是静音，试听不会出声。",
          )
        : null,
      result === null ? null : createElement("div", { style: HINT_STYLE }, result),
    );
  }

  /**
   * MiniMax 语音的**认领状态 + 重新认领**。
   *
   * 「设置页黑塔 → 语音那一栏」的这一行，与上面那个「本地语音模型」是两条不同的
   * 链路：那个是离线模型归档，这个是云端克隆音色的认领状态。值的来源是
   * `/herta-minimax-state`，与 SSE 的 `state` 帧是**同一份**宿主快照。
   *
   * ## 为什么一行里要显示这么多东西
   *
   * 「她怎么没声了」有六种完全不同的原因（没密钥 / 认领失败 / 额度用完 / 在冷却 /
   * 回落到本地 / 到了每轮上限），而它们在界面上原来长得一模一样 —— 全是「没声音」。
   * 把 `engine`、`engineReason`、`voice.phase`、`lastError`、`retryAt`、
   * `maxTurnChars`、`clients` 一起摆出来，就是为了让每一种原因都能被认出来，
   * 而不是让人去翻日志。
   */
  function MiniMaxVoiceRow(): unknown {
    const [state, setState] = useState<Record<string, unknown> | null>(miniMaxState);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      // 挂上就拉一次 + 开 5 秒轮询；卸载即停（没有订阅者就没有定时器）。
      return subscribeMiniMax(setState);
    }, []);

    const engine = typeof state?.engine === "string" ? state.engine : "未知";
    const engineNote = typeof state?.engineReason === "string" && state.engineReason !== "" ? state.engineReason : null;
    const keyKnown = state?.keyKnown === true;
    const voice = (state?.voice ?? {}) as {
      phase?: unknown;
      voiceId?: unknown;
      host?: unknown;
      clonedAt?: unknown;
      lastError?: unknown;
      retryAt?: unknown;
      /** 这一档累计的计费字符（宿主 readout 带出来的）；取不到就不显示。 */
      billedCharsTotal?: unknown;
    };
    const synth = (state?.synth ?? {}) as { refusal?: unknown; lastFailure?: unknown; inFlight?: unknown };
    const pipeline = (state?.pipeline ?? {}) as {
      cappedUtterances?: unknown;
      utterances?: unknown;
      /** 最近一次撞到每轮上限的记录（`src/host/minimax/pipeline.ts` 的 `lastCap`）。 */
      lastCap?: { spokenChars?: unknown; limit?: unknown } | null;
    };
    const maxTurnChars = typeof state?.maxTurnChars === "number" ? state.maxTurnChars : null;
    const clients = typeof state?.clients === "number" ? state.clients : null;
    const phase = typeof voice.phase === "string" ? voice.phase : "absent";

    const phaseText =
      phase === "ready"
        ? `已认领：${String(voice.voiceId ?? "（没有 id）")} @ ${String(voice.host ?? "未知端点")}`
        : phase === "preparing"
          ? "认领中…"
          : phase === "failed"
            ? `认领失败：${miniMaxErrorText(voice.lastError)}`
            : "还没有认领（或密钥还没填）";
    const retryText = phase === "failed" ? miniMaxRetryText(voice.retryAt) : null;

    const adopt = (): void => {
      if (busy) return;
      setBusy(true);
      // 按钮期间禁用：`adopt` 在宿主那边是「清记录 + 重新认领一次」，会打网络；
      // 连点就是连着重认领，白花钱也白等。
      void postMiniMaxAction("adopt").then((next) => {
        setBusy(false);
        setState(next);
      });
    };

    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, "MiniMax 语音"),
        createElement(
          "div",
          { style: HINT_STYLE },
          `当前引擎：${engineLabel(engine)}` + `　·　密钥：${keyKnown ? "已填" : "未填"}`,
        ),
        // 「语音状态」要显式说 —— 否则用户只会觉得"她的声音变了"，说不出为什么。
        // 措辞必须中性：fish 明确不回落，写成「已回落：Fish Audio 不可用…」会自相矛盾。
        engineNote === null
          ? null
          : createElement(
              "div",
              { style: { ...HINT_STYLE, color: "var(--dsw-alias-label-warning, #b7791f)" } },
              `语音状态：${engineNote}`,
            ),
        createElement("div", { style: HINT_STYLE }, phaseText),
        retryText === null ? null : createElement("div", { style: HINT_STYLE }, `下次可重试：${retryText}`),
        synth.refusal === null || synth.refusal === undefined
          ? null
          : createElement("div", { style: HINT_STYLE }, `MiniMax 拒绝：${miniMaxErrorText(synth.refusal)}`),
        synth.lastFailure === null || synth.lastFailure === undefined
          ? null
          : createElement(
              "div",
              { style: HINT_STYLE },
              `上次合成失败：${miniMaxErrorText(synth.lastFailure)}（在飞 ${String(synth.inFlight ?? 0)}）`,
            ),
        createElement(
          "div",
          { style: HINT_STYLE },
          `每轮上限：${maxTurnChars === null ? "未知" : `${maxTurnChars} 字`}` +
            `　·　已到上限的轮数：${String(pipeline.cappedUtterances ?? 0)}` +
            `　·　SSE 客户端：${clients === null ? "未知" : clients}` +
            (pipeline.lastCap
              ? `　·　⚠️ 上一轮太长：只念了前 ~${String(pipeline.lastCap.spokenChars)} 字（上限 ${String(pipeline.lastCap.limit)} 字），后面的内容只显示、没发声`
              : "") +
            (voice?.billedCharsTotal ? `　·　已计费 ${String(voice.billedCharsTotal)} 字` : ""),
        ),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", paddingTop: 1 } },
        createElement(
          "button",
          { type: "button", style: ACTION_BUTTON_STYLE, disabled: busy, onClick: adopt },
          busy ? "认领中…" : "重新认领",
        ),
      ),
    );
  }

  /** 「打开网盘」—— 一个真链接，不是占位。 */
  function NetdiskRow(): unknown {
    return createElement(
      "div",
      { style: ROW_STYLE },
      createElement(
        "div",
        { style: { flex: "1 1 auto", minWidth: 0 } },
        createElement("div", { style: LABEL_STYLE }, "安装包网盘"),
        createElement(
          "div",
          { style: HINT_STYLE },
          "整机安装包的网盘镜像（网络到不了 GitHub 时用）。**不含语音模型**（模型只能从 GitHub 下）。在新标签页里打开。",
        ),
      ),
      createElement(
        "div",
        { style: { flex: "0 0 auto", paddingTop: 1 } },
        createElement(
          "button",
          {
            type: "button",
            style: ACTION_BUTTON_STYLE,
            onClick: () => {
              window.open(NETDISK_URL, "_blank", "noopener,noreferrer");
            },
          },
          "打开网盘",
        ),
      ),
    );
  }

  /**
   * 「同步到工作区」的路径输入。
   *
   * 独立组件，好让它成为 `useWorkspaces` 的**唯一调用点**：只有当
   * `settings.section` 真的带了这个标准 prop 时才挂载它，钩子调用次数因此
   * 与渲染次数无关（合规），也不会因为 prop 缺席而炸整页。
   */
  function WorkspacePicker(props: { useWorkspaces: any; onPick: (path: string) => void; disabled?: boolean }): unknown {
    const items = props.useWorkspaces((snapshot: unknown) => (snapshot as { items?: unknown })?.items ?? EMPTY_WORKSPACES);
    if (!Array.isArray(items) || items.length === 0) return null;
    return createElement(
      "div",
      { style: { marginTop: 8, display: "grid", gap: 4 } },
      createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "从 DSH 已登记的工作区里选："),
      ...items
        .filter((item: unknown) => typeof (item as { path?: unknown })?.path === "string")
        .slice(0, 8)
        .map((item: any) =>
          createElement(
            "button",
            {
              key: item.path,
              type: "button",
              style: SUGGEST_STYLE,
              disabled: props.disabled === true,
              onClick: () => props.onPick(item.path),
            },
            `${item.title ?? item.path} — ${item.path}`,
          ),
        ),
    );
  }

  /**
   * 路径 / 文本输入：本地暂存草稿，失焦或回车才写（逐键写会把 profile 补丁刷爆）。
   *
   * `placeholder` 由字段表给（`kind: "text"` 的字段各写各的）；
   * `useWorkspaces` **只在 `kind: "path"` 时传进来** —— 「音色模型 ID」这种
   * 纯文本字段不该看到「从 DSH 已登记的工作区里选」那一块。
   */
  function WorkspaceInput(props: {
    value: string;
    disabled?: boolean;
    onCommit: (next: string) => void;
    placeholder?: string;
    useWorkspaces: any;
  }): unknown {
    const [draft, setDraft] = useState(props.value);
    useEffect(() => {
      // 外部值变了（例如从下面的建议里选了）就同步草稿。
      setDraft(props.value);
    }, [props.value]);
    return createElement(
      "div",
      null,
      createElement("input", {
        type: "text",
        value: draft,
        disabled: props.disabled === true,
        spellCheck: false,
        placeholder: props.placeholder ?? "例如 D:\\项目\\我的仓库",
        style: INPUT_STYLE,
        onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
        onKeyDown: (event: { key: string }) => {
          if (event.key === "Enter") props.onCommit(draft);
        },
        onBlur: () => {
          if (draft !== props.value) props.onCommit(draft);
        },
      }),
      props.useWorkspaces === undefined
        ? null
        : createElement(WorkspacePicker, {
            useWorkspaces: props.useWorkspaces,
            disabled: props.disabled,
            onPick: (path: string) => {
              setDraft(path);
              props.onCommit(path);
            },
          }),
    );
  }

  return function HertaSettingsSection(props: {
    useHertaMachine?: (selector: (snapshot: unknown) => unknown) => unknown;
    setHertaField?: (field: string, value: unknown) => void;
    useWorkspaces?: unknown;
  }): unknown {
    const snapshot = (typeof props.useHertaMachine === "function"
      ? props.useHertaMachine((s: unknown) => s)
      : undefined) as { status?: string; value?: unknown; writable?: boolean } | undefined;
    const values = useMemo(() => normalizeSettings(snapshot?.value), [snapshot]);

    const header = createElement(
      "div",
      null,
      createElement("div", { style: { fontSize: 15, fontWeight: 600, marginBottom: 6 } }, "黑塔"),
      createElement(
        "div",
        { style: NOTE_STYLE },
        "黑塔的设置**只有这一处**。她的整机界面里那套设置面板已经删除，所以这里改的值就是她读到的值。",
      ),
      createElement(
        "div",
        { style: NOTE_STYLE },
        "写入落进 DSH 的 profile 配置（`cordis.patch.yml` 的 `herta` 条目）。密钥是唯一的例外：它们进 DSH 的凭据存储，不进这份明文配置。",
      ),
    );

    if (snapshot?.status !== "ready") {
      const why = snapshot?.status === "unavailable" ? "宿主没有向这个页面提供设置（可能当前部署把设置存在本地）。" : "正在读取设置…";
      return createElement("div", { style: SECTION_STYLE }, header, createElement("div", { style: NOTE_STYLE }, why));
    }

    const disabled = snapshot.writable === false;
    const setField = (field: string, value: unknown) => props.setHertaField?.(field, value);

    /** 一个字段 → 一行。控件类型由字段表的 `kind` 决定，加一项不用改这里。 */
    const fieldRow = (field: string): unknown => {
      const spec = (FIELDS as Record<string, any>)[field];
      const value = (values as Record<string, unknown>)[field];
      // 引擎那一行不是「标签 + 一个控件」：它还有逐档现状、本地就绪、试听。
      // 通用形状装不下 —— 所以由描述符的 `widget` 指名（**不是**按字段名硬编码：
      // 加一个同样形状的字段时，这里一行都不用改）。
      if (spec.widget === "engineRow") {
        return createElement(VoiceEngineRow, {
          key: field,
          value,
          disabled,
          muted: (values as Record<string, unknown>).voiceMuted === true,
          setField,
        });
      }
      let control: unknown;
      if (spec.kind === "boolean") {
        control = createElement(Switch, {
          checked: value === true,
          label: spec.label,
          disabled,
          onChange: (next: boolean) => setField(field, next),
        });
      } else if (spec.kind === "enum") {
        control = createElement(EnumControl, {
          field,
          value,
          disabled,
          onChange: (next: string) => setField(field, next),
        });
      } else if (spec.kind === "number") {
        control = createElement(NumberControl, {
          field,
          value,
          disabled,
          onChange: (next: number) => setField(field, next),
        });
      } else {
        control = createElement(WorkspaceInput, {
          value: typeof value === "string" ? value : "",
          disabled,
          onCommit: (next: string) => setField(field, next),
          // `kind: "text"` 用字段自己的占位符；其余（`path`）保持原样。
          placeholder: typeof spec.placeholder === "string" ? spec.placeholder : undefined,
          // 只有路径字段才给工作区选择器 —— 模型 ID 那一类看了会莫名其妙。
          useWorkspaces: spec.kind === "path" ? props.useWorkspaces : undefined,
        });
      }
      return createElement(Row, {
        key: field,
        label: spec.label,
        hint: spec.hint,
        // 「暂未接线」的逐行原因来自字段表本身（`FIELDS[field].note`）——
        // 页面不抄第二遍，所以字段表改了这里跟着改。
        note: typeof spec.note === "string" ? spec.note : undefined,
        control,
      });
    };

    /** 一个分组：标题 + 可选说明 + 若干行。 */
    const group = (title: string, hint: string | undefined, rows: readonly unknown[]): unknown =>
      createElement(
        "section",
        { key: title },
        createElement("h3", { style: GROUP_TITLE_STYLE }, title),
        hint === undefined
          ? null
          : createElement("div", { style: { ...NOTE_STYLE, marginTop: -6, marginBottom: 6 } }, hint),
        ...rows,
      );

    /**
     * 组尾挂件：声明里的**名字** → 渲染器。
     *
     * 名字是数据（在字段表的 `GROUP_DECLARATION` 里），组件在这里注册 —— 于是
     * 「哪一组末尾挂什么」不需要拿显示文案当逻辑 key（2026-10-03 之前是
     * `entry.title === "语音"`，改个组标题就会静默丢掉那行状态）。
     */
    const GROUP_TRAILERS: Record<string, () => unknown> = {
      "minimax-voice": MiniMaxVoiceRow,
    };

    const wiredGroups = SETTINGS_GROUPS.map((entry) => {
      const trailer = GROUP_TRAILERS[(entry as { trailer?: string }).trailer ?? ""];
      const rows = entry.fields.map(fieldRow);
      return group(
        entry.title,
        (entry as { hint?: string }).hint,
        // 「语音」那一栏末尾多一行宿主事实（认领状态 + 重新认领）。它**不是**设置
        // 字段，所以不来自字段表；挂在组尾是因为它讲的是上面那几行的**后果**
        // （谁在说话、为什么回落、到没到上限）—— 先选，再看状态。
        trailer === undefined ? rows : [...rows, createElement(trailer, { key: (entry as { trailer?: string }).trailer })],
      );
    });

    const credentialsGroup = group(
      "密钥",
      "密钥存进 DSH 的凭据存储（`$DSH_HOME/.credentials.yaml`，权限 0600），不写进 profile 的明文配置。上面那行状态读的是宿主的事实，不是本地的乐观值。",
      CREDENTIALS.map((spec) => createElement(CredentialRow, { key: spec.ref, spec })),
    );

    const actionsGroup = group(
      "整机动作",
      "下面两个都是**真动作**：宿主侧的实现已经存在，按下去会有实际后果。",
      [createElement(VoiceModelRow, { key: "voice-model" }), createElement(NetdiskRow, { key: "netdisk" })],
    );

    // 「暂未接线」那一组由字段表自己的 `UNWIRED_FIELD_NAMES` 生成 ——
    // 名单与逐行原因都只有一份，在 `settings-schema.js` 里。
    const unwiredGroup = group("暂未接线", UNWIRED_HINT, UNWIRED_FIELD_NAMES.map(fieldRow));

    return createElement(
      "div",
      { style: SECTION_STYLE },
      header,
      ...wiredGroups,
      credentialsGroup,
      actionsGroup,
      unwiredGroup,
    );
  };
}