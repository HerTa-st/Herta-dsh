/**
 * 构建「Herta 整机」页面（甲方案）。
 *
 * 与 client 半侧（乙）的区别，决定了这里的配置完全不同：
 *
 * | | 乙（conversation.view 里的组件） | 甲（iframe 整页） |
 * |---|---|---|
 * | 载体 | 宿主页面里的一个 shadow root | **独立文档** |
 * | React | 必须 external（共享宿主的） | **必须打包进去**（iframe 不共享模块表） |
 * | CSS | 必须转换成 `:host`、删整页 chrome | **原样使用** —— `:root`/`body` 在整页里正好是对的 |
 * | device-scene | 打桩 | 打桩（three.js 1.1MB + Basis 585KB） |
 *
 * 所以这里不套用 build.mjs 的外部依赖白名单，反而是「什么都不 external」。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = join(root, "lib", "herta-ui");
const URL_ASSETS_DIR = join(outDir, "assets");

const HERTA_SRC =
  process.env.HERTA_SRC ?? "E:\\deepseek工作区\\HerTa\\Herta-src";
const HERTA_RENDERER = join(HERTA_SRC, "packages", "gui", "src", "renderer");
/** 官网那套 shim 可以直接借用 —— 它们就是为「脱离 Electron 跑渲染层」写的。 */
const WEBSITE_SRC = join(HERTA_SRC, "website", "src");

function findEsbuild() {
  // 固定 0.25.12（ADR-0003：可复现构建），与 build.mjs 同一个版本 ——
  // 两条构建链换 esbuild 版本会让产物字节漂移，被 pre-commit 的 diff 守卫拦下。
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
    `找不到 esbuild 0.25.12（可复现构建的固定版本）：\n  ${entry}`
  );
}

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
  name: "herta-ui:gui-alias",
  setup(build) {
    build.onResolve({ filter: /^@gui(\/|$)/ }, (args) => {
      const rest = args.path.replace(/^@gui\/?/, "");
      const found = firstExistingFile(join(HERTA_RENDERER, rest));
      if (found === null)
        return { errors: [{ text: `@gui 解析失败：${args.path}` }] };
      return { path: found };
    });
  },
};

/** `./y.js` → 磁盘上的 `y.ts` / `y.tsx`。 */
const jsToTs = {
  name: "herta-ui:js-to-ts",
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.path.startsWith(".") && !args.path.startsWith("/")) return null;
      if (args.importer === "") return null;
      const base = resolve(dirname(args.importer), args.path.slice(0, -3));
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(base + ext) && statSync(base + ext).isFile())
          return { path: base + ext };
      }
      return null;
    });
  },
};

/**
 * 官网为「浏览器里跑渲染层」准备的两个 shim，直接借用：
 *   · `shared/attachment-image.js` —— 渲染层用它按 Electron 协议拼图片 URL
 *   · `device-scene/DeviceScene.js` —— 打桩，省掉 three.js 1.1MB + Basis 585KB
 * 另外把 `@herta/app-server` 的类型导入（纯类型，会被擦除）指向官网的同名类型来源，
 * 避免为了几个 type 去打包整个 app-server。
 */
const websiteShims = {
  name: "herta-ui:website-shims",
  setup(build) {
    build.onResolve({ filter: /\/shared\/attachment-image\.js$/ }, () => ({
      path: join(WEBSITE_SRC, "demo-attachment-image.ts"),
    }));
    build.onResolve({ filter: /\/device-scene\/DeviceScene\.js$/ }, () => ({
      path: join(WEBSITE_SRC, "demo-device-scene.tsx"),
    }));
  },
};

const HERE = here;
const ENTRY = join(root, "src", "herta-ui", "main.tsx");

/**
 * Vite 的 `?url` 后缀：语义是「给我这个资源的 URL」，而不是把它打进 bundle。
 * esbuild 会当成普通模块去解析，于是报「没有 default 导出」。
 *
 * 通用处理：把目标文件复制到页面资源目录 `lib/herta-ui/assets/`，导出一个相对
 * 路径字符串。这样 pdf.js 的 worker（1.2 MB）之类的资源都能正常工作，
 * 而且一份都不用进 bundle。相对路径是刻意的 —— 页面本身就在 /herta-ui/ 下。
 */
const urlAssets = {
  name: "herta-ui:url-assets",
  setup(build) {
    build.onResolve({ filter: /\?url$/ }, async (args) => {
      const clean = args.path.replace(/\?url$/, "");
      const resolved = await build.resolve(clean, {
        resolveDir: args.resolveDir,
        importer: args.importer,
        kind: args.kind,
      });
      if (resolved.errors.length > 0) return { errors: resolved.errors };
      return { path: resolved.path, namespace: "herta-url" };
    });
    build.onLoad({ filter: /.*/, namespace: "herta-url" }, (args) => {
      const name = basename(args.path);
      mkdirSync(URL_ASSETS_DIR, { recursive: true });
      copyFileSync(args.path, join(URL_ASSETS_DIR, name));
      urlAssetNames.add(name);
      return {
        contents: `export default ${JSON.stringify(`assets/${name}`)};`,
        loader: "js",
      };
    });
  },
};

/** 上面复制出来的资源文件名，构建结束时报告一下。 */
const urlAssetNames = new Set();

