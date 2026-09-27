/**
 * dsh-herta 的 host（Node）半侧。
 *
 * 这个包同时出现在两个平面上，**它们是不同的东西，必须各司其职**：
 *
 *   · profile bundle 行（宿主面，`plane` 未设）
 *       —— 只负责让 client 半侧进入浏览器启动图，界面才存在。
 *          `@deepseek-ai/dsh-client-modules` 只扫 `loader.entries()`，
 *          而 preset 子树刻意不在这次遍历里，所以界面**必须**靠这一行。
 *       —— 如果在这里注册工具，会泄漏给**所有**会话（包括 standard）。
 *       —— 也是**设置命名空间**的载体：只有 profile 顶层那一条 `id: herta`
 *          能被 `configEditor` 看到，所以 Config 只能挂在这一行上。
 *
 *   · preset 行（agent 面，`plane: preset`）
 *       —— 为「黑塔」这个 preset 的会话挂上她的记忆货架段与记忆工具。
 *          注册进的是 preset 的作用域层，只对该 preset 的 agent 可见。
 *
 * 两个实例的 `apply` 都会跑（ESM 缓存让模块只求值一次，但 fiber 是两个），
 * 所以**模块级可变状态必须与平面无关或按 key 索引** —— 下面的缓存按 cwd 索引，
 * 设置呈现（`configure({auto:false})`）则只在宿主面跑。
 */
import z from "@deepseek-ai/schemastery";
import { readNarrativeSync } from "./narrative.js";
import { HERTA_TOOLS } from "./tools.js";
import { hertaDreamTool } from "./dream.js";
import { registerVoiceRoute, hertaSpeakTool } from "./voice.js";
import { registerDirRoute } from "./static-route.js";
import { registerVoiceModelRoute } from "./voice-model-route.js";
import {
  hertaSayTool,
  installMiniMaxSpeech,
  installMiniMaxVoice,
  registerMiniMaxVoiceRoutes,
} from "./minimax-voice.js";
import { HERTA_UI_DIR, HERTA_UI_ROUTE } from "./herta-ui-route.js";
import { FIELD_NAMES, FIELDS } from "./settings-schema.js";

/** Cordis 插件名，与 cordis.patch.yml / preset 里的 loader 条目 id 一致。 */
export const name = "herta";

/** 注册 prompt 段与工具需要的两个服务。 */
export const inject = ["tools", "systemPrompt"];

/**
 * 设置命名空间 = profile 条目 id。
 *
 * 必须是字面量：`@deepseek-ai/dsh-settings` 的 `describe()` 按
 * `entry.options.id` 建表，客户端 `ctx.configForms.get(id)` 也按同一个 id 取。
 * 两处写死同一个字符串是有意的 —— 它们跨进程，没有可共享的常量。
 */
export const HERTA_SETTINGS_NAMESPACE = "herta";

/**
 * 插件 Config —— 「黑塔」全部设置的**唯一真相**。
 *
 * ## 为什么每个字段都必须 `.volatile()`
 *
 * `@deepseek-ai/dsh-settings` 的 `volatileForm()` 只把 volatile 字段投影进表单：
 * 没有 volatile 字段的条目 `describe()` 直接跳过，写侧也会抛
 * `Plugin entry "herta" has no volatile fields`。换来的好处是这些字段**改了就生效**：
 * loader 把新值提交进同一个引用（`_commitVolatile`），不重挂插件。
 *
 * ## 为什么 schema 是**生成**的、不是手写的
 *
 * 字段名、合法取值、默认值都住在 `settings-schema.js` 的 `FIELDS` 里 ——
 * 客户端也要用同一份（页面标签、枚举选项、默认值）。手写一遍 schema
 * 等于给「字段名 ↔ 取值域」造第二个真相来源，而两者漂移的症状是
 * 「设置页能选，取值被判非法」——同一个值到了整机那边被判非法的代价是
 * **整份设置文件回落默认**，所以这条不能靠人记。
 *
 * 平铺字段名（而不是嵌套的 `backend.thinking`）是客户端 API 逼出来的：
 * `ConfigForm.set(field, value)` 只接受根级单字段。
 *
 * ## 这里不再有 `followedFields`
 *
 * 上一版还有第二个字段：用户声明「这一项跟随整机」的名单，宿主据此跳过种子。
 * 它随**写回**一起删除了 —— 种子与写回都没了，「跟随」就无对象可言。
 */
