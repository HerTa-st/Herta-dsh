/**
 * 开发用：把本地语音模型装到 `$DSH_HOME/tts/<bundle id>`。
 *
 * 干的就是设置页「整机动作 ▸ 下载」那颗按钮干的事（同一个服务、同一套校验），
 * 只是能在命令行里跑 —— **回落要用的就是这份模型**：MiniMax 不可用时，
 * 说话管线会显式回落到它。没装模型时回落会明确报「模型还没装」。
 *
 * 用法：
 *   node --disable-warning=ExperimentalWarning scripts/download-voice-model.mjs
 *
 * 注意：本机对 GitHub 的 TLS 有中间拦截时，普通 Node 的 fetch 会 `fetch failed`，
 * 给宿主/本进程加 `NODE_OPTIONS=--use-system-ca` 才通（仓库别处早记过这条）。
 */
import { createVoiceModelService, voiceModelStoreRoot } from "../src/host/voice-model.js";

const root = voiceModelStoreRoot();
const service = createVoiceModelService({
  root,
  log: (line) => console.log(`[voice-model] ${line}`),
});

console.log(`[voice-model] 目标目录：${root}`);
console.log(`[voice-model] 归档：${service.archive.url}`);

const before = service.state();
console.log(`[voice-model] 当前状态：${before.phase}`);
if (before.phase === "ready") {
  console.log("[voice-model] 已经装好了，什么都不用做。");
  process.exit(0);
}

let last = "";
const timer = setInterval(() => {
  const s = service.state();
  const line = `${s.phase} ${(s.receivedBytes / 1048576).toFixed(1)}/${(s.totalBytes / 1048576).toFixed(1)} MiB`;
  if (line !== last) {
    last = line;
    console.log(`[voice-model] ${line}`);
  }
}, 1000);

const result = await service.download();
clearInterval(timer);
const after = service.state();
console.log(`[voice-model] 结束：${after.phase}${after.error === undefined ? "" : `（${after.error}）`}`);
console.log(`[voice-model] download() 返回：${JSON.stringify(result ?? null)}`);
process.exit(after.phase === "ready" ? 0 : 1);
