/**
 * Fish 密钥来源的单测 —— 纯逻辑，不需要网络、不需要 DSH 运行时。
 *
 * 覆盖 2026-09-30 新增「Fish 密钥」填写框时的契约：
 *
 *   1. **清洗规则**：取第一行非空内容（凭据值与文件内容同一套规则，CRLF 也算）
 *   2. **优先级**：DSH 凭据 > `C:/herta-ai/fish_key.txt`
 *      —— 明文文件只是「没填凭据时的兜底」，不是第二份真相
 *   3. **两处 ref 字面量必须一致**：客户端 `CREDENTIALS` 里那一行的 `ref`
 *      = 宿主 `minimax-voice.js` 读的那个 ref
 *      （漂移的症状是「设置页填了、宿主读不到」，而且完全静默：选 fish 就是不发声）
 *   4. **密钥仍然不进 Config**：字段表里不许出现 fishKey 之类的字段
 *
 * 第 3、4 条读源码文本 —— 它们防的是「下一次有人只改了一半」，不是某个函数的行为。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS } from "../src/host/settings-schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name}`);
  }
}

/**
 * `fish-tts.js` 在 **import 时**读 `HERTA_FISH_CONFIG` 定下配置路径，
 * 所以必须先把环境变量指向临时配置，再动态 import。
 */
const dir = mkdtempSync(join(tmpdir(), "herta-fish-key-"));
const keyFile = join(dir, "fish_key.txt");
const cfgFile = join(dir, "fish_config.json");
writeFileSync(cfgFile, JSON.stringify({ keyFile }));
process.env.HERTA_FISH_CONFIG = cfgFile;

const { fishStatus, keySource, normalizeKey, readKey } = await import("../src/host/fish-tts.js");

console.log("fish-key");

const cfg = { keyFile };

// ── 1. 清洗规则 ───────────────────────────────────────────────────────────
check("null → null", normalizeKey(null) === null);
check("undefined → null", normalizeKey(undefined) === null);
check("非字符串 → null", normalizeKey(42) === null && normalizeKey({}) === null);
check("空串 → null", normalizeKey("") === null);
check("只有空白 → null", normalizeKey("  \t\r\n  ") === null);
check("取第一行非空内容", normalizeKey("sk-one\nsk-two") === "sk-one");
check("跳过前面的空行与注释空行", normalizeKey("\n\n   \nsk-real\n") === "sk-real");
check("前后空白被 trim", normalizeKey("  sk-trim  ") === "sk-trim");
check("CRLF 也能取到", normalizeKey("sk-crlf\r\nsk-other") === "sk-crlf");

// ── 2. 谁赢 ───────────────────────────────────────────────────────────────
// 2a. 两处都没有
check("没文件、没凭据 → 取不到密钥", readKey(cfg) === null);
check("没文件、没凭据 → keySource=null", keySource(cfg) === null);
check("没文件、没凭据 → fishStatus.keyPresent=false", fishStatus().keyPresent === false);

// 2b. 只有明文文件（旧配置）
writeFileSync(keyFile, "sk-from-file\n");
check("只有文件 → 读到文件里的那把", readKey(cfg) === "sk-from-file");
check("只有文件 → keySource=file", keySource(cfg) === "file");
check("只有文件 → fishStatus 如实报有密钥", fishStatus().keyPresent === true);
check("只有文件 → fishStatus 报来源 file", fishStatus().keySource === "file");

// 2c. 两处都有 —— 凭据必须赢（否则设置页那一框就是个摆设）
check("两处都有 → 凭据赢", readKey(cfg, "sk-from-credential") === "sk-from-credential");
check("两处都有 → keySource=credential", keySource(cfg, "sk-from-credential") === "credential");
check("两处都有 → fishStatus 报来源 credential", fishStatus("sk-from-credential").keySource === "credential");

// 2d. 凭据是空的/空白的 —— 退回文件，而不是「有凭据所以密钥为空」
check("凭据为空串 → 回落文件", readKey(cfg, "") === "sk-from-file");
check("凭据只有空白 → 回落文件", readKey(cfg, "   \n  ") === "sk-from-file");
check("凭据为空时 keySource=file", keySource(cfg, "") === "file");
check("凭据值也走同一套清洗（前后空白/换行）", readKey(cfg, "  sk-trimmed  \n") === "sk-trimmed");

// 2e. 文件存在但是空的 —— 仍然算没有（空文件不等于配好了）
writeFileSync(keyFile, "\n   \n");
check("空文件 → 取不到密钥", readKey(cfg) === null);
check("空文件 + 无凭据 → keySource=null", keySource(cfg) === null);
check("空文件 + 有凭据 → 凭据仍然有效", readKey(cfg, "sk-only-cred") === "sk-only-cred");

rmSync(dir, { recursive: true, force: true });
check("临时目录已清理", !existsSync(dir));

// ── 3. 两半的 ref 必须是同一个名字 ────────────────────────────────────────
const clientText = readFileSync(join(root, "src", "client", "index.tsx"), "utf8");
const hostText = readFileSync(join(root, "src", "host", "minimax-voice.js"), "utf8");
const clientRef = /ref:\s*"(FISH_API_KEY)"/.exec(clientText)?.[1];
const hostRef = /FISH_KEY_REF\s*=\s*"(FISH_API_KEY)"/.exec(hostText)?.[1];
check("客户端设置页声明了 Fish 密钥这一行", clientRef === "FISH_API_KEY");
check("宿主声明了同一个 ref", hostRef === "FISH_API_KEY");
check("两半的字面量一致", clientRef !== undefined && clientRef === hostRef);
check("客户端把密钥交给凭据缝（saveCredential/clearCredential 走 spec.ref）", clientText.includes("saveCredential(props.spec.ref") && clientText.includes("clearCredential(props.spec.ref"));
// 候选 #1 之后，"现读现传"这件事**拆到了两处**：宿主提供 `readKey`（现读），
// fish 档用它拼出 `fishKey`（现传）。断言照样钉行为，只是不再假设它在同一个文件里
// —— 这正是 Q23 说的"让正则测试穿过 interface，而不是抓源码文本"。
const registryText = readFileSync(join(root, "src", "host", "synth-registry.js"), "utf8");
check(
  "合成前现读凭据、不缓存明文（宿主现读 + fish 档现传）",
  (hostText.includes("readFishKey") || registryText.includes("readFishKey")) &&
    registryText.includes("fishKey:"),
);

// ── 4. 密钥不许进 Config ─────────────────────────────────────────────────
check("字段表里没有 fishKey（密钥不落明文 cordis.patch.yml）", !("fishKey" in FIELDS));
check("字段表里没有任何 key 字段", !Object.keys(FIELDS).some((name) => /key/i.test(name)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
