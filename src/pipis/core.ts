/// <reference lib="dom" />

export const REACTIVE = Symbol();

export type Cleanup = () => void;

export type Reactive<T> = {
  readonly [REACTIVE]: true;
  subscribe(callback: (newValue: T) => void): Cleanup;
};

export function isReactive<T>(value: unknown): value is Reactive<T> {
  return (value as Reactive<T> | null)?.[REACTIVE] === true;
}

export type JSXElement = (parent?: Node, sibling?: Node | null) => Node | null;

export type Content = string | number | null | undefined;
type JSXChild = JSXElement | Content | Reactive<Content>;
type JSXChildArray = readonly JSXChild[];

export type ChildrenProp = {
  readonly children?: JSXChild | JSXChildArray;
};

export type RefProp<T> = {
  readonly ref?: ((instance: T) => void) | { set value(_: T) };
};

export const emptyElement: JSXElement = (parent, sibling = null) => sibling;

export function Fragment(props: ChildrenProp): JSXElement {
  const { children } = props;
  let childElements: JSXElement[] = [];
  for (const child of children instanceof Array ? children : [children]) {
    if (child != null) {
      childElements.push(typeof child === "function" ? child : textNode(child));
    }
  }
  if (childElements.length <= 1) {
    return childElements[0] ?? emptyElement;
  }
  return function Fragment_element(parent, sibling = null) {
    for (let i = childElements.length - 1; i >= 0; i--) {
      sibling = childElements[i](parent, sibling);
    }
    return sibling;
  };
}

export function needsToMove(
  element: Node,
  parent: Node | undefined,
  sibling: Node | null,
): boolean {
  return element.parentNode != parent || element.nextSibling != sibling;
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
  return function textNode_element(parent, sibling = null) {
    if (needsToMove(node, parent, sibling)) {
      if (parent) {
        cleanup ??= contentReactive?.subscribe(function textNode_binding(newValue) {
          setText(node, newValue);
        });
        parent.insertBefore(node, sibling);
      } else {
        node.remove();
        cleanup?.();
        cleanup = undefined;
      }
    }
    return node;
  };
}

export function createMarker(text: string = ""): Comment {
  return document.createComment(text);
}

export function convertChildren(props: ChildrenProp): JSXElement[] {
  const { children } = props;
  let childElements: JSXElement[] = [];
  for (const child of children instanceof Array ? children : [children]) {
    if (child != null) {
      childElements.push(typeof child === "function" ? child : textNode(child));
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

type IntrinsicElement<T extends Node> = ConvertIntrinsicProps<
  Omit<StripReadonly<StripMethods<T>>, "children">,
  T
> &
  ChildrenProp &
  RefProp<T>;

export type IntrinsicElements = {
  [K in keyof AllElements]: IntrinsicElement<AllElements[K]>;
};

export function setRef<T>(props: RefProp<T>, value: T) {
  const { ref } = props;
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.value = value;
  }
}

type BindingEntry = [string, Reactive<unknown>, Cleanup | null];
export function createElement<T extends keyof IntrinsicElements>(
  type: T,
  props: IntrinsicElements[T],
): JSXElement {
  const element = document.createElement(type) as AllElements[T];
  const bindings: BindingEntry[] = [];
  for (const key in props) {
    if (key === "children" || key === "ref") {
      continue;
    }
    const value = (props as any)[key];
    if (isReactive(value)) {
      bindings.push([key, value, null]);
    } else {
      (element as any)[key] = value;
    }
  }
  setRef(props, element);
  const children = Fragment(props);
  return function jsxIntrinsic_element(parent, sibling = null) {
    if (needsToMove(element, parent, sibling)) {
      children(element);
      if (parent) {
        for (const b of bindings) {
          const [key] = b;
          b[2] ??= b[1].subscribe(function jsxIntrinsic_binding(newValue) {
            (element as any)[key] = newValue;
          });
        }
        parent.insertBefore(element, sibling);
      } else {
        element.remove();
        for (const b of bindings) {
          b[2]?.();
          b[2] = null;
        }
      }
    }
    return element;
  };
}
