/**
 * 「Herta 整机」页面里的 bridge 实现（甲方案）。
 *
 * 结构：iframe 里的这个 bridge 把每个调用**转发给父窗口**（DSH 页面里的
 * client 插件），父窗口用 DSH 的客户端服务回答；事件反向推送。
 *
 * 用 postMessage 而不是让 iframe 直接连 DSH 的 /api：
 *   · iframe 不需要懂 DSH 的传输协议（WebSocket + RPC），协议只在父窗口那一侧
 *   · 父窗口本来就已经拿着 `uiConversation.binding(sessionId).target('chat')`
 *     这份组装好的数据（乙路线已经验证过这条路径）
 *   · 同源，postMessage 不需要额外鉴权
 *
 * 这个文件只依赖 Herta 的 `HertaBridge` 契约（92 成员 / 43 必填，见
 * `@gui/ipc/bridge-types`）。所有可选成员**一律不实现** —— 上游的契约是
 * 省略即优雅隐藏（官网的 demo bridge 就省了 45 个可选成员，渲染层照常工作）。
 */

type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

/**
 * 每个事件名最后一条载荷。
 *
 * **这是必须的**：父窗口推数据时，渲染层的 store 可能还没订阅（它的订阅发生在
 * `HertaBridgeProvider` 的 effect 里，而 postMessage 是异步到达的）。
 * 不重放的话，那次 reset 就永远丢了 —— 现象是「她的界面起来了、但会话是空的」，
 * 而且不会再恢复。真实 Electron preload 的语义也是这样：新订阅者立刻拿到当前状态。
 */
const lastPayload = new Map<string, unknown>();

/** 订阅一个由父窗口推送的事件；有缓存则立刻补一条。 */
function on(event: string, cb: Listener): () => void {
  let set = listeners.get(event);
  if (set === undefined) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(cb);

  if (lastPayload.has(event)) {
    const replay = lastPayload.get(event);
    // 异步补发：订阅发生在 effect 里，同步回调会在渲染过程中触发 setState。
    queueMicrotask(() => {
      if (set.has(cb)) cb(replay);
    });
  }

  return () => {
    set.delete(cb);
  };
}

let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

/** 父窗口是否已经出现过（用来判断是嵌在 DSH 里还是被单独打开）。 */
let parentSeen = false;

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as { __herta?: boolean; kind?: string; id?: number; value?: unknown; error?: string; event?: string; payload?: unknown };
  if (msg === null || typeof msg !== "object" || msg.__herta !== true) return;
  parentSeen = true;
  if (msg.kind === "reply") {
    const slot = pending.get(msg.id as number);
    if (slot === undefined) return;
    pending.delete(msg.id as number);
    if (typeof msg.error === "string") slot.reject(new Error(msg.error));
    else slot.resolve(msg.value);
    return;
  }
  if (msg.kind === "event" && typeof msg.event === "string") {
    lastPayload.set(msg.event, msg.payload);
    for (const cb of listeners.get(msg.event) ?? []) cb(msg.payload);
  }
});

/** 调用父窗口。父窗口没应答就超时失败，由调用方决定降级值。 */
function call<T>(method: string, params?: unknown, timeoutMs = 8_000): Promise<T> {
  const id = (seq += 1);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    window.parent.postMessage({ __herta: true, kind: "call", id, method, params }, "*");
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`父窗口没有应答：${method}`));
    }, timeoutMs);
  });
}

/** 带降级的调用：父窗口不可用时用默认值，界面不至于白屏。 */
function callOr<T>(method: string, fallback: T, params?: unknown): Promise<T> {
  return call<T>(method, params).catch(() => fallback);
}

/**
 * 造一个 bridge。
 *
 * 事件类成员（`onXxx`）不在这里推送 —— 由父窗口发 `{kind:'event'}` 过来。
 * 唯一例外是兜底：如果一小会儿之后父窗口从没出现过（被单独打开调试），
 * 主动推一个 `noSession`，让渲染层走它的「未连接」分支而不是一直转圈。
 */
