/**
 * dsh-herta 的构建脚本。
 *
 * 产出到 lib/：
 *   lib/index.js    —— host 半侧（直接从 src/host 拷贝，目前是纯 JS，无需编译）
 *   lib/minimax/    —— MiniMax 那一组**移植件**（TS → JS，见 build-minimax.mjs）
 *   lib/client.js   —— client 半侧（esbuild 打包，外面套 DSH 的模块加载器）
 *
 * 三件关键的事：
 *
 * 1. **模块加载器包装**。DSH 的客户端插件不是普通 ESM 文件，而是往
 *    `window.__ModuleLoader__.load({id, factory})` 注册一个工厂。loader 会把
 *    一个同步 `require` 交给工厂，它只认「平台种子词」与启动图里已注册的包。
 *    所以产物必须是 CJS 形态，并用 banner/footer 把 esbuild 的输出包进工厂里。
 *
 * 2. **平台种子词必须 external**。外壳冻结了一张模块表，一共只有 9 项
 *    （react / react-dom / cordis / dsh-client-store / ui-slots / ui-primitives /
 *    ui-dockkit）。react 尤其必须 external —— 打进两份 React 会让 hooks 直接崩。
 *
 * 3. **`.js` → `.ts(x)` 解析**。Herta 源码是 NodeNext 风格：TS 文件之间用
 *    `import x from "./y.js"` 互相引用。磁盘上没有 y.js，只有 y.ts/y.tsx。
 *    esbuild 默认不会做这个替换，必须自己接一个 onResolve。
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = join(root, "lib");

/** Herta 源码树；界面组件从这里取。可用 HERTA_SRC 覆盖。 */
const HERTA_SRC = process.env.HERTA_SRC ?? resolve(root, "..", "Herta-src");
/** Herta 渲染层根目录 —— 等价于官网 vite 配置里的 `@gui` 别名。 */
const HERTA_RENDERER = join(HERTA_SRC, "packages", "gui", "src", "renderer");

/**
 * DSH 客户端平台种子词。取自运行中外壳的冻结模块表
 * （`dsh-web-frontend/dist/assets/index-*.js` 里的 `function by()`）。
 * 只有这些可以 external；其余必须打进 bundle。
 */
const PLATFORM_SEED = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-ui-dockkit",
];

/** 本机没有独立安装 esbuild，从 Herta 仓库的 pnpm 虚拟 store 里取。 */
function findEsbuild() {
  // 固定 0.25.12（ADR-0003：可复现构建）。候选列表已删除 —— 换 esbuild 版本意味着
  // `lib/client.js` 字节漂移，pre-commit 的「build 后 lib/ 无 diff」会当场拦下；
  // 要升级得显式改这里 + 重建产物 + 过守卫，而不是静默走另一个候选。
  const dir = join(
    HERTA_SRC,
    "node_modules",
    ".pnpm",
    "esbuild@0.25.12",
    "node_modules",
    "esbuild"
  );
  const entry = join(dir, "lib", "main.js");
  if (existsSync(entry)) return entry;
  throw new Error(
    `找不到 esbuild 0.25.12（可复现构建的固定版本）：\n  ${entry}\n` +
      `可用 HERTA_SRC 指向含该版本 pnpm store 的 Herta 源码树。`
  );
}

