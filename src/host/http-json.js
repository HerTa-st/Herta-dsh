/**
 * 两条插件自带端点共用的 JSON 收发小工具。
 *
 * 抽出来的理由很实际：`/herta-voice-model` 与 `/herta-minimax-state` 都要做同样的
 * 三件事 —— 发 JSON、按上限收请求体、把坏 JSON 变成 400 —— 而这三件事写两遍
 * 就会有两套边界行为（其中一套迟早漏掉上限）。
 */

/** 发一个 JSON 响应。`no-store`：这两条端点回的都是会变的实时状态。 */
export function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

/**
 * 收一个 JSON 请求体。
 *
 * **自己已经回过响应就返回 undefined**（超限或坏 JSON），调用方据此直接收手，
 * 不要重复 writeHead。
 *
 * 超限时不只是 `req.destroy()`：那会让**已经发出去的 413 被 TCP RST 截掉**，
 * 客户端看到的是一个网络错误而不是「body too large」（实测：Node 的 fetch 报
 * `UND_ERR_SOCKET`）。所以先回 413，再**丢弃**剩余字节（不存），只在超过一个
 * 宽裕的宽限上限时才真的断连。
 *
 * @param req - Node 请求。
 * @param res - Node 响应。
 * @param maxBytes - 上限；超过就 413。
 * @returns 解析好的值；空体是 `{}`；已回过响应则是 undefined。
 */
export function readJsonBody(req, res, maxBytes) {
  /** 丢弃剩余字节的宽限上限：到此为止还没读完就断连（防灌）。 */
  const graceBytes = maxBytes * 4;
  return new Promise((resolve) => {
    let body = "";
    let seen = 0;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on("data", (chunk) => {
      seen += chunk.length;
      if (settled) {
        // 已经回过 413 了：只数不存，超宽限才断。
        if (seen > graceBytes) req.destroy();
        return;
      }
      body += chunk;
      if (body.length > maxBytes) {
        sendJson(res, 413, { error: "body too large" });
        finish(undefined);
        body = "";
      }
    });
    req.on("end", () => {
      if (settled) return;
      if (body === "") return finish({});
      try {
        finish(JSON.parse(body));
      } catch (error) {
        sendJson(res, 400, { error: `bad json: ${String(error?.message ?? error)}` });
        finish(undefined);
      }
    });
    req.on("error", () => {
      if (settled) return;
      sendJson(res, 400, { error: "request error" });
      finish(undefined);
    });
  });
}
