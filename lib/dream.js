/**
 * 做梦：把一份她自己写的废案**晋升**到记忆货架，并记进做梦账本。
 *
 * ## 与 Herta 原版的关系（重要，别误读）
 *
 * Herta 的 dream 是一个**离线自主**的 pass：切分会话 → 选片段 → 用它自己的
 * LLM 蒸馏出候选 → 语气复核 → 晋升或归档（`@herta/knowledge/dream`，约 6700 行）。
 *
 * 这里保留了两件真正有分量的东西：
 *   · **晋升门** —— 格式门（与读取端同一道）+ 标题新颖性 + 篇幅下限
 *   · **做梦账本** —— `<workspace>/.herta/dream/manifest.json`，
 *     逐条记 promoted/archived 与原因，与上游同构
 *
 * 换掉的是**蒸馏环节**：在 DSH 里模型就是她本人，会话上下文就在她眼前，
 * 再让宿主另起一次 LLM 调用去「蒸馏她自己」既昂贵又绕。所以由她在会话里
 * 写出候选，这个工具负责把关与落账。
 *
 * ## 两种用法（2026-09-19 起）
 *
 * 1. **直接晋升**（原样保留）：她给 `title` + `body`，工具过门、落账。
 * 2. **蒸馏晋升**（`distill: true`）：她只需说「把这段沉淀下来」，宿主另起一次
 *    LLM 调用，从当前会话片段里**蒸馏**出候选废案，再过同一道门、落同一本账。
 *    这是把上游的蒸馏环节接回来的结果（见 `dream-distill.js` 的文件头，
 *    说明取了上游多阶段管线里的哪一段）。
 *
 * **蒸馏不绕门**：两条路径都走 `promoteFeian` 的三道门。
 *
 * ## 拿 llm 服务的方式（一个丑陋但必要的绕路）
 *
 * 工具的 `execute(args, exec)` **拿不到 `ctx`**（`exec` 上只有 agent / callId /
 * name / arguments / signal），而蒸馏需要 `ctx.llm` 服务。所以叙述层挂载时把
 * `ctx.llm` 放进 `globalThis.__DSH_HERTA_HOST__`，这里读回来。
 *
 * 为什么 `globalThis` 可以接受：这正是本插件一贯的做法 —— DSH 不把宿主 cordis
 * 上下文暴露出来，`globalThis.__DSH_HERTA__`（客户端）就是这个理由建的。
 * 别的工具（记忆/发声）不需要它，因为它们不调 LLM。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { promoteFeian, titlesOf } from "./feian.js";
import { NARRATIVE_REL, readNarrative } from "./narrative.js";
import { pickExcerpt } from "./session-surface.js";
import { resolveRoute } from "./supervisor.js";
// 注意：**不要**在这里静态 import `dream-distill-llm.js` —— 它静态 import
// `@deepseek-ai/dsh-llm`，而本文件被 `index.js` 静态 import。一旦那个包解析
// 失败，**整个插件挂载就崩了**（记忆 / 语音 / 界面一起没）。蒸馏路径里用
// 动态 import，最坏情况只是蒸馏不可用。

/** 做梦账本的位置（与 Herta 本体的 `.herta/dream/manifest.json` 一致）。 */
export const DREAM_MANIFEST_REL = join(".herta", "dream", "manifest.json");

/** 一份「梦」的篇幅下限 —— 低于这个长度不是一段记忆，是一句备忘。 */
const MIN_DREAM_CHARS = 120;

function manifestPath(cwd) {
  return join(cwd, DREAM_MANIFEST_REL);
}

/**
 * 读做梦账本。不存在时返回空账本 —— 还没做过梦是正常状态，不是错误。
 * @param cwd - 会话工作区根。
 */
export async function readDreamManifest(cwd) {
  try {
    const raw = await readFile(manifestPath(cwd), "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      lastRunAt: parsed.lastRunAt ?? null,
      episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
      created: Array.isArray(parsed.created) ? parsed.created : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, lastRunAt: null, episodes: [], created: [] };
    // 账本坏了不该让做梦整个失败 —— 从空账本继续，坏文件留在原地可人工检查。
    if (error instanceof SyntaxError) return { version: 1, lastRunAt: null, episodes: [], created: [] };
    throw error;
  }
}

/**
 * 往账本追加一条 episode。写入是整份重写（账本很小，且要保证
 * `lastRunAt` 与 `episodes` 同一次落盘，不会出现只更新一半的状态）。
 */
