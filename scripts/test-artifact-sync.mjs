/**
 * 产物一致性：`lib/*.js` 必须与 `src/host/*.js` **逐字节相同**。
 *
 * ## 为什么值得单独一条
 *
 * 这个仓库的构建约定是「`src/host/*.js` 平铺拷进 `lib/`」（见 `scripts/build.mjs`）。
 * 但**仓库里没有 CI 守着这条**，于是它靠人记住 —— 2026-09-30 一天之内踩了两次：
 *
 *   · 梦源加了「Fish 密钥」那一行，只改了 `src/client/index.tsx`，`lib/client.js`
 *     没跟上 → 源码看着有、界面里没有（客户端读的正是产物）；
 *   · 我加了「Fish 代理」字段，同样差点只改源码。
 *
 * 上面那次还能靠肉眼，因为改动可见；下面这一类就彻底看不见了：改了 `src/host/x.js`
 * 却忘了拷进 `lib/` —— 单测全绿（测的是 `src/`），装到用户机器上跑的是**旧代码**。
 *
 * 这条测试就是那道 CI：把两个目录对一遍，任何不一致都当场红。
 *
 * 用法：node scripts/test-artifact-sync.mjs
 *   `lib/client.js` 不在检查范围（它是 esbuild 打的包，源码在 `src/client/**`，
 *   磁盘上这两者本来就不同形 —— 它的一致性由 `scripts/reapply-*.mjs` 那类脚本
 *   与 `test-fish-proxy.mjs` 里的定点断言各自守着）。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src", "host");
const LIB = join(root, "lib");

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

/** 平铺拷进 `lib/` 的那些（.js / .cjs，见 build.mjs）。 */
const flat = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith(".js") || e.name.endsWith(".cjs")))
    .map((e) => e.name);

console.log("=== src/host 的每一个文件都要在 lib 里，且逐字节相同 ===");
const srcFiles = flat(SRC);
let same = 0;
for (const name of srcFiles) {
  const a = join(SRC, name);
  const b = join(LIB, name);
  if (!existsSync(b)) {
    ok(false, `${name}：lib 里没有这个文件（构建产物漏了）`);
    continue;
  }
  const ba = readFileSync(a);
  const bb = readFileSync(b);
  if (ba.equals(bb)) {
    same += 1;
  } else {
    ok(
      false,
      `${name}：src 与 lib 不一致`,
      `${ba.length} B vs ${bb.length} B —— 改了源码但没同步产物（或反之）`,
    );
  }
}
ok(same === srcFiles.length, `全部 ${srcFiles.length} 个文件一致`, `实际一致 ${same} 个`);

console.log("\n=== 反向：lib 里不该有 src/host 没有的『平铺文件』 ===");
// `client.js` 是 esbuild 打的包（源码在 `src/client/**`），本来就不来自 `src/host` ——
// 文件头那段已经写明它不在检查范围，反查这里也必须显式排除，
// 否则每次都会误报「多了：client.js」。
const libOnly = flat(LIB).filter((n) => !srcFiles.includes(n) && n !== "client.js");
ok(
  libOnly.length === 0,
  "没有来路不明的平铺文件",
  libOnly.length === 0 ? "" : `多了：${libOnly.join(", ")}`,
);

console.log("\n=== 子目录也要在（如 lib/minimax/）===");
const subdirs = readdirSync(SRC, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
for (const d of subdirs) {
  ok(existsSync(join(LIB, d)), `lib/${d}/ 存在`);
}

// ── 发布面：`lib/` 等目录会随 npm 包发出去，里面不许留补丁脚本的备份 ──────────
// 2026-10-01 踩到：`scripts/reapply-*.mjs` 的备份写在**被改的那个文件旁边**
// （`lib/client.js.bak-unwired-groups`），而 `package.json` 的 `files` 收了整个
// `lib/` —— `.gitignore` 挡得住 git，挡不住 npm：那个 511 KB 的备份进了 tarball。
// 这里把「发布目录里没有 .bak*」钉成断言，免得下次又靠人记得。
console.log("\n=== 发布目录里不许有补丁脚本的备份（.bak*）===");
const PUBLISHED = ["lib", "assets", "preset", "locale"];
const backups = [];
for (const dir of PUBLISHED) {
  const base = join(root, dir);
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.name.includes(".bak")) backups.push(childRel);
    }
  };
  if (existsSync(base)) walk(base, dir);
}
ok(
  backups.length === 0,
  "没有 .bak 备份混进发布目录",
  backups.length === 0 ? "" : `发现：${backups.join(", ")}（删掉它，或让脚本把备份写到仓库外）`,
);

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
console.log(
  "（修法：`node scripts/build.mjs`；没有 esbuild 的手工场合，把 src/host 下改过的文件原样覆盖到 lib/。）",
);
process.exit(fail === 0 ? 0 : 1);
