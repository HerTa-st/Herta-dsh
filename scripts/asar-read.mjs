/**
 * 从 DSH 的 `app.asar` 里读文件。
 *
 * 为什么要自己写：DSH 的 `@deepseek-ai/*` 包都在 asar 里，
 * 只有 Electron 打过补丁的 fs 读得进去，裸 Node 看不见。
 * 而这台机器上 `app.asar.unpacked` 只解出了 4 个原生包。
 *
 * ## asar 格式（**实测校准**，与常见文档略有出入）
 *
 * ```
 * 偏移 0 : u32 = 4
 * 偏移 4 : u32 = headerSize
 * 偏移 8 : u32 = jsonSize
 * 偏移 12: u32 = **真实 JSON 长度**   ← 关键
 * 偏移 16: JSON（上面那个长度）
 * 之后    : 各文件内容顺序排列，用头里的 `offset` 定位
 * ```
 *
 * ⚠ **两个必须校准的坑**（都实测踩过）：
 *
 *  1. 真实 JSON 长度在**偏移 12**，不是 8。用 8 读出来的值大 4，
 *     于是数据区起点偏 4 字节 —— 表现为读到的内容少了开头 4 个字符
 *     （`"name": "@deep"` 变成 `e": "@deep`）。
 *     等价的正确写法还有 `dataStart = 8 + headerSize`。
 *  2. `JSON.parse` 会因尾部多余字节报「Unexpected non-whitespace character
 *     after JSON」，所以要截到最后一个 `}`。
 *
 * ⚠ 第三个坑不在本文件：**别把大量输出走 PowerShell 管道** —— 实测会「卡死」
 * （是管道捕获阻塞，不是真的慢）。写文件再读就没问题。
 */
import { closeSync, openSync, readFileSync, readSync } from "node:fs";

const DEFAULT_ASAR = "C:/Users/AORUS/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";

export function openAsar(path = DEFAULT_ASAR) {
  const fd = openSync(path, "r");
  const head = Buffer.alloc(16);
  readSync(fd, head, 0, 16, 0);
  // ⚠ 真实 JSON 长度在**偏移 12**（用偏移 8 会多 4 字节，数据区起点就偏 4）
  const jsonLen = head.readUInt32LE(12);
  const raw = Buffer.alloc(jsonLen);
  readSync(fd, raw, 0, jsonLen, 16);
  const txt = raw.toString("utf8");
  // 尾部可能还有填充，截到最后一个 }
  const body = txt.slice(0, txt.lastIndexOf("}") + 1);
  const header = JSON.parse(body);
  const dataStart = 16 + body.length;
  return { fd, header, dataStart, path, jsonLen, bodyLen: body.length };
}

/** 按 asar 内路径（如 `/dsh/node_modules/x/index.js`）定位条目。 */
export function findEntry(header, asarPath) {
  const parts = asarPath.split("/").filter(Boolean);
  let node = header;
  for (const p of parts) {
    const next = node.files?.[p];
    if (next === undefined) return null;
    node = next;
  }
  return node;
}

export function readEntry(asar, asarPath) {
  const ent = findEntry(asar.header, asarPath);
  if (ent === null || ent.files) return null;
  const buf = Buffer.alloc(ent.size);
  readSync(asar.fd, buf, 0, ent.size, asar.dataStart + Number(ent.offset ?? 0));
  return buf;
}

/** 列出某个 asar 目录下的条目名。 */
export function listDir(header, asarPath) {
  const ent = asarPath === "/" ? header : findEntry(header, asarPath);
  return ent?.files ? Object.keys(ent.files) : [];
}

export function closeAsar(asar) {
  closeSync(asar.fd);
}

/** 便捷：一次性读出整个文件当字符串。 */
export function readText(asarPath, asarPath2 = DEFAULT_ASAR) {
  const asar = openAsar(asarPath2);
  try {
    const b = readEntry(asar, asarPath);
    return b === null ? null : b.toString("utf8");
  } finally {
    closeAsar(asar);
  }
}

/** 便捷：给定 url，读出真实内容（用于 module.register 的 load 钩子）。 */
export function readByUrl(url) {
  const m = url.match(/^asar:\/\/\/(.*)$/);
  if (!m) return null;
  const asar = openAsar();
  try {
    return readEntry(asar, "/" + decodeURIComponent(m[1]));
  } finally {
    closeAsar(asar);
  }
}

export { readFileSync };
