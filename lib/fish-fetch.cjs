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

/**
 * 与 `fish-tts.js` 同源：主域名 `fishaudio.org`（国内可直连），旧域名兜底
 * （`api.fish.audio` 在国内被按 SNI 重置）。这里是**配了代理才走**的那条路，
 * 两个域名依次试，取第一个成功的。
 */
const API_URLS = ["https://fishaudio.org/v1/tts", "https://api.fish.audio/v1/tts"];
/** 大黑塔（新域名下的 id；旧域名那个 `f9ede038…` 在 fishaudio.org 上不存在）。 */
const DEFAULT_REF = "36e4d5f5-7654-43d4-b160-a1f15398116f";

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

  let res = null;
  let lastError = "没有可用的接口地址";
  // 两条地址共享同一个预算：父进程按 `timeoutMs + 5000` 硬杀，各给一次会把子进程拖死。
  const deadline = Date.now() + (cfg.timeoutMs ?? 30000);
  for (const url of API_URLS) {
    const remain = deadline - Date.now();
    if (remain <= 0) {
      lastError = "取音频的时间预算用尽";
      break;
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), remain);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": "application/json",
          model: cfg.model ?? "s2.1-pro-free",
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!r.ok) {
        let detail = "";
        try {
          detail = (await r.text()).slice(0, 200);
        } catch {
          /* 忽略 */
        }
        lastError = `HTTP ${r.status} ${detail}`;
        continue;
      }
      res = r;
      break;
    } catch (err) {
      lastError = `fetch: ${err?.message ?? err}`;
    } finally {
      clearTimeout(timer);
    }
  }

  if (res === null) {
    reply({ ok: false, error: lastError });
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
