/**
 * 她的记忆工具。
 *
 * 三条原则：
 *
 * 1. **读与写共用同一道格式门**。写入路径也要过 `checkFewShot` —— 否则模型
 *    可以写一份栅栏不平衡的文件，下次组装时污染自己的提示词。门不是只管外来文件。
 *
 * 2. **工作区根只有一个来源**：`exec.agent.session.header.cwd`。工具是 per-agent 的，
 *    绝不能用进程级或模块级的当前目录。
 *
 * 3. **不猜状态**。列表工具如实报告「哪些进了当前提示词、哪些因预算落选、
 *    哪些被门拦下」，因为她的记忆纪律就建立在这件事上（她的自述：
 *    「记录里有什么我才说什么」）。
 */
import { existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { promoteFeian } from "./feian.js";
import {
  DEFAULT_MAX_TOKENS,
  NARRATIVE_REL,
  checkFewShot,
  estimatePromptTokens,
  readNarrative,
} from "./narrative.js";

/** 取会话工作区根。拿不到就抛 —— 工具必须知道自己在谁的目录里干活。 */
function cwdOf(exec) {
  const cwd = exec.agent?.session.header.cwd;
  if (cwd === undefined) {
    throw new Error("dsh-herta: 这个工具需要所属会话的工作区（session.header.cwd 缺失）");
  }
  return cwd;
}

/** 列出货架。 */
export const narrativeListTool = defineTool({
  name: "herta_narrative_list",
  description:
    "列出黑塔的记忆货架（<workspace>/.herta/narrative/）：每一份的名称、估算 token、"
    + "以及它是否进入了当前这次请求的系统提示词。用于回答「你记得什么」这类问题，"
    + "以及在派活之前确认货架上到底有什么。",
  parameters: {},
  output: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        directory: { type: "string", description: "货架的绝对路径。" },
        exists: { type: "boolean", description: "货架目录是否存在。还没写过记忆时为 false。" },
        entries: {
          type: "array",
          description: "货架上的每一份。",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              tokens: { type: "number", description: "估算 token。" },
              inPrompt: { type: "boolean", description: "是否进入了当前系统提示词。" },
            },
          },
        },
        dropped: {
          type: "array",
          description: "被格式门拦下的文件与原因（它们不会进提示词）。",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { name: { type: "string" }, reason: { type: "string" } },
          },
        },
        /**
         * **必须声明**：输出形状是 `additionalProperties: false`，返回值里多一个字段
         * 就会让整次调用报「returned invalid output」—— 2026-09-30 我真踩了这一步：
         * 渲染那边加了落选项，`execute` 也跟着返回 `skipped`，却忘了在这里声明，
         * 于是这个工具**每次都失败**（不是显示问题，是彻底不能用）。
         * 教训：加返回字段时，**形状声明与返回值要一起改**。
         */
        skipped: {
          type: "array",
          description: "因预算不够而**没进**本次提示词的那几份（按需仍可读，但这一轮她看不见）。",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { name: { type: "string" }, tokens: { type: "number" } },
          },
        },
        promptTokens: { type: "number", description: "进入提示词的合计估算 token。" },
        budgetTokens: { type: "number", description: "当前预算上限。" },
      },
    },
    render: (args, value) => {
      const lines = [];
      if (!value.exists) {
        lines.push(`货架还不存在：${value.directory}（还没有人往上面放过东西）`);
        return [{ type: "text", text: lines.join("\n") }];
      }
      const skippedNames = new Set(value.skipped.map((s) => s.name));
      lines.push(`货架：${value.directory}`);
      lines.push(`共 ${value.entries.length} 份，其中 ${value.entries.filter((e) => e.inPrompt).length} 份在本次提示词里（${value.promptTokens}/${value.budgetTokens} 估算 token）：`);
      for (const e of value.entries) {
        // 三个状态必须分清（2026-09-30）：以前只有「在提示词 / 按需可读」两种标签，
        // 于是**因预算落选**的那些读起来像是「都在，需要时能读」—— 而实际上这一轮
        // 她根本看不见它们。工具描述承诺过如实报告，这里才真的做到。
        const label = e.inPrompt
          ? "[在提示词]"
          : skippedNames.has(e.name)
            ? "[本次没进提示词]"
            : "[按需可读]";
        lines.push(`  ${label} ${e.name}  ~${e.tokens} tok`);
      }
      if (value.skipped.length > 0) {
        lines.push(
          `\n⚠️ 有 ${value.skipped.length} 份**没有**进本次提示词（预算 ${value.budgetTokens} 估算 token 装不下）：`,
        );
        for (const s of value.skipped) lines.push(`  ${s.name}  ~${s.tokens} tok`);
        lines.push(
          "它们仍然可以按需读（herta_narrative_read），但**这一轮她看不见** —— 想让她记住，"
          + "要么把某几份合并、要么删掉不要的（腾出预算）。",
        );
      }
      if (value.dropped.length > 0) {
        lines.push(`被格式门拦下 ${value.dropped.length} 份（不会进提示词）：`);
        for (const d of value.dropped) lines.push(`  ${d.name} —— ${d.reason}`);
      }
      return [{ type: "text", text: lines.join("\n") }];
    },
  },
  isConcurrencySafe: () => true,
  execute(_args, exec) {
    const cwd = cwdOf(exec);
    const dir = join(cwd, NARRATIVE_REL);
    return readNarrative(cwd).then((r) => ({
      directory: dir,
      exists: existsSync(dir),
      entries: r.items,
      dropped: r.dropped,
      skipped: r.skipped,
      promptTokens: r.tokens,
      budgetTokens: DEFAULT_MAX_TOKENS,
    }));
  },
});

