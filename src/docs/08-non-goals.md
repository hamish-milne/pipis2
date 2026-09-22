# Caveats and non-goals

## Dynamic node reuse

Unlike vDOM frameworks such as React, _pipis_ doesn't automatically re-use DOM nodes held by a different element than the one previously mounted. As documented in [Dynamic UI](#dynamic-ui), this isn't relevant for most applications, but the tradeoff exists nonetheless: applications with a frequently-changing dynamic structure will likely perform better in React/preact unless manual caching or incremental updates are used.

While utilities for most dynamic patterns are provided (`List`, `OneOf` etc.), these must be explicltly used.

```tsx
function MyList(props: { items: Reactive<string> }) {
  // Bad - this won't update when the 'items' value changes
  // return <ul>{...props.items.value.map((item) => <li>{item}</li>)}</ul>;

  // Good!
  return (
    <List items={props.items} itemKey={(x) => x}>
      {(item) => <li>{item}</li>}
    </List>
  );
}
```

## Mutable state

Like many similar frameworks, _pipis_ works best with immutable state. Reactive values that aren't primitives (string, number, boolean etc.) should be updated by replacing the entire object or array rather than modifying it in-place. When using the built-in `reactive` helper, in-place updates won't notify subscribers, and changes are detected with a strict equality check (`===`) so assigning the same value has no effect.

```tsx
function App() {
  const state = reactive({ a: 1, b: 2 });

  //state.value.a = 3; // Bad!
  //state.value = Object.assign(state.value, { a: 3 }); // Also bad, because Object.assign modifies the first argument
  state.value = { ...state.value, a: 3 }; // Good!
}
```

Many state management frameworks, as well as libraries like [immer](https://immerjs.github.io/immer/), provide convenient and robust solutions to this problem.

## Update loops

While _pipis_ does not have a 'render' step that could get into a loop, it is, like any other piece of software, susceptible to a failure mode where one event, directly or indirectly, triggers the same event to be fired, causing an infinite loop which is typically terminated with a stack overflow exception.

The easiest way to cause this is to update a reactive value in the subscription to that same value:

```ts
const foo = reactive(0);
// This will immediately crash:
foo.subscribe(() => foo.value++);
```

A more subtle example would be a component that modifies values which are dependencies of its parent:

```tsx
// This example demonstrates several anti-patterns and serves as an example of what *not* to do!

function BadText({
  text,
  maxLength,
}: {
  text: Reactive<string>;
  maxLength: ReactiveState<number>;
}) {
  return (
    <p>
      <Watch value={text}>{(x) => (maxLength.value = Math.max(maxLength.value, x.length))}</Watch>
      {text}
    </p>
  );
}

function BadComponent() {
  const maxLength = reactive(0);
  // This will immediately crash because of the circular dependency between 'text' and 'maxLength'.
  return <BadText maxLength={maxLength} text={select(maxLength, (n) => "foo".repeat(n))} />;
}
```
