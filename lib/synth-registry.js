/**
 * 语音合成器的**唯一 interface** —— 四档引擎（local / minimax / fish / mimo）都实现它，
 * router 只认它。来源：架构审查 candidate #1（31 条决定见交接文档）。
 *
 * ## 为什么单独一个文件
 *
 * `minimax-voice.js` 已经 700+ 行，而引擎编排（谁先谁后、失败回不回落到本地、
 * 取消打到哪）原本压在其中一条 95 行的 if 链里。这条链**通过 deletion test**
 * （删了复杂度只会散到四个 caller 里），所以是**深化**而不是删 —— 把它挪到
 * 一个有名字的 seam 上：这一页就是"一个合成器长什么样"的全部答案。
 *
 * ## 三条不可动摇的约定（来自 `minimax/types.ts` 里与上游逐字对齐的语义）
 *
 *  1. **失败与被取消都返回 `{audio: null, code}`，不抛异常** —— 该单元退化成打字
 *     节奏继续推进，而不是把整段回复卡住。
 *  2. **`available()` 是活开关**：每次要用之前重新问（密钥可能刚填上、克隆可能刚删）。
 *     router 不许缓存它（Q29 有测试守着这条）。
 *  3. **`cancel(id)` 只丢该 utterance** —— 在飞的原生合成允许跑完，结果被丢弃。
 *
 * ## 谁能回落、谁不能（Q1：这是 **router** 的规则，不是 adapter 的职责）
 *
 * ```
 * minimax ──不可用/失败──▶ local      （显式回落，理由记进 code）
 * local   ──失败────────▶  （不回落）
 * fish    ──失败────────▶  （**不回落**：用户明确选了这一档，换个声音比没声音更糟）
 * mimo    ──未接线──────▶  （不回落）
 * ```
 *
 * 加第五档的人**必须先读这一段** —— 否则很容易把"回落"写进自己的 adapter，
 * 于是同一个规则在四处各实现一遍、且各不相同。
 */

/** 机器可读的失败原因（Q13：文案在边界拼一次，adapter 只给 code）。 */
export const SYNTH_CODES = Object.freeze({
  /** 合成成功。 */
  ok: "ok",
  /** 这一档当前用不了（没装模型、没配密钥、未接线……）。 */
  unavailable: "unavailable",
  /** 网络/上游不通。 */
  network: "network",
  /** 上游明确拒绝（配额、鉴权、内容策略……）。 */
  refused: "refused",
  /** 本地模型进程起来了但合成失败。 */
  localFailed: "local_failed",
  /** 这一档还没接线（mimo）。 */
  notWired: "not_wired",
  /** 兜底：没归类的原因。 */
  other: "other",
});

/**
 * 一个 adapter 长什么样（Q2 / Q3 / Q16 / Q30）。
 *
 * @typedef {object} SynthAdapter
 * @property {string} name - 自报名字（Q2：`engine` 标签从此由 adapter 自己给，不再由
 *   `synthUnit` 在外面拼）。
 * @property {() => boolean} available - **活开关**（见上）。不许缓存结果。
 * @property {(req: object) => Promise<{audio: object|null, name: string, code: string}>} synthesize
 *   失败**不抛**：`audio: null` + `code`。成功时 `code` 为 `SYNTH_CODES.ok`。
 * @property {() => object} [status] - 可选的自我描述片段（Q30：minimax 给 `keyKnown`、
 *   fish 给 `keyPresent`、local/mimo 给空对象）。router 不解释它，只往快照里搬。
 * @property {(utteranceId: string) => void} [cancel] - 取消该 utterance（Q9）。
 */

/**
 * 把"可能为 null 的结果"包成契约形状（Q16）。
 *
 * 为什么必须包一层：老形状里 `null` 既表示"失败"又表示"没音频"，
 * **原因没地方放**，于是只能塞进 `mini.engineNote` 那个可变字段 —— 原因和产生它
 * 的代码分居两处（locality 缺失）。包成 `{audio, name, code}` 之后，
 * `audio: null` 与 `code` 各说各的，谁也不用吞掉谁。
 *
 * @param {string} name - adapter 名字。
 * @param {{samples: unknown, sampleRate: number, durationMs?: number}|null} audio
 * @param {string} [code] - 失败原因；成功时省略。
 * @returns {{audio: object|null, name: string, code: string}}
 */
