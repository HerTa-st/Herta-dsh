/**
 * dsh-theme-herta —— 宿主侧。
 *
 * 职责：把包里的静态资源（移植来的开场模块 + 四份开场段数据）注册成一条路由，
 * 让浏览器端能**动态 import 它们** —— 客户端那一半因此不需要打包器，模块保持原样。
 *
 * ## 为什么必须用 `ctx.inject(["webServer"], …)` 而不是 `ctx.get("webServer")`
 *
 * 宿主行的**挂载早于 webserver 行就绪**：那时 `ctx.get("webServer")` 拿到的是
 * `undefined`。直接用它 + 早退，就变成**静默不注册任何路由**（页面上表现为全 404，
 * 而错误哪里都不出现）。这条不是我猜的 —— 上游 `dsh-herta/lib/index.js` 的注释里
 * 写着同样的实测结论。`ctx.inject` 会等服务出现再回调；在没有 web 的组合（无头/SDK）
 * 里它只是永远不触发，不会把插件卡成 PENDING。
 */
import { registerOpeningRoute } from "./opening-route.js";

/** 与 `cordis.patch.yml` 里的 loader 行对应。 */
export const name = "dsh-theme-herta";

/** 路由前缀（客户端 client.js 里写死同一个值）。 */
export const OPENING_ROUTE = "/herta-theme";

export function apply(ctx) {
  // 挂载日志保留是有意的：DSH 的插件挂载失败往往是静默的，
  // 而「这个包到底有没有被挂上」是排查一切问题的第一问。
  console.log("[dsh-theme-herta] host 半侧已挂载");

  ctx.inject(["webServer"], (scoped) => {
    scoped.effect(
      () => registerOpeningRoute(scoped, OPENING_ROUTE) ?? (() => {}),
      "dsh-theme-herta: opening route",
    );
  });
}
