/// <reference lib="dom" />

export const REACTIVE = Symbol("REACTIVE");
export const NODE = Symbol("NODE");

export type Cleanup = () => void;

export type Reactive<T> = {
  readonly [REACTIVE]: true;
  subscribe(callback: (newValue: T) => void): Cleanup;
};

export function isReactive<T>(value: unknown): value is Reactive<T> {
  return (value as Reactive<T> | null)?.[REACTIVE] === true;
}

export type JSXElement = (parent?: Element) => void;

export type Content = string | number | null | undefined;
type JSXChild = JSXElement | Content | Reactive<Content>;
type JSXChildArray = readonly JSXChild[];

export type JSXProps = {
  readonly children?: JSXChild | JSXChildArray;
};

export function Fragment(props: JSXProps): JSXElement {
  const childElements = convertChildren(props);
  return function Fragment_element(parent) {
    for (const child of childElements) {
      child(parent);
    }
  };
}

function setText(node: Text, content: Content) {
  node.data = String(content ?? "");
}

function textNode(content: Content | Reactive<Content>): JSXElement {
  const node = document.createTextNode("");
  let contentReactive: Reactive<Content> | undefined;
  if (isReactive(content)) {
    contentReactive = content;
  } else {
    setText(node, content);
  }
  let cleanup: Cleanup | undefined;
  return function textNode_element(parent) {
    node.remove();
    cleanup?.();
    cleanup = contentReactive?.subscribe(function textNode_binding(newValue) {
      setText(node, newValue);
    });
    parent?.appendChild(node);
  };
}

function convertChild(child: JSXChild): JSXElement {
  return typeof child === "function" ? child : textNode(child);
}

export function convertChildren(props: JSXProps): JSXElement[] {
  const { children } = props;
  let childElements: JSXElement[] = [];
  for (const child of children instanceof Array ? children : [children]) {
    if (child != null) {
      childElements.push(convertChild(child));
    }
  }
  return childElements;
}

type StripReadonly<T> = {
  [K in keyof T as Equals<Pick<T, K>, Readonly<Pick<T, K>>> extends true ? never : K]: T[K];
};

type Equals<A, B> =
  (<Y>() => Y extends B ? 1 : 2) extends <Y>() => Y extends A ? 1 : 2 ? true : false;

type StripMethods<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

type EventHandlerWithTarget<TEventHandler, TTarget extends EventTarget> = TEventHandler extends (
  this: infer TThis,
  ev: infer TEvent,
) => any
  ? (this: TThis, ev: TEvent & { target: TTarget }) => void
  : TEventHandler;

type ValueOrBinding<T> = T | Reactive<T>;

type ConvertIntrinsicProps<T, TTarget extends EventTarget> = {
  [K in keyof T]?: ValueOrBinding<EventHandlerWithTarget<T[K], TTarget>>;
};

type AllElements = HTMLElementTagNameMap & SVGElementTagNameMap & MathMLElementTagNameMap;

type IntrinsicElement<T extends Element> = ConvertIntrinsicProps<
  Omit<StripReadonly<StripMethods<T>>, "children">,
  T
> &
  JSXProps;

export type IntrinsicElements = {
  [K in keyof AllElements]: IntrinsicElement<AllElements[K]>;
};

type BindingEntry = [string, Reactive<unknown>, Cleanup | null];
export function createElement<T extends keyof IntrinsicElements>(
  type: T,
  props: IntrinsicElements[T],
): JSXElement {
  const element = document.createElement(type);
  const bindings: BindingEntry[] = [];
  for (const key in props) {
    if (key === "children") {
      continue;
    }
    const value = (props as any)[key];
    if (isReactive(value)) {
      bindings.push([key, value, null]);
    } else {
      (element as any)[key] = value;
    }
  }
  return function jsxIntrinsic_element(parent) {
    element.remove();
    for (const b of bindings) {
      const [key, binding, cleanup] = b;
      cleanup?.();
      b[2] = binding.subscribe(function jsxIntrinsic_binding(newValue) {
        (element as any)[key] = newValue;
      });
    }
    for (const child of convertChildren(props)) {
      child(element);
    }
    if (parent) {
      parent.appendChild(element);
    }
  };
}
