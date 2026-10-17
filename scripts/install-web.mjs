/**
 * Phase E：把 dsh-herta 装进桌面应用真正在用的那个 profile。
 *
 * **为什么要有脚本而不是手敲命令**：这一步会改用户日常在用的环境，
 * 而且必须**关窗重开应用**才生效（会掐断当前会话）。所以它必须是：
 *   · 一步到位 —— 不需要现场拼命令
 *   · 动之前先备份 —— 回滚要有据可依
 *   · 动之后自校验 —— `--dump-config` 必须 exit 0 且 herta 行恰好一条
 *   · 可空跑 —— `--dry-run` 只读不写，先看清它会做什么
 *
 * 用法：
 *   node scripts/install-web.mjs --dry-run          # 只读：看它会做什么
 *   node scripts/install-web.mjs                    # 真装（默认 web profile）
 *   node scripts/install-web.mjs --rollback         # 用最近一次备份还原
 *   node scripts/install-web.mjs --profile herta-lab --home <lab home>   # 换目标（给 lab 空跑用）
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// ── 参数 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};

/**
 * 目标 DSH home。0.1.7 起桌面应用用 `%USERPROFILE%\.dsh`（可用 --home 覆盖）。
 */
const HOME = value("--home", process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const PROFILE = value("--profile", "desktop");
/**
 * 目标 profile 实际在用的那个 dsh bin。
 *
 * ⚠️ **0.1.7 起桌面应用的运行时打包在 `resources/app.asar` 里** —— 那是 Electron
 * 的归档格式，普通 Node 读不到，所以本脚本**无法驱动桌面应用自带的那份运行时**。
 * 两种用法：
 *   · 桌面应用：用应用内置的插件管理器安装（模型侧的 `plugin_manager` 工具，
 *     `install_bundle` → `file:<repo>`），再关窗重开
 *   · 独立 DSH 安装（npm / 便携版）：`--dsh-bin <…/@deepseek-ai/dsh/lib/bin.js>`
 *     或 `$env:DSH_BIN`，本脚本全程可用
 */
const DSH_BIN = value("--dsh-bin", process.env.DSH_BIN ?? "");
const NODE = process.execPath;
const DRY = flag("--dry-run");
const ROLLBACK = flag("--rollback");

const PROFILE_DIR = join(HOME, "profiles", PROFILE);
const BACKUP_ROOT = join(root, "install-backups");
const PACKAGE_NAME = "dsh-herta";

const say = (s) => console.log(s);
const step = (n, s) => console.log(`\n── ${n}. ${s}`);
const bytes = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  if (existsSync(dir)) walk(dir);
  return total;
}