/** 读一份样本的正文。 */
export const narrativeReadTool = defineTool({
  name: "herta_narrative_read",
  description:
    "读黑塔记忆货架上某一份的完整正文。用于「我上次是不是说过」这类需要看原文的场合 —— "
    + "不要凭印象复述，读出来照着念。",
  parameters: {
    name: { type: "string", required: true, description: "货架上的文件名（herta_narrative_list 给出的原名）。" },
  },
  output: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        found: { type: "boolean" },
        text: { type: "string", description: "清洗过的正文；found 为 false 时为空。" },
        tokens: { type: "number" },
        reason: { type: "string", description: "没读到时的原因（不存在 / 没通过格式门）。" },
      },
    },
    render: (args, value) => [
      {
        type: "text",
        text: value.found
          ? `【${value.name}】\n\n${value.text}`
          : `读不到「${args.name}」：${value.reason}`,
      },
    ],
  },
  isConcurrencySafe: () => true,
  async execute(args, exec) {
    const cwd = cwdOf(exec);
    const r = await readNarrative(cwd);
    if (!r.files.includes(args.name)) {
      return { name: args.name, found: false, text: "", tokens: 0, reason: "货架上没有这个文件" };
    }
    const droppedHit = r.dropped.find((d) => d.name === args.name);
    if (droppedHit !== undefined) {
      return { name: args.name, found: false, text: "", tokens: 0, reason: `没有通过格式门：${droppedHit.reason}` };
    }
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(join(cwd, NARRATIVE_REL, args.name), "utf8");
    const check = checkFewShot(args.name, raw);
    return check.ok
      ? { name: args.name, found: true, text: check.body, tokens: estimatePromptTokens(check.body) }
      : { name: args.name, found: false, text: "", tokens: 0, reason: check.reason ?? "未通过格式门" };
  },
});

/** 往货架上写一份新的废案。 */
export const memorySaveTool = defineTool({
  name: "herta_memory_save",
  description:
    "往黑塔的记忆货架上写一份新的废案（<workspace>/.herta/narrative/）。"
    + "正文必须自带一行 `### 废案_NN：<标题>` 头，且对话栅栏（（我 说）…（/我 说））必须成对闭合 —— "
    + "格式不合格会被拒绝，因为货架内容会在下次请求时进她的系统提示词。",
  parameters: {
    title: { type: "string", required: true, description: "标题，会写进 `### 废案_NN：<标题>`。" },
    body: {
      type: "string",
      required: true,
      description: "正文。可含（我 说）…（/我 说）这类对话栅栏，但必须成对闭合、不得嵌套。",
    },
  },
  output: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        saved: { type: "boolean" },
        name: { type: "string", description: "写入的文件名（saved 为 true 时）。" },
        path: { type: "string" },
        tokens: { type: "number" },
        reason: { type: "string", description: "被拒绝时的原因。" },
      },
    },
    render: (args, value) =>
      value.saved
        ? [{ type: "text", text: `已写入货架：${value.name}（约 ${value.tokens} token）` }]
        : [{ type: "text", text: `没有写入：${value.reason}` }],
  },
  async execute(args, exec) {
    const cwd = cwdOf(exec);
    // 走与做梦同一条晋升路径（fmt 门 + 标题新颖性 + 落盘），两条写入路径不分叉。
    // 区别只在：这条没有篇幅下限，也不记账本 —— 它是随手记一笔的入口。
    const r = await promoteFeian(cwd, { title: args.title, body: args.body });
    return r.saved
      ? { saved: true, name: r.name, path: r.path, tokens: r.tokens }
      : { saved: false, name: "", path: "", tokens: 0, reason: r.reason ?? "未通过写入检查" };
  },
});

