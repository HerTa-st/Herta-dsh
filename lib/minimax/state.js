/**
 * MiniMax 克隆记录的宿主状态文件：`$DSH_HOME/dsh-herta-minimax.json`。
 *
 * ## 为什么不是设置字段
 *
 * 这份记录（`voiceId` / `host` / `clonedAt` / `lastUsedAt`）是**机器状态**，不是
 * 用户偏好：它由服务端签发、由插件自己采用与续期，用户在设置页里没有"改它"的
 * 语义。`dsh-herta/src/host/settings-schema.js` 当年把 `minimaxVoice` 列进"不搬"
 * 清单，理由正是这一条 —— 那条理由**仍然成立**，本次变的是另一件事：既然链路
 * 要接上，记录就必须在 DSH 侧有一个真相（否则每次启动都要重新认领，离线即空）。
 * 所以它单独落一个文件，**不进** profile 的 Config（那份是用户可编辑的设置）。
 *
 * ## 容错优先
 *
 * 读：文件不存在 / 坏了 / 字段类型不对 → 一律当作"没有记录"，绝不抛。
 * 写：先写临时文件再 rename（原子替换），且**吞掉所有异常** ——
 * 状态文件坏掉不该让黑塔失声。
 *
 * ## 冷却与失败也落在这里
 *
 * `adoptAttemptAt` / `adoptFailure` 是**认领冷却**（10 分钟内不重复打 `listClones`）
 * 与"设置页要显示什么"的唯一依据。没有它们，冷却只能放在内存里 ——
 * 而宿主每次重载都会忘掉，于是每次重载都打一次网络。
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** 当前文件格式版本。读到更高的版本号时按"不认识"处理（不猜未来字段）。 */
export const MINIMAX_STATE_VERSION = 1;

/** 认领冷却：失败后 10 分钟内不再打 `listClones`。 */
export const ADOPT_COOLDOWN_MS = 10 * 60_000;

/** `lastUsedAt` 的写盘节流（与上游 `stampUsed` 同量级）。 */
export const STAMP_THROTTLE_MS = 10 * 60_000;

/** 状态文件的形状（平铺，方便人和 diff 读）。 */
                                   
                  
                        
                   
                
                    
                      
                                        
                      
                           
                          
                             
                        
 

/**
 * 状态文件路径。
 *
 * 默认 `$DSH_HOME/dsh-herta-minimax.json`（`DSH_HOME` 取不到时退回 `~/.dsh`，
 * 与 narrative-beacon 一致）。
 *
 * `DSH_HERTA_MINIMAX_STATE` 是**测试/诊断用的覆盖点**，存在的理由很具体：
 * 端到端测试需要一个干净的状态文件，但**不能**改 `DSH_HOME` —— 那会把离线模型
 * （`$DSH_HOME/tts/...`）也一起挡掉，而"云端不可用 → 回落本地模型"这条恰恰要用
 * 到那份模型。所以把覆盖点开在文件这一级，而不是目录那一级。
 */
export function miniMaxStatePath()         {
  const override = process.env.DSH_HERTA_MINIMAX_STATE;
  if (typeof override === "string" && override !== "") return override;
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  return join(home, "dsh-herta-minimax.json");
}

/** 空状态。 */
export function emptyState()                   {
  return { version: MINIMAX_STATE_VERSION };
}

/** 非空字符串才算数 —— 空串是"字段在但没值"，与缺失等价。 */
function str(value         )                     {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** 读状态（不抛）。 */
export function readMiniMaxState(path = miniMaxStatePath())                   {
  let parsed         ;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return emptyState();
  }
  if (parsed === null || typeof parsed !== "object") return emptyState();
  const raw = parsed                           ;
  const version = typeof raw.version === "number" ? raw.version : MINIMAX_STATE_VERSION;
  // 未来版本的文件不按当前语义解释：宁可当空，也不要读错一半。
  if (version > MINIMAX_STATE_VERSION) return emptyState();
  const voiceId = str(raw.voiceId);
  const host = str(raw.host);
  const state                   = { version: MINIMAX_STATE_VERSION };
  // voiceId 与 host 必须成对出现：只有一半的记录是坏的，不采用。
  if (voiceId !== undefined && host !== undefined) {
    state.voiceId = voiceId;
    state.host = host;
    state.clonedAt = str(raw.clonedAt);
    state.lastUsedAt = str(raw.lastUsedAt);
    state.adoptedTag = str(raw.adoptedTag);
  }
  state.adoptAttemptAt = str(raw.adoptAttemptAt);
  state.adoptFailure = str(raw.adoptFailure);
  return state;
}

/** 写状态（原子替换、不抛）。@returns 是否真的写成功（测试与诊断用）。 */
export function writeMiniMaxState(state                  , path = miniMaxStatePath())          {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
    return true;
  } catch {
    // 清掉可能残留的临时文件，别让它变成下一轮的孤儿。
    try {
      rmSync(`${path}.tmp`, { force: true });
    } catch {
      /* 清理失败也不该抛 */
    }
    return false;
  }
}

/** 从状态里取出可用记录（没有/不完整 → null）。 */
export function cloneRecordOf(
  state                  ,
)                                                                                                        {
  if (state.voiceId === undefined || state.host === undefined) return null;
  return {
    voiceId: state.voiceId,
    host: state.host,
    clonedAt: state.clonedAt,
    lastUsedAt: state.lastUsedAt,
    adoptedTag: state.adoptedTag,
  };
}

/**
 * 冷却是否生效：最近一次**失败**的尝试在 `ADOPT_COOLDOWN_MS` 之内。
 * 成功的尝试不产生冷却（成功之后本来也不需要再认领）。
 */
export function adoptCoolingDown(
  state                  ,
  now        ,
  cooldownMs = ADOPT_COOLDOWN_MS,
)          {
  if (state.adoptFailure === undefined) return false;
  const at = state.adoptAttemptAt === undefined ? NaN : Date.parse(state.adoptAttemptAt);
  if (!Number.isFinite(at)) return false;
  return now - at < cooldownMs;
}


//# sourceURL=state.ts