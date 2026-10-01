/**
 * 发布前预检 + 发布后核验 —— **只读，不自动发任何东西**。
 *
 * ## 为什么要有它
 *
 * 发一个版本要动六个面（commit / tag / GitHub Release / npm / 上游目录 / 三份文案），
 * 靠人脑逐条对照清单必然漏。这里把「能不能发」变成可执行的判据：每条检查打印
 * ✅ / ⚠️ / ❌，**任何一条 ❌ 就 exit 1**。
 *
 * ## 两个模式
 *
 * ```powershell
 * node scripts/preflight-release.mjs                    # 发布前：八项预检
 * node scripts/preflight-release.mjs --verify-published 0.1.6   # 发布后：核对 registry
 * ```
 *
 * 阈值与路径都可用环境变量覆盖（见下面 CONFIG），不写死作者本机之外的假设。
 *
 * ## 八项（发布前）
 *
 *   1. 版本号：高于 npm 上的 `latest`，且该版本号没在 registry 上出现过
 *   2. 工作区：已跟踪文件无未提交改动（未跟踪文件只警告）
 *   3. 测试：核心 23 组 + MiniMax 6 组全绿
 *   4. 构建：`build` + `build:ui` + `build:preset` 跑完 `git diff` 必须为空
 *   5. 产物：`test-artifact-sync`（`src/host` ↔ `lib` 逐字节 + 发布目录无 `.bak`）
 *   6. 打包：`npm pack` 的实际内容、文件数、大小与 sha1（写进 Release 说明）
 *   7. 文案：README 版本历史条目 + 两份发布文档（Release 说明 / B 站公告）都在
 *   8. 宿主矩阵：`engines.dsh` 区间 vs 当前桌面应用版本
 *
 * ## 为什么测试要带 `--import ./scripts/test-resolve-hook.mjs`
 *
 * 仓库刻意不带 `node_modules`，`src/host` 里几个文件静态 import `@deepseek-ai/*`。
 * 那 4 个测试（dream / dream-manifest / forget / tool-schema）不带 hook 直接
 * `ERR_MODULE_NOT_FOUND`。本机的 DSH 解包安装在 `$DSH_MODULES` 或 `dsh-017/` 下。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// ── 配置（全部可用环境变量覆盖）─────────────────────────────────────────────
const CONFIG = {
  /** 发布文档放哪（默认：仓库上一级 = 工作区根，沿用 `Herta-DSH-vX.Y.Z-*.md` 惯例）。 */
  docsDir: process.env.RELEASE_DOCS_DIR ?? resolve(root, ".."),
  /** 桌面应用的 `runtime.json`（读 `desktopVersion` 做宿主矩阵比对）。 */
  desktopRuntimeJson: process.env.DESKTOP_RUNTIME_JSON ?? "E:/deepseek Desktop/resources/runtime/primary-runtime/runtime.json",
  /** 国内镜像（发布后核验顺带看一眼，滞后不算缺陷 —— 按需同步）。 */
  mirrors: [
    "https://registry.npmjs.org",
    "https://registry.npmmirror.com",
    "https://mirrors.cloud.tencent.com/npm",
  ],
};

const PASS = "✅";
const WARN = "⚠️";
const FAIL = "❌";
const results = [];
function check(level, label, detail = "") {
  results.push({ level, label });
  console.log(`  ${level} ${label}${detail === "" ? "" : `  —— ${detail}`}`);
}
/** 只解释机制、不参与判定的说明行。 */
function info(label, detail = "") {
  console.log(`  ℹ️ ${label}${detail === "" ? "" : `  —— ${detail}`}`);
}

/**
 * 跑一条命令，拿 stdout（失败也不抛，把 stderr 一起带回来）。
 *
 * Windows 上 `npm` 是 `npm.cmd`，不经 shell 起不来；而 `shell: true` + args 数组
 * 会踩 Node 的 DEP0190（并且 args 不转义）。所以这里把 argv 自己拼一条命令行、
 * 自己加引号，`execFileSync` 只收一个字符串。
 */