export function synthResult(name, audio, code = SYNTH_CODES.ok) {
  return { audio: audio ?? null, name, code: audio === null || audio === undefined ? code : SYNTH_CODES.ok };
}

/** 成功的结果。 */
export function synthOk(name, audio) {
  return { audio, name, code: SYNTH_CODES.ok };
}

/** 失败的结果（把 `null` 与原因一起说清楚）。 */
export function synthFail(name, code) {
  return { audio: null, name, code };
}

/**
 * 建 router：按 `engineOf()` 选一档，按上面的规则决定回不回落，
 * 每次合成结束统一 `noteState()`（Q28 —— adapter 彻底不知道 `mini` 的存在）。
 *
 * @param {object} opts
 * @param {Record<string, SynthAdapter>} opts.adapters - 名字 → adapter（四档全给，哪怕
 *   当前没接线：路由要能对任意 `voiceEngine` 值给出**确定的**答复）。
 * @param {() => string} opts.engineOf - 当前引擎（读的是配置，可能随时变）。
 * @param {() => void} [opts.noteState] - 状态可见性回调（Q28）。
 * @param {(line: string) => void} [opts.log]
 * @param {(adapter: SynthAdapter) => string} [opts.describeUnavailable] - 把"为什么用不了"
 *   变成 code（Q20：这个判断读的是 adapter 私有状态，所以留在 adapter 侧，由它注入）。
 * @returns {object} router：`synthesize` / `cancel` / `status` / `describe` / `names`
 */
export function createSynthRouter(opts) {
  const adapters = opts.adapters ?? {};
  const engineOf = opts.engineOf ?? (() => "local");
  const noteState = opts.noteState ?? (() => {});
  const log = opts.log ?? (() => {});
  const describeUnavailable = opts.describeUnavailable ?? (() => SYNTH_CODES.unavailable);

  /** 取一档；名字不认识时给 null（由调用方兜成"未知引擎"）。 */
  const adapterFor = (name) => (Object.prototype.hasOwnProperty.call(adapters, name) ? adapters[name] : null);

  /**
   * 合成一个单元。
   *
   * 返回值形状与老 `synthUnit` **保持兼容**（`{samples, sampleRate, durationMs, engine}` 或
   * `null`）—— Q14 要求 `pipeline` 的 `opts.synthUnit` 签名不动；原因（code）另外
   * 通过 `router.lastCode()` 取，供状态行拼文案（Q12）。
   *
   * @param {{text: string, utteranceId: string, seq: number, lang: string}} req
   */
  async function synthesize(req) {
    const wanted = engineOf();
    const adapter = adapterFor(wanted);

    // 名字不认识：按"这一档用不了"处理，且**不回落**（配置写错了要让人看见，
    // 而不是被静默换成一个别的声音）。
    if (adapter === null) {
      last = { name: wanted, code: SYNTH_CODES.unavailable };
      log(`未知的语音引擎「${wanted}」：不发声，也不回落`);
      noteState();
      return null;
    }

    const wrapped = await runAdapter(adapter, req);
    if (wrapped.audio !== null) {
      last = { name: wrapped.name, code: SYNTH_CODES.ok };
      noteState();
      return { ...wrapped.audio, engine: wrapped.name };
    }

    // 失败：要不要回落到 local？**这是 router 的规则**（Q1）。
    if (wanted === "minimax") {
      const local = adapterFor("local");
      if (local !== null) {
        log(`回落到本地模型：${wrapped.code}`);
        const fb = await runAdapter(local, req);
        if (fb.audio !== null) {
          // 回落成功：引擎标签报**实际出声的那个**，但原因留着给状态行看。
          last = { name: fb.name, code: wrapped.code };
          noteState();
          return { ...fb.audio, engine: fb.name };
        }
        // 云端与兜底都没成 —— 两条原因都要能看见（Q13：文案在边界拼）。
        last = { name: wrapped.name, code: joined(wrapped.code, fb.code) };
        noteState();
        return null;
      }
    }

    last = { name: wrapped.name, code: wrapped.code };
    noteState();
    return null;
  }

  /** 云端原因 + 本地兜底原因，拼成一个 code（老代码里那句拼接的等价物）。 */
  const joined = (a, b) => (b === SYNTH_CODES.ok || b === undefined ? a : `${a}+${b}`);

  /** 跑一档：adapter 抛异常也按失败处理（契约说"不抛"，但 router 不拿它赌）。 */
  async function runAdapter(adapter, req) {
    try {
      if (!adapter.available()) {
        return synthFail(adapter.name, describeUnavailable(adapter) ?? SYNTH_CODES.unavailable);
      }
      const out = await adapter.synthesize(req);
      if (out === null || out === undefined) return synthFail(adapter.name, SYNTH_CODES.other);
      if (out.audio === null || out.audio === undefined) {
        return synthFail(adapter.name, out.code ?? SYNTH_CODES.other);
      }
      return synthOk(adapter.name, out.audio);
    } catch (err) {
      log(`${adapter.name} 合成抛错：${String(err?.message ?? err)}`);
      return synthFail(adapter.name, SYNTH_CODES.other);
    }
  }

  /** 最近一次合成的 `{name, code}`（状态行拼文案用，Q12：喂给 `engineReason`）。 */
  let last = { name: null, code: SYNTH_CODES.ok };

  return {
    synthesize,

    /**
     * 取消：**转发给所有带 cancel 的 adapter**（Q9）。
     *
     * 老代码里这一句硬接在 minimax 的 synthesizer 上（`cancelUnit`），
     * 于是用户打断时如果当前引擎是 fish/local，**在飞的那条请求根本没被取消**。
     * 转发给全部、而不是只给当前那档：当前这一轮可能正处在"云端失败、已回落本地"
     * 的中间态，两档都可能握着在飞请求。
     */
    cancel(utteranceId) {
      for (const adapter of Object.values(adapters)) {
        try {
          adapter.cancel?.(utteranceId);
        } catch (err) {
          log(`${adapter.name} 取消失败：${String(err?.message ?? err)}`);
        }
      }
    },

    /** 最近一次的 `{name, code}`（只读快照）。 */
    lastCode() {
      return { ...last };
    },

    /** 各档状态片段的合集（Q30）：`{ [name]: status() }`，router 不解释内容。 */
    status() {
      const out = {};
      for (const [name, adapter] of Object.entries(adapters)) {
        try {
          out[name] = adapter.status?.() ?? {};
        } catch (err) {
          out[name] = { error: String(err?.message ?? err) };
        }
      }
      return out;
    },

    /** 现在这一档**会不会出声**（给 `speaksFor` 那类判据用；router 不替它缓存）。 */
    available() {
      const adapter = adapterFor(engineOf());
      return adapter === null ? false : adapter.available();
    },

    /** 四档名字（诊断/测试用）。 */
    names() {
      return Object.keys(adapters);
    },
  };
}

