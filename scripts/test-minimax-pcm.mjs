/**
 * `src/client/minimax-pcm.ts` 的单测 —— 覆盖：base64 → Int16 解码（含负数、
 * 空串、错误长度）与播放队列状态机（按 seq 交付、去重、换 utterance 打断、stop）。
 *
 * 这一份**不需要浏览器、不需要 DSH、不需要构建**：被测模块零 import，
 * Node 24 的类型剥离直接跑 `.ts`（同 `scripts/test-mimo-tts.mjs` 的写法：
 * check 计数、失败退出码非 0）。
 *
 * 跑法：`node --disable-warning=ExperimentalWarning scripts/test-minimax-pcm.mjs`
 */
import { createPlaybackQueue, decodePcmFrame } from "../src/client/minimax-pcm.ts";

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

/** 造 base64 —— 与宿主 `samplesToBase64` 等价（Int16LE 的字节直接编码）。 */
function b64(samples) {
  const bytes = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => bytes.writeInt16LE(s, i * 2));
  return bytes.toString("base64");
}

/** 造一个只记录交付的队列；「播完了」由测试用 `finish()` 显式收尾。 */
function makeQueue() {
  const played = [];
  const stopped = [];
  const queue = createPlaybackQueue({
    onPlay: (item) => {
      played.push(item);
    },
    onStop: (id) => stopped.push(id),
  });
  /** 收尾「刚交付的那一段」—— 参数必须与交付时的一致，这正是队列要求的。 */
  const finish = () => {
    const last = played[played.length - 1];
    if (last === undefined) return;
    queue.complete(last.utteranceId, last.seq);
  };
  return { queue, played, stopped, finish };
}

console.log("minimax-pcm");

// ── 1. 解码 ────────────────────────────────────────────────────────────────
{
  const frame = decodePcmFrame(b64([0, 1000, -1000, 32767, -32768]));
  check("解码：样本数", frame.samples.length === 5);
  check("解码：实例是 Int16Array", frame.samples instanceof Int16Array);
  check(
    "解码：正负与两个端点都对",
    frame.samples[0] === 0 &&
      frame.samples[1] === 1000 &&
      frame.samples[2] === -1000 &&
      frame.samples[3] === 32767 &&
      frame.samples[4] === -32768,
  );
  check("解码：byteLength 是样本数的两倍", frame.byteLength === 10);
  check("解码：没有跳过任何字符", frame.skippedChars === 0);

  // 与宿主 `samplesToBase64` 的往返：小端、单声道、逐字节相等。
  const round = Int16Array.from([1, -2, 3, -32768, 32767, 256, -256]);
  check("往返：宿主的编码能解回原值", decodePcmFrame(b64(round)).samples.join(",") === round.join(","));
}

// 空串：不抛、给空数组（宿主对没有音频的单元根本不发帧，但空帧不该炸队列）
{
  const empty = decodePcmFrame("");
  check("空串 → 空数组", empty.samples.length === 0 && empty.byteLength === 0);
}

// 非字符串
{
  let threw = false;
  try {
    decodePcmFrame(null);
  } catch (error) {
    threw = error instanceof TypeError;
  }
  check("非字符串 → TypeError", threw);
}

// 错误长度：3 字节凑不出整数个 16 bit 采样
{
  let message = null;
  try {
    decodePcmFrame(Buffer.from([1, 2, 3]).toString("base64"));
  } catch (error) {
    message = String(error.message);
  }
  check("奇数长度 → 抛错（不静默静音）", message !== null && message.includes("16 bit"));
}

// 容错：base64 里混进换行/空白（有些代理会折行）不该让整段音频消失
{
  const clean = b64([7, -7]);
  const folded = `${clean.slice(0, 4)}\n  ${clean.slice(4)}`;
  const frame = decodePcmFrame(folded);
  check("折行的 base64 仍然解得出", frame.samples[0] === 7 && frame.samples[1] === -7);
  // 折行插进去的 3 个字符（\n、空格、空格）都只记账，不影响样本。
  check("折行的 base64 记下跳过的字符", frame.skippedChars === 3);
}

