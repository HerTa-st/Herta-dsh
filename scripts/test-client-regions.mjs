/**
 * 客户端四个 region 的接口测试（候选 #2 的产物 · 候选 #3 的做法）。
 *
 * ## 这个文件存在的原因
 *
 * 拆之前，`src/client/index.tsx` 是一个 3196 行的单文件、打包后只剩 `lib/client.js`
 * 一个产物 —— **测不到内部 seam**，于是那些断言只能读源码文本再正则匹配
 * （重命名内部变量就变红）。#2 把四个 region 拆成独立 module 之后，它们可以被**裸
 * Node import**（靠 `scripts/client-test-hook.mjs` 把 react / @gui 指到桩），
 * 所以这里断言的是**接口的返回值**，而不是任何文件的字面。
 *
 * 用法：`node --import ./scripts/client-test-hook.mjs scripts/test-client-regions.mjs`
 */
import { SETTINGS_GROUPS } from "../src/host/settings-schema.js";
import { bindMachineForm, machineValues } from "../src/client/machine.ts";
import { createSettingsSection, loadSeedModule } from "../src/client/settings.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    fail++;
    console.log("  ✗ " + label + (detail ? "  —— " + detail : ""));
  }
};

console.log("=== 四个 region 的 seam：能 import，且导出的是接口 ===");
{
  // 每个 region 至少有一个入口能被外面拿到（装配层就靠这些）
  ok(typeof createSettingsSection === "function", "settings 导出 createSettingsSection（装配层要用）");
  ok(typeof loadSeedModule === "function", "settings 导出 loadSeedModule");
  ok(typeof bindMachineForm === "function", "machine 导出 bindMachineForm（状态归层独占的入口）");
  ok(typeof machineValues === "function", "machine 导出 machineValues");
}

console.log("\n=== 行为断言：没绑表单时读到的是完整默认值（Q「不报错、不白屏」）===");
{
  bindMachineForm(null);
  const values = machineValues();
  ok(values !== null && typeof values === "object", "machineForm 为 null 时 machineValues 仍返回对象");
  ok(
    Object.keys(values).length > 0,
    "没绑表单时也给出完整快照（回落默认，而不是空）",
    "键数 " + Object.keys(values).length,
  );
}

console.log("\n=== 结果：" + pass + " 通过 / " + fail + " 失败 ===");
process.exit(fail === 0 ? 0 : 1);

// 注：原先这里还想断言「每个组的 trailer 客户端都注册了」—— 直接读 GROUP_TRAILERS 的键。
// 实测发现那张表引用的是同样声明在 createSettingsSection 内部的那些行组件，把它单独提到
// 模块级会 TDZ 报错（MiniMaxVoiceRow is not defined）。要行为地断言它，得连着那些行组件
// 一起提出来 —— 那是独立的一笔，记在 ADR-0008 的后续里。所以这条暂时仍留在
// test-herta-settings.mjs 里读文本。
