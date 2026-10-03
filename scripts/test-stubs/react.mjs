/**
 * 客户端 module 的测试桩：`react`。
 *
 * 仓库刻意不带 node_modules（见 `test-resolve-hook.mjs`），而 #2 拆出的四个客户端
 * module 静态 import react。要**行为地**断言它们的接口（候选 #3），就得让它们能被
 * 裸 Node import —— 于是把 react 指到这份最小桩。
 *
 * 桩只需要"导入不炸"：这些 module 的顶层只定义函数与常量，不在导入期调用 hooks。
 * 真要在测试里渲染，得换成真 react —— 那不是这份桩的用途。
 */
export const createElement = (...args) => ({ __stub: "createElement", args });
export const useCallback = (fn) => fn;
export const useEffect = () => undefined;
export const useMemo = (fn) => fn();
export const useRef = (initial) => ({ current: initial ?? null });
export const useState = (initial) => [initial, () => undefined];
export const useLayoutEffect = () => undefined;
export const Fragment = Symbol("Fragment");
export default { createElement, useCallback, useEffect, useMemo, useRef, useState };