async function appendDreamEpisode(cwd, episode, created) {
  const manifest = await readDreamManifest(cwd);
  const next = {
    version: manifest.version,
    lastRunAt: episode.at,
    episodes: [...manifest.episodes, episode],
    created: created === undefined ? manifest.created : [...manifest.created, created],
  };
  const path = manifestPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/**
 * 过晋升门 → 落账 → 组返回值。**两条路径（直接晋升 / 蒸馏）共用这一个出口。**
 *
 * 抽出来的理由不只是去重：门与账必须是**同一条代码路径**，否则某天改了其中
 * 一条（比如加一道新门）而忘了另一条，做梦的账本就会与货架不一致。
 *
 * @param {string} cwd - 会话工作区根。
 * @param {string} at - 本次做梦的时间戳（ISO）。
 * @param {string} title - 标题。
 * @param {string} body - 正文。
 * @returns {Promise<object>} 工具的输出值。
 */
async function promoteAndRecord(cwd, at, title, body) {
  const promoted = await promoteFeian(cwd, { title, body });
  const episode = promoted.saved
    ? { at, result: "promoted", title, file: promoted.name, tokens: promoted.tokens }
    : { at, result: "archived", title, reason: promoted.reason };

  const next = await appendDreamEpisode(
    cwd,
    episode,
    promoted.saved ? { title, file: promoted.name, state: "live" } : undefined,
  );

  return {
    result: promoted.saved ? "promoted" : "archived",
    name: promoted.saved ? promoted.name : "",
    tokens: promoted.saved ? promoted.tokens : 0,
    reason: promoted.saved ? "" : (promoted.reason ?? "未通过晋升门"),
    promoted: next.episodes.filter((e) => e.result === "promoted").length,
    archived: next.episodes.filter((e) => e.result === "archived").length,
  };
}

/**
 * 做梦。
 *
 * 输入是她写好的一份废案。工具做三件事：过晋升门 → 落盘或拒收 → 记账。
 * **拒收不抛错**：返回原因让她改一版重试，这正是她真实账本里
 * 「invalid after refine: bad header」那些条目的形态。
 */
export const hertaDreamTool = defineTool({
  name: "herta_dream",
  description:
    "把一段经历沉淀成一份废案，写进黑塔的记忆货架（做梦）。"
    + "用它，而不是随手记事：这里的门槛更高（格式、标题不重复、篇幅下限），"
    + "而且每一条都会记进做梦账本（promoted / archived 与原因）。"
    + ""
    + "两种用法："
    + "① 你已经有成稿 —— 给 title + body；"
    + "② 你只想说「把刚才这段沉淀下来」—— 设 distill: true，"
    + "宿主会另起一次调用，从当前会话片段里蒸馏出候选废案再落账。"
    + ""
    + "body 必须自带 `### 废案_NN：<标题>` 头（编号由工具分配，你只要给标题），"
    + "对话栅栏（（我 说）…（/我 说））必须成对闭合、不得嵌套。"
    + "被拒收时会告诉你原因，改一版再试即可。",
  parameters: {
    title: {
      type: "string",
      description: "这段记忆的标题。直接晋升时必给；distill 模式下由宿主生成。",
    },
    body: {
      type: "string",
      description:
        "正文，至少 120 字。可含（我 说）/（我 想）这类对话栅栏，必须成对闭合。"
        + "直接晋升时必给；distill 模式下由宿主生成。",
    },
    distill: {
      type: "boolean",
      description:
        "设 true 时改走蒸馏：宿主读当前会话片段，另起一次 LLM 调用产出候选废案。"
        + "适合「这段值得记，但我不想现在写」的场合。",
    },
  },
  output: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        result: { type: "string", description: "promoted 或 archived。" },
        name: { type: "string", description: "晋升后的文件名（archived 时为空）。" },
        tokens: { type: "number", description: "晋升正文的估算 token。" },
        reason: { type: "string", description: "archived 的原因（promoted 时为空）。" },
        promoted: { type: "number", description: "账本里累计晋升条数。" },
        archived: { type: "number", description: "账本里累计归档条数。" },
      },
    },
    render: (args, value) =>
      value.result === "promoted"
        ? [
            {
              type: "text",
              text: `已晋升：${value.name}（约 ${value.tokens} token）。账本：累计晋升 ${value.promoted} 条、归档 ${value.archived} 条。`,
            },
          ]
        : [{ type: "text", text: `这次没有记下来（archived）：${value.reason}` }],
  },
  async execute(args, exec) {
    const cwd = exec.agent?.session.header.cwd;
    if (cwd === undefined) {
      throw new Error("dsh-herta: herta_dream 需要所属会话的工作区（session.header.cwd 缺失）");
    }
    const at = new Date().toISOString();

    // ── 路径二：蒸馏 ────────────────────────────────────────────────────────
    // 她说「沉淀一下」，宿主另起一次 LLM 调用产出候选，再过同一道门。
    if (args.distill === true) {
      const g = globalThis.__DSH_HERTA_HOST__;
      const session = exec.agent?.session;
      const nodes = session?.surface?.nodes ?? [];
      const excerpt = pickExcerpt({
        nodes,
        eventAt: (seq) => session?.eventAt(seq),
        deriveMessage: (event) => session?.deriveEventMessage(event),
      });

      // 三条前置条件各自给出**可操作**的拒绝理由，而不是笼统失败 ——
      // 她（或用户）需要知道是「没有片段」还是「没有模型可用」。
      const route = resolveRoute(exec.agent);
      const blocker =
        g?.llm === undefined || g?.llm === null
          ? "宿主没有可用的 llm 服务（叙述层未挂载，或该组合里没有 llm）"
          : excerpt.trim().length === 0
            ? "这个会话里还没有可用的对话片段"
            : route === null
              ? "拿不到当前会话的模型路由（provider/model）"
              : null;
      if (blocker !== null) {
        const episode = { at, result: "archived", title: "(蒸馏)", reason: blocker };
        const next = await appendDreamEpisode(cwd, episode);
        return {
          result: "archived",
          name: "",
          tokens: 0,
          reason: blocker,
          promoted: next.episodes.filter((e) => e.result === "promoted").length,
          archived: next.episodes.filter((e) => e.result === "archived").length,
        };
      }

      // 已有标题进去 —— 提示词据此要求「取一个不同的」，从源头减少撞门。
      const before = await readNarrative(cwd);
      // 动态 import：见文件头的说明（静态会把整个插件拖下水）。
      const { distillFeian } = await import("./dream-distill-llm.js");
      const outcome = await distillFeian({
        ctx: g.ctx,
        route,
        excerpt,
        existingTitles: titlesOf(before.files),
        signal: exec.signal,
      });
      if (outcome.ok === false) {
        const reason = `蒸馏未产出候选（${outcome.stage}）：${outcome.reason}`;
        const episode = { at, result: "archived", title: "(蒸馏)", reason };
        const next = await appendDreamEpisode(cwd, episode);
        return {
          result: "archived",
          name: "",
          tokens: 0,
          reason,
          promoted: next.episodes.filter((e) => e.result === "promoted").length,
          archived: next.episodes.filter((e) => e.result === "archived").length,
        };
      }
      // 落进与直接晋升**完全相同**的门与账。
      return await promoteAndRecord(cwd, at, outcome.title, outcome.body);
    }

    // ── 路径一：直接晋升 ────────────────────────────────────────────────────
    const title = String(args.title ?? "").trim();
    const body = String(args.body ?? "");
    if (title.length === 0 || body.trim().length === 0) {
      // 误用而不是错误：告诉模型该怎么调，别让它猜。
      return {
        result: "archived",
        name: "",
        tokens: 0,
        reason:
          "需要 title + body（直接晋升），或者 distill: true（让宿主从会话里蒸馏）。"
          + "两者都没提供。",
        promoted: (await readDreamManifest(cwd)).episodes.filter((e) => e.result === "promoted").length,
        archived: (await readDreamManifest(cwd)).episodes.filter((e) => e.result === "archived").length,
      };
    }
    const chars = body.trim().length;

    // 篇幅下限：一份「梦」应当是一段完整的记忆，不是一句备忘。
    // 备忘走 herta_memory_save，那条路径没有这道门槛。
    if (chars < MIN_DREAM_CHARS) {
      const episode = { at, result: "archived", title, reason: `too short (${chars} < ${MIN_DREAM_CHARS} chars)` };
      const next = await appendDreamEpisode(cwd, episode);
      return {
        result: "archived",
        name: "",
        tokens: 0,
        reason: episode.reason,
        promoted: next.episodes.filter((e) => e.result === "promoted").length,
        archived: next.episodes.filter((e) => e.result === "archived").length,
      };
    }

    // 走与蒸馏路径**完全相同**的门与账（一个出口，两处调用）。
    return await promoteAndRecord(cwd, at, title, args.body);
  },
});

/** 账本里晋升过的条数 —— 给列表工具与将来的界面用。 */
export async function dreamStats(cwd) {
  const m = await readDreamManifest(cwd);
  return {
    path: join(cwd, DREAM_MANIFEST_REL),
    lastRunAt: m.lastRunAt,
    promoted: m.episodes.filter((e) => e.result === "promoted").length,
    archived: m.episodes.filter((e) => e.result === "archived").length,
    episodes: m.episodes.length,
  };
}

/** 货架路径导出给测试用（避免测试里重复拼路径）。 */
export { NARRATIVE_REL };