function run(cmd, args, { allowFail = false, cwd = root } = {}) {
  const argv = args.flat(Infinity).map(String);
  const quote = (a) => (/^[\w@./:\\=+-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
  const line = [cmd, ...argv.map(quote)].join(" ");
  try {
    const out = execFileSync(line, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
      shell: true,
      cwd,
    });
    return { ok: true, out };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

const git = (...args) => run("git", args);
const npm = (...args) => run("npm", args);

/** 递归列出目录下所有文件的相对路径（`/` 分隔，排序）。 */
function listFilesRel(base) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const p = join(abs, entry.name);
      const r = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(p, r);
      else if (entry.isFile()) out.push(r);
    }
  };
  if (existsSync(base)) walk(base, "");
  return out.sort();
}

/**
 * 两个文件是否同一内容：原始字节相同，**或文本文件按 EOL 归一后相同**。
 *
 * 为什么允许 EOL 差异：git 检出（`core.autocrlf=true`）写 CRLF，而发布时打包的那份
 * 可能是 LF —— 同一份源码、两种字节。二进制文件不做归一（用前 8KB 有没有 NUL 判断）。
 */
function sameFile(a, b) {
  const x = readFileSync(a);
  const y = readFileSync(b);
  if (x.equals(y)) return true;
  const isText = (buf) => !buf.subarray(0, 8192).includes(0);
  if (!isText(x) || !isText(y)) return false;
  const strip = (buf) => Buffer.from(buf.toString("latin1").replace(/\r/g, ""), "latin1");
  return strip(x).equals(strip(y));
}
/**
 * `npm view <包> <字段…> --json`。
 *
 * ⚠️ 包名与字段必须**分开当多个 argv 传**：拼成一个带空格的字符串时，npm 会把它
 * 当成一个 tag 名（`EINVALIDTAGNAME: Invalid tag name "dsh-herta version"`）。
 * 多字段时返回的键是带点的（`"dist.shasum"` / `"dist.fileCount"`）。
 */
const npmView = (spec, fields = [], extra = []) => npm("view", [spec, ...fields, "--json", ...extra]);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;

/** 语义化比较（够用即可：数字三元组，预发布版视为小于同号正式版）。 */
function cmpSemver(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(v).trim());
    return m === null ? null : { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  if (x === null || y === null) return null;
  for (let i = 0; i < 3; i += 1) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre === null && y.pre === null) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre === y.pre ? 0 : x.pre < y.pre ? -1 : 1;
}

/** `>=0.1.7-rc.1 <0.3.0-0` 这种两段区间是否覆盖 `v`。 */
function satisfiesRange(range, v) {
  const parts = String(range).trim().split(/\s+/).filter(Boolean);
  for (const part of parts) {
    const m = /^(>=|<=|>|<|=)?(.+)$/.exec(part);
    if (m === null) return null;
    const op = m[1] ?? "=";
    const c = cmpSemver(v, m[2]);
    if (c === null) return null;
    if (op === ">=" && c < 0) return false;
    if (op === ">" && c <= 0) return false;
    if (op === "<=" && c > 0) return false;
    if (op === "<" && c >= 0) return false;
    if (op === "=" && c !== 0) return false;
  }
  return true;
}