export function createBridge() {
  // 报个到。父窗口收到 hello 后才知道该往这边推初始的 reset
  //（不推的话渲染层会一直停在启动画面）。
  window.parent.postMessage({ __herta: true, kind: "hello" }, "*");

  // 兜底：如果一小会儿之后父窗口从没出现过（这一页被单独打开调试），
  // 自己推一个 noSession，让渲染层走「未连接」分支而不是一直转圈。
  setTimeout(() => {
    if (!parentSeen) {
      for (const cb of listeners.get("reset") ?? []) cb({ noSession: true });
    }
  }, 800);

  return {
    platform: "win32",
    // Electron 43 起 File.path 被移除，真实拖放在浏览器里拿不到路径。
    // 官网就是这个做法：返回空串，composer 会过滤掉空路径。
    pathForFile: () => "",

    // ── 会话生命周期 ──────────────────────────────────────────────────────
    submitText: (text: string, stagedImageIds?: readonly string[]) =>
      call("submitText", { text, stagedImageIds }),
    interrupt: (turnId?: string) => callOr("interrupt", { ok: false }, { turnId }),
    rewindLastTurn: (sessionId: string) => call("rewindLastTurn", { sessionId }),
    maybePlayEasterEgg: () => callOr("maybePlayEasterEgg", undefined),
    listSessions: () => callOr("listSessions", []),
    openSession: (sessionId: string) => call("openSession", { sessionId }),
    createSession: (opts: unknown) => call("createSession", { opts }),
    deleteSession: (sessionId: string) =>
      callOr("deleteSession", { ok: false, wasActive: false }, { sessionId }),
    resolveApproval: (opts: unknown) => callOr("resolveApproval", { ok: false, reason: "no_pending_overlay" }, { opts }),

    // ── 工作区 / 附件（浏览器里都没有真正的实现，按契约降级）──────────────
    pickWorkspace: async () => null,
    setWorkspace: async () => ({ ok: false, message: "由 DSH 侧管理工作区" }),
    resetWorkspace: async () => ({ ok: false, message: "由 DSH 侧管理工作区" }),
    pickAttachments: async () => null,
    attachFiles: async () => ({ ok: false, message: "整机视图不支持附件" }),
    removeAttachment: async () => ({ ok: true }),
    stageImages: async () => ({ ok: false, message: "整机视图不支持图片暂存" }),
    unstageImage: async () => false,

    // ── 语音（VoiceSettings 那 12 个方法的接任者，见 Herta-语音模块-交接.md §2.2）──
    // 全部由父窗口（DSH client 半侧）应答：
    //   · 引擎 / 实时语音开关 / 静音 / 音量 → DSH 的设置命名空间 `herta`
    //   · 离线模型         → 插件自持的下载端点（`/herta-voice-model`）
    //
    // **三个成员以前是坏的，这里都修了**：
    //   · `downloadVoiceModel` 的兜底值曾是 `phase:"ready"` —— 父窗口没应答时
    //     界面会显示「已就绪」，而盘上什么都没有。这正是仓库别处修过的「假绿」，
    //     改成 `absent`：证明不了的可用性一律不声称。
    //   · `onVoiceModel` 曾是 `() => () => {}`（永不订阅），于是下载进度永远不动。
    //   · `cancelVoiceModelDownload` 曾是空函数 —— 点了取消什么都不发生。
    getRealtimeVoice: () => callOr("getRealtimeVoice", null),
    setRealtimeVoice: (enabled: boolean) =>
      callOr("setRealtimeVoice", undefined, { next: enabled }),
    getVoiceEngine: () => callOr("getVoiceEngine", "local"),
    setVoiceEngine: (engine: string) =>
      callOr("setVoiceEngine", undefined, { engine }),
    // 静音与音量：整机那边原本自己存在 localStorage，DSH 侧读不到也写不到。
    // 现在这两个值由 DSH 设置页持有、经这里下发（`voice-prefs.ts` 接住），
    // 所以 `callOr` 的兜底要与 `settings-schema.js` 的默认值一致：不静音、满音量。
    // 单位是 **0–1**（与 HTMLAudioElement / WebAudio 同），设置字段那边是 0–100。
    getVoicePrefs: () => callOr("getVoicePrefs", { muted: false, volume: 1 }),
    setVoiceMuted: (muted: boolean) => callOr("setVoiceMuted", undefined, { muted }),
    setVoiceVolume: (volume: number) => callOr("setVoiceVolume", undefined, { volume }),
    downloadVoiceModel: () =>
      callOr("downloadVoiceModel", {
        phase: "absent",
        receivedBytes: 0,
        totalBytes: 0,
        unpackedBytes: 0,
      }),
    onVoiceModel: (cb: Listener) => {
      // **订阅要通知父窗口**：`on()` 只是本地登记监听，父窗口并不知道有人在等
      // 这个事件。少了这一句，父窗口那个 `onVoiceModel` 应答器永远不会被触发，
      // 于是它既不去读宿主的模型状态、也不推 `voiceModel` 事件 —— 设置面板里
      // 「语音模型」一直显示「约 0 MB」，而按钮/进度也跟着不动（实测踩到）。
      // 真实 Electron preload 的订阅本来就会走到主进程，这里补上这一步。
      void callOr("onVoiceModel", undefined);
      return on("voiceModel", cb);
    },
    prepareMiniMaxVoice: () => callOr("prepareMiniMaxVoice", { phase: "absent" }),
    onMiniMaxVoice: () => () => {},
    clearMiniMaxKey: () =>
      callOr("clearMiniMaxKey", {
        // 兜底也如实：父窗口没应答就是**没删成**，不能回 ok:true。
        ok: false,
        status: { set: false, hint: "父窗口没有应答", encrypted: true },
      }),
    // 真存：父窗口把它写进 DSH 的凭据存储（ref `MINIMAX_API_KEY`）。
    setMiniMaxKey: (key: string) =>
      callOr("setMiniMaxKey", { ok: false, reason: "父窗口没有应答" }, { key }),
    cancelVoiceModelDownload: () => callOr("cancelVoiceModelDownload", undefined),
    removeVoiceModel: () =>
      callOr("removeVoiceModel", {
        phase: "absent",
        receivedBytes: 0,
        totalBytes: 0,
        unpackedBytes: 0,
      }),

    // ── 设置 ──────────────────────────────────────────────────────────────
    //
    // **这一组以前是坏的**：三个 getter 返回硬编码常量，三个 setter 是
    // `async () => {}` 的空实现 —— 她的设置面板能点、点了不报错、值却永远不变
    // （典型假绿）。现在六个都真的转发给父窗口，父窗口读写 DSH 的设置命名空间
    // `herta`，也就是 DSH 设置页里「黑塔」那一页的同一份值。
    //
    // 参数名跟着上游 `bridge-types.ts` 的契约走（`:617-672`）：
    //   getDreamConfig/setDreamConfig(cfg)  getLocale/setLocale(locale)
    //   getCloseToTray/setCloseToTray(enabled)
    getDreamConfig: () => callOr("getDreamConfig", { enabled: true }),
    setDreamConfig: (cfg: unknown) => callOr("setDreamConfig", undefined, { cfg }),
    getLocale: () => callOr("getLocale", "zh"),
    setLocale: (locale: string) => callOr("setLocale", undefined, { locale }),
    getCloseToTray: () => callOr("getCloseToTray", true),
    setCloseToTray: (enabled: boolean) => callOr("setCloseToTray", undefined, { enabled }),
    // 密钥：**如实报告，不假装成功**。
    //
    // 上一版 `getDeepSeekKeyStatus` 的兜底值是 `{set:true}` —— 父窗口没应答时
    // 界面显示「密钥已设置」，而谁也不知道 DSH 有没有那把钥匙。现在兜底是
    // 「未设置」：证明不了的可用性一律不声称（与上面 `downloadVoiceModel`
    // 那条同一个口径）。父窗口应答时读的是 DSH 真正的凭据缝。
    getDeepSeekKeyStatus: () =>
      callOr("getDeepSeekKeyStatus", { set: false, hint: null, encrypted: true }),
    // DeepSeek 密钥归 DSH 自己的模型配置管（凭据 ref `DEEPSEEK_API_KEY`），
    // 她的界面里没有第二个填它的地方：这条写路径如实拒绝。
    setDeepSeekKey: async () => ({ ok: false, reason: "rejected" as const }),
    clearDeepSeekKey: async () => ({ ok: true as const, status: { set: false, hint: "", encrypted: false } }),

    // ── 窗口控制（iframe 里没有窗口可言，全部空实现）──────────────────────
    windowMinimize: () => {},
    windowToggleMaximize: () => {},
    windowClose: () => {},
    windowIsMaximized: async () => false,
    onWindowMaximized: (cb: Listener) => on("windowMaximized", cb),

    // ── 推送事件 ──────────────────────────────────────────────────────────
    onWorkspace: (cb: Listener) => on("workspace", cb),
    onRecord: (cb: Listener) => on("record", cb),
    onOverlay: (cb: Listener) => on("overlay", cb),
    onSpeech: (cb: Listener) => on("speech", cb),
    onAgent: (cb: Listener) => on("agent", cb),
    onTurn: (cb: Listener) => on("turn", cb),
    onReset: (cb: Listener) => on("reset", cb),
    onTitle: (cb: Listener) => on("title", cb),
    onSessionDeleted: (cb: Listener) => on("sessionDeleted", cb),
    onVoice: (cb: Listener) => on("voice", cb),
  };
}
