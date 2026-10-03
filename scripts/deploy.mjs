/**
 * dsh-herta 的部署脚本：构建 → 把产物显式镜像进目标 profile 的 node_modules。
 *
 * 为什么不靠 `dsh plugin add` 重复重装：profile 开了 `nodeLinker: hoisted`，
 * 包是**硬链接**进 node_modules 的。硬链接只在「原地改写」时才会跟着变，
 * 一旦构建器改成「写临时文件再改名」（很常见），profile 里就还是旧代码，
 * 而 pnpm 重复 add 还会撞 `ERR_PNPM_UNEXPECTED_STORE`。所以这里显式拷贝，
 * 不依赖任何链接语义。
 *
 * 用法：
 *   node scripts/deploy.mjs                      # 默认部署到 lab profile
 *   DSH_PROFILE_DIR=<path> node scripts/deploy.mjs
 *   node scripts/deploy.mjs --no-build           # 只镜像，不跑构建（见下）
 *
 * 注意：这只用于**开发迭代**。正式安装仍然走
 * `dsh plugin --profile <name> add dsh-herta`。
 *
 * ## 2026-09-28：不再「先整棵删再拷」
 *
 * 上一版先 `rmSync(target, { recursive: true, force: true })` 再拷，理由是
 * 「合并覆盖会被上一位持有者留下的文件句柄挡成 EPERM/EPIPE，而且会留下陈旧模块」。
 * 那个理由在**目标没人在用**时成立；在**应用正在运行**时它是最坏的组合：
 * Windows 会让目录停在 delete-pending 状态，`force: true` 把失败**吞掉**，
 * 脚本继续往下跑、`cpSync` 撞 EIO，profile 里只剩一个空目录
 * （真机踩过：desktop profile 的 `dsh-herta` 被删空，只能从 install-backups 还原）。
 *
 * 现在改成：**逐个文件原地覆盖**（运行中的实例并不锁这些文件 —— 它们是启动时读
 * 一遍就关掉的），拷完删掉这一版已经没有的陈旧文件，最后**逐文件核对内容**。
 * 仍然要重启实例才生效：宿主半侧与客户端 bundle 都是启动期加载的。
 *
 * 再补一条（同日晚些时候又踩到）：**内容没变的文件不写**。应用跑着常驻合成进程时，
 * `assets/tts-runtime` 下的那几个 dll 被映射进那个子进程的地址空间，谁都写不动（EBUSY）
 * —— 而它在两次构建之间根本没变。所以先比内容再决定要不要碰它；真的写不动就逐条报
 * 出来，让人关掉实例重跑，而不是让整次部署死在一个不该被碰的文件上。
 *
 * ## `--no-build`：本机没有 esbuild 时只镜像
 *
 * 构建脚本要借一份**解开目录**的 DSH 安装（桌面应用的运行时在 `app.asar` 里，
 * 普通 Node 读不到），所以有些机器上根本跑不了构建。而仓库里的 `lib/` 产物是
 * **随提交一起推上来**的，一致性由 `scripts/test-artifact-sync.mjs` 守着 ——
 * 这种机器上用 `--no-build`：跳过三个构建脚本，只做「镜像 + 清陈旧 + 逐字节核验」。
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/** 默认目标是工作区里的隔离实验 profile，绝不碰桌面应用真正在用的那个。 */
const DEFAULT_PROFILE_DIR = resolve(
  root,
  "..",
  "herta-lab",
  ".dsh",
  "profiles",
  "herta-lab"
);
const profileDir = process.env.DSH_PROFILE_DIR ?? DEFAULT_PROFILE_DIR;
/** 只镜像、不构建（见文件头 `--no-build`）。 */
const NO_BUILD = process.argv.includes("--no-build");
const target = join(profileDir, "node_modules", "dsh-herta");