// ── 2. 队列：同一个 utterance 内按 seq 交付，一次只播一个 ────────────────────
{
  const { queue, played, finish } = makeQueue();
  const r1 = queue.push("a1-1", 1, "第一句");
  check("第一段立刻播（playing）", r1 === "playing");
  check("立刻播时只交付了一段", played.length === 1 && played[0].seq === 1);

  const r2 = queue.push("a1-1", 2, "第二句");
  check("第二段排队（queued），不叠声", r2 === "queued" && played.length === 1);
  check("排队状态可读", queue.state().queued.join(",") === "2" && queue.state().playing === 1);

  // 播完第一段 → 第二段接上
  finish();
  check("第一段播完后第二段自动接上", played.length === 2 && played[1].seq === 2);
  check("状态跟着推进", queue.state().playing === 2 && queue.state().queued.length === 0);
}

// 乱序到达：seq 3 先合成完、seq 2 后到 —— 按到达顺序交付，不押后
{
  const { queue, played, finish } = makeQueue();
  queue.push("a2-1", 3, "第三句");
  check("乱序：先到的 3 直接播", played.length === 1 && played[0].seq === 3);
  queue.push("a2-1", 2, "第二句");
  check("乱序：后到的 2 排队", played.length === 1);
  finish();
  check("乱序：补上的 2 在 3 之后播", played.length === 2 && played[1].seq === 2);
}

// ── 3. 去重：同一个 utterance 里重复的 seq 只交付一次 ─────────────────────────
{
  const { queue, played, finish } = makeQueue();
  queue.push("a3-1", 1, "一");
  queue.push("a3-1", 1, "一（重放）");
  check("重复的 seq 被丢弃", played.length === 1 && queue.state().queued.length === 0);
  const dup = queue.push("a3-1", 1, "一（再重放）");
  check("重复判定有明确返回值", dup === "duplicate");
  finish();
  check("去重之后仍然只有一段", played.length === 1);
}

// 队列的两条关键次序保证：
//   · 「上一条的迟到帧」不许抢走正在播的位置（否则不是被掐掉就是顺序全乱）
//   · 「宿主先 ttsStop、再开新的一条」（复核否决的正规路径）照常切过去
// 队列的两条关键次序保证（2026-09-27 修过一个真 bug，两条都要在）：
//   · 「上一条的迟到帧」不许抢走正在播的位置（否则不是被掐掉就是顺序全乱）
//   · 「新的一条」**必须**打断旧的 —— 一律丢会让后面整段静默
//     （DSH 一轮里常有多条 assistant 消息；下一轮也常紧接上一轮）
{
  // 迟到帧（先见过 a4-1，再切到 a4-2，然后 a4-1 的尾巴才到）
  const { queue, played, stopped, finish } = makeQueue();
  queue.push("a4-1", 1, "上一条");
  queue.push("a4-2", 1, "新的一条");
  check("新的一条打断旧的（旧的那条收到 onStop）", stopped.join(",") === "a4-1");
  check("新的一条开始播", queue.state().current === "a4-2" && queue.state().playing === 1);
  const before = played.length;
  check("上一条的迟到帧被丢掉", queue.push("a4-1", 9, "旧台词迟到") === "duplicate");
  check("迟到帧没有顶掉正在播的", queue.state().current === "a4-2" && played.length === before);
  check("迟到帧没有再次打断（onStop 只叫过一次）", stopped.join(",") === "a4-1");
  finish();
}

{
  // 这条钉的是修掉的那个 bug：旧的一条**又播又排队**（忙）时来了新的一条，
  // 早先的实现会把新的丢掉 —— 用户听到的是"这句话播完就再也没声音"。
  const { queue, played, stopped, finish } = makeQueue();
  queue.push("b1-1", 1, "旧的第一段");
  queue.push("b1-1", 2, "旧的第二段");
  check("旧的一条确实忙（在播 + 有排队）", queue.state().playing === 1 && queue.state().queued.length === 1);
  const r = queue.push("b1-2", 1, "新一轮的第一段");
  check("旧的一条还在忙时，新的一条仍然打断并播出", r === "playing" && queue.state().current === "b1-2");
  check("旧的一条的排队被清掉（不会插到新句子里）", queue.state().queued.length === 0);
  check("新的一条播出前，旧的那条收到 onStop", stopped.join(",") === "b1-1");
  check("正在播的是新的那一段", played[played.length - 1].utteranceId === "b1-2" && played[played.length - 1].payload === "新一轮的第一段");
  finish();
}

