/**
 * schema 兼容层：优先用运行时给的 `@deepseek-ai/schemastery`，拿不到就退到一个最小实现。
 *
 * ## 为什么必须这么做
 *
 * 原来入口文件写的是**静态导入**：
 *
 *     import z from "@deepseek-ai/schemastery";
 *
 * 而本包**不声明任何依赖**（`dependencies` / `peerDependencies` 都是空的）——
 * 它整个指望 DSH 运行时把那个包递过来。运行时不给（或给的是另一个形状）时，
 * **模块在解析阶段就抛**，静态导入没法用 try/catch 兜，于是插件整个起不来。
 * 用户侧看到的正是这一句：
 *
 *     dsh: warning: 1 entry did not activate herta (dsh-herta): failed to import
 *
 * 改成动态导入 + 兜底之后：拿得到就用真的，拿不到也**至少让插件活着进来**。
 *
 * ## 兜底那套是「宽容」的，不是「等价」的
 *
 * 它只保证**能被链式调用**（`z.object({...}).default(v).volatile()` 这类），
 * 并把用到的形状记下来；它**不实现真正的校验**。也就是说：真库在时行为不变，
 * 真库不在时——插件能加载、字段名与默认值仍来自 `settings-schema.js`，
 * 但 DSH 那边的表单/校验拿到的是一份宽容描述。**这比「整个插件起不来」好。**
 */
let z = null;
try {
  const mod = await import("@deepseek-ai/schemastery");
  z = mod?.default ?? mod ?? null;
} catch {
  z = null;
}
if (z === null || typeof z.object !== "function") z = makeFallback();

function makeFallback() {
  const CHAINABLE = {
    default: (extra, v) => ({ ...extra, defaultValue: v }),
    min: (extra, v) => ({ ...extra, min: v }),
    max: (extra, v) => ({ ...extra, max: v }),
    volatile: (extra) => ({ ...extra, volatile: true }),
    description: (extra, v) => ({ ...extra, description: v }),
    optional: (extra) => ({ ...extra, optional: true }),
    required: (extra) => ({ ...extra, required: true }),
    nullable: (extra) => ({ ...extra, nullable: true }),
  };
  /** 不认识的方法名也返回可链式调用，且不返回 thenable（避免被 await 挂住）。 */
  const DENY = new Set(["then", "toJSON", "constructor", "toString", "valueOf", "inspect"]);
  function node(kind, extra = {}) {
    const target = { kind, __hertaFallbackSchema: true, ...extra };
    return new Proxy(target, {
      get(t, prop) {
        if (typeof prop === "symbol") return undefined;
        if (prop in t) return t[prop];
        if (DENY.has(prop)) return undefined;
        const fn = CHAINABLE[prop];
        if (fn !== undefined) return (...args) => node(kind, fn(extra, ...args));
        // 未知方法：宽容地当作一次链式调用，不改形状
        return () => node(kind, extra);
      },
    });
  }
  return {
    __hertaFallbackSchema: true,
    object(shape) {
      return node("object", { shape });
    },
    string: () => node("string"),
    number: () => node("number"),
    boolean: () => node("boolean"),
    union: (values) => node("union", { values }),
    literal: (value) => node("literal", { value }),
    array: (item) => node("array", { item }),
    any: () => node("any"),
  };
}

/** 兜底是否生效——写进启动日志，免得「静默降级」（今天那条规矩）。 */
export const usingFallbackSchema = z !== null && z.__hertaFallbackSchema === true;

export default z;