// ── 1. 版本号 ───────────────────────────────────────────────────────────────
function checkVersion() {
  console.log("\n── 1. 版本号 ──────────────────────────────────────────");
  check(PASS, `package.json version = ${version}`);
  const latest = npmView("dsh-herta", ["dist-tags.latest"], ["--registry", CONFIG.mirrors[0]]);
  if (!latest.ok) {
    check(FAIL, "拿不到 npm 上的 dist-tags（需要网络）", latest.out.split("\n")[0]);
    return;
  }
  let latestVersion = null;
  try {
    latestVersion = JSON.parse(latest.out.trim().replace(/^"|"$/g, ""));
  } catch {
    latestVersion = latest.out.trim().replace(/"/g, "");
  }
  check(PASS, `npm 上 latest = ${latestVersion}`);
  const c = cmpSemver(version, latestVersion);
  if (c === null) check(WARN, "版本号无法比较（非纯 semver？）", `${version} vs ${latestVersion}`);
  else if (c <= 0) check(FAIL, "新版本号必须**严格高于** npm 上的 latest", `${version} ≤ ${latestVersion}`);
  else check(PASS, `${version} > ${latestVersion}`);

  const all = npmView("dsh-herta", ["versions"], ["--registry", CONFIG.mirrors[0]]);
  if (all.ok) {
    try {
      const versions = JSON.parse(all.out);
      if (Array.isArray(versions) && versions.includes(version)) {
        check(FAIL, `registry 上已经有 ${version} 了`, "同版本绝不重发 —— 递增 patch 再发");
      } else {
        check(PASS, `${version} 还没在 registry 上出现过`);
      }
    } catch {
      check(WARN, "已发布版本列表解析失败", all.out.slice(0, 80));
    }
  }
}

// ── 2. 工作区 ───────────────────────────────────────────────────────────────
function checkWorkspace() {
  console.log("\n── 2. 工作区 ──────────────────────────────────────────");
  const tracked = git("diff", "--name-only");
  const staged = git("diff", "--cached", "--name-only");
  const dirty = [...new Set(`${tracked.out}${staged.out}`.split("\n").map((s) => s.trim()).filter(Boolean))];
  if (dirty.length > 0) check(FAIL, "已跟踪文件有未提交改动", dirty.slice(0, 8).join(", "));
  else check(PASS, "已跟踪文件干净");

  const status = git("status", "--porcelain");
  const untracked = status.out.split("\n").map((s) => s.trim()).filter((s) => s.startsWith("??")).map((s) => s.slice(2).trim());
  if (untracked.length > 0) check(WARN, `${untracked.length} 个未跟踪文件（确认不是发布残留）`, untracked.slice(0, 6).join(", "));
  else check(PASS, "没有未跟踪文件");
}

// ── 3. 测试 ─────────────────────────────────────────────────────────────────
/** 核心 23 组（`npm test` 链里的 17 组 + 4 组新加的）。 */
const CORE_TESTS = [
  "test-narrative", "test-dream", "test-mapping", "test-narrative-hints", "test-supervisor",
  "test-session-surface", "test-beat-policy", "test-silence-guard", "test-subagent-skip",
  "test-dream-distill", "test-mimo-tts", "test-voice-settings", "test-fish-key",
  "test-voice-model", "test-tts-resident", "test-herta-settings", "test-source-kind",
  "test-artifact-sync", "test-tool-schema", "test-dream-manifest", "test-forget",
  "test-fish-proxy", "test-billed-chars",
];

function countPassed(out) {
  let n = 0;
  for (const m of String(out).matchAll(/(\d+)\s*(?:passed|通过)/g)) n += Number(m[1]);
  return n;
}

function checkTests() {
  console.log("\n── 3. 测试 ────────────────────────────────────────────");
  const failed = [];
  let total = 0;
  for (const t of CORE_TESTS) {
    const r = run(process.execPath, ["--import", "./scripts/test-resolve-hook.mjs", `scripts/${t}.mjs`]);
    total += countPassed(r.out);
    if (!r.ok) failed.push(t);
  }
  if (failed.length === 0) check(PASS, `核心 ${CORE_TESTS.length} 组全绿`, `${total} 项`);
  else check(FAIL, `核心测试红 ${failed.length} 组`, failed.join(", "));

  const mini = npm("run", "test:minimax");
  const miniTotal = countPassed(mini.out);
  if (mini.ok) check(PASS, "MiniMax 6 组全绿", `${miniTotal} 项`);
  else check(FAIL, "MiniMax 组有红", mini.out.split("\n").filter((l) => /failed|Error/.test(l)).slice(-2).join(" / "));

  const badAssertion = /❌/.test(mini.out) ? "（输出里有 ❌ 但没有非零退出码，人工看一眼）" : "";
  if (badAssertion !== "") check(WARN, "MiniMax 输出含 ❌", badAssertion);
}

// ── 4. 构建零差异 ───────────────────────────────────────────────────────────
function checkBuild() {
  console.log("\n── 4. 构建（必须零差异）───────────────────────────────");
  for (const script of ["build", "build:ui", "build:preset"]) {
    const r = npm("run", script);
    if (!r.ok) {
      check(FAIL, `npm run ${script} 失败`, r.out.split("\n").filter(Boolean).slice(-1)[0] ?? "");
      return;
    }
    check(PASS, `npm run ${script}`);
  }
  // `git diff` 只看内容（行尾由 autocrlf 归一），所以构建写 LF 造成的
  // `git status` 噪音不会误报 —— 但那种噪音仍值得提一句。
  const diff = git("diff", "--name-only");
  const files = diff.out.split("\n").map((s) => s.trim()).filter(Boolean);
  if (files.length === 0) check(PASS, "构建后 git diff 为空（产物与源码一致）");
  else check(FAIL, "构建产生了差异 —— 产物与源码不同步", files.slice(0, 8).join(", "));

  const status = git("status", "--porcelain");
  const eolOnly = status.out.split("\n")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("M "))
    .map((s) => s.slice(2).trim())
    .filter((f) => !files.includes(f));
  if (eolOnly.length > 0) check(WARN, `${eolOnly.length} 个文件只有行尾差异（构建写 LF / 检出 CRLF）`, eolOnly.join(", "));
}

