/**
 * 叙述层的**启动与运行信标** —— 用来回答「它到底在不在跑」。
 *
 * ## 为什么需要它
 *
 * 叙述层在「放行」的时候**不留任何痕迹**：复核判 `pass` 就不注入、不写会话记录。
 * 所以在正式环境里，光看会话记录区分不出「复核跑了并放行」与「复核压根没跑」。
 * 2026-09-19 实测就卡在这里 —— 用户发了三轮消息，记录干净，但证明不了什么。
 *
 * 这个文件把「它跑到哪一步」写成可读证据：
 *
 * ```jsonc
 * {
 *   "verdict": "叙述层在跑",
 *   "phases": {
 *     "install":  { "at": "…", "pid": 123, "depsOk": true },   // 钩子挂上了
 *     "llm":      { "at": "…", "nice": true },                  // llm 服务拿到了
 *     "turnStop": { "at": "…", "n": 3 },                        // turn 边界钩子被触发过
 *     "review":   { "at": "…", "n": 3, "turn": 3 },             // 复核真的跑过
 *     "beat":     { "at": "…", "n": 1 };                        // 分拍判据真的看过
 *   }
 * }
 * ```
 *
 * 每推进一个阶段就**整体重写**（文件极小，且写入频率低 —— 每个 turn 最多几次），
 * 用「已见过的最大阶段」合并，所以多次写入不会把证据擦掉。
 *
 * ## 位置与隐私
 *
 * 写在 `$DSH_HOME/dsh-herta-narrative.json`（`DSH_HOME` 取不到时退回 os.homedir 的
 * `.dsh`）。**只放阶段名、计数、时间与 pid，不放任何对话内容**。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** 信标文件路径。 */
export function beaconPath() {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  return join(home, "dsh-herta-narrative.json");
}

/** 读现有信标（读不到就给空对象）。 */
function readBeacon() {
  try {
    const raw = readFileSync(beaconPath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** 阶段名 → 中文一句话，让 verdict 能直接读懂。 */
const PHASE_LABEL = {
  install: "钩子已挂上",
  llm: "llm 服务已就绪",
  turnStop: "turn 边界钩子触发过",
  review: "复核执行过",
  beat: "分拍判据执行过",
  veto: "复核否决过",
  silence: "空轮提醒注入过",
};

/**
 * 合并一次阶段记录并落盘。
 *
 * @param {string} phase - 阶段名（见 {@link PHASE_LABEL}）。
 * @param {object} [extra] - 附加字段（计数、turn 等）。
 * @param {object} [override] - 直接覆盖顶层字段（例如失败原因）。
 * @returns {object | null} 写入后的信标；失败时 null（**信标坏掉不该影响叙述层**）。
 */
export function markPhase(phase, extra = {}, override = {}) {
  try {
    const path = beaconPath();
    const prev = readBeacon();
    const phases = { ...(prev.phases ?? {}) };
    const old = phases[phase] ?? {};
    phases[phase] = {
      at: new Date().toISOString(),
      pid: process.pid,
      n: (old.n ?? 0) + (extra.count === true ? 1 : 0),
      ...extra,
      // 保留最早的 at 作为「首次」，另给 lastAt 作为「最近」
      firstAt: old.firstAt ?? old.at ?? new Date().toISOString(),
    };
    delete phases[phase].count;
    delete phases[phase].at;
    phases[phase].lastAt = new Date().toISOString();

    // verdict：取阶段表里最靠后的那个（顺序即推进顺序）。
    const order = ["install", "llm", "turnStop", "review", "beat", "veto", "silence"];
    const reached = order.filter((k) => phases[k] !== undefined);
    const last = reached[reached.length - 1];
    const next = {
      what: "dsh-herta 叙述层运行信标",
      updatedAt: new Date().toISOString(),
      verdict: last === undefined ? "尚未启动" : `叙述层在跑：${PHASE_LABEL[last] ?? last}`,
      phases,
      ...override,
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  } catch {
    return null;
  }
}