/**
 * 把货架上的一份记忆**收起来**（归档）。
 *
 * ## 为什么是「收起」而不是「删掉」
 *
 * 2026-09-30 体检发现的缺口：六个工具里没有任何删除/清空入口，用户想让她忘掉一件事
 * 只能去文件管理器里手删 —— 而货架文件名带全角冒号，手工操作很容易删错。
 *
 * 但真删是不可逆的，而这是一份**记忆**。所以这条工具做的是「移出货架、留在归档区」：
 * 它立刻从提示词里消失（这是用户要的效果），原件仍然在盘上（这是保险）。
 * 返回里会明说「没有真删，想彻底删就自己删那个文件」—— 不替用户做不可逆的决定。
 *
 * ## 边界
 *
 *  · 只认货架的命名约定（`### 废案…` / `### 记录…`），免得它变成一把随处可用的刀；
 *  · **不接受路径分隔符**：这条工具会移动文件，`../` 之类必须在入口就挡住；
 *  · 同名已归档过就加数字后缀，**绝不覆盖**（归档区也要保住历史）。
 */
export const forgetTool = defineTool({
  name: "herta_forget",
  description:
    "把货架上的一份记忆收起来（移到 `.herta/narrative/archive/`，**不是真删**）。"
    + "用它来让她忘掉某件事：收起之后那份文件立刻不再进系统提示词。"
    + "文件名要用 `herta_narrative_list` 给出的原名（含 `### 废案…` 前缀与 `.txt`）。"
    + "想彻底删掉，自己删归档区里那个文件 —— 这条工具不替你做不可逆的事。",
  parameters: {
    name: { type: "string", required: true, description: "货架上的完整文件名（原名）。" },
    reason: { type: "string", description: "为什么收起来（会原样带回，方便以后回头看）。" },
  },
  output: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        forgotten: { type: "boolean" },
        name: { type: "string" },
        archivedTo: { type: "string", description: "归档后的完整路径（forgotten 为 true 时）。" },
        reason: { type: "string", description: "没有收起来时的原因，或调用方给的说明。" },
      },
    },
    render: (args, value) =>
      value.forgotten
        ? [
            {
              type: "text",
              text:
                `已从货架上收起：${value.name}（不再进提示词）`
                + `\n原件没有删：${value.archivedTo}`
                + (value.reason === "" ? "" : `\n说明：${value.reason}`),
            },
          ]
        : [{ type: "text", text: `没有收起来：${value.reason}` }],
  },
  async execute(args, exec) {
    const cwd = cwdOf(exec);
    const name = String(args.name ?? "").trim();
    const reason = String(args.reason ?? "");
    const refuse = (why) => ({ forgotten: false, name, archivedTo: "", reason: why });

    if (name === "") return refuse("要给出文件名（herta_narrative_list 里的原名）");
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      return refuse("文件名里不能有路径分隔符 —— 这条工具只在货架目录里活动");
    }
    if (!/^###\s*(废案|记录)/.test(name)) {
      return refuse("这不是货架上的文件（货架文件都以「### 废案」或「### 记录」开头）");
    }

    const dir = join(cwd, NARRATIVE_REL);
    const from = join(dir, name);
    if (!existsSync(from)) return refuse("货架上没有这个文件");

    const archiveDir = join(dir, "archive");
    await mkdir(archiveDir, { recursive: true });
    let to = join(archiveDir, name);
    for (let i = 2; existsSync(to) && i < 1000; i += 1) to = join(archiveDir, `${name}.${i}`);

    try {
      await rename(from, to);
    } catch (error) {
      return refuse(`移动失败：${String(error?.message ?? error)}`);
    }
    return { forgotten: true, name, archivedTo: to, reason };
  },
});

/** 插件注册时按顺序装上去的四件工具。 */
export const HERTA_TOOLS = [narrativeListTool, narrativeReadTool, memorySaveTool, forgetTool];