// ─────────────────────────── 四档工厂 ───────────────────────────
//
// 每个工厂只做一件事：**把某一档的既有能力套进上面那个契约**。
// 引擎知识留在各自的工厂里（fish 的 7 个参数、minimax 的 describeUnavailable
// 判据、mimo 的 fetch 缝），router 一点都不知道它们的存在（Q28）。
//
// 装配（读配置、拿密钥、把四档挂到 router 上）**留在 `minimax-voice.js`**（Q14）——
// 这一页只导出工厂。
//
// **刷新密钥的时机**（与老代码一致）：`available()` 读的是缓存布尔，而"刚在设置页
// 填上"这件事由装配侧在每次合成前 `await readKey()` 刷新（老代码就是
// `if (!keyKnown) await readKey();`）—— 所以契约里**不需要**额外的钩子。

/**
 * local：本地模型。今天没有"可用性"的概念（起进程与失败都在合成里现形），
 * 所以 `available()` 恒真，失败时给 `local_failed`，具体原因放 status。
 *
 * @param {{queue: (text: string) => Promise<object|null>, getFailure: () => string|null}} deps
 */
export function createLocalAdapter(deps) {
  const { queue, getFailure } = deps;
  let failure = null;
  return {
    name: "local",
    available: () => true,
    async synthesize(req) {
      failure = null;
      const out = await queue(req.text);
      if (out === null || out === undefined) {
        failure = getFailure() ?? null;
        return synthFail("local", SYNTH_CODES.localFailed);
      }
      return synthOk("local", out);
    },
    status: () => ({ failure }),
  };
}

