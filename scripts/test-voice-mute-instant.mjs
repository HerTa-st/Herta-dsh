/**
 * 「静音立刻生效」的行为测试 —— 直接驱动**源码模块**（穿 interface，不读产物文本）。
 *
 * ## 钉的是什么
 *
 * 用户报的是「点了静音要等她念完当前这句才停」。原来静音只在**下一次**调度时才被读
 * （`playLocalVoice` 开头那次早退 + 合成前那次），已经排进 WebAudio 时间轴的段照播。
 * 判据因此是两条：
 *
 *   1. `voiceMuted` **一变**，`applyMuteNow()` 必须让已排的音频当场停（增益归零 +
 *      源被停掉）；
 *   2. **别的字段变不算** —— 监听器拿到的必须是"真正变化的字段名"，否则用户每动一下
 *      设置都会把她正在念的那句掐掉。
 *
 * 用的是注入的假 `machineForm`（`MachineForm` 那个 interface 本来就是给这一层之外的
 * 东西实现的），所以不需要 DOM，也不需要 DSH 运行时。
 *
 * 跑法：`node scripts/test-voice-mute-instant.mjs`
 */
import { bindMachineForm, machineValues, setFormValueListener } from "../src/client/machine.ts";
import { applyMuteNow } from "../src/client/voice.ts";
import { notifyMuteChanged, subscribeMuteChanged, toggleMuteSetting } from "../src/client/ui.ts";

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

/** 一张最小的假表单：能读快照、能被订阅、能被写，**并把写过的操作记下来**。 */
function makeForm(initial = {}) {
  let value = { ...initial };
  const listeners = new Set();
  /** 真发生过的写入：`[[字段, 值], …]`。注意 `writeMachineField` 走的是 `mutate`。 */
  const writes = [];
  const applyOps = (ops) => {
    for (const op of ops) {
      const field = op?.path?.[0];
      if (typeof field === "string" && op.op === "set") {
        writes.push([field, op.value]);
        value = { ...value, [field]: op.value };
      }
    }
  };
  return {
    writes,
    getSnapshot: () => ({ status: "ready", value, writable: true }),
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    set: async (field, next) => {
      writes.push([field, next]);
      value = { ...value, [field]: next };
      return true;
    },
    unset: async () => true,
    mutate: async (ops) => {
      applyOps(ops ?? []);
      // 宿主接受之后会回推一帧 —— 真的写入就该让订阅者响一次。
      if ((ops ?? []).length > 0) for (const cb of listeners) cb();
      return true;
    },
    /** 测试用：改一个字段并通知订阅者（模拟设置页/iframe 写入后宿主回推）。 */
    poke(field, next) {
      value = { ...value, [field]: next };
      for (const cb of listeners) cb();
    },
    /** 测试用：不改变值，只通知（宿主的一次无意义回写）。 */
    touch() {
      for (const cb of listeners) cb();
    },
  };
}

console.log("voice-mute-instant（静音是不是立刻生效）");

// ── 1. 变更监听器：只报"真的变了"的字段 ────────────────────────────────────
{
  const form = makeForm({ voiceMuted: false, voiceVolume: 100, realtimeVoice: true });
  const seen = [];
  setFormValueListener((changed) => seen.push(changed));
  bindMachineForm(form);

  check("绑定那一刻不发通知（不该掐掉正在念的开场白）", seen.length === 0);
  check("快照读得到字段", machineValues().voiceMuted === false);

  form.touch();
  check("宿主原样回写（值没变）也不发通知", seen.length === 0);

  form.poke("voiceVolume", 30);
  check("改音量只报 voiceVolume", seen.length === 1 && seen[0].join(",") === "voiceVolume");

  form.poke("voiceMuted", true);
  check("改静音只报 voiceMuted（不会把音量也算进来）",
    seen.length === 2 && seen[0].join(",") === "voiceVolume" && seen[1].join(",") === "voiceMuted");

  setFormValueListener(null);
}

// ── 2. 装配那条线：静音一变 → applyMuteNow 被调用 ──────────────────────────
//
// 这里照 `index.tsx` 的接法复刻一遍（那一行本来就是"把两个模块接到一起"）。
{
  const form = makeForm({ voiceMuted: false, voiceVolume: 100 });
  let called = 0;
  setFormValueListener((changed) => {
    if (changed.includes("voiceMuted")) {
      called += 1;
      applyMuteNow();
    }
  });
  bindMachineForm(form);
  check("绑定时先对一次（这里不算变更）", called === 0);

  form.poke("voiceMuted", true);
  check("静音打开 → 走了立刻静音那条路", called === 1);

  form.poke("realtimeVoice", false);
  check("动别的设置不会误触发", called === 1);

  form.poke("voiceMuted", false);
  check("解静音也走同一条路（按当前音量恢复）", called === 2);

  setFormValueListener(null);
}

// ── 4. 工具条那个键：写的是**设置**，不是本地 state ─────────────────────────
//
// 用户第二次报的就是这个键（"对话顶端按钮的静音不是立刻生效"）。原来它只改本地
// `useState` —— 只影响标签文字，跟音频链路毫无关系，于是按了"没反应"。
{
  const form = makeForm({ voiceMuted: false, voiceVolume: 100 });
  bindMachineForm(form);

  let local = null;
  const next = toggleMuteSetting(false, (v) => {
    local = v;
  });
  check("按下就返回新状态（供标签立刻更换）", next === true && local === true);

  // 判据必须看"**写到底发生了没有**"，而不是"快照现在是不是 true" ——
  // 后者可以被我手动回推一次凑出来，那正是第一版这条断言没抓住变异的原因。
  check("按下真的写了设置字段（这才是真闸门，不是本地 state）",
    form.writes.some(([field, value]) => field === "voiceMuted" && value === true));
  check("写完之后快照里也是 true", machineValues().voiceMuted === true);

  // 镜像那条线：别处改了静音，订阅者要被告知。
  const seen = [];
  const off = subscribeMuteChanged((m) => seen.push(m));
  notifyMuteChanged();
  check("notifyMuteChanged 把当前值推给工具条", seen.length === 1 && seen[0] === true);

  form.poke("voiceMuted", false);
  notifyMuteChanged();
  check("解静音也推给工具条", seen.length === 2 && seen[1] === false);

  off();
  notifyMuteChanged();
  check("退订之后不再收到（面板卸载不留监听）", seen.length === 2);
}

// ── 5. applyMuteNow 本身不抛（没有 AudioContext / 没有 iframe 的环境）──────
{
  const form = makeForm({ voiceMuted: true, voiceVolume: 30 });
  bindMachineForm(form);
  let threw = null;
  try {
    applyMuteNow();
  } catch (error) {
    threw = error;
  }
  check("没有 WebAudio 的环境里也安全（静音可以接受，白屏不行）", threw === null);

  form.poke("voiceMuted", false);
  try {
    applyMuteNow();
  } catch (error) {
    threw = error;
  }
  check("解静音同样不抛", threw === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