/** 用桌面应用那个 bin 跑 dsh，返回 stdout。 */
function dsh(args, { allowFail = false } = {}) {
  try {
    return execFileSync(NODE, [DSH_BIN, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DSH_HOME: HOME },
    });
  } catch (error) {
    if (allowFail) return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    throw new Error(`dsh ${args.join(" ")} 失败：\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
  }
}

// ── 回滚 ────────────────────────────────────────────────────────────────────
if (ROLLBACK) {
  step("回滚", `用「${PROFILE}」这个 profile 的最近一次备份还原`);
  if (!existsSync(BACKUP_ROOT)) throw new Error(`没有备份目录：${BACKUP_ROOT}`);

  // **按目标 profile 过滤**，不是取全局最新 —— 同一台机器上可能装过多个 profile，
  // 取最新会把别人的配置还原到这边来。
  const candidates = readdirSync(BACKUP_ROOT)
    .sort()
    .reverse()
    .filter((name) => {
      try {
        const t = JSON.parse(readFileSync(join(BACKUP_ROOT, name, "TARGET.json"), "utf8"));
        return t.home === HOME && t.profile === PROFILE;
      } catch {
        return false;
      }
    });
  const latest = candidates[0];
  if (latest === undefined) {
    throw new Error(`没有针对 ${HOME} / ${PROFILE} 的备份（目录里现有：${readdirSync(BACKUP_ROOT).join(", ")}）`);
  }
  const from = join(BACKUP_ROOT, latest);
  say(`  用 ${from}`);

  for (const rel of ["package.json", "cordis.patch.yml"]) {
    const src = join(from, rel);
    if (existsSync(src)) {
      cpSync(src, join(PROFILE_DIR, rel));
      say(`  已还原 ${rel}`);
    }
  }
  // 0.1.7 起 preset 是包自带的第二条 bundle patch，跟着 package.json + bundles
  // 一起回滚，这里不再有单独的 `.agent-presets` 需要清理。
  say("\n回滚完成。**仍需关窗重开桌面应用才生效。**");
  process.exit(0);
}

// ── 0. 前置检查 ─────────────────────────────────────────────────────────────
step("0", "前置检查");
if (DSH_BIN === "") {
  throw new Error(
    [
      "没有指定 dsh bin —— 本脚本需要一个**普通 Node 能启动**的 DSH 安装。",
      "  · 桌面应用：运行时在 resources/app.asar 里（普通 Node 读不到），",
      "    请改用应用内置的插件管理器安装（模型侧 plugin_manager 工具的 install_bundle）。",
      "  · 独立 DSH 安装：--dsh-bin <…/node_modules/@deepseek-ai/dsh/lib/bin.js> 或 $env:DSH_BIN。",
    ].join("\n"),
  );
}
for (const [label, p] of [
  ["DSH bin", DSH_BIN],
  ["profile 目录", PROFILE_DIR],
  ["profile package.json", join(PROFILE_DIR, "package.json")],
  ["插件包", join(root, "lib", "client.js")],
  ["语音资产", join(root, "assets", "voice")],
  ["TTS 运行时", join(root, "assets", "tts-runtime", "sherpa-onnx-node", "sherpa-onnx.js")],
  ["preset 补丁层", join(root, "preset", "herta.patch.yml")],
  ["插件图标", join(root, "icon.png")],
]) {
  if (!existsSync(p)) throw new Error(`缺 ${label}：${p}`);
  say(`  ✅ ${label}`);
}

const pluginSize = dirSize(join(root, "lib")) + dirSize(join(root, "assets"));
say(`  插件体积：${bytes(pluginSize)}`);

const before = JSON.parse(readFileSync(join(PROFILE_DIR, "package.json"), "utf8"));
say(`  目标 profile 现有 bundles：${(before.dsh?.profile?.bundles ?? []).join(", ")}`);
if ((before.dsh?.profile?.bundles ?? []).includes(PACKAGE_NAME)) {
  say(`  ⚠️  ${PACKAGE_NAME} 已经在这个 profile 里了 —— 这次相当于重装`);
}

if (DRY) {
  say("\n（--dry-run：到此为止，没有改动任何文件）");
  say("真装会做：备份 → dsh plugin add（含 preset bundle patch）→ --dump-config 自校验");
  process.exit(0);
}

// ── 1. 备份 ─────────────────────────────────────────────────────────────────
step("1", "备份");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = join(BACKUP_ROOT, stamp);
mkdirSync(backupDir, { recursive: true });
for (const rel of ["package.json", "cordis.patch.yml"]) {
  const src = join(PROFILE_DIR, rel);
  if (existsSync(src)) cpSync(src, join(backupDir, rel));
}
// 记下这份备份属于哪个 home / profile —— 回滚时按它过滤，避免还错对象。
writeFileSync(
  join(backupDir, "TARGET.json"),
  `${JSON.stringify({ home: HOME, profile: PROFILE, at: new Date().toISOString() }, null, 2)}\n`,
  "utf8",
);
say(`  已备份到 ${backupDir}`);

// ── 2. 装插件 ───────────────────────────────────────────────────────────────
step("2", "装插件");
say(`  ⚠️  这一步之后**不要再手改 profile 的 cordis.patch.yml** ——`);
say(`     包自带 bundle patch 已插入同一行，手加会产生重复条目、profile 起不来。`);

/** 把包镜像进 profile 的 node_modules（pnpm 本来会做的事）。 */
function mirrorPackage() {
  const target = join(PROFILE_DIR, "node_modules", PACKAGE_NAME);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(root, "lib"), join(target, "lib"), { recursive: true });
  cpSync(join(root, "assets"), join(target, "assets"), { recursive: true });
  // preset 补丁层必须一起进 profile —— package.json 的 dsh.bundle.patch 数组
  // 指向 ./preset/herta.patch.yml，少了它 profile 起不来（loader 找不到 patch 文件）。
  cpSync(join(root, "preset"), join(target, "preset"), { recursive: true });
  for (const rel of ["cordis.patch.yml", "package.json", "icon.png"]) {
    cpSync(join(root, rel), join(target, rel));
  }
  return target;
}

// 首选官方路径（dsh plugin add → pnpm）。
const addOut = dsh(["plugin", "--profile", PROFILE, "add", `file:${root}`], { allowFail: true });
const addFailed = /ERR_|dsh: pnpm failed/i.test(addOut);

if (addFailed) {
  // pnpm 在这台机器上会撞 ERR_PNPM_UNEXPECTED_STORE（store 位置与 node_modules
  // 记录的不一致）。这时**不硬修 pnpm**，改走确定性路径：直接改 profile 清单
  // 的两处（dependencies + dsh.profile.bundles），再把包镜像进 node_modules ——
  // 这正是 pnpm 成功的那些次所产生的结果。
  say("  ⚠️  plugin add 的 pnpm 步骤失败，改走确定性的手工安装路径");
  say(`     失败摘要：${addOut.split("\n").filter((l) => /ERR_|failed/i.test(l)).slice(0, 2).join(" / ")}`);

  const profilePkg = join(PROFILE_DIR, "package.json");
  const pkg = JSON.parse(readFileSync(profilePkg, "utf8"));
  pkg.dependencies = pkg.dependencies ?? {};
  pkg.dependencies[PACKAGE_NAME] = `file:${root.replace(/\\/g, "/")}`;
  pkg.dsh = pkg.dsh ?? {};
  pkg.dsh.profile = pkg.dsh.profile ?? {};
  const list = pkg.dsh.profile.bundles ?? [];
  if (!list.includes(PACKAGE_NAME)) list.push(PACKAGE_NAME);
  pkg.dsh.profile.bundles = list;
  writeFileSync(profilePkg, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  say(`  ✅ 已写入 profile package.json（dependencies + bundles）`);

  const target = mirrorPackage();
  say(`  ✅ 已镜像到 ${target}`);
} else {
  say("  ✅ plugin add 成功（官方路径）");
  // pnpm 会把包装进 node_modules，但文件可能是硬链接的旧副本 ——
  // 用我们自己的镜像覆盖一次，保证 profile 里跑的就是刚构建出来的那份。
  mirrorPackage();
  say("  ✅ 已用最新构建覆盖 node_modules 里的副本");
}

const after = JSON.parse(readFileSync(join(PROFILE_DIR, "package.json"), "utf8"));
const bundles = after.dsh?.profile?.bundles ?? [];
if (!bundles.includes(PACKAGE_NAME)) {
  throw new Error(`装完 bundles 里仍没有 ${PACKAGE_NAME}：${bundles.join(", ")}`);
}
say(`  ✅ bundles 现在：${bundles.join(", ")}`);

// ── 3. preset ───────────────────────────────────────────────────────────────
// 0.1.7 起 preset 不再是 `$DSH_HOME/.agent-presets/<name>/` 目录，而是**包自带的
// 第二条 bundle patch**（`preset/herta.patch.yml`，见 package.json 的
// dsh.bundle.patch 数组）。它已随上面的 mirrorPackage 进 profile，这里只核验。
step("3", "核验 preset 补丁层");
const presetInProfile = join(PROFILE_DIR, "node_modules", PACKAGE_NAME, "preset", "herta.patch.yml");
if (!existsSync(presetInProfile)) {
  throw new Error(`preset 补丁层没进 profile：${presetInProfile}`);
}
say(`  ✅ ${presetInProfile}`);

// ── 4. 自校验 ───────────────────────────────────────────────────────────────
step("4", "自校验（--dump-config）");
const dump = dsh(["--profile", PROFILE, "--dump-config"]);
const hertaRows = (dump.match(/^- id: herta$/gm) ?? []).length;
say(`  ✅ dump-config exit 0`);
say(`  herta 行数量：${hertaRows}${hertaRows === 1 ? "" : "  ❌ 应当是 1"}`);
if (hertaRows !== 1) throw new Error("herta 行不是恰好一条 —— 疑似重复条目，回滚：node scripts/install-web.mjs --rollback");
// preset 补丁层必须真的进了合成结果（它是「Herta」这个 preset 的唯一来源）
if (!dump.includes("preset-herta") || !dump.includes("plane: preset")) {
  throw new Error("配置里没有 preset-herta / plane: preset —— bundle patch 数组没生效，回滚：node scripts/install-web.mjs --rollback");
}
say("  ✅ preset-herta 行在配置里（她的 preset 已挂上）");

// 之前装的插件必须还在（我们只是追加，不该动别人）
for (const other of ["dsh-github-workbench"]) {
  if (bundles.includes(other) && !dump.includes(other)) {
    throw new Error(`${other} 从配置里消失了 —— 回滚：node scripts/install-web.mjs --rollback`);
  }
}
say("  ✅ 其他已装插件仍在配置里");

// ── 5. 交接 ─────────────────────────────────────────────────────────────────
writeFileSync(join(backupDir, "INSTALLED.txt"), `installed at ${new Date().toISOString()}\nhome=${HOME}\nprofile=${PROFILE}\n`, "utf8");
console.log(`
════════════════════════════════════════════════════════════════
装好了。**现在需要你做的唯一一件事：关掉桌面应用窗口，再重新打开。**

为什么必须这样：patchReload: live 只热重载 patch 文件，而 bundles 的变更是
启动期合成；桌面应用又没有子进程守护 —— 直接杀掉 dsh web 不会自动拉起，
界面会变哑。

重开后验证：
  1. 新建会话 → 页签里应出现「Herta」
  2. General 设置里的 Agent preset 应出现「Herta」
  3. 让她的会话跑一轮后，工具表里应有 7 个 herta_*（需要 API Key）

出问题就回滚：
  node "${join(here, "install-web.mjs")}" --rollback
  （然后同样要关窗重开）
备份在：${backupDir}
════════════════════════════════════════════════════════════════
`);