/**
 * minimax：云端优先。判据链照旧（密钥 → 认领 → 拒绝/失败），但**只给 code**，
 * 文案留到边界拼（Q13）。
 *
 * `describe`（= 老 `describeUnavailable`）由装配侧注入：它读的是这一档的私有状态
 * （voice 的 phase、synthesizer 的 refusal），Q20 说这个判断留在 minimax 这一档。
 *
 * @param {{synthesizer: object, describe: () => string}} deps
 */
export function createMinimaxAdapter(deps) {
  const { synthesizer, describe } = deps;
  return {
    name: "minimax",
    available: () => synthesizer.available() === true,
    async synthesize(req) {
      if (!synthesizer.available()) return synthFail("minimax", codeOf(describe()));
      const out = await synthesizer.synthesize(req);
      if (out === null || out === undefined) return synthFail("minimax", codeOf(describe()));
      return synthOk("minimax", out);
    },
    /** 状态行要的原始细节（Q30）：reason 给人看，code 给机器看。 */
    status: () => ({ synthesizer: safeStatus(synthesizer), reason: describe() }),
  };
}

/**
 * fish：云端，**失败不回落**（规则在 router）。`available()` 只看**密钥在不在**
 * （Q18）—— 不测网络：网络失败走 `code`，于是"没配密钥"与"连不上"在状态行上分得开。
 *
 * 七个参数（ref/speed/effect/preset/proxy/key）**收进这一档**（Q5），
 * interface 上只剩 `synthesize(req)`。`load` 保留惰性 import（Q7 的装配时机不变）。
 *
 * @param {{load: () => Promise<object>, params: () => object, keyPresent: () => boolean}} deps
 */
export function createFishAdapter(deps) {
  const { load, params, keyPresent, readKey } = deps;
  let lastReason = null;
  return {
    name: "fish",
    available: () => keyPresent() === true,
    async synthesize(req) {
      let fish = null;
      try {
        fish = await load();
        // 密钥**现读现传**，不缓存明文（Q19：注入的是函数而不是值）。
        const key = typeof readKey === "function" ? await readKey() : null;
        const r = await fish.trySynthesizePcm(req.text, { ...params(), fishKey: key ?? undefined });
        if (r === null || r === undefined) {
          lastReason = fish.getLastFailure?.() ?? null;
          return synthFail("fish", codeOf(lastReason));
        }
        lastReason = null;
        return synthOk("fish", r);
      } catch (err) {
        lastReason = String(err?.message ?? err);
        return synthFail("fish", SYNTH_CODES.other);
      }
    },
    status: () => ({ keyPresent: keyPresent() === true, reason: lastReason }),
  };
}

/**
 * mimo：**注册但 `available(): false`**（Q6）。判断链其实已经存在 ——
 * `mimo-tts.js` 本身就是一份 SpeechSynthesizer 实现（Q24 直接注册），
 * 接线时把这里改成 `synthesizer.available()` 即可，一个返回值的事。
 *
 * @param {{synthesizer: object}} deps
 */
export function createMimoAdapter(deps) {
  const { synthesizer } = deps;
  return {
    name: "mimo",
    available: () => false,
    async synthesize() {
      return synthFail("mimo", SYNTH_CODES.notWired);
    },
    status: () => ({ wired: false, synthesizer: safeStatus(synthesizer) }),
  };
}

/** 把描述性原因**归成 code**（Q13）。不认识的归 `other` —— 原文留在 status 里。 */
function codeOf(reason) {
  const s = String(reason ?? "").toLowerCase();
  if (s === "" || s === "null") return SYNTH_CODES.other;
  if (s.includes("密钥") || s.includes("no_key") || s.includes("key")) return SYNTH_CODES.no_key;
  if (s.includes("认领")) return SYNTH_CODES.unavailable;
  if (s.includes("拒绝") || s.includes("refus")) return SYNTH_CODES.refused;
  if (s.includes("网络") || s.includes("network") || s.includes("超时") || s.includes("proxy")) {
    return SYNTH_CODES.network;
  }
  if (s.includes("不可用") || s.includes("unavailable")) return SYNTH_CODES.unavailable;
  return SYNTH_CODES.other;
}

/** 取某个东西的 status()，取不到就给空对象（诊断不许把合成搞坏）。 */
function safeStatus(owner) {
  try {
    return owner?.status?.() ?? {};
  } catch {
    return {};
  }
}