// ── 5. 产物一致性 ───────────────────────────────────────────────────────────
function checkArtifacts() {
  console.log("\n── 5. 产物一致性 ──────────────────────────────────────");
  const r = run(process.execPath, ["scripts/test-artifact-sync.mjs"]);
  const summary = String(r.out).split("\n").filter((l) => /结果：/.test(l))[0] ?? "";
  if (r.ok) check(PASS, "src/host ↔ lib 逐字节 + 发布目录无 .bak", summary.trim());
  else check(FAIL, "产物一致性检查红了", summary.trim() || String(r.out).split("\n").filter(Boolean).slice(-1)[0]);
}

// ── 6. 打包 ─────────────────────────────────────────────────────────────────
function checkPack() {
  console.log("\n── 6. 打包 ────────────────────────────────────────────");
  const dir = mkdtempSync(join(tmpdir(), "herta-preflight-"));
  try {
    const r = npm("pack", ["--pack-destination", dir]);
    if (!r.ok) {
      check(FAIL, "npm pack 失败", String(r.out).split("\n").filter(Boolean).slice(-1)[0] ?? "");
      return;
    }
    const tgz = readdirSync(dir).find((f) => f.endsWith(".tgz"));
    if (tgz === undefined) {
      check(FAIL, "没找到打好的 tarball");
      return;
    }
    const bytes = readFileSync(join(dir, tgz));
    const sha1 = createHash("sha1").update(bytes).digest("hex");
    const listed = run("tar", ["-tzf", join(dir, tgz)], {});
    const files = listed.out.split("\n").map((s) => s.trim()).filter((s) => s !== "" && !s.endsWith("/"));
    const junk = files.filter((f) => /\.bak|_tmp|\.npm-cache|\.log$/.test(f));
    check(PASS, `tarball ${tgz}`, `${files.length} 个文件 / ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
    check(PASS, "sha1（写进 Release 说明）", sha1);
    if (junk.length === 0) check(PASS, "没有 .bak / 临时文件混进包");
    else check(FAIL, "包里有发布残留", junk.slice(0, 6).join(", "));
    const hasPreset = files.some((f) => f.endsWith("package/preset/herta.patch.yml"));
    const hasEntry = files.some((f) => f.endsWith("package/lib/index.js"));
    if (hasPreset && hasEntry) check(PASS, "preset 补丁层与宿入口都在包里");
    else check(FAIL, "包内缺少关键文件", `preset=${hasPreset} index=${hasEntry}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── 7. 文案 ─────────────────────────────────────────────────────────────────
function checkDocs() {
  console.log("\n── 7. 发布文案 ────────────────────────────────────────");
  const readme = readFileSync(join(root, "README.md"), "utf8");
  if (new RegExp(`^### v${version.replace(/\./g, "\\.")}\\b`, "m").test(readme)) {
    check(PASS, `README 版本历史有 v${version} 条目`);
  } else {
    check(FAIL, `README 版本历史缺 v${version} 条目`, `在「## 版本历史」下补 ### v${version}`);
  }
  for (const [label, file] of [
    ["Release 说明", join(CONFIG.docsDir, `Herta-DSH-v${version}-Release说明.md`)],
    ["B 站公告", join(CONFIG.docsDir, `Herta-DSH-v${version}-公告.md`)],
  ]) {
    if (existsSync(file)) check(PASS, `${label}：${file}`);
    else check(FAIL, `缺 ${label}`, file);
  }
}

// ── 8. 宿主矩阵 ─────────────────────────────────────────────────────────────
function checkHostMatrix() {
  console.log("\n── 8. 宿主矩阵 ────────────────────────────────────────");
  const range = pkg.engines?.dsh ?? null;
  if (range === null) {
    check(FAIL, "package.json 里没有 engines.dsh");
    return;
  }
  check(PASS, `engines.dsh = ${range}`);
  if (!existsSync(CONFIG.desktopRuntimeJson)) {
    check(WARN, "找不到桌面应用的 runtime.json（跳过比对）", CONFIG.desktopRuntimeJson);
    return;
  }
  const runtime = JSON.parse(readFileSync(CONFIG.desktopRuntimeJson, "utf8"));
  const desktop = String(runtime.desktopVersion ?? "");
  if (desktop === "") {
    check(WARN, "runtime.json 里没有 desktopVersion");
    return;
  }
  const ok = satisfiesRange(range, desktop);
  if (ok === true) check(PASS, `桌面应用 ${desktop} 落在区间内`);
  else if (ok === false) check(FAIL, `桌面应用 ${desktop} **不在** engines.dsh 区间内`, "要么放宽区间，要么先适配");
  else check(WARN, "区间或版本号解析不了，人工确认", `区间 ${range} vs 桌面 ${desktop}`);
}

// ── 发布后核验 ──────────────────────────────────────────────────────────────
function verifyPublished(ver) {
  console.log(`\n=== 发布后核验 dsh-herta@${ver} ===`);
  const meta = npmView(`dsh-herta@${ver}`, ["dist.shasum", "dist.integrity", "dist.fileCount", "dist.unpackedSize", "version"]);
  if (!meta.ok) {
    check(FAIL, `registry 上取不到 ${ver}`, String(meta.out).split("\n").filter(Boolean).slice(-1)[0] ?? "");
  } else {
    let m = null;
    try {
      m = JSON.parse(meta.out);
    } catch {
      /* 忽略 */
    }
    if (m === null) {
      check(WARN, "元数据解析失败", String(meta.out).slice(0, 120));
    } else {
      check(PASS, `registry 上是 ${m.version}`, `${m["dist.fileCount"]} 个文件 / ${(m["dist.unpackedSize"] / 1024 / 1024).toFixed(1)} MB`);
      check(PASS, "dist.shasum", m["dist.shasum"]);
      check(PASS, "dist.integrity", String(m["dist.integrity"]).slice(0, 48) + "…");

      // 逐文件核验：拿**发布提交那一棵树**打包，与 registry 上那份逐文件比。
      // ⚠️ 两个坑，都踩过：
      //   1. 不能 pack 当前工作区 —— 发布之后工作区通常已前进到下个版本（比对必然不一致）；
      //   2. 不能比 tarball 的 sha1 —— 新检出写 CRLF、发布时那份可能是 LF，字节数就不同。
      //      所以逐文件比：原始字节不同时，**文本文件**再按 EOL 归一后比一次。
      const wt = mkdtempSync(join(tmpdir(), "herta-tag-"));
      const pubPack = mkdtempSync(join(tmpdir(), "herta-pub-"));
      const tagPack = mkdtempSync(join(tmpdir(), "herta-tagpack-"));
      const pubTree = mkdtempSync(join(tmpdir(), "herta-pubtree-"));
      const tagTree = mkdtempSync(join(tmpdir(), "herta-tagtree-"));
      try {
        npm("pack", [`dsh-herta@${ver}`, "--pack-destination", pubPack]);
        const add = git("worktree", "add", "--detach", wt, `v${ver}`);
        if (!add.ok) {
          check(WARN, `拉不出 tag v${ver} 的工作树，跳过逐文件核验`, String(add.out).split("\n").filter(Boolean).slice(-1)[0] ?? "");
        } else {
          run("npm", ["pack", "--pack-destination", tagPack], { cwd: wt });
          const pubTgz = readdirSync(pubPack).find((f) => f.endsWith(".tgz"));
          const tagTgz = readdirSync(tagPack).find((f) => f.endsWith(".tgz"));
          if (pubTgz === undefined || tagTgz === undefined) {
            check(WARN, "取不到两份 tarball，跳过逐文件核验");
          } else {
            run("tar", ["-xzf", join(pubPack, pubTgz), "-C", pubTree]);
            run("tar", ["-xzf", join(tagPack, tagTgz), "-C", tagTree]);
            const files = listFilesRel(pubTree);
            const differs = [];
            for (const rel of files) {
              const a = join(pubTree, rel);
              const b = join(tagTree, rel);
              if (!existsSync(b)) {
                differs.push(`${rel}（tag 树里没有）`);
                continue;
              }
              if (!sameFile(a, b)) differs.push(rel);
            }
            const extra = listFilesRel(tagTree).filter((rel) => !files.includes(rel));
            for (const rel of extra) differs.push(`${rel}（只在 tag 树里）`);
            if (differs.length === 0) {
              check(PASS, `tag v${ver} 那一棵树与 registry 上那份逐文件一致`, `${files.length} 个文件（文本文件按 EOL 归一后比）`);
            } else {
              check(FAIL, `tag v${ver} 与 registry 上那份有 ${differs.length} 个文件不同`, differs.slice(0, 6).join(", "));
            }
          }
        }
      } finally {
        git("worktree", "remove", "--force", wt);
        for (const d of [wt, pubPack, tagPack, pubTree, tagTree]) rmSync(d, { recursive: true, force: true });
      }
    }
  }

  // 国内镜像：滞后不算缺陷（按需同步），但要说清
  console.log("\n── 国内镜像（滞后＝按需同步，不是缺陷）──────────────");
  for (const mirror of CONFIG.mirrors.slice(1)) {
    const r = npmView("dsh-herta", ["version"], ["--registry", mirror]);
    const v = String(r.out).trim().replace(/"/g, "");
    if (r.ok && v === ver) check(PASS, `${mirror} → ${v}`);
    else check(WARN, `${mirror} → ${v || "取不到"}`, "镜像按需同步；让别人强制指定版本：dsh plugin --profile desktop add dsh-herta@" + ver);
  }

  // GitHub：tag 与 Release
  console.log("\n── GitHub ────────────────────────────────────────────");
  const tag = git("ls-remote", "--tags", "origin", `v${ver}`);
  if (tag.ok && tag.out.trim() !== "") check(PASS, `tag v${ver} 已在远端`);
  else check(FAIL, `远端没有 tag v${ver}`, "git push origin v" + ver);
  const gh = run("gh", ["release", "view", `v${ver}`, "--json", "tagName,isDraft,isPrerelease"]);
  if (!gh.ok) check(WARN, "查不到 GitHub Release（gh 未装/未登录，或还没建）", `gh release create v${ver} …`);
  else {
    const j = JSON.parse(gh.out);
    if (j.isDraft) check(FAIL, `Release v${ver} 还是草稿`);
    else check(PASS, `GitHub Release v${ver} 存在`);
  }

  // 上游目录：只说明机制，不当缺陷
  console.log("\n── 上游目录（机制说明）────────────────────────────────");
  info("目录卡片的 version 是上游每日构建的快照", "发布后次日约 10:23（北京时间）重建才会显示新版本号；安装始终取 npm latest，不受它影响");
}

// ── main ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv[0] === "--verify-published") {
  const ver = argv[1] ?? version;
  verifyPublished(ver);
} else {
  console.log(`dsh-herta 发布前预检（version = ${version}）`);
  checkVersion();
  checkWorkspace();
  checkTests();
  checkBuild();
  checkArtifacts();
  checkPack();
  checkDocs();
  checkHostMatrix();
}

const fails = results.filter((r) => r.level === FAIL);
const warns = results.filter((r) => r.level === WARN);
console.log(`\n=== 汇总：${results.filter((r) => r.level === PASS).length} ✅ / ${warns.length} ⚠️ / ${fails.length} ❌ ===`);
if (fails.length > 0) {
  console.log("阻塞项：");
  for (const f of fails) console.log(`  ❌ ${f.label}`);
  process.exit(1);
}
console.log(warns.length === 0 ? "可以发。" : "没有阻塞项；⚠️ 项请人工判断后再发。");
