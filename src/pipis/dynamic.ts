import {
  type Cleanup,
  type JSXElement,
  type Reactive,
  Fragment,
  type RefProp,
  setRef,
  isReactive,
  createMarker,
  moveNode,
  type JSXParent,
  type JSXSibling,
  type ChildrenProp,
} from "./core";
import { reactive, type ReactiveReadonly } from "./reactive";

type MountFn = (parent: Exclude<JSXParent, undefined>, sibling: JSXSibling) => Cleanup | void;
/**
 * Builds a {@link JSXElement} whose content can change shape over time (be added, removed, or
 * reordered) without breaking the fixed "head" contract that {@link JSXElement} requires.
 *
 * A persistent {@link createMarker marker} node is inserted once, immediately before the original
 * `sibling`, before `mount` ever runs - so it's always the leftmost node of the region, and is
 * always returned as this element's head, however its content changes later. `mount` is free to
 * insert/move/remove real content anywhere between the marker and `sibling`.
 *
 * `mount` is only called once per mount (guarded with `cleanup ??=`), so subscribing inside it is
 * safe even if the returned element's mount function is invoked again with the same parent.
 */
export function dynamic(mount: MountFn, unmount: Cleanup): JSXElement {
  const marker = createMarker();
  let cleanup: Cleanup | void;
  return function Dynamic_element(parent, sibling = null, shadow) {
    if (moveNode(marker, parent, sibling) || (!cleanup && parent && !shadow)) {
      // Either the node was moved, or it's visible in the DOM but hasn't been activated yet.
      cleanup?.();
      if (parent && !shadow) {
        cleanup = mount(parent, sibling);
      } else {
        cleanup = undefined;
        unmount();
      }
    }
    return marker;
  };
}

