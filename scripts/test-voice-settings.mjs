/**
 * `src/host/voice-settings-shared.js` 的单测。
 *
 * 覆盖：
 *   · 引擎判别式与上游三处字面量一致
 *   · 归一化的**防御性**（undefined / null / 非对象 / 非法值一律回退）
 *   · `buildRealtimeVoiceState` 的字段完备性与「不再假绿」
 *
 * 0.1.7 起这两个偏好改由插件 Config 持有（命名空间 `herta`，
 * 见 `settings-schema.js` / `settings-sync.js`），落盘那一层不在这里测 ——
 * 本文件只测「怎么把值拼成她界面要的形状」。设置值本身的校验、写回、
 * 旧文件迁移在 `scripts/test-herta-settings.mjs`。
 *
 * 不需要 DSH 运行时、不需要网络。
 */
import {
  DEFAULT_VOICE_SETTINGS,
  FALLBACK_HOST_FACTS,
  VOICE_ENGINES,
  buildRealtimeVoiceState,
  emptyKeyStatus,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../src/host/voice-settings-shared.js";
// 字段表是纯数据、无 import，所以 Node 里直接读得到（客户端侧也共用同一份）。
import { FIELDS } from "../src/host/settings-schema.js";

/** 交叉核对用的两个视图（只取本文件关心的字段）。 */
const FIELD_VALUES = { voiceEngine: FIELDS.voiceEngine.values.join(",") };
const FIELD_DEFAULTS = {
  voiceEngine: FIELDS.voiceEngine.def,
  realtimeVoice: FIELDS.realtimeVoice.def,
};

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log("voice-settings");

// 1. 引擎判别式 —— 必须与上游 VoiceEngine 逐字一致
check("三引擎判别式 = local,minimax,mimo", VOICE_ENGINES.join(",") === "local,minimax,mimo");
check("isVoiceEngine 认全部三个", VOICE_ENGINES.every((e) => isVoiceEngine(e)));
check("isVoiceEngine 拒非法值", !isVoiceEngine("gpt") && !isVoiceEngine("") && !isVoiceEngine(null));
check("isVoiceEngine 拒非字符串", !isVoiceEngine(3) && !isVoiceEngine({}));

// 3. 默认值
check("默认引擎 local", DEFAULT_VOICE_SETTINGS.engine === "local");
check("默认实时语音开", DEFAULT_VOICE_SETTINGS.realtimeVoice === true);
check("默认值被冻结", Object.isFrozen(DEFAULT_VOICE_SETTINGS));

// 4. normalizeVoiceSettings 的防御性
{
  const d = normalizeVoiceSettings(undefined);
  check("undefined → 默认", d.engine === "local" && d.realtimeVoice === true);
  check("null → 默认", normalizeVoiceSettings(null).engine === "local");
  check("非对象（字符串）→ 默认", normalizeVoiceSettings("nope").engine === "local");
  check("非对象（数字）→ 默认", normalizeVoiceSettings(42).engine === "local");

  check("合法引擎保留", normalizeVoiceSettings({ engine: "mimo" }).engine === "mimo");
  check("非法引擎回退", normalizeVoiceSettings({ engine: "gpt" }).engine === "local");
  check("缺字段回退", normalizeVoiceSettings({}).engine === "local");

  check("布尔开关保留", normalizeVoiceSettings({ realtimeVoice: false }).realtimeVoice === false);
  check("非布尔开关回退", normalizeVoiceSettings({ realtimeVoice: "yes" }).realtimeVoice === true);
  check("开关字段缺失回退", normalizeVoiceSettings({ engine: "mimo" }).realtimeVoice === true);

  const extra = normalizeVoiceSettings({ engine: "minimax", extra: 1, volume: 0.3 });
  check("只取已知字段（不把无关键带出来）", Object.keys(extra).join(",") === "engine,realtimeVoice");
}

// 5. emptyKeyStatus 形状（照抄上游 DeepSeekKeyStatus）
{
  const k = emptyKeyStatus();
  check("空 Key 状态 set=false", k.set === false);
  check("空 Key 状态 hint=null", k.hint === null);
  check("空 Key 状态 encrypted=false", k.encrypted === false);
}

// 6. buildRealtimeVoiceState：字段完备（上游 VoiceSettings 直接读这些键）
{
  const s = buildRealtimeVoiceState(undefined);
  const keys = Object.keys(s).sort().join(",");
  check(
    "顶层字段 = bundle,enabled,engine,failed,mimo,minimax,model,runtime",
    keys === "bundle,enabled,engine,failed,mimo,minimax,model,runtime",
  );
  check("model 四个字段齐", Object.keys(s.model).sort().join(",") === "phase,receivedBytes,totalBytes,unpackedBytes");
  check("minimax 四个字段齐", Object.keys(s.minimax).sort().join(",") === "key,planKey,refusal,voice");
  check("mimo 两个字段齐", Object.keys(s.mimo).sort().join(",") === "key,voice");
}

// 7. **不再假绿**：默认事实必须报「不可用」
{
  const s = buildRealtimeVoiceState(undefined);
  check("bundle 不再硬编码 true", s.bundle === false);
  check("runtime 不再硬编码 true", s.runtime === false);
  check("failed=false", s.failed === false);
  check("model.phase=absent（不再假装 ready）", s.model.phase === "absent");
  check("minimax.key 未设置", s.minimax.key.set === false);
  check("minimax.voice 不存在", s.minimax.voice.phase === "absent");
  check("mimo.key 未设置", s.mimo.key.set === false);
  check("mimo.voice 不存在", s.mimo.voice.phase === "absent");
  check("refusal=null", s.minimax.refusal === null);
}

// 8. 用户偏好真的透传进状态
{
  const s = buildRealtimeVoiceState({ engine: "mimo", realtimeVoice: false });
  check("engine 透传 mimo", s.engine === "mimo");
  check("enabled 跟着 realtimeVoice", s.enabled === false);
  const s2 = buildRealtimeVoiceState({ engine: "minimax", realtimeVoice: true });
  check("engine 透传 minimax", s2.engine === "minimax");
  check("enabled=true", s2.enabled === true);
}

// 9. 外部事实可覆盖（第三步/第四步接上后走这条路）
{
  const facts = {
    bundle: true,
    runtime: true,
    failed: false,
    modelPhase: "ready",
    minimaxKey: { set: true, hint: "abcd", encrypted: true },
  };
  const s = buildRealtimeVoiceState({ engine: "local" }, facts);
  check("bundle 可被事实置真", s.bundle === true);
  check("runtime 可被事实置真", s.runtime === true);
  check("model.phase 可被事实改", s.model.phase === "ready");
  check("minimax.key 可被事实改", s.minimax.key.set === true && s.minimax.key.hint === "abcd");
  check("未覆盖的字段仍有兜底", s.minimax.planKey.set === false && s.mimo.key.set === false);
  check("坏事实（null）回退默认", buildRealtimeVoiceState({}, null).bundle === false);
}

// 10. 设置值本身在这一层不做校验了 ——
//
// 0.1.7-rc.2 起「引擎 / 实时语音」是插件 Config 的字段（`voiceEngine` / `realtimeVoice`），
// **校验归 schemastery 的 schema**（`src/host/index.js` 的 `Config` 由
// `settings-schema.js` 的 FIELDS 生成），写回与旧文件迁移归 `settings-sync.js`。
// 那两层的断言在 `scripts/test-herta-settings.mjs`，这里只留一条交叉核对：
// 共享模块的引擎字面量必须与字段表的取值域完全一致 —— 两处漂移的症状是
// 「设置页能选，但拼给她的状态里落回默认」。
check(
  "共享模块的三引擎与 FIELDS.voiceEngine 的取值域逐字一致",
  VOICE_ENGINES.join(",") === FIELD_VALUES.voiceEngine,
);
check(
  "共享模块的默认引擎与 FIELDS.voiceEngine 的默认值一致",
  DEFAULT_VOICE_SETTINGS.engine === FIELD_DEFAULTS.voiceEngine,
);
check(
  "共享模块的默认实时语音与 FIELDS.realtimeVoice 的默认值一致",
  DEFAULT_VOICE_SETTINGS.realtimeVoice === FIELD_DEFAULTS.realtimeVoice,
);

// 11. FALLBACK_HOST_FACTS 自洽
// （原名叫 UNWIRED_HOST_FACTS。改名理由：MiniMax 那一项已经不是"未接线"——
//  它的事实现在由宿主 `/herta-minimax-state` 与 SSE 的 `state` 帧给出；
//  这份常量的角色变成"还没拿到快照之前的兜底"。）
{
  check("FALLBACK_HOST_FACTS.bundle=false", FALLBACK_HOST_FACTS.bundle === false);
  check("FALLBACK_HOST_FACTS.runtime=false", FALLBACK_HOST_FACTS.runtime === false);
  check("FALLBACK_HOST_FACTS 被冻结", Object.isFrozen(FALLBACK_HOST_FACTS));
  check(
    "兜底里 MiniMax 报「未设置、无克隆」（快照到达前不许假装能用）",
    FALLBACK_HOST_FACTS.minimaxKey.set === false && FALLBACK_HOST_FACTS.minimaxVoice.phase === "absent",
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
