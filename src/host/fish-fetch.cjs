/**
 * Fish Audio 取音频的**子进程**（独立文件）。
 *
 * ## 为什么是 `.cjs` 而不是 `.mjs`
 *
 * `scripts/build.mjs` 把 `src/host/` 拷进 `lib/` 时**只认 `.js` 和 `.cjs`**：
 *
 * ```js
 * if (name.endsWith(".js") || name.endsWith(".cjs")) copyFileSync(...)
 * ```
 *
 * 早先这份写成 `.mjs`，本机因为手工复制过所以能用，但**作者一构建就会缺文件** ——
 * 表现为代理那条路失效、云端取不到音频。改成 `.cjs` 就落进了既有构建规则，
 * 不必为了一个文件去改 `build.mjs`。

 *
 * ## 为什么必须是子进程
 *
 * Node 的 `fetch`（undici）**不读系统代理**，也不认 `HTTP_PROXY` 环境变量，
 * 除非进程启动时带了 `--use-env-proxy`。而 DSH 是用户启动的，我们改不了它的
 * 启动参数。所以：在子进程里用 `node --use-env-proxy` 跑，代理就生效了。
 *
 * 用法：node --use-env-proxy fish-fetch.mjs <config.json>
 *   config = { text, ref, model, speed, out, timeoutMs }
 * 输出：stdout 一行 JSON —— { ok:true, bytes } 或 { ok:false, error }
 */
const { readFileSync, writeFileSync } = require("node:fs");

const API_URL = "https://api.fish.audio/v1/tts";
const DEFAULT_REF = "f9ede0382ffc4671ac86b44d49f19cdd";

function reply(v) {
  process.stdout.write(`${JSON.stringify(v)}\n`);
}

/** 配置来源：`-` 读 stdin、`{...}` 直接解析、其余当文件路径。 */
function readConfig(arg) {
  if (arg === "-" || arg === undefined) {
    return JSON.parse(readFileSync(0, "utf8"));
  }
  if (arg.startsWith("{")) return JSON.parse(arg);
  return JSON.parse(readFileSync(arg, "utf8"));
}

async function main() {
  const cfg = readConfig(process.argv[2]);

  const body = {
    text: cfg.text,
    reference_id: cfg.ref ?? DEFAULT_REF,
    format: "wav",
    sample_rate: 44100,
    latency: "normal",
    prosody: { speed: cfg.speed ?? 1.0, normalize_loudness: true },
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), cfg.timeoutMs ?? 30000);
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        model: cfg.model ?? "s2.1-pro-free",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (err) {
    reply({ ok: false, error: `fetch: ${err?.message ?? err}` });
    return;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* 忽略 */
    }
    reply({ ok: false, error: `HTTP ${res.status} ${detail}` });
    return;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    reply({ ok: false, error: `body too small: ${buf.length}` });
    return;
  }
  writeFileSync(cfg.out, buf);
  reply({ ok: true, bytes: buf.length, out: cfg.out });
}

main().catch((e) => reply({ ok: false, error: String(e?.message ?? e) }));
