/**
 * 会话 v4 来源体检：把「本轮运行失败」变成可查的证据。
 *
 * ## 为什么需要它
 *
 * DSH 0.1.7-rc.2 的会话格式 v4 要求消息来源是「生产者自有 kind」
 * （第三方插件为 `{ kind: "plugin:<包名>" }`）。插件若仍写 0.1.5 时代的
 * `{ kind: "plugin", plugin: "..." }`，事件在**写入会话之前**就被
 * `assertV4SourceRowAdmission` 拒掉：
 *
 *     format v4 message require a producer-owned source kind
 *
 * 于是整轮 turn 失败（GUI 上「本轮运行失败」），但那一条事件**没进日志** ——
 * 事后翻会话文件永远看不到它。反过来说：日志里读到的 source 全都合法，
 * 并不等于没出过这个错。
 *
 * 所以本脚本做两件事：
 *   1. 逐条校验日志里每个消息槽的 source 形状（能直接抓出「已被写进去的坏行」）；
 *   2. 找出**每一轮都没有正常收尾**的会话 —— 没有 `turn/end` 却已经
 *      `step/end`，正是当年这个 bug 留下的指纹。
 *
 * ⚠️ 只体检**会话格式 v4** 的日志（`session.v4.jsonl.zstd`）。旧的
 * `session.jsonl.zstd` 是 v3 及更早，里面的 `{ kind: "plugin", plugin: ... }`
 * 是当时**合法**的写法，读取时由 v3→v4 迁移负责改写（`rewriteV3MessageSource`
 * 会把它提升成 `plugin:<包名>`）。把它们算成坏行是纯误报 —— 实测过。
 *
 * ## 用法
 *
 *     node scripts/check-v4-sources.mjs                    # 扫默认的 DSH home
 *     node scripts/check-v4-sources.mjs <dsh-home>         # 指定 DSH home
 *
 * 退出码：0 = 干净；1 = 有问题。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { zstdDecompressSync } from "node:zlib";

const home = process.argv[2] ?? join(homedir(), ".dsh");
const sessionsRoot = join(home, "sessions");

/**
 * 解压一份会话日志。日志是**多个 zstd 帧拼接**的，`zstdDecompressSync` 只吃
 * 第一帧，所以按 magic（28 B5 2F FD）切帧逐段解再拼。
 *
 * @param {Buffer} buf - 原始文件内容。
 * @returns {string} 解码后的 JSONL 文本。
 */
function decompress(buf) {
  const starts = [];
  for (let i = 0; i + 4 <= buf.length; i += 1) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) {
      starts.push(i);
    }
  }
  if (starts.length === 0) return buf.toString("utf8");
  starts.push(buf.length);
  const parts = [];
  for (let k = 0; k < starts.length - 1; k += 1) {
    try {
      parts.push(zstdDecompressSync(buf.subarray(starts[k], starts[k + 1])));
    } catch {
      // 尾部半帧（进程被杀）就丢掉，与宿主的「忽略不完整尾巴」一致
    }
  }
  return Buffer.concat(parts).toString("utf8");
}

/** 递归找出所有会话日志文件。 */
function sessionFiles(dir, out = []) {
  let ents;
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sessionFiles(p, out);
    else if (e.name.endsWith(".zstd")) out.push(p);
  }
  return out;
}

/** 取一条事件里所有「持久化消息槽」的消息对象。 */
function messageSlots(event) {
  const data = event.data;
  if (typeof data !== "object" || data === null) return [];
  switch (event.type) {
    case "user/message":
      return [{ slot: "data", message: data }];
    case "system/message":
    case "assistant/message":
    case "tool/result":
    case "developer/message":
      return [{ slot: "data.message", message: data.message }];
    case "agent/inbox/spliced":
      return (Array.isArray(data.inserted) ? data.inserted : []).map((m, i) => ({
        slot: `data.inserted[${i}]`,
        message: m,
      }));
    case "session/title-llm-request":
      return (Array.isArray(data.messages) ? data.messages : []).map((m, i) => ({
        slot: `data.messages[${i}]`,
        message: m,
      }));
    default:
      return [];
  }
}

/** 与宿主 `source()` 同一条判定。 */
function sourceOk(source) {
  return (
    typeof source === "object" &&
    source !== null &&
    !Array.isArray(source) &&
    typeof source.kind === "string" &&
    source.kind.length > 0 &&
    source.kind !== "plugin"
  );
}

if (!statSync(sessionsRoot, { throwIfNoEntry: false })) {
  console.log(`找不到会话目录：${sessionsRoot}`);
  process.exitCode = 1;
} else {
  const files = sessionFiles(sessionsRoot);
  let badSources = 0;
  let unfinished = 0;
  let scanned = 0;
  let skippedLegacy = 0;

  for (const file of files) {
    // 只体检 v4：旧的 session.jsonl.zstd 里的 plugin 包装是合法的 v3 写法
    if (!file.endsWith(".v4.jsonl.zstd")) {
      skippedLegacy += 1;
      continue;
    }
    let text;
    try {
      text = decompress(readFileSync(file));
    } catch {
      continue;
    }
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;

    let header = null;
    const events = [];
    for (const line of lines) {
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.type === "session") header = obj;
      else events.push(obj);
    }
    if (header === null) continue;
    scanned += 1;

    // ---- 1. 逐条校验消息来源 ----
    for (const event of events) {
      for (const { slot, message } of messageSlots(event)) {
        if (typeof message !== "object" || message === null) continue;
        if (!sourceOk(message.source)) {
          badSources += 1;
          console.log(
            `[坏 source] ${basename(file)}  cwd=${header.cwd ?? "?"}\n` +
              `           type=${event.type} seq=${event.seq} slot=${slot}\n` +
              `           source=${JSON.stringify(message.source)}`,
          );
        }
      }
    }

    // ---- 2. 找没正常收尾的轮次（当年这个 bug 的指纹）----
    //
    // 这条**只作提示，不计入退出码**：正在跑的会话、以及被强关的会话都会
    // 留下「turn/start 多于 turn/end」。真正的判据在第 1 项 —— 坏 source 是
    // 硬事实，这条只是给排查指个方向。
    const starts = events.filter((e) => e.type === "turn/start").length;
    const ends = events.filter((e) => e.type === "turn/end").length;
    const failedTurns = events.filter((e) => e.type === "turn/error" || e.type === "turn/failed").length;
    if (starts > ends || failedTurns > 0) {
      unfinished += 1;
      const mtime = statSync(file).mtime.toISOString().replace("T", " ").slice(0, 19);
      console.log(
        `[提示·轮次未收尾] ${basename(file)}\n` +
          `             cwd=${header.cwd ?? "?"}  改动时间=${mtime}\n` +
          `             turn/start=${starts} turn/end=${ends}${failedTurns > 0 ? ` turn 级错误=${failedTurns}` : ""}\n` +
          `             （正在跑的会话或被强关的会话也会这样；只有配合上面的坏 source 才有意义）`,
      );
    }
  }

  console.log("");
  console.log(`体检 v4 会话 ${scanned} 个（跳过 ${skippedLegacy} 个旧格式日志）`);
  console.log(`坏 source：${badSources} 处`);
  console.log(`轮次未收尾（仅提示）：${unfinished} 个会话`);
  if (badSources === 0) {
    console.log("→ 结论：v4 会话里没有写入被拒的来源。");
  }
  process.exitCode = badSources === 0 ? 0 : 1;
}