/** 尝试给一个无后缀/错后缀的路径补出真实文件。 */
function firstExistingFile(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.css`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    join(base, "index.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** `@gui/x` → Herta 渲染层下的 x。 */
const guiAlias = {
  name: "dsh-herta:gui-alias",
  setup(build) {
    build.onResolve({ filter: /^@gui(\/|$)/ }, (args) => {
      const rest = args.path.replace(/^@gui\/?/, "");
      const found = firstExistingFile(join(HERTA_RENDERER, rest));
      if (found === null) {
        return { errors: [{ text: `@gui 解析失败：${args.path}` }] };
      }
      return { path: found };
    });
  },
};

/** `./y.js` → 磁盘上的 `y.ts` / `y.tsx`。 */
const jsToTs = {
  name: "dsh-herta:js-to-ts",
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.path.startsWith(".") && !args.path.startsWith("/")) return null;
      if (args.importer === "") return null;
      const base = resolve(dirname(args.importer), args.path.slice(0, -3));
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(base + ext) && statSync(base + ext).isFile()) {
          return { path: base + ext };
        }
      }
      return null; // 真的 .js，交回默认解析
    });
  },
};

/**
 * Herta 的全局样式表在 DSH 里必须被改造，原因有三：
 *
 * 1. `:root` 在 shadow root 里**不匹配任何元素** —— 而 Herta 的全部配色变量
 *    （56 处）都定义在 `:root` 上，不改就等于整张表失效。
 * 2. `:root[data-theme="dark"] …`（53 条）同理，要变成 `:host([data-theme="dark"]) …`。
 * 3. `html` / `body` 的三条规则是**整页 chrome**（宇宙渐变背景、100vh 居中网格、
 *    fixed 模糊光晕）。嵌进 DSH 的对话框里它们是错的，直接删掉；只把
 *    「颜色 + 字体 + 不可选中」这三件真正需要继承的事补到 `:host` 上。
 *
 * 这样 Herta 的样式被完整关进 shadow root：既拿得到自己的变量，也碰不到 DSH 的壳。
 */
const HERA_HOST_BASE = `:host{color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;user-select:none;}`;

const STRIP_PAGE_CHROME = [
  /body:before\s*\{[^}]*\}/g,
  /body:after\s*\{[^}]*\}/g,
  /(?<![\w.#-])body\s*\{[^}]*\}/g,
  /(?<![\w.#-])html\s*\{[^}]*\}/g,
];

function transformHertaCss(raw) {
  let css = raw;
  for (const pattern of STRIP_PAGE_CHROME) css = css.replace(pattern, "");
  // 先换带主题的那一形态，再换裸 `:root`
  css = css.replace(
    /:root\[data-theme="dark"\]/g,
    ':host([data-theme="dark"])'
  );
  css = css.replace(/:root/g, ":host");

  const leftover = css.match(/(?<![\w.#-])(?:html|body)\s*\{/);
  if (leftover !== null) {
    throw new Error(`CSS 转换后仍残留整页选择器：${leftover[0]}`);
  }
  if (!css.includes(":host{")) {
    throw new Error(
      "CSS 转换后没有 :host 变量块 —— 变量定义可能改了写法，需要更新转换逻辑"
    );
  }
  return HERA_HOST_BASE + css;
}

/** 把 Herta 的全局样式表当字符串模块喂给 bundle（已做 shadow DOM 改造）。 */
const hertaCss = {
  name: "dsh-herta:herta-css",
  setup(build) {
    build.onLoad({ filter: /reference-ux\.css$/ }, (args) => {
      const raw = readFileSync(args.path, "utf8");
      const transformed = transformHertaCss(raw);
      console.log(
        `样式表 ${(raw.length / 1024).toFixed(0)} KB → ${(transformed.length / 1024).toFixed(0)} KB（已转 :host、去整页 chrome）`
      );
      return {
        contents: `export default ${JSON.stringify(transformed)};`,
        loader: "js",
      };
    });
  },
};

const BANNER = `window.__ModuleLoader__.load({ id: "dsh-herta", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;`;

const FOOTER = `return module.exports;
}});`;

async function main() {
  if (!existsSync(HERTA_RENDERER)) {
    throw new Error(
      `找不到 Herta 渲染层：${HERTA_RENDERER}（可用 HERTA_SRC 覆盖）`
    );
  }

  // 0) MiniMax 那一组模块是 TS 移植件，先单独编译到 lib/minimax/。
  //    其余 host 模块仍是逐字节拷贝 —— 这条缝只开给那一组（理由见 build-minimax.mjs）。
  execFileSync(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(here, "build-minimax.mjs")],
    {
      stdio: "inherit",
      cwd: root,
    }
  );

  const esbuildEntry = findEsbuild();
  const esbuild = await import(pathToFileURL(esbuildEntry).href);

  mkdirSync(outDir, { recursive: true });

  // host 半侧：逐文件拷贝（不是只拷 index.js —— 模块会越加越多）。
  // `.cjs` 也要：`tts-worker.cjs` 是 CommonJS 的子进程执行体（sherpa 的 glue
  // 本身就是 CJS，而且它必须在**子进程**里 require 原生件）。
  //
  // **先清掉源码里已经没有的旧模块**：拷贝是增量的，删掉一个 host 模块之后
  // lib/ 里会留着上一版的副本。它不被任何静态 import 引用，所以不会报错，
  // 只会让「产物里到底有哪些模块」跟源码对不上 —— 排查时最容易骗人的那种不一致。
  const hostSrc = join(root, "src", "host");
  const hostNames = new Set(readdirSync(hostSrc));
  for (const name of readdirSync(outDir)) {
    // 只管 host 半侧的平铺产物：client.js 是本脚本生成的，herta-ui/ 是
    // build-herta-ui.mjs 的，都不在这里的职责内。
    if (
      name === "client.js" ||
      (!name.endsWith(".js") && !name.endsWith(".cjs"))
    )
      continue;
    if (hostNames.has(name)) continue;
    rmSync(join(outDir, name), { force: true });
    console.log(`lib/${name} 已删除（源码里没有这个模块了）`);
  }
  for (const name of readdirSync(hostSrc)) {
    if (name.endsWith(".js") || name.endsWith(".cjs")) {
      copyFileSync(join(hostSrc, name), join(outDir, name));
    }
  }

  // client 半侧：打包。
  const result = await esbuild.build({
    entryPoints: [join(root, "src", "client", "index.tsx")],
    outfile: join(outDir, "client.js"),
    bundle: true,
    format: "cjs",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    external: PLATFORM_SEED,
    plugins: [guiAlias, jsToTs, hertaCss],
    banner: { js: BANNER },
    footer: { js: FOOTER },
    legalComments: "none",
    logLevel: "warning",
    metafile: true,
  });

  const bytes = Object.values(result.metafile.outputs).reduce(
    (n, o) => n + o.bytes,
    0
  );
  console.log(`lib/index.js   已生成（host 半侧）`);
  console.log(
    `lib/client.js  已生成（client 半侧，${(bytes / 1024).toFixed(1)} KB）`
  );

  // 自检：确认外部依赖真的没被打进来。
  for (const seeded of ["react", "react/jsx-runtime"]) {
    if (
      !result.metafile.inputs[`${seeded}`] &&
      !Object.keys(result.metafile.inputs).some((k) =>
        k.includes(`node_modules/${seeded}/`)
      )
    ) {
      continue;
    }
    throw new Error(`${seeded} 被打进了 bundle —— 它必须保持 external`);
  }
}

await main();
