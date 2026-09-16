import {
  type Cleanup,
  type JSXElement,
  type Reactive,
  Fragment,
  type RefProp,
  setRef,
  isReactive,
  createMarker,
} from "./core";
import { constant, reactive, type ReactiveReadonly } from "./reactive";

export function dynamic(
  mount: (parent: Node, sibling: Node | null) => Cleanup | void,
  unmount: () => void,
): JSXElement {
  const marker = createMarker();
  let cleanup: Cleanup | void;
  return function Dynamic_element(parent, sibling = null) {
    if (parent) {
      parent.insertBefore(marker, sibling);
      cleanup ??= mount(parent, sibling);
    } else {
      unmount();
      cleanup?.();
      cleanup = undefined;
      marker.remove();
    }
    return marker;
  };
}

export function Repeat({
  count,
  children,
}: {
  count: Reactive<number>;
  children: (index: number) => JSXElement;
}): JSXElement {
  const items: JSXElement[] = [];
  return dynamic(
    function Repeat_mount(parent, sibling) {
      return count.subscribe(function Repeat_count(newLength) {
        while (items.length > newLength) {
          items.pop()?.();
        }
        while (items.length < newLength) {
          const index = items.length;
          const child = children(index);
          items.push(child);
          child(parent, sibling);
        }
      });
    },
    function Repeat_unmount() {
      for (const item of items) {
        item();
      }
      items.length = 0;
    },
  );
}

export function List<T>({
  items,
  itemKey,
  children,
}: {
  items: Reactive<readonly T[]>;
  itemKey: (item: T, index: number) => PropertyKey;
  children: (item: T, index: number) => JSXElement;
}): JSXElement {
  const renderedItems = new Map<PropertyKey, JSXElement>();
  return dynamic(
    function List_mount(parent, sibling) {
      return items.subscribe(function List_items(newItems) {
        const newKeys = newItems.map(itemKey);
        for (const [key, item] of renderedItems) {
          if (newKeys.indexOf(key) === -1) {
            item?.();
            renderedItems.delete(key);
          }
        }
        // Forward iteration also works (when passing in 'sibling' repeatedly), but that would cause
        // every item to be moved to the end of the parent each update, even if its real position doesn't change.
        let nextSibling = sibling;
        for (let index = newItems.length - 1; index >= 0; index--) {
          const item = newItems[index];
          const k = newKeys[index];
          let itemElement = renderedItems.get(k);
          if (!itemElement) {
            itemElement = children(item, index);
            renderedItems.set(k, itemElement);
          }
          nextSibling = itemElement(parent, nextSibling);
        }
      });
    },
    function List_unmount() {
      for (const [, item] of renderedItems) {
        item();
      }
      renderedItems.clear();
    },
  );
}

export function OneOf<T extends PropertyKey>({
  selector,
  children,
}: {
  selector: Reactive<T>;
  children: Partial<Record<T, JSXElement>>;
}): JSXElement {
  let current: JSXElement | undefined;
  return dynamic(
    function OneOf_mount(parent, sibling) {
      return selector.subscribe(function OneOf_value(newValue) {
        current?.();
        current = children[newValue];
        if (current && parent) {
          current(parent, sibling);
        }
      });
    },
    function OneOf_unmount() {
      current?.();
      current = undefined;
    },
  );
}

export function Dynamic<T>({
  value,
  children,
}: {
  value: Reactive<T>;
  children: (props: T) => JSXElement;
}): JSXElement {
  let current: JSXElement | undefined;
  return dynamic(
    function Dynamic_mount(parent, sibling) {
      return value.subscribe(function Dynamic_value(newValue) {
        current?.();
        current = children(newValue);
        if (current && parent) {
          current(parent, sibling);
        }
      });
    },
    function Dynamic_unmount() {
      current?.();
      current = undefined;
    },
  );
}

export function effect(fn: () => Cleanup | undefined): JSXElement {
  let cleanup: Cleanup | undefined;
  return function Effect_element(parent, sibling = null) {
    if (parent) {
      cleanup ??= fn();
    } else {
      cleanup?.();
      cleanup = undefined;
    }
    return sibling;
  };
}

export function Effect(props: { children: () => Cleanup | undefined }): JSXElement {
  return effect(props.children);
}

export function Watch<T>({
  value,
  children,
}: {
  value: Reactive<T>;
  children: (newValue: T) => void;
}): JSXElement {
  return effect(function Watch_effect() {
    return value.subscribe(function Watch_value(newValue) {
      children(newValue);
    });
  });
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
  return dynamic(
    function ErrorBoundary_mount(parent, sibling = null) {
      try {
        children(parent, sibling);
      } catch (err) {
        errorValue.value = err;
        try {
          children();
        } catch {}
        fallbackElement(parent, sibling);
      }
    },
    function ErrorBoundary_unmount() {
      children();
      fallbackElement();
      errorValue.value = undefined;
    },
  );
}

export type PortalTargetValue = readonly [Node, Node | null] | undefined;

export function PortalTarget(props: RefProp<PortalTargetValue>): JSXElement {
  return function PortalTarget_element(parent, sibling = null) {
    setRef(props, parent ? [parent, sibling] : undefined);
    return sibling;
  };
}

export function Portal({
  target,
  children,
}: {
  target: Reactive<PortalTargetValue>;
  children: JSXElement;
}): JSXElement {
  return effect(function Portal_effect() {
    return target.subscribe(function Portal_target(newValue) {
      if (newValue) {
        const [parent, sibling] = newValue;
        children(parent, sibling);
      }
    });
  });
}
