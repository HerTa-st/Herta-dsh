/**
 * DSH 会话节点 → Herta 气泡的映射（DSH 里唯一的界面路线）。
 *
 * 抽出来的理由：这是客户端里逻辑最密的一段（11 种节点 → 气泡，外加发声 cue），
 * 之前它埋在 `src/client/index.tsx` 里，**只能靠浏览器验证、无法单测**。
 * 现在是纯函数，Node 里可以直接跑（见 `scripts/test-mapping.mjs`）。
 *
 * 为什么用 `.js` 而不是 `.ts`：这样 Node 能直接 import 它做测试，esbuild 也能
 * 原样打包进 client bundle —— 一份代码，两个消费者，不需要额外的构建步骤。
 */
// 叙述调度层落地后，她的回复里开始按原版语法出现 `（我 想）…（/我 想）` 的
// **思考围栏**。她的展示组件里 thought surface 本来就不渲染 —— 所以**必须在这里
// 把思考剥掉**，否则整段内心话会被当成她的发言显示出来（2026-09-19 实际发生：
// 用户看到「（我 想）我错在把失败的具体样子填成了自己顺手编的一版…（/我 想）」
// 被原样发了出去）。
import { splitSurfaces } from "../host/narrative-hints.js";

// ── 共同的小工具 ────────────────────────────────────────────────────────────

/**
 * 从 DSH 的 `ContentBlock[]` 里取纯文本。
 * 图片 / 文件 / 工具块这一版不处理（它们不是「她说的内容」）。
 * @param content - DSH 的内容块数组。
 * @returns 拼接后的纯文本；没有文本块时为空串。
 */
export function textOf(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        b.type === "text" &&
        typeof b.text === "string",
    )
    .map((b) => b.text)
    .join("\n");
}

/**
 * epoch ms → ISO。她的 `at` 要 ISO 字符串；拿不到就不给这个字段
 * （她的气泡会隐藏时间，而不是伪造一个「现在」）。
 * @param time - DSH 节点的 `time`。
 * @returns ISO 字符串或 undefined。
 */
export function isoOf(time) {
  return typeof time === "number" && Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/** 把 `at` 折成可选字段，避免给她的块塞 `at: undefined`。 */
function stampOf(time) {
  const at = isoOf(time);
  return at === undefined ? {} : { at };
}

// ── DSH 节点 → 气泡（她的展示组件要的形态）──────────────────────────────────

/**
 * 降维成气泡列表。
 *
 * DSH 有 11 种会话节点，Herta 的展示组件只认 user / herta 两种气泡；
 * 其余（工具、上下文注入、命令、压缩、插曲、重试、错误）在她的模型里没有
 * 对应物，这里**如实计数并跳过**，而不是硬塞进 system 块假装有内容。
 *
 * @param nodes - DSH 的 `ConversationNode[]`。
 * @returns `{ bubbles, dropped, voiceCues }`。
 */
export function toBubbles(nodes) {
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
      const raw = (node.blocks ?? [])
        .filter((b) => b.kind === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("");
      // 剥掉她的思考围栏：`（我 想）…（/我 想）` 那一段不该当成她说的话
      // 显示出来。另外 reasoning 块本身也对应 thought surface，而她本来就不渲染 thought。
      const { thought, speech } = splitSurfaces(raw);
      if (speech !== "") {
        bubbles.push({ role: "herta", text: speech, ...stampOf(node.time) });
      } else {
        // 只有思考、没有正文的助手节点也**如实计入降维损失** ——
        // 与工具结果同一标准，否则这个计数器就只是在挑好说的记。
        droppedKinds.push(thought !== "" ? "assistant:thought-only" : "assistant:reasoning-only");
      }
      continue;
    }
    if (node.kind === "tool-result") {
      // `herta_speak` 的私有负载在 meta 上 —— 这是宿主与浏览器之间唯一的通道，
      // 不需要为它新开事件类型。
      const voice = node.meta?.hertaVoice;
      if (typeof voice?.url === "string" && typeof node.seq === "number") {
        voiceCues.push({
          seq: node.seq,
          url: voice.url,
          clip: voice.clip ?? "",
          category: voice.category ?? "",
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
    voiceCues,
  };
}