/**
 * 两处 Vite 专有特性的替代（esbuild 不认 `import.meta.glob` 与 `?url`）：
 *
 * 1. `ReferenceView.tsx` —— 设计参考稿查看器（`#reference` 旁路视图），
 *    靠 `./reference/UX_v5.html?url` 加载。整机视图不需要它，打桩成空组件。
 *
 * 2. `pick-opening-segment.ts` —— 用 `import.meta.glob` 惰性加载 4 份开场
 *    ASCII 段（每份 770–820 KB）。**不打桩降级**：改成从静态路由按需 fetch，
 *    这样开场动画保住，同时 3.2 MB 不进 bundle。
 */
const viteFeatureStubs = {
  name: "herta-ui:vite-feature-stubs",
  setup(build) {
    // 用 onLoad 而不是 onResolve：这两个文件的导入写法是 `./ReferenceView.js`
    // （NodeNext 风格），会先被 jsToTs 插件解析成 .tsx，onResolve 就轮不到了。
    // onLoad 拿到的是已解析的绝对路径，与插件顺序无关。
    build.onLoad({ filter: /[/\\]ReferenceView\.tsx$/ }, () => ({
      contents: `export function ReferenceView() { return null; }\nexport default ReferenceView;\n`,
      loader: "js",
    }));
    build.onLoad({ filter: /[/\\]pick-opening-segment\.ts$/ }, () => ({
      // 与上游同名的导出与签名，只是数据源换成按需 fetch。
      contents: `
const NAMES = ${JSON.stringify(OPENING_SEGMENTS)};
export function pickOpeningSegment(loaders = undefined, rng = Math.random) {
  const keys = loaders === undefined ? NAMES : Object.keys(loaders).sort();
  if (keys.length === 0) throw new Error("no opening segment assets found");
  const index = Math.min(keys.length - 1, Math.floor(rng() * keys.length));
  const name = keys[index];
  if (loaders !== undefined) return loaders[name];
  // 相对路径：页面本身就在 /herta-ui/ 下，所以不依赖路由前缀。
  return () => fetch("openings/" + encodeURIComponent(name)).then((r) => {
    if (!r.ok) throw new Error("opening segment fetch failed: " + r.status);
    return r.json();
  });
}
`,
      loader: "js",
    }));
  },
};

/** 可用的开场段文件名（构建期扫出来，供上面的 fetch 版使用）。 */
const OPENING_DIR = join(HERTA_RENDERER, "assets", "openings");
const OPENING_SEGMENTS = existsSync(OPENING_DIR)
  ? readdirSync(OPENING_DIR)
      .filter((n) => n.endsWith(".json"))
      .sort()
  : [];

const BANNER = undefined;

async function main() {
  if (!existsSync(HERTA_RENDERER))
    throw new Error(`找不到 Herta 渲染层：${HERTA_RENDERER}`);
  if (!existsSync(ENTRY)) throw new Error(`找不到入口：${ENTRY}`);

  const esbuild = await import(pathToFileURL(findEsbuild()).href);
  mkdirSync(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [ENTRY],
    outfile: join(outDir, "herta-ui.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    // React 只装在 Herta 的 gui 包下，本包没有 node_modules —— 用 nodePaths 补上。
    nodePaths: [
      join(HERTA_SRC, "packages", "gui", "node_modules"),
      join(HERTA_SRC, "node_modules"),
    ],
    // 渲染层里有 `import.meta.env.DEV`（App.tsx）。iife 格式下 import.meta 是空的，
    // 不替换就会变成 `undefined.DEV` 这种运行时错误，所以必须显式替换掉。
    define: {
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
      "import.meta.env.MODE": '"production"',
      "process.env.NODE_ENV": '"production"',
    },
    loader: {
      ".png": "dataurl",
      ".webp": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".gif": "dataurl",
      ".svg": "dataurl",
      ".woff": "dataurl",
      ".woff2": "dataurl",
      ".ttf": "dataurl",
      ".opus": "dataurl",
      ".wav": "dataurl",
      ".json": "json",
    },
    plugins: [urlAssets, guiAlias, jsToTs, websiteShims, viteFeatureStubs],
    legalComments: "none",
    logLevel: "warning",
    metafile: true,
  });

  // CSS 单独出一份：整页里用 <link> 比 JS 注入 275KB 干净得多。
  // 注意也要带 guiAlias —— 样式表入口里的 `@import "@gui/..."` 同样需要解析。
  await esbuild.build({
    entryPoints: [join(root, "src", "herta-ui", "herta-ui.css")],
    outfile: join(outDir, "herta-ui.css"),
    bundle: true,
    plugins: [guiAlias],
    loader: { ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    logLevel: "warning",
  });

  const js = statSync(join(outDir, "herta-ui.js")).size;
  const css = statSync(join(outDir, "herta-ui.css")).size;
  console.log(`lib/herta-ui/herta-ui.js   ${(js / 1024 / 1024).toFixed(2)} MB`);
  console.log(`lib/herta-ui/herta-ui.css  ${(css / 1024).toFixed(0)} KB`);

  // 开场段按需取：复制到与 index.html 同级的 openings/ 下，不进 bundle。
  const openingOut = join(outDir, "openings");
  mkdirSync(openingOut, { recursive: true });
  let copied = 0;
  for (const name of OPENING_SEGMENTS) {
    copyFileSync(join(OPENING_DIR, name), join(openingOut, name));
    copied += statSync(join(openingOut, name)).size;
  }
  console.log(
    `lib/herta-ui/openings/     ${OPENING_SEGMENTS.length} 份 / ${(copied / 1024 / 1024).toFixed(1)} MB（按需 fetch）`
  );

  // 页面本身。
  copyFileSync(
    join(root, "src", "herta-ui", "index.html"),
    join(outDir, "index.html")
  );
  console.log("lib/herta-ui/index.html");
}

await main();
