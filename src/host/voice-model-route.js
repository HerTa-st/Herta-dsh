/**
 * 本地语音模型的端点：`/herta-voice-model`。
 *
 * ## 为什么是「GET 状态 + POST 动作」而不是一次阻塞调用
 *
 * 归档 72.7 MiB、解包后 110.5 MiB，全程几十秒到几分钟。客户端要的是**进度**，
 * 不是一个挂住的请求。所以：
 *
 *   · `GET`  → 当前状态（`{phase, receivedBytes, totalBytes, unpackedBytes, …}`）
 *   · `POST` → `{"action": "download" | "cancel" | "remove"}`，**立刻**回当前状态
 *
 * `download` 是**点火即返回**：真正的下载在后台跑，进度靠客户端轮询 `GET` 拿。
 * 这样取消也简单 —— 另发一个 `{"action":"cancel"}`，不需要打断一个挂着的事务。
 *
 * 状态码与 `phase` 都用上游那套：`absent` / `downloading` / `ready` / `failed`，
 * 失败时带 `error`（`network` / `http` / `size` / `hash` / `archive` / `verify` /
 * `disk` / `cancelled`）—— 是**键**，由界面本地化。
 */
import { readJsonBody, sendJson } from "./http-json.js";
import { TTS_ARCHIVE_BYTES, TTS_BUNDLE_BYTES } from "./tts-release.js";
import { probeTtsRuntime } from "./tts-runtime.js";
import { createVoiceModelService, voiceModelStoreRoot } from "./voice-model.js";

/** 挂载前缀。与 `/herta-voice`（静态资产）等宿主自持端点并列。 */
export const HERTA_VOICE_MODEL_ROUTE = "/herta-voice-model";

/** 请求体只有一个小动作名，超过这个长度一定是别的东西。 */
const MAX_BODY = 4 * 1024;

const ACTIONS = new Set(["download", "cancel", "remove"]);

/**
 * 注册语音模型端点。
 *
 * @param ctx - 宿主 cordis 上下文（需要 `webServer` 服务）。
 * @returns 路由 disposer；没有 webServer 时返回 undefined（无头启动）。
 */
export function registerVoiceModelRoute(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === undefined) {
    console.log(`[dsh-herta] 没有 webServer，语音模型端点跳过（${HERTA_VOICE_MODEL_ROUTE}）`);
    return undefined;
  }

  const root = voiceModelStoreRoot();

  // 只在**阶段切换**时打日志：进度每 200 ms 一次，全打会把启动日志淹掉。
  let lastPhase = "absent";
  const service = createVoiceModelService({
    root,
    log: (line) => console.log(`[dsh-herta] ${line}`),
    onChange: (state) => {
      if (state.phase === lastPhase) return;
      lastPhase = state.phase;
      if (state.phase === "downloading") {
        console.log(
          `[dsh-herta] 语音模型开始下载：${(state.totalBytes / 1048576).toFixed(1)} MiB → ${root}`,
        );
      } else if (state.phase === "ready") {
        console.log(`[dsh-herta] 语音模型就绪：${service.bundleId}`);
      } else if (state.phase === "failed") {
        console.log(`[dsh-herta] 语音模型不可用（${state.error ?? "unknown"}）`);
      }
    },
  });

  /** 给客户端的完整快照：状态 + 固定参数（界面要显示体积与来源）+ 运行时探测。 */
  const snapshot = async () => ({
    ...service.state(),
    bundleId: service.bundleId,
    url: service.archive.url,
    pinnedBytes: TTS_ARCHIVE_BYTES,
    pinnedUnpackedBytes: TTS_BUNDLE_BYTES,
    // 运行时是**探测出来的**，不是写死的。设置面板把「下载模型」按钮与
    // 「实时语音」开关都 gate 在它上面（`disabled={!runtime}` 与
    // `canSpeak = bundle && runtime && !failed`）—— 写死 true 就正好造出
    // 仓库别处修过的那个假绿：面板显示已就绪，而她一个音也发不出来。
    // 探测走子进程把 addon 真加载起来，结果进程内缓存一次。
    runtime: await probeTtsRuntime(),
  });

  const disposer = webServer.register({
    kind: "prefix",
    path: HERTA_VOICE_MODEL_ROUTE,
    handler: async (req, res) => {
      const method = req.method ?? "GET";
      if (method === "GET" || method === "HEAD") {
        sendJson(res, 200, await snapshot());
        return;
      }
      if (method !== "POST") {
        sendJson(res, 405, { error: "method not allowed" });
        return;
      }

      const body = await readJsonBody(req, res, MAX_BODY);
      if (body === undefined) return; // 已回过 413 / 400

      const action = body !== null && typeof body === "object" ? body.action : undefined;
      if (typeof action !== "string" || !ACTIONS.has(action)) {
        sendJson(res, 400, {
          error: `unknown action: ${String(action)}`,
          allowed: [...ACTIONS],
        });
        return;
      }

      if (action === "download") {
        // 点火即走：不等它下完（那要几分钟），进度靠客户端轮询 GET。
        void service.download();
      } else if (action === "cancel") {
        service.cancel();
      } else {
        await service.remove();
      }
      sendJson(res, 200, await snapshot());
    },
  });

  console.log(`[dsh-herta] 语音模型端点已挂：${HERTA_VOICE_MODEL_ROUTE}（GET 状态 / POST 动作）`);
  return disposer;
}
