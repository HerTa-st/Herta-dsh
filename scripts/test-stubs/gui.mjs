/**
 * 客户端 module 的测试桩：`@gui/*`（上游 Herta 的整机组件与样式）。
 *
 * 四个客户端 module 里有三处静态 import 来自 `@gui/*`：两个气泡组件、一个
 * LocaleProvider、一份 CSS。它们住在 `Herta-src` 里，仓库里没有 —— 打桩即可，
 * 因为被断言的是**我们这侧**的接口与字段表，不是上游组件的实现。
 *
 * CSS 那个是默认导入（字符串），所以这里也给一个 default。
 */
const noop = (props) => ({ __stub: "gui", props });

export const HertaBubble = noop;
export const UserBubble = noop;
export const LocaleProvider = noop;

export default "";
