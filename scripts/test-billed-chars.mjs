/**
 * 计费字符那条链的**源码级接线检查**（2026-09-30 体检补）。
 *
 * ## 为什么是源码级，而不是行为级
 *
 * `miniMaxVoice()` 那个工厂要造一整套依赖（fetch、密钥读取、落盘路径、DSH home），
 * 直接跑它得先读进整套 options —— 测试会变成「测脚手架」。而这条链真正容易断的地方
 * 只有两处，且都在源码里看得见：
 *
 *  1. **合成器把数传出来了、宿主接的时候有没有接住**（真事故：`onUsed` 收了参数没人用，
 *     于是 `billedChars` 被丢掉，界面上永远没有「花了多少」的答案）；
 *  2. **累计写在哪一行**（必须在**节流**与 `rec === null` 早退**之前** ——
 *     节流为了少写盘，而钱是按次花的）。
 *
 * 它证明的是**接线与顺序**，不是运行时行为 —— 这一点写在这里，免得下一个人把它当成
 * 「跑过了」的证据。真正的行为验证要等有真凭据的机器。
 *
 * 用法：node scripts/test-billed-chars.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${label}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
  }
};

console.log("=== 宿主：接住合成器传出来的那个数 ===");
for (const p of ["src/host/minimax-voice.js", "lib/minimax-voice.js"]) {
  const s = read(p);
  ok(/onUsed:\s*\(billedChars\)\s*=>\s*voice\.stampUsed\(billedChars\)/.test(s), `${p}：把 billedChars 传进 stampUsed`);
  ok(!/onUsed:\s*\(\)\s*=>\s*voice\.stampUsed\(\)/.test(s), `${p}：没有「收了参数没人用」的老写法`);
}

console.log("\n=== voice：累计 + 带出（源与产物都要有）===");
for (const p of ["src/host/minimax/voice.ts", "lib/minimax/voice.js"]) {
  const s = read(p);
  ok(/let billedCharsTotal = 0/.test(s), `${p}：声明了累计量`);
  ok(/stampUsed\(billedChars = 0\)/.test(s), `${p}：stampUsed 有参数（默认为 0）`);
  ok(/billedCharsTotal \+= billedChars/.test(s), `${p}：真的累加`);
  ok(/billedCharsTotal > 0 \? \{ billedCharsTotal \}/.test(s), `${p}：readout 把它带出去`);

  // 顺序：累加必须出现在「节流」与「早退」之前
  const atAcc = s.indexOf("billedCharsTotal += billedChars");
  const atRec = s.indexOf("if (rec === null) return;", atAcc - 2000);
  const atThrottle = s.indexOf("stampThrottleMs", atAcc);
  ok(atAcc > 0 && atRec > atAcc, `${p}：累加在 rec === null 早退之前`, `acc@${atAcc} rec@${atRec}`);
  ok(
    atAcc > 0 && (atThrottle === -1 || atAcc < atThrottle),
    `${p}：累加在节流判断之前`,
    `acc@${atAcc} throttle@${atThrottle}`,
  );
}

console.log("\n=== 客户端：那一行把它显示出来（产物）===");
{
  const s = read("lib/client.js");
  ok(/voice\?\.billedCharsTotal/.test(s), "状态行读了 billedCharsTotal（带可选链，取不到不显示）");
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
console.log("（这是接线与顺序的检查；运行时行为要有真凭据的机器才验得了。）");
process.exit(fail === 0 ? 0 : 1);
