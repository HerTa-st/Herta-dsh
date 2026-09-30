/**
 * Fish Audio 语音合成 —— `dsh-herta` 的可选外挂。
 *
 * ## 这个文件是「附加件」，不是插件的一部分
 *
 * 它**不被 `src/host` 里任何现有文件引用**（除了 `tts-runtime.js` 里那一小段
 * 标记为 `[herta-fish]` 的可选钩子）。作者的更新不会碰它。
 * 想彻底移除：删掉本文件 + `comm-channel-effect.cjs`，再跑一次
 * `reapply-fish-hook.mjs --remove`。
 *
 * ## 契约（照抄 tts-runtime.synthesize 的）
 *
 * 返回 `{ ok:true, out:<wav路径>, sampleRate, samples, durationMs }`：
 *   · `out` 指向一个 **PCM16 单声道 WAV**
 *   · 调用方**会删掉该文件所在目录**，所以必须写在自建的临时目录里
 * 任何失败都返回 `null` —— 调用方会安静地回落到本地模型，
 * 绝不能让语音层因为云端问题而出错。
 *
 * ## 已知坑：Fish 的 WAV 头是坏的
 *
 * Fish Audio 流式返回，`data` 块大小写的是占位符 `4294967040`（0xFFFFFF00）。
 * 播放器信这个头会算出「48695 秒」而完全放不出声。这里写完就修。
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require_ = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
/** 代理取音频用的子进程脚本（与本文件同目录）。 */
// `.cjs` 而不是 `.mjs` —— `scripts/build.mjs` 只把 `.js`/`.cjs` 拷进 `lib/`，
// 写成 `.mjs` 的话作者一构建就会缺这个文件（本机是靠手工复制才没露馅）。
const FETCH_SCRIPT = join(HERE, "fish-fetch.cjs");

/** 配置文件位置：可用环境变量覆盖，便于把 herta-ai 挪到别处。 */
const CONFIG_PATH = process.env.HERTA_FISH_CONFIG ?? "C:/herta-ai/fish_config.json";
const DEFAULT_KEY_PATH = "C:/herta-ai/fish_key.txt";
const API_URL = "https://api.fish.audio/v1/tts";
const DEFAULT_REF = "f9ede0382ffc4671ac86b44d49f19cdd"; // 大黑塔

const DEFAULTS = {
  enabled: true,
  ref: DEFAULT_REF,
  speed: 1.0,
  effect: true,
  preset: "terminal_textured",
  keyFile: DEFAULT_KEY_PATH,
  timeoutMs: 30000,
  /** 直连超时（短一点，失败就尽快转代理）。 */
  directTimeoutMs: 6000,
  /** 代理地址；设为 null 可显式禁用代理。 */
  proxy: "http://127.0.0.1:7897",
};

function log(line) {
  try {
    console.log(`[dsh-herta] fish: ${line}`);
  } catch {
    /* 日志失败不该影响发声 */
  }
}

function loadConfig() {
  const cfg = { ...DEFAULTS };
  try {
    if (existsSync(CONFIG_PATH)) {
      Object.assign(cfg, JSON.parse(readFileSync(CONFIG_PATH, "utf8")));
    }
  } catch (err) {
    log(`配置读取失败，用默认值：${err?.message ?? err}`);
  }
  return cfg;
}

function readKey(cfg) {
  try {
    const p = cfg.keyFile ?? DEFAULT_KEY_PATH;
    if (!existsSync(p)) return null;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (t !== "") return t;
    }
  } catch {
    /* 读不到就当没配 */
  }
  return null;
}

/** 改写 WAV 头里的 `data` 大小与 RIFF 大小。返回样本数。 */
function fixWavHeader(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return 0;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const sz = buf.readUInt32LE(off + 4);
    if (id === "data") {
      const avail = buf.length - off - 8;
      if (sz !== avail) {
        buf.writeUInt32LE(avail, off + 4);
        buf.writeUInt32LE(off + 8 + avail - 8, 4);
      }
      const fmtOff = buf.indexOf("fmt ", 12, "ascii");
      const channels = fmtOff >= 0 ? buf.readUInt16LE(fmtOff + 10) : 1;
      const bits = fmtOff >= 0 ? buf.readUInt16LE(fmtOff + 22) : 16;
      return Math.floor(avail / (channels * (bits / 8)));
    }
    off += 8 + sz + (sz & 1);
  }
  return 0;
}

function sampleRateOf(buf) {
  const fmtOff = buf.indexOf("fmt ", 12, "ascii");
  return fmtOff >= 0 ? buf.readUInt32LE(fmtOff + 12) : 0;
}