export const Config = z.object({
  ...Object.fromEntries(
    FIELD_NAMES.map((field) => {
      const spec = FIELDS[field];
      if (spec.kind === "boolean") return [field, z.boolean().default(spec.def).volatile()];
      if (spec.kind === "enum") return [field, z.union([...spec.values]).default(spec.def).volatile()];
      if (spec.kind === "number") {
        return [field, z.number().min(spec.min).max(spec.max).default(spec.def).volatile()];
      }
      return [field, z.string().default(spec.def).volatile()];
    }),
  ),
});

/**
 * 挂「设置**呈现**」。
 *
 * 这个函数曾经叫 `installSettingsWriteBack`，做的是把用户改过的字段写回整机
 * 自己读的那两份 `settings.json`，外加首次种子迁移。**整块已删除**，理由是
 * 两条实测事实：
 *
 *   · 嵌在 DSH 里的整机从来不读那些文件 —— 它的每个设置都经 postMessage
 *     向父窗口要，父窗口再读 `ctx.configForms.get("herta")`。唯一真相只有一份。
 *   · 读那两份文件的是独立安装的 `Herta.exe`，而它已判定不再维护。
 *
 * 于是这里只剩下一件事：**声明这一页由插件自带**（`configure({auto:false})`），
 * 免得将来某个客户端按 schema 自动生成页时多出一页。
 *
 * ## 为什么必须 `ctx.inject` 而不是写进 `inject` 数组
 *
 * 无头 / SDK 组合里没有 `settings` 服务，硬依赖会让整个插件永不挂载 ——
 * 记忆、语音、界面会跟着一起没。
 *
 * ## 为什么 owner 要显式传 `ctx.fiber`
 *
 * `ctx.inject(deps, cb)` 在 cordis 里就是 `this.plugin({inject, apply: cb})`
 * （`cordis/lib/index.js:1600-1606`），而 `plugin()` 会 `new Fiber(...)`
 * —— 回调拿到的是**另一条 fiber**，不是这条插件实例自己的。官方自带页插件
 * 全都显式传 `ctx.fiber`，正是这个原因。
 *
 * @param {object} ctx - 宿主面 cordis 上下文。
 */
function installSettingsPresentation(ctx) {
  ctx.inject(["settings"], (scoped) => {
    // 自带页面：不这么声明，将来某个客户端按 schema 自动生成页时会多出一页。
    scoped.effect(
      () => scoped.settings.configure({ auto: false }, ctx.fiber),
      "dsh-herta: settings presentation",
    );
    console.log(`[dsh-herta] 设置命名空间已就绪：${HERTA_SETTINGS_NAMESPACE}（自带页面，不自动生成）`);
  });
}

/**
 * prompt 段的 `text` 必须是**同步**的（DSH 没有异步 prompt provider），
 * 而读货架是 IO。所以这里做一层按 cwd 索引的小缓存：组装时同步查表，
 * 表过期才重新读盘。
 *
 * 键必须是 cwd 而不是模块级单值 —— preset 实例是常驻的，会服务多个会话。
 */
const CACHE_TTL_MS = 3_000;
const narrativeCache = new Map();

function narrativeFor(cwd) {
  const now = Date.now();
  const hit = narrativeCache.get(cwd);
  if (hit !== undefined && now - hit.at < CACHE_TTL_MS) return hit;

  let entry;
  try {
    const r = readNarrativeSync(cwd);
    entry = { at: now, text: r.text, tokens: r.tokens };
  } catch (error) {
    // 读盘失败不该让整次组装炸掉 —— 退化成本段为空并记下原因。
    entry = { at: now, text: "", tokens: 0, error: String(error?.message ?? error) };
  }
  narrativeCache.set(cwd, entry);
  return entry;
}

/**
 * @param ctx - 宿主 cordis 上下文。
 * @param config - loader 行配置；`plane: 'preset'` 标记 agent 面那一行。
 */
