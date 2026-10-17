/**
 * 通用的目录静态路由 —— 语音资产（80 条 opus + 生成的 index.json）用。
 *
 * 安全模型：**只发白名单里的文件**。启动时扫一遍目录建索引，请求路径必须命中，
 * 否则一律 404。这样根本不存在路径穿越的可能，不需要再写 `../` 过滤与规范化 ——
 * 少一类最容易写错的安全代码。
 *
 * 抽出来的理由：语音资产与代码生成的端点（`index.json`）共用同一套白名单规则，
 * 只有 MIME 与是否需要入口文件不同。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** 常见扩展名 → Content-Type。缺省一律 application/octet-stream。 */
const TYPES = {
  ".opus": "audio/ogg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
};

/**
 * 递归扫出目录下的全部文件（相对路径，正斜杠分隔）。
 * @param dir - 目录绝对路径。
 * @returns 相对路径数组；目录不存在时为空数组。
 */
export function scanFiles(dir) {
  const out = [];
  const walk = (current, prefix) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(join(current, entry.name), prefix === "" ? entry.name : `${prefix}/${entry.name}`);
      } else {
        out.push(prefix === "" ? entry.name : `${prefix}/${entry.name}`);
      }
    }
  };
  walk(dir, "");
  return out.sort();
}

/**
 * 注册一个目录静态路由。
 *
 * @param ctx - 宿主 cordis 上下文（需要 `webServer` 服务）。
 * @param options - `{ prefix, dir, indexFile?, noCache?, synthetic? }`。
 *   `synthetic` 是「不是磁盘文件、由代码生成」的端点（例如语音的 index.json），
 *   键是相对路径、值是返回响应体的函数。
 * @returns 路由 disposer；没有 webServer 时返回 undefined。
 */
export function registerDirRoute(ctx, options) {
  const { prefix, dir, indexFile = "index.html", noCache = false, synthetic = {} } = options;
  const files = new Set(scanFiles(dir));

  const webServer = ctx.get("webServer");
  if (webServer === undefined) return undefined;

  return webServer.register({
    kind: "prefix",
    path: prefix,
    handler: (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      let rel = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, "");
      if (rel === "" || rel.endsWith("/")) rel += indexFile;

      // 代码生成的端点优先（它们不在磁盘上，白名单里也没有）。
      const make = synthetic[rel];
      if (make !== undefined) {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(make());
        return;
      }

      // 白名单：不在索引里的一律 404。
      if (!files.has(rel)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }

      const full = join(dir, rel);
      const info = statSync(full);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(rel).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(info.size),
        // 入口 html 不缓存（改了要立刻生效），其余资源长缓存。
        "Cache-Control": noCache && rel === indexFile ? "no-cache" : "public, max-age=86400",
      });
      res.end(readFileSync(full));
    },
  });
}