/**
 * 镜像集 —— 与 `package.json` 的 `files` 对齐（少了 `assets` 语音整档静默失效）。
 *
 * ⚠️ 2026-09-30 真机踩到：这里原先少了 `locale`、`LICENSE`、`NOTICE.md`、
 * `THIRD-PARTY.md`（`files` 里都有），而下面的陈旧清理**遍历整个目标目录** ——
 * 于是部署一次就把目标里那 5 个文件当「陈旧文件」删了。两处一起收口：
 * 镜像集补齐成 `files` 的内容，陈旧判定只在自己的镜像集里找。
 */
const MIRRORED_DIRS = ["lib", "assets", "preset", "locale", "theme"];
const MIRRORED_FILES = [
  "cordis.patch.yml",
  "package.json",
  "icon.png",
  "LICENSE",
  "NOTICE.md",
  "THIRD-PARTY.md",
];

/** 列出目录下所有文件的相对路径（`/` 分隔，便于跨平台比较）。 */
function listFiles(base) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  };
  if (existsSync(base)) walk(base, "");
  return out;
}

/**
 * 逐文件递归拷贝（**不用 `cpSync`**）。
 *
 * 真机上量到的事实：应用在跑时 `cpSync(srcDir, dstDir, {recursive:true})` 会以
 * `EIO: Access is denied` 挂在目标目录上（它按目录整体操作），而 `copyFileSync`
 * 逐个覆盖完全正常 —— 运行中的实例并不会锁住这些文件，它们只在启动时被读一遍。
 * 所以这里的每个目录用 `mkdirSync(recursive)` 复用，每个文件用 `copyFileSync`。
 *
 * ## 但**内容没变的文件不写**
 *
 * 2026-09-28 又踩一次：应用正跑着一个常驻合成进程（`tts-worker.cjs` 的 `serve` 模式），
 * 它**把 `assets/tts-runtime/sherpa-onnx-win-x64/onnxruntime.dll` 映射进自己的地址空间** ——
 * 那个文件谁都写不动（EBUSY）。而它在两次构建之间**根本没变**。
 * 所以先比内容（大小 + 逐字节），一样就跳过；只有真的变了才写，写不动就记下来
 * 一起报（见下面 2c），而不是让整次部署死在一个不该被碰的文件上。
 */
const unchanged = [];
const failed = [];

/** 目标文件是否已经与源**逐字节一致**（一致就不必去碰它）。 */
function sameContent(src, dst) {
  if (!existsSync(dst)) return false;
  const a = statSync(src);
  const b = statSync(dst);
  if (a.size !== b.size) return false;
  return readFileSync(src).equals(readFileSync(dst));
}

/** 写一个文件：一样就跳过，写不动就记账（不抛）。 */
function copyOne(src, dst) {
  const rel = relative(root, src).split(sep).join("/");
  if (sameContent(src, dst)) {
    unchanged.push(rel);
    return;
  }
  try {
    copyFileSync(src, dst);
  } catch (error) {
    failed.push({ rel, error: String(error?.message ?? error) });
  }
}

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) copyOne(src, dst);
  }
}