export function apply(ctx, config) {
  const plane = config?.plane ?? "host";
  // 挂载日志保留是有意的：DSH 的插件挂载失败往往是静默的，
  // 而「这个包到底有没有被挂上、挂在哪个平面」是排查一切问题的第一问。
  console.log(`[dsh-herta] host 半侧已挂载（plane=${plane}）`);

  // 宿主面这一行只做**进程级**的三件事：
  //   1. 让 client 半侧进启动图（由包里的 dsh.client 声明自动完成，不需要代码）
  //   2. 把 80 条语音资产的静态路由挂上（C 层，静态资源挂一次就够）
  //   3. 声明设置命名空间由我们自带页面（设置就挂在 profile 的这一行上）
  // 不在这里注册任何模型可见的东西 —— 那会泄漏给所有会话。
  if (plane !== "preset") {
    // 设置呈现**不依赖 webServer**：无头组合里也该把命名空间声明出来。
    installSettingsPresentation(ctx);

    // MiniMax 云端语音：服务 + 启动认领 + 凭据变化重认领。这一条也**不依赖
    // webServer**（无头组合里它照样能认领、能读状态，只是没人推 PCM）。
    installMiniMaxVoice(ctx, config);

    // 用 `ctx.inject` 而不是直接 `ctx.get('webServer')`：宿主行的挂载早于
    // webserver 行就绪，直接 get 会拿到 undefined（实测就是这样，日志会打
    // 「没有 webServer」）。`inject` 会等服务出现再回调，且在没有 web 的
    // 组合（无头/SDK）里只是永远不触发，不会把插件卡成 PENDING。
    ctx.inject(["webServer"], (scoped) => {
      scoped.effect(() => registerVoiceRoute(scoped) ?? (() => {}), "dsh-herta: voice route");
      // 本地语音模型（离线 TTS）的下载端点：GET 状态 / POST 动作。
      // 固定参数（URL/体积/SHA-256）来自上游 Herta，见 tts-release.js。
      scoped.effect(
        () => registerVoiceModelRoute(scoped) ?? (() => {}),
        "dsh-herta: voice model route",
      );
      // MiniMax 的两条端点：SSE（PCM 推给浏览器半侧）与状态/手动认领。
      scoped.effect(
        () => registerMiniMaxVoiceRoutes(scoped) ?? (() => {}),
        "dsh-herta: minimax routes",
      );
      // 「Herta 整机」页面（甲方案）：入口 html 不缓存，改了刷新即可见。
      scoped.effect(
        () =>
          registerDirRoute(scoped, {
            prefix: HERTA_UI_ROUTE,
            dir: HERTA_UI_DIR,
            noCache: true,
          }) ?? (() => {}),
        "dsh-herta: herta-ui route",
      );
      console.log(`[dsh-herta] 整机页面已挂：${HERTA_UI_ROUTE}`);
    });
    return;
  }

  // ── 她的记忆货架段 ──────────────────────────────────────────────────────
  // order 100：紧跟在人格前缀（0）之后、第一方工具引导（500+）之前 ——
  // 与她自己那套「自传 + 废案样本 + 环境」的顺序一致。
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: "herta:narrative",
        order: 100,
        text: (context) => {
          const cwd = context.agent?.session.header.cwd;
          if (cwd === undefined) return "";
          // 空段落会被 renderPrompt 丢掉，所以货架为空时天然不占位。
          return narrativeFor(cwd).text;
        },
      }),
    "dsh-herta: narrative section",
  );

  // ── 她的记忆 / 做梦 / 发声工具 ───────────────────────────────────────────
  // `herta_speak` 放的是**录音片段**；`herta_say` 走 **MiniMax 云端合成**
  // （她自己的克隆音色），既是调试入口也是语音链路的验收通道。
  for (const tool of [...HERTA_TOOLS, hertaDreamTool, hertaSpeakTool, hertaSayTool]) {
    ctx.effect(() => ctx.tools.register(tool), `dsh-herta: tool ${tool.name}`);
  }

  // ── 云端语音的说话管线（只在这一面挂）──────────────────────────────────
  // 订阅助手流与 turn 边界：正文边写边念；复核否决/重说时把还在流的那一段掐掉。
  // 挂在 preset 面而不是 host 面，是因为这里的监听器**只覆盖黑塔自己的会话**。
  // 刻意不传 config：分发只看 host 平面那份（见 minimax-voice.js 的 setConfig）。
  installMiniMaxSpeech(ctx);

  // ── 叙述调度层（方案 B）────────────────────────────────────────────────
  // 让她的回复恢复原版的叙述行为：分拍、thought tag、自我收回、supervisor 复核。
  // 详见 `docs/叙述调度层设计.md`。
  //
  // **刻意用动态 import**：静态 import 的解析失败发生在模块求值阶段，会让
  // **整个插件挂载失败** —— 那会把记忆 / 语音 / 界面一起弄坏。包在 try 里，
  // 最坏情况只是叙述层缺席，其余照常（宿主插件的裸包名解析见 narrative-layer.js
  // 的模块注释：DSH 用 profile 根作基准，不是插件目录）。
  void import("./narrative-layer.js")
    .then((m) => m.installNarrativeLayer(ctx))
    .catch((error) => {
      const marks = (globalThis.__DSH_HERTA_HOST__ ??= {});
      marks.narrativeInstalled = false;
      marks.narrativeError = String(error?.message ?? error);
      console.log(`[dsh-herta] 叙述层未挂载：${marks.narrativeError}`);
    });
}
