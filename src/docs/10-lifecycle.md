# Custom Elements

While most applications will build Elements from other, pre-defined Components or intrinsic HTML tags, it is possible to define your own Element functions to implement advanced functionality or interact directly with the DOM.

An Element has the following signature:

```ts
type JSXElement = (parent?: Node, sibling?: Node | null) => Node | null;
```

Invoking an Element function instructs it to remove or add its content and/or functionality to the DOM.

The position to add any child DOM nodes is indicated by the `parent` and `sibling` arguments. The usage of these arguments matches the DOM [insertBefore](https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore) method, but with the stricter guarantee that `sibling`, if present, is always a child of `parent`, and `parent` is always alive in the DOM before the Element is invoked. If `parent` is `undefined`, then the element should be unmounted: any child nodes removed, and any event subscriptions cleaned up.

The Element must return a **stable head reference**: a node that can, in turn, be passed as the `sibling` parameter of any subsequent sibling Elements. This can be either:

- A node created and owned by the Element, added as a child of `parent` on mount, which will never change until the Element is un-mounted, OR
- The `sibling` parameter, if the Element has no DOM content. If `sibling` is null, this indicates the Element is at the right-most position (i.e. the end of the list of children).

The space between the `sibling` argument and the returned 'head' is owned by the Element, which is free to add additional nodes anywhere between the two during or after the mount call. If these two values are the same, then the Element reserves no space for its own content.

On unmount, the return value should always be `sibling` (since the Element has no DOM content after unmounting).

```ts
const myNode = document.createElement("br");
// A common pattern is to set the default value of `sibling` to null. This is because
// `insertBefore` does not allow its 'reference node' to be undefined; it must be defined, or null.
// Likewise, the element's return value cannot be undefined.
const myElement: JSXElement = (parent, sibling = null) => {
  if (parent) {
    parent.insertBefore(myNode, sibling);
  } else {
    myNode.remove();
  }
  return parent ? myNode : sibling;
};
```

If the Element's content might change dynamically, then additional care must be taken that the returned head reference is stable. For example, if an Element returns its left-most child, then decides to unmount all its children while active, this would break the sibling reference of subsequent Elements. In these situations a **synthetic head node** can be created - a node that can act as an anchor point without otherwise affecting the document. A [Comment](https://developer.mozilla.org/en-US/docs/Web/API/Comment) node fulfils this criteria: it is ignored by anything targeting DOM elements or text, including CSS, and is only observable by specifically iterating through child nodes.

```ts
const marker = document.createComment("");
let prevSibling: JSXSibling = null;
const myElement: JSXElement = (parent, sibling = null) => {
  if (parent && (marker.parentNode != parent || sibling != prevSibling)) {
    parent.insertBefore(marker, sibling);
    // Mount other nodes
  } else {
    // Unmount other nodes
    marker.remove();
  }
  return parent ? marker : sibling;
};
```

This strategy is implemented by the `dynamic()` helper function, which is in turn used by the various dynamic Components (`List`, `OneOf` etc.).

## Component lifecycle

Components and Elements in _pipis_ have a lifecycle that closely maps to the object lifecycle of the underlying platform (JavaScript and the DOM).

- **Definition**: A Component is defined as a function that accepts 'props' and returns an Element. Components are usually defined at the module scope, and can be reused indefinitely.
- **Construction**: A Component is invoked (either directly, or via JSX), returning an Element.
  - Any GC resources (such as DOM nodes) and, in general, any values or objects that depend solely on the 'props' can be pre-computed here.
  - This step (any code directly in the Component body) should be **idempotent**; that is, it can be performed repeatedly without side-effects. For example, subscriptions should _not_ be performed here.
- **Mount**: The Element function is invoked, passing in a Parent and Sibling, and returning a stable Head.
  - Once this step completes, the Element should be alive in the DOM. Any reactive subscriptions should be enabled here. This step can (and probably _should_!) have some side-effects.
  - Where possible, any side-effects should be **reversible** when the component unmounts, but this isn't always practical (for example, a component that fetches data or focuses a control on mount).
  - A single element instance may be mounted and unmounted many times during the application's lifetime, so performance should be a consideration.
  - It is an anti-pattern to trigger any event that could further alter the structure of the app (for example, changing a reactive dependency of a dynamic element) in this step. As a general rule, mounting a component should not modify the _application_ state at all. An important counter-example is the `Portal` utility, which mounts its own content immediately when the `PortalTarget` is mounted, via a reactive value.
- **Update**: If the Element enables any subscriptions on mount, these might be invoked at any time, usually in response to an external event (such as a network query or user action).
  - The Element can take any action it likes in response to these events, such as modifying attributes, or constructing/mounting/unmounting other Elements.
  - Since external events might happen frequently, performance is paramount.
  - It is an anti-pattern to mix state updates and DOM events in the same handler. The pattern should either be a DOM event that updates app state, or an app state change that updates the DOM. Deviations from this should be done with care to avoid update loops.
- **Move**: If an already-mounted Element is mounted again with a different parent or sibling, the functional effect is the same as unmounting and re-mounting.
  - Some structures, such as lists, might move components frequently. It is the Element's responsibility to check if any change is needed, and if not, to skip it for performance.
  - Moving an Element to the same parent and sibling pair should have no observable effect.
- **Unmount**: Calling the Element function with no arguments unmounts it.
  - Once this step completes, the Element is no longer active in the DOM.
  - Only cleanup and removal actions should be done here - no state updates.
  - The Element can subsequently be re-mounted, so this step should not take any destructive action.
- **GC**: When an Element or Component has no more references, the runtime cleans it up.
  - To avoid memory leaks, it's important that the Definition and Construction steps do not create any objects outside of their scope.
