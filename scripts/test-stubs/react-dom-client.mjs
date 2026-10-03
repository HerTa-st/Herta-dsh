/**
 * 客户端 module 的测试桩：`react-dom/client`。
 *
 * 同上（见 react.mjs 的说明）。`createRoot` 返回一个形状齐全的空壳，
 * 足够让模块导入、以及让测试检查"接口导出了什么"。
 */
export function createRoot() {
  return {
    render: () => undefined,
    unmount: () => undefined,
  };
}
export default { createRoot };