{
  // 正规路径：宿主先 ttsStop（复核否决），再开新的一条
  const { queue, played, stopped, finish } = makeQueue();
  queue.push("a4-2", 1, "旧");
  queue.push("a4-2", 2, "旧第二段");
  queue.stop("a4-2");
  check("ttsStop 生效：上一条收到 onStop", stopped.join(",") === "a4-2");
  const r = queue.push("a4-1", 1, "新的一条");
  check("ttsStop 之后新的一条立刻播", r === "playing" && played[played.length - 1].utteranceId === "a4-1");
  check("被 ttsStop 掉的那条的迟到帧仍然被丢", queue.push("a4-2", 3, "迟到的尾巴") === "duplicate");
  finish();
}

// stop 之后同一条 utterance 的迟到尾巴：不许复活。
// （宿主在复核否决时会发 ttsStop；被否决的那条之后可能还有在飞的帧。）
{
  const { queue, played, stopped, finish } = makeQueue();
  queue.push("a5-3", 1, "被否决的台词");
  queue.push("a5-3", 2, "它的第二段");
  queue.stop("a5-3");
  check("stop 之后 onStop 只叫了一次", stopped.join(",") === "a5-3");
  const late = queue.push("a5-3", 3, "迟到尾巴");
  check("stop 之后同一条的迟到帧不会复活", late === "duplicate" && played.length === 1);
  check("stop 之后队列状态是空的", queue.state().current === null && queue.state().playing === null);
  // 换一条新的照样能播（stop 只封锁那一条）
  check("stop 只封锁那一条，新 utterance 照常", queue.push("a5-4", 1, "新一条") === "playing");
}

// ── 5. stop(utteranceId)：清掉排队 + 停正在播 ───────────────────────────────
{
  const { queue, played, stopped, finish } = makeQueue();
  queue.push("a5-1", 1, "一");
  queue.push("a5-1", 2, "二");
  queue.push("a5-1", 3, "三");
  check("三条里只播了第一条", played.length === 1 && queue.state().queued.join(",") === "2,3");

  queue.stop("a5-1");
  check("stop 后排队清空", queue.state().queued.length === 0 && queue.state().playing === null);
  check("stop 触发了 onStop（用于掐真实音频）", stopped.join(",") === "a5-1");
  check("stop 后 state.current 归空", queue.state().current === null);

  // 迟到的 complete（AudioBufferSourceNode 被 stop 之后 onended 还是会来）
  finish();
  check("stop 之后迟到的 complete 不会把队列推乱", queue.state().playing === null && played.length === 1);

  // stop 一条不相干的：什么都不做、不叫 onStop
  const before = stopped.length;
  queue.stop("a9-9");
  check("stop 不相干的 utterance 是空操作", stopped.length === before);

  // 空停（没有在播也没有排队）不该叫 onStop
  queue.push("a5-2", 1, "一");
  finish();
  const after = stopped.length;
  queue.stop("a5-2");
  check("空停不叫 onStop", stopped.length === after);
}

// complete 必须带**这一段自己的身份**，否则晚到的兜底定时器会把下一段误收尾。
// （音频层的兜底 setTimeout 一定晚于真实结束；只按"当前在播"收尾就会提前切句。）
{
  const { queue, played } = makeQueue();
  queue.push("a5-5", 1, "一");
  queue.push("a5-5", 2, "二");
  // 第 1 段播完 → 第 2 段接上
  queue.complete("a5-5", 1);
  check("带对身份的 complete 会推进", played.length === 2 && queue.state().playing === 2);
  // 第 1 段的兜底定时器这时才到（它晚于真实结束）
  queue.complete("a5-5", 1);
  check("迟到的旧 complete 不会把正在播的第 2 段误收尾", queue.state().playing === 2);
  // 错的 utteranceId 同样不收尾
  queue.complete("a5-9", 2);
  check("身份不对的 complete 是空操作", queue.state().playing === 2);
  queue.complete("a5-5", 2);
  check("正确身份的 complete 照常收尾", queue.state().playing === null);
}

// ── 6. 不合法帧 / reset ────────────────────────────────────────────────────
{
  const { queue, played, finish } = makeQueue();
  check("空 utteranceId 被丢弃", queue.push("", 1, "x") === "stopped");
  check("非数字 seq 被丢弃", queue.push("a6-1", "1", "x") === "stopped");
  check("不合法帧没有交付", played.length === 0);

  queue.push("a6-1", 1, "一");
  queue.reset();
  check("reset 清空一切", queue.state().current === null && queue.state().playing === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