/** Renders `count` items in sequence, adding or removing from the end as `count` changes. */
export function Repeat({
  count,
  children,
}: {
  count: Reactive<number>;
  children: (index: number) => JSXElement;
}): JSXElement {
  const items: JSXElement[] = [];
  const Repeat_mount: MountFn = (parent, sibling) =>
    count.subscribe(function Repeat_count(newLength) {
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
  return dynamic(Repeat_mount, function Repeat_unmount() {
    for (const item of items) {
      item();
    }
    items.length = 0;
  });
}

/**
 * Renders items from an array, keyed by `itemKey` so items can be added, removed, and reordered
 * without recreating unaffected items. Each item is (re-)mounted on every update by iterating
 * back-to-front and chaining each item's returned head node as the next item's `sibling`; combined
 * with {@link moveNode}, an item only costs a real DOM operation when it actually moved.
 */
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
  const List_mount: MountFn = (parent, sibling) =>
    items.subscribe(function List_items(newItems) {
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
  return dynamic(List_mount, function List_unmount() {
    for (const [, item] of renderedItems) {
      item();
    }
    renderedItems.clear();
  });
}

/** Mounts one of several elements, chosen by `selector`, unmounting the previous choice on change. */
export function OneOf<T extends PropertyKey>({
  selector,
  children,
}: {
  selector: Reactive<T>;
  children: Partial<Record<T, JSXElement>>;
}): JSXElement {
  let current: JSXElement | undefined;
  const OneOf_mount: MountFn = (parent, sibling) =>
    selector.subscribe(function OneOf_value(newValue) {
      current?.();
      current = children[newValue];
      if (current && parent) {
        current(parent, sibling);
      }
    });
  return dynamic(OneOf_mount, function OneOf_unmount() {
    current?.();
    current = undefined;
  });
}

/** Conditionally renders its child based on a boolean reactive value. */
export function If({
  condition,
  ...props
}: {
  condition: Reactive<boolean>;
} & ChildrenProp) {
  const children = Fragment(props);
  const If_mount: MountFn = (parent, sibling) =>
    condition.subscribe(function If_value(newValue) {
      children(newValue ? parent : undefined, sibling);
    });
  return dynamic(If_mount, function If_unmount() {
    children();
  });
}

/**
 * Renders content computed from a reactive value, fully recreating the DOM whenever it changes.
 * Prefer {@link OneOf}, {@link List}, or {@link Repeat} where they fit; those update in place
 * instead of throwing away and rebuilding the DOM on every change.
 */
export function Dynamic<T>({
  value,
  children,
}: {
  value: Reactive<T>;
  children: (props: T) => JSXElement;
}): JSXElement {
  let current: JSXElement | undefined;
  const Dynamic_mount: MountFn = (parent, sibling) =>
    value.subscribe(function Dynamic_value(newValue) {
      current?.();
      current = children(newValue);
      if (current && parent) {
        current(parent, sibling);
      }
    });
  return dynamic(Dynamic_mount, function Dynamic_unmount() {
    current?.();
    current = undefined;
  });
}

/** Renders nothing, but runs `fn` on mount and its returned cleanup (if any) on unmount. */
export function effect(fn: () => Cleanup | undefined): JSXElement {
  let cleanup: Cleanup | undefined;
  return function Effect_element(parent, sibling = null, shadow) {
    if (parent && !shadow) {
      cleanup ??= fn();
    } else {
      cleanup?.();
      cleanup = undefined;
    }
    return sibling;
  };
}

/** JSX-friendly wrapper around {@link effect}, for running a side effect on mount/unmount. */
export const Effect = (props: { children: () => Cleanup | undefined }): JSXElement =>
  effect(props.children);

/** Runs `children` with the current value on mount, and again on every subsequent change. */
export function Watch<T>({
  value,
  children,
}: {
  value: Reactive<T>;
  children: (newValue: T) => void;
}): JSXElement {
  const Watch_effect = () =>
    value.subscribe(function Watch_value(newValue) {
      children(newValue);
    });
  return effect(Watch_effect);
}

/**
 * Creates a context: a `[provider, consumer]` pair for passing a value down the component tree
 * without threading it through every level of props. The consumer resolves to the nearest
 * enclosing provider's value at the time the component is constructed.
 */
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
  const context_consumer = () => stack[stack.length - 1];
  return [context_provider, context_consumer] as const;
}

/**
 * Renders `children` (or `success`, if omitted) while `promise` is pending, `success` once it
 * resolves, and `error` if it rejects. Does not offer timeout/retry/streaming; for that level of
 * control, consider a dedicated data-fetching library layered on top.
 */
export function Suspense<T>({
  promise,
  placeholder,
  success,
  error,
  ...props
}: {
  promise: (() => Promise<T>) | Reactive<Promise<T>>;
  placeholder: T;
  success: (value: ReactiveReadonly<T>) => JSXElement;
  error?: (err: ReactiveReadonly<unknown>) => JSXElement;
} & ChildrenProp): JSXElement {
  const state = reactive<0 | 1 | 2>(0);
  const successValue = reactive<T>(placeholder);
  const errorValue = reactive<unknown>(undefined);
  const successElement = success(successValue);

  function Suspense_promise(newPromise: Promise<T>) {
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
  }

  return Fragment({
    children: [
      isReactive(promise)
        ? Watch({
            value: promise,
            children: Suspense_promise,
          })
        : effect(function Suspense_onMount() {
            Suspense_promise(promise());
          }),
      OneOf({
        selector: state,
        children: [
          props.children ? Fragment(props) : successElement,
          successElement,
          error?.(errorValue) ?? successElement,
        ],
      }),
    ],
  });
}

/**
 * Catches errors thrown synchronously while mounting `children` and renders `fallback` instead.
 * Only covers the mount call itself - errors thrown later, e.g. from a reactive binding's
 * subscriber callback or an {@link Effect}, are not caught. Use a global error handler (such as
 * `window.onerror`) alongside a reactive flag for those cases.
 */
export function ErrorBoundary({
  fallback,
  ...props
}: {
  fallback: (err: ReactiveReadonly<unknown>) => JSXElement;
} & ChildrenProp): JSXElement {
  const children = Fragment(props);
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

/** The `[parent, sibling]` mount position captured by a {@link PortalTarget}, or `undefined` if it isn't mounted. */
export type PortalTargetValue = readonly [Node, Node | null] | undefined;

/**
 * Marks a spot in the tree for a {@link Portal} to render into. Renders nothing itself; assign
 * its position (via `ref`) to a reactive value and pass that to a `Portal`'s `target` prop.
 */
export function PortalTarget(props: RefProp<PortalTargetValue>): JSXElement {
  return dynamic(
    function PortalTarget_mount(parent, sibling = null) {
      setRef(props, [parent, sibling]);
    },
    function PortalTarget_unmount() {
      setRef(props, undefined);
    },
  );
}

/**
 * Renders `children` into the position captured by a {@link PortalTarget}, wherever that is in
 * the DOM. Since the captured position is a pair of live node references rather than a snapshot,
 * this keeps working correctly even if the target is later moved (e.g. as part of a reordering
 * {@link List}).
 */
export function Portal({
  target,
  ...props
}: {
  target: Reactive<PortalTargetValue>;
} & ChildrenProp): JSXElement {
  const children = Fragment(props);
  const Portal_effect = () =>
    target.subscribe(function Portal_target(newValue) {
      if (newValue) {
        const [parent, sibling] = newValue;
        children(parent, sibling);
      }
    });
  return effect(Portal_effect);
}

/**
 * Renders its children into the document head.
 */
export function Helmet(props: ChildrenProp): JSXElement {
  const children = Fragment(props);
  return (parent, sibling = null, shadow) => {
    if (parent && !shadow) {
      const { head } = document;
      // This ensures new Helmet children are inserted at the beginning, so they take priority.
      children(head, head.firstChild);
    } else {
      children();
    }
    return sibling;
  };
}
