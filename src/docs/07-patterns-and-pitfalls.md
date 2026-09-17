## Patterns and pitfalls

A collection of non-obvious details worth knowing, uncovered while building the example apps.

### `ref` fires at construction, not at mount

`ref` callbacks run while the element is being _constructed_ (as part of `createElement`), before the returned mount function is ever called with a real parent. At that point the node exists, but is very likely still detached from the document - calling something like `.focus()` synchronously inside a `ref` callback is a no-op, since browsers ignore focus calls on detached nodes.

The idiomatic fix is to capture the node into a reactive value with `ref`, then perform the action explicitly with a `Watch` or `Effect` - this makes it clear _when_ the action happens, and the reactive value is free to be read anywhere else too:

```tsx
function App() {
  const inputBox = reactive<HTMLInputElement | null>(null);
  return (
    <>
      <Watch value={inputBox}>{(el) => el?.focus()}</Watch>
      <input ref={inputBox} />
    </>
  );
}
```

A callback-style `ref` is still the right tool when you need to do setup that doesn't require the node to be live, such as attaching an event listener directly to the DOM node.

### `ErrorBoundary` only sees its direct children

`ErrorBoundary` catches errors thrown synchronously while mounting its `children` - but only its _direct_ children. If the thing that might throw is chosen by a reactive value further down the tree (say, inside a `Dynamic` or `OneOf`), an error thrown there happens on a later, independent mount call that `ErrorBoundary` isn't around to observe.

The straightforward fix is to convert the reactive condition into a plain value _before_ it reaches `ErrorBoundary`, so the boundary's direct children genuinely differ on every relevant change:

```tsx
function DebugPanel({ shouldCrash }: { shouldCrash: Reactive<boolean> }) {
  return (
    <Dynamic value={shouldCrash}>
      {(crash) => (
        <ErrorBoundary fallback={(err) => <p>Crashed: {String(err)}</p>}>
          <p>Panel content</p>
          {crash && <CrashyComponent />}
        </ErrorBoundary>
      )}
    </Dynamic>
  );
}
```

Note that `ErrorBoundary` itself must never be the thing rebuilt reactively by wrapping it directly in `Dynamic`/`OneOf` on its own - the docs for `Dynamic` specifically warn against using it just to force a remount, since it throws away and recreates the entire subtree rather than updating in place. Here, the reactive branching happens _inside_ `ErrorBoundary`'s children instead, so only the part that actually needs to change is rebuilt.

### `dynamic()`'s marker is a `Comment`, and that's compatible with CSS

Utilities like `If`, `OneOf`, `List`, `Repeat`, and `Dynamic` are all built on a shared `dynamic()` helper, which inserts a persistent `Comment` node as a stable anchor ("head") before any of their real content. CSS structural pseudo-classes like `:empty` and `:only-child` ignore comment nodes per spec, so patterns like `<ul className="empty:hidden">...</ul>` still work correctly even when the list's actual items are wrapped in one of these utilities.

### `List` reorders with exactly one DOM operation per moved item

`List` walks items back-to-front on every update, chaining each item's returned head as the next item's `sibling` anchor, and skips the actual `insertBefore` call entirely for any item whose `parentNode`/`nextSibling` already matches (see `moveNode`). Combined, this means a re-order only costs one DOM operation per item that actually changed position - not one per item in the list.