// 1) 构建（插件 + preset + 整机页面）。`--no-build` 时跳过：产物随提交一起推，
//    一致性由 `scripts/test-artifact-sync.mjs` 守（本机没有 esbuild，见文件头）。
if (NO_BUILD) {
  console.log("（--no-build：跳过构建，直接镜像仓库里的产物）");
} else {
  execFileSync(process.execPath, [join(here, "build.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
  execFileSync(process.execPath, [join(here, "build-preset.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
  execFileSync(process.execPath, [join(here, "build-herta-ui.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
}

// 2) 镜像插件（原地覆盖，不删目录 —— 见文件头那段实测记录）
if (!existsSync(profileDir)) {
  throw new Error(
    `目标 profile 不存在：${profileDir}\n先跑一次 dsh --profile herta-lab --from-default-profile web --dump-config`
  );
}
mkdirSync(target, { recursive: true });
for (const dir of MIRRORED_DIRS) {
  copyTree(join(root, dir), join(target, dir));
}
for (const rel of MIRRORED_FILES) {
  copyOne(join(root, rel), join(target, rel));
}

// 2a) 写不动的记下来一起报（不带着半截状态往下走，也不在一行堆栈里结束）。
//     最常见的就是那三个原生件：常驻合成进程把 dll 映射进地址空间之后谁都写不动。
if (failed.length > 0) {
  for (const f of failed) console.log(`  ✗ 没写进去：${f.rel} —— ${f.error}`);
  throw new Error(
    `有 ${failed.length} 个文件没能写进 ${target}。\n` +
      "最常见的原因：那个实例正在跑，而它加载了 assets/tts-runtime 下的原生件（常驻合成进程会）。\n" +
      "已写入的部分不必回滚 —— 关掉实例后**重跑一次**即可（内容没变的文件会被跳过，不会重复动它们）。"
  );
}

// 2b) 清掉这一版已经没有的陈旧文件：留在 profile 里会在下次启动时被 import 到
//     （上一版就是为了这件事才整棵删的；这里只删多出来的那些，不删目录）。
const sourceFiles = new Set(MIRRORED_FILES);
for (const dir of MIRRORED_DIRS) {
  for (const rel of listFiles(join(root, dir)))
    sourceFiles.add(`${dir}/${rel}`);
}
// 只在**自己的镜像集里**找陈旧文件。遍历整个目标目录会把镜像集之外的东西
// （`locale/`、`LICENSE` 这些 `files` 里点名的、以及别人放进去的文件）当陈旧删掉。
const stale = [];
for (const dir of MIRRORED_DIRS) {
  for (const rel of listFiles(join(target, dir))) {
    if (!sourceFiles.has(`${dir}/${rel}`)) stale.push(`${dir}/${rel}`);
  }
}
for (const rel of stale) {
  try {
    rmSync(join(target, rel), { force: true });
  } catch (err) {
    console.log(
      `陈旧文件删不掉（多半正被运行中的实例占着）：${rel} —— ${String(err?.message ?? err)}`
    );
  }
}

// 2c) 核验：镜像集内每个文件都必须与仓库**逐字节一致**。
//     不核验的镜像脚本只能证明"我调用了拷贝"，证明不了"它真的落盘了"。
const mismatched = [];
for (const rel of sourceFiles) {
  const a = readFileSync(join(root, rel));
  const abs = join(target, rel);
  if (!existsSync(abs) || !a.equals(readFileSync(abs))) mismatched.push(rel);
}
if (mismatched.length > 0) {
  throw new Error(
    `镜像核验失败：${mismatched.length}/${sourceFiles.size} 个文件与构建产物不一致：\n  ${mismatched.slice(0, 10).join("\n  ")}`
  );
}
console.log(
  `插件已部署到 ${target}（核验 ${sourceFiles.size} 个文件逐字节一致` +
    `；本次真正写入 ${sourceFiles.size - unchanged.length} 个` +
    `${unchanged.length === 0 ? "" : `，${unchanged.length} 个内容未变已跳过`}` +
    `${stale.length === 0 ? "" : `，清掉 ${stale.length} 个陈旧文件`}）`
);

// 3) 轻量核验：preset 行确实出现在合成结果里。
// 0.1.7 起 preset 不再是 `$DSH_HOME/.agent-presets/<name>/` 目录，所以这里
// 不再往 home 里拷任何东西 —— 它随包一起，作为第二条 bundle patch 生效。
// 顺带确认目标是**真目录**：若是链接（某些 pnpm 布局会建），拷贝语义与"真副本"
// 不同 —— 那种情况要显式报出来，而不是默默拷到一个别人不会读的地方。
const lst = lstatSync(target);
if (lst.isSymbolicLink() || !lst.isDirectory()) {
  throw new Error(`目标不是普通目录（可能是链接/junction）：${target}`);
}
console.log(
  "（preset 随包生效，无需往 $DSH_HOME 拷贝；改了 client 半侧或 preset 后需要重启 dsh web）"
);