/** 直连调 Fish API（不走代理）。 */
async function callFishDirect(text, cfg, key) {
  const body = {
    text,
    reference_id: cfg.ref ?? DEFAULT_REF,
    format: "wav",
    sample_rate: 44100,
    latency: "normal",
    prosody: { speed: cfg.speed ?? 1.0, normalize_loudness: true },
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), cfg.directTimeoutMs ?? 6000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        model: cfg.model ?? "s2.1-pro-free",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length >= 1000 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 经代理调 Fish API —— **走子进程**。
 *
 * Node 的 fetch 不读系统代理、也不认 HTTP_PROXY，除非进程带 `--use-env-proxy`。
 * DSH 的启动参数改不了，所以在子进程里加那个标志。
 */
function callFishViaProxy(text, cfg, key) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        process.execPath,
        ["--use-env-proxy", FETCH_SCRIPT, "-"],
        {
          env: {
            ...process.env,
            HTTP_PROXY: cfg.proxy ?? "http://127.0.0.1:7897",
            HTTPS_PROXY: cfg.proxy ?? "http://127.0.0.1:7897",
          },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (err) {
      log(`子进程启动失败：${err?.message ?? err}`);
      return resolve(null);
    }

    const payload = JSON.stringify({
      text,
      ref: cfg.ref,
      model: cfg.model,
      speed: cfg.speed,
      key,
      out: cfg.__tmpOut,
      timeoutMs: cfg.timeoutMs ?? 30000,
    });

    let out = "";
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* 忽略 */
      }
      resolve(null);
    }, (cfg.timeoutMs ?? 30000) + 5000);

    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.on("error", (err) => {
      log(`子进程出错：${err?.message ?? err}`);
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      const line = out.trim().split(/\r?\n/).filter(Boolean).pop();
      if (!line) return resolve(null);
      try {
        const j = JSON.parse(line);
        if (j.ok !== true) {
          log(`代理取音频失败：${j.error ?? "未知"}`);
          return resolve(null);
        }
        resolve(readFileSync(cfg.__tmpOut));
      } catch (err) {
        log(`子进程输出解析失败：${err?.message ?? err}`);
        resolve(null);
      }
    });
    child.stdin.end(payload, "utf8");
  });
}

/**
 * 直连是否可用 —— 记住第一次的结果。
 *
 * 直连失败的代价是**等满超时**（默认 6 秒），每句话都白等一次不可接受。
 * 所以一旦失败就长期走代理；进程重启后才会再试一次直连
 *（哪天网络环境变了、不再需要代理，重启即恢复）。
 */
let directUsable = true;

/** 取音频：先直连，失败再走代理子进程。 */
async function callFish(text, cfg, key, tmpOut) {
  cfg = { ...cfg, __tmpOut: tmpOut };
  if (directUsable) {
    const direct = await callFishDirect(text, cfg, key);
    if (direct !== null) return direct;
    directUsable = false;
    log("直连不可用，本进程内后续都走代理");
  }
  if (cfg.proxy === null) return null; // 显式禁用代理
  return await callFishViaProxy(text, cfg, key);
}

/** 叠加信道音效（原地覆盖）。失败不算致命。 */
function applyEffect(path, preset) {
  try {
    const { applyCommChannel } = require_("./comm-channel-effect.cjs");
    const buf = readFileSync(path);
    if (buf.toString("ascii", 0, 4) !== "RIFF") return false;
    let off = 12;
    let dataOff = -1;
    let dataLen = 0;
    let channels = 1;
    let sampleRate = 44100;
    while (off + 8 <= buf.length) {
      const id = buf.toString("ascii", off, off + 4);
      const sz = buf.readUInt32LE(off + 4);
      if (id === "fmt ") {
        channels = buf.readUInt16LE(off + 10);
        sampleRate = buf.readUInt32LE(off + 12);
      } else if (id === "data") {
        dataOff = off + 8;
        dataLen = sz;
        break;
      }
      off += 8 + sz + (sz & 1);
    }
    if (dataOff < 0 || channels !== 1) return false;
    const n = Math.floor(dataLen / 2);
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i += 1) samples[i] = buf.readInt16LE(dataOff + i * 2) / 32768;
    const wet = applyCommChannel(samples, sampleRate, { preset });
    for (let i = 0; i < n; i += 1) {
      const v = Math.max(-1, Math.min(1, wet[i]));
      buf.writeInt16LE(Math.round(v * 32767), dataOff + i * 2);
    }
    writeFileSync(path, buf);
    return true;
  } catch (err) {
    log(`音效失败（不影响发声）：${err?.message ?? err}`);
    return false;
  }
}

/**
 * 把调用方（插件设置页）传来的值盖到配置上。
 *
 * **只认 `undefined` 以外的值** —— 设置页没设过的字段会传 `undefined` 进来，
 * 那时保留 JSON 里的值。优先级：
 *
 *   设置页的值 > `fish_config.json` > 本文件里的 DEFAULTS
 *
 * 键名要映射：设置页用带前缀的 `fishRef` / `fishSpeed` / `fishEffect` / `fishPreset`
 * （避免和 `voiceEngine` 那批挤在一起），本模块内部叫 `ref` / `speed` / `effect` / `preset`。
 */
