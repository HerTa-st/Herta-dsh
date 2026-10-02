/**
 * 静态路由：把 `lib/` 下的文件按白名单端出去（前缀 `/herta-theme`）。
 *
 * 安全模型照上游那套：**启动时扫一遍目录建索引，请求必须命中索引，否则 404** ——
 * 这样根本不存在路径穿越，不需要 `../` 过滤与规范化（少一类最容易写错的安全代码）。
 *
 * 模型来源：上游 `dsh-herta` 的 `lib/static-route.js`（`webServer.register({kind:'prefix'})`）。
 * 这里是重写的一份（我们的包要独立，不 import 别人的文件）。
 *
 * 调用方注意：**必须在 `ctx.inject(["webServer"], …)` 里调**（见 index.js 的注释）——
 * 早于 webserver 就绪时拿不到服务，直接 get 会静默什么都不注册。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
};

/** 递归列出目录下的文件（相对路径、正斜杠）。 */
function scan(dir, prefix = "") {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return out;
    throw error;
  }
  for (const e of entries) {
    const rel = prefix === "" ? e.name : `${prefix}/${e.name}`;
    if (e.isDirectory()) out.push(...scan(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * 注册 `/herta-theme/**` → 包内 `lib/**` 的只读静态路由。
 * @param ctx - 宿主 cordis 上下文。
 * @param prefix - 路由前缀。
 * @returns disposer；没有 webServer 时返回 undefined（不抛，插件照常挂载）。
 */
export function registerOpeningRoute(ctx, prefix) {
  const webServer = ctx.get("webServer");
  if (webServer === undefined) {
    // 走到这里说明调用方没有先 inject —— 出声，别静默（这正是本包上一次的失败方式）。
    console.warn("[dsh-theme-herta] 注册路由时 webServer 仍不可用（应当在 ctx.inject 里调用）");
    return undefined;
  }

  const files = new Set(scan(HERE));
  console.log(`[dsh-theme-herta] 静态路由 ${prefix} 已注册（${files.size} 个文件）`);

  return webServer.register({
    kind: "prefix",
    path: prefix,
    handler: (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const rel = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, "");
      if (!files.has(rel)) {
        // 装完之后才加进来的文件（比如新背景图）不在启动时那份索引里 —— 现场重扫一次再判。
        // 效果是「加文件不用重启」；白名单保证不变：能命中的必须真是 HERE 下的文件。
        for (const f of scan(HERE)) files.add(f);
        if (!files.has(rel)) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
      }
      const full = join(HERE, rel);
      const info = statSync(full);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(rel).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(info.size),
        // 入口不缓存（改了要立刻生效），其余由浏览器按不缓存处理也行 —— 早期求稳。
        "Cache-Control": "no-cache",
      });
      res.end(readFileSync(full));
    },
  });
}
