import { jsx, type Component, type JSXKey } from "./jsx-runtime";
import type { JSXProps } from "./core";
export { Fragment } from "./core";

export type SourceInfo = {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
};

export function jsxDEV(
  type: Component,
  props: JSXProps,
  key?: JSXKey,
  isStaticChildren?: boolean,
  source?: SourceInfo,
  self?: any,
) {
  return jsx(type, props, key);
}