const OVERRIDE_KEYS = Object.freeze({
  ref: "fishRef",
  speed: "fishSpeed",
  effect: "fishEffect",
  preset: "fishPreset",
});

function applyOverrides(cfg, overrides) {
  if (overrides === null || typeof overrides !== "object") return cfg;
  const out = { ...cfg };
  for (const [inner, outer] of Object.entries(OVERRIDE_KEYS)) {
    const v = overrides[outer];
    if (v !== undefined) out[inner] = v;
  }
  return out;
}

/**
 * 尝试用 Fish Audio 合成。
 *
 * @param {string} text - 要合成的话。
 * @param {Record<string, unknown>} [overrides] - 设置页传来的 `fish*` 字段。
 * @returns `null` —— 未启用/失败，调用方应给出理由；
 *          否则返回与 `tts-runtime.synthesize()` 同形的结果对象。
 */
export async function trySynthesize(text, overrides) {
  const cfg = applyOverrides(loadConfig(), overrides);
  if (cfg.enabled !== true) return null;
  if (typeof text !== "string" || text.trim() === "") return null;

  const key = readKey(cfg);
  if (key === null) {
    log("没找到密钥，回落本地");
    return null;
  }

  // 先建临时目录 —— 调用方读完会把这个目录整个删掉。
  // 代理子进程也要写到这里，所以必须在取音频之前创建。
  const dir = mkdtempSync(join(tmpdir(), "herta-fish-"));
  const out = join(dir, "speech.wav");

  let buf;
  try {
    buf = await callFish(text, cfg, key, out);
  } catch (err) {
    log(`请求失败：${err?.message ?? err}`);
    return null;
  }
  if (buf === null || buf === undefined) return null;

  const samples = fixWavHeader(buf);
  if (samples <= 0) {
    log("WAV 解析失败");
    return null;
  }

  writeFileSync(out, buf);

  const applied = cfg.effect === true ? applyEffect(out, cfg.preset ?? "terminal_textured") : false;

  return {
    ok: true,
    out,
    sampleRate: sampleRateOf(buf),
    samples,
    durationMs: (samples / (sampleRateOf(buf) || 44100)) * 1000,
    effect: applied,
    engine: "fish",
  };
}

/** 供设置页/诊断用：当前是否已启用且有密钥。 */
export function fishStatus() {
  const cfg = loadConfig();
  return {
    enabled: cfg.enabled === true,
    keyPresent: readKey(cfg) !== null,
    ref: cfg.ref ?? DEFAULT_REF,
    effect: cfg.effect === true,
    preset: cfg.preset ?? "terminal_textured",
    configPath: CONFIG_PATH,
    keyFile: cfg.keyFile ?? DEFAULT_KEY_PATH,
  };
}

/** 从 WAV Buffer 里抽出单声道 Int16 样本。 */
function toPcm16(buf) {
  let off = 12;
  let dataOff = -1;
  let dataLen = 0;
  let channels = 1;
  let sampleRate = 44100;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const sz = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(off + 10);
      sampleRate = buf.readUInt32LE(off + 12);
    } else if (id === "data") {
      dataOff = off + 8;
      dataLen = sz;
      break;
    }
    off += 8 + sz + (sz & 1);
  }
  if (dataOff < 0 || channels !== 1) return null;
  const n = Math.floor(dataLen / 2);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i += 1) samples[i] = buf.readInt16LE(dataOff + i * 2);
  return { samples, sampleRate };
}

/**
 * 给 `voiceEngine: "fish"` 用的入口 —— 直接返回**说话管线要的形状**。
 *
 * `minimax-voice.js` 的 `synthUnit` 期待 `{ samples:Int16Array, sampleRate, durationMs }`
 * （本地那条路也是这样，见 `createLocalQueue`）。这里就地解码成 Int16 并清掉临时目录，
 * 省得宿主再读一次文件 —— 而且宿主读完本来就会删那个目录。
 *
 * @param {Record<string, unknown>} [overrides] - 设置页传来的 `fish*` 字段。
 * @returns `null` 表示不可用（调用方应给出 `engineNote`，且不发声）
 */
export async function trySynthesizePcm(text, overrides) {
  const r = await trySynthesize(text, overrides);
  if (r === null) return null;
  try {
    const out = toPcm16(readFileSync(r.out));
    if (out === null) return null;
    try {
      rmSync(dirname(r.out), { recursive: true, force: true });
    } catch {
      /* 清理失败不该影响发声 */
    }
    return {
      samples: out.samples,
      sampleRate: out.sampleRate,
      durationMs: r.durationMs,
      effect: r.effect,
    };
  } catch (err) {
    log(`PCM 解码失败：${err?.message ?? err}`);
    return null;
  }
}
