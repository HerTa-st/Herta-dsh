/**
 * DSH 版本兼容核对（只读）。
 *
 * ## 它核对什么
 *
 * 插件与 DSH 之间有三处**会随版本漂移**的契约，靠人记不住：
 *
 * 1. **官方 preset 底本**：`preset/herta.patch.yml` 以官方 `standard.patch.yml` 为底、
 *    只替换 persona。底本变了而我们没跟，症状是"她少了某个能力"，没人会往构建脚本上想。
 *    → 这里把**已安装 DSH 里的那份**与 `scripts/baselines/` 里的底本比指纹。
 * 2. **preset 里引用的每一个包/子路径**：rc 之间会改包名、删子路径导出。
 *    → 逐个解析（包根存在 + 子路径在 `exports` 里）。
 * 3. **`dsh.client.inject` 里引用的包**：rc 里可能整包被并掉（例如
 *    `dsh-client-ui-slots` 在 rc.5 已不存在）。DSH 对"注入了不存在的包"是**容忍**的
 *    （rc.5 自己的官方包里就有同样情形），所以这里只报事实、不算失败。
 *
 * ## 用法
 *
 * ```powershell
 * node scripts/test-dsh-compat.mjs
 * # 换一台机器 / 换安装位置：
 * $env:DSH_ASAR = "D:\\path\\to\\app.asar"; node scripts/test-dsh-compat.mjs
 * ```
 *
 * 没装 DSH（或路径不对）时**跳过并退出 0** —— 这条测试不该在 CI/别的机器上误报。
 */
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openAsar, listDir, readEntry, closeAsar } from "./asar-read.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const asarPath =
  process.env.DSH_ASAR ??
  join(process.env.LOCALAPPDATA ?? "", "Programs", "DeepSeek Harness", "resources", "app.asar");

let pass = 0;
let fail = 0;
let notes = 0;
const ok = (cond, label, detail = "") => {
  if (cond) {
    pass++;
    console.log("  ✓ " + label);
  } else {
    fail++;
    console.log("  ✗ " + label + (detail ? "  —— " + detail : ""));
  }
};
const note = (label) => {
  notes++;
  console.log("  · " + label);
};

let asar;
try {
  asar = openAsar(asarPath);
} catch {
  console.log("  （跳过）本机没有可读的 DSH 安装：" + asarPath);
  process.exit(0);
}

const pkgRoot = "dsh/node_modules";
const readText = (p) => {
  const b = readEntry(asar, p);
  return b === null ? null : b.toString("utf8");
};
const readJson = (p) => {
  const t = readText(p);
  if (t === null) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
const dirOfPkg = (name) => pkgRoot + "/" + name;
const pkgJsonOf = (name) => readJson(dirOfPkg(name) + "/package.json");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

console.log("=== ① 已安装的 DSH ===");
const webApp = pkgJsonOf("@deepseek-ai/dsh-web-app");
ok(webApp !== null, "找到 @deepseek-ai/dsh-web-app", asarPath);
const version = webApp?.version ?? "unknown";
console.log("  DSH web-app 版本：" + version);

console.log("");
console.log("=== ② 官方 standard.patch.yml 与我们的底本 ===");
const official = readEntry(asar, pkgRoot + "/@deepseek-ai/dsh-web-app/presets/standard.patch.yml");
ok(official !== null, "读到官方 standard.patch.yml");
if (official !== null) {
  const officialSha = sha256(official);
  const dir = join(root, "scripts", "baselines");
  const baselines = readdirSync(dir).filter((f) => /^standard\.dsh-.+\.patch\.yml$/.test(f));
  const rows = baselines.map((f) => ({
    f,
    sha: sha256(readFileSync(join(dir, f))),
  }));
  const match = rows.find((r) => r.sha === officialSha);
  ok(
    match !== undefined,
    "官方 preset 与某份自带底本逐字节一致",
    "官方 sha256=" + officialSha.slice(0, 16) + "…；自带 " + rows.length + " 份都没对上",
  );
  if (match) console.log("  对上的是：" + match.f);
  else console.log("  → 上游 preset 变了：请按 scripts/baselines/README.md 导出新底本（standard.dsh-" + version + ".patch.yml）");
}

console.log("");
console.log("=== ③ preset 里引用的每个包 / 子路径都能解析 ===");
const preset = readFileSync(join(root, "preset", "herta.patch.yml"), "utf8");
const names = [...new Set([...preset.matchAll(/name:\s*['"]?(@deepseek-ai\/[A-Za-z0-9._/-]+)['"]?/g)].map((m) => m[1]))];
let unresolved = 0;
for (const name of names) {
  const parts = name.split("/");
  const pkgName = parts[0] + "/" + parts[1];
  const sub = parts.slice(2).join("/");
  const pj = pkgJsonOf(pkgName);
  if (pj === null) {
    unresolved++;
    console.log("  ✗ " + name + "  —— 包 " + pkgName + " 不存在");
    continue;
  }
  if (sub === "") continue;
  const ex = pj.exports ?? {};
  const key = "./" + sub;
  if (Object.prototype.hasOwnProperty.call(ex, key)) continue;
  unresolved++;
  console.log("  ✗ " + name + "  —— " + pkgName + " 没有导出 " + key + "（现有：" + Object.keys(ex).join(", ") + "）");
}
ok(unresolved === 0, "preset 引用的 " + names.length + " 个条目全部可解析", unresolved + " 个解析不了");

console.log("");
console.log("=== ④ dsh.client.inject 引用的包（缺包是否被容忍）===");
const self = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const injects = self?.dsh?.client?.inject ?? [];
for (const name of injects) {
  const exists = pkgJsonOf(name) !== null;
  if (exists) ok(true, name + " 存在");
  else note(name + " 在 " + version + " 里已不存在（DSH 对缺包是容忍的，见官方先例）");
}
// 官方先例：rc 里有没有官方包也 inject 了不存在的包
const officialNames = listDir(asar.header, pkgRoot + "/@deepseek-ai").filter((n) => n.startsWith("dsh-client"));
let precedents = 0;
for (const p of officialNames) {
  const pj = pkgJsonOf("@deepseek-ai/" + p);
  for (const dep of pj?.dsh?.client?.inject ?? []) {
    if (pkgJsonOf(dep) === null) {
      precedents++;
      console.log("  官方先例：" + p + " → " + dep + "（不存在）");
    }
  }
}
console.log("  官方先例数：" + precedents + (precedents > 0 ? " → 缺包被容忍 ✓" : " → 官方无先例，需留意"));

closeAsar(asar);
console.log("");
console.log("=== 结果：" + pass + " 通过 / " + fail + " 失败 / " + notes + " 说明 ===");
process.exit(fail === 0 ? 0 : 1);
