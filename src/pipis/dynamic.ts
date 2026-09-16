import {
  type Cleanup,
  type JSXElement,
  type ChildrenProp,
  type Reactive,
  Fragment,
  type RefProp,
  setRef,
  isReactive,
} from "./core";
import { constant, reactive, type ReactiveReadonly } from "./reactive";

export function Repeat({
  count,
  children,
}: {
  count: Reactive<number>;
  children: (index: number) => JSXElement;
}): JSXElement {
  let cleanup: Cleanup | undefined;
  const items: JSXElement[] = [];
  return function Repeat_element(parent) {
    for (const item of items) {
      item();
    }
    items.length = 0;
    cleanup?.();
    if (!parent) {
      return;
    }
    cleanup = count.subscribe(function Repeat_count(newLength) {
      while (items.length > newLength) {
        items.pop()?.();
      }
      while (items.length < newLength) {
        const index = items.length;
        const child = children(index);
        items.push(child);
        child(parent);
      }
    });
  };
}

export function List<T>({
  items,
  key,
  children,
}: {
  items: Reactive<readonly T[]>;
  key: (item: T, index: number) => PropertyKey;
  children: (item: T, index: number) => JSXElement;
}): JSXElement {
  let cleanup: Cleanup | undefined;
  const renderedItems = new Map<PropertyKey, JSXElement>();
  return function List_element(parent) {
    cleanup?.();
    if (!parent) {
      return;
    }
    cleanup = items.subscribe(function List_items(newItems) {
      const newKeys = newItems.map(key);
      for (const [key, item] of renderedItems) {
        if (newKeys.indexOf(key) === -1) {
          item?.();
          renderedItems.delete(key);
        }
      }
      for (let index = 0; index < newItems.length; index++) {
        const item = newItems[index];
        const k = key(item, index);
        if (!renderedItems.has(k)) {
          const child = children(item, index);
          renderedItems.set(k, child);
          child(parent);
        }
      }
    });
  };
}

export function OneOf<T extends PropertyKey>({
  selector,
  children,
}: {
  selector: Reactive<T>;
  children: Partial<Record<T, JSXElement>>;
}): JSXElement {
  let cleanup: Cleanup | undefined;
  let current: JSXElement | undefined;
  return function OneOf_element(parent) {
    cleanup?.();
    cleanup = selector.subscribe(function OneOf_value(newValue) {
      current?.();
      current = children[newValue];
      if (current && parent) {
        current(parent);
      }
    });
  };
}

export function Dynamic<T>({
  value,
  children,
}: {
  value: Reactive<T>;
  children: (props: T) => JSXElement;
}): JSXElement {
  let cleanup: Cleanup | undefined;
  let current: JSXElement | undefined;
  return function Dynamic_element(parent) {
    cleanup?.();
    cleanup = value.subscribe(function Dynamic_value(newValue) {
      current?.();
      current = children(newValue);
      if (current && parent) {
        current(parent);
      }
    });
  };
}

export function Watch<T>({
  value,
  children,
}: {
  value: Reactive<T>;
  children: (newValue: T) => void;
}): JSXElement {
  let cleanup: Cleanup | undefined;
  return function Watch_element() {
    cleanup?.();
    cleanup = value.subscribe(function Watch_value(newValue) {
      children(newValue);
    });
  };
}

export function Effect({ children }: { children: () => Cleanup | undefined }): JSXElement {
  let cleanup: Cleanup | undefined;
  return function Effect_element() {
    cleanup?.();
    cleanup = children();
  };
}

export function defineContext<T>(defaultValue: T) {
  const stack = [defaultValue];
  function context_provider<U>(value: T, inner: () => U): U {
    stack.push(value);
    try {
      return inner();
    } finally {
      stack.pop();
    }
  }
  function context_consumer() {
    return stack[stack.length - 1];
  }
  return [context_provider, context_consumer] as const;
}

export function Suspense<T>({
  promise,
  placeholder,
  success,
  error,
  children,
}: {
  promise: Promise<T> | Reactive<Promise<T>>;
  placeholder: T;
  success: (value: ReactiveReadonly<T | undefined>) => JSXElement;
  error?: (err: ReactiveReadonly<unknown>) => JSXElement;
  children?: JSXElement;
}): JSXElement {
  const state = reactive<0 | 1 | 2>(0);
  const successValue = reactive<T>(placeholder);
  const errorValue = reactive<unknown>(undefined);
  const successElement = success(successValue);

  return Fragment({
    children: [
      Watch({
        value: isReactive(promise) ? promise : constant(promise),
        children: function Suspense_promise(newPromise) {
          state.value = 0;
          newPromise.then(
            (value) => {
              successValue.value = value;
              state.value = 1;
            },
            (err) => {
              errorValue.value = err;
              state.value = 2;
            },
          );
        },
      }),
      OneOf({
        selector: state,
        children: [
          children ?? successElement,
          successElement,
          error?.(errorValue) ?? successElement,
        ],
      }),
    ],
  });
}

export function ErrorBoundary({
  children,
  fallback,
}: {
  children: JSXElement;
  fallback: (err: ReactiveReadonly<unknown>) => JSXElement;
}): JSXElement {
  const errorValue = reactive<unknown>(undefined);
  const fallbackElement = fallback(errorValue);
  return function ErrorBoundary_element(parent) {
    try {
      return children(parent);
    } catch (err) {
      errorValue.value = err;
      return fallbackElement(parent);
    }
  };
}

export function PortalTarget(props: RefProp<Element | undefined>): JSXElement {
  return function PortalTarget_element(parent) {
    setRef(props, parent);
  };
}

export function Portal({
  target,
  children,
}: {
  target: Reactive<Element | undefined>;
  children: JSXElement;
}): JSXElement {
  let cleanup: Cleanup | undefined;
  return function Portal_element() {
    cleanup?.();
    cleanup = target.subscribe(children);
  };
}
