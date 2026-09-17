## Comparison with React

Like Preact, DOM event handlers in _pipis_ use the standard names and semantics. So instead of `onClick`, use `onclick`. The `onchange` event is the standard HTML change event instead of an alias for `oninput` like in React.

Instead of _useState_, you use `reactive` to create reactive state variables. Reactive values can come from anywhere; you don't have to define them inside a component.

```tsx
function App() {
  const count = reactive(0);
  return <div>{count}</div>;
}
```

Instead of _useEffect_, you use `Watch` to react to changes in reactive values; or `Effect` to run a side effect when a component is mounted.

```tsx
function App() {
  const count = reactive(0);

  return (
    <>
      <Watch value={count}>
        {(newValue) => {
          console.log("Count changed:", newValue);
        }}
      </Watch>
      <Effect>
        {() => {
          console.log("Component mounted");
          return () => {
            console.log("Component unmounted");
          };
        }}
      </Effect>
    </>
  );
}
```

Instead of _useMemo_, you can use `select` to create derived reactive values. Alternatively, if the source values are all static, you can simply compute the value in the function body.

```tsx
function App() {
  const count = reactive(0);
  const doubleCount = select(count, (value) => value * 2);

  return (
    <div>
      <div>Count: {count}</div>
      <div>Double Count: {doubleCount}</div>
    </div>
  );
}
```

Instead of _createContext_ and _useContext_, use `defineContext` to create a context provider and consumer. Context values are resolved when the element is constructed. You can pass a `Reactive<T>` as the context value if needed.

```tsx
const [withTheme, getTheme] = defineContext(reactive("light"));

function ThemedButton() {
  return <button className={getTheme()}>Themed Button</button>;
}

function App() {
  return withTheme("dark", () => (
    <div>
      <ThemedButton />
    </div>
  ));
}
```

_useCallback_ can usually be omitted entirely: there's no need to memoize functions for performance reasons as in React.

To get a reference to a DOM node, you can use the `ref` prop. The `ref` can be either a function that receives the element or an object with a `value` property that will be set to the element (such as a reactive value). Since DOM nodes are persistent, the reference is set once when the element is constructed and never cleared, and it is guaranteed to be set before the parent element is ever mounted. Just like in React, there is no special handling for `ref` in custom components.

```tsx
function App() {
  const divRef = reactive<HTMLElement | null>(null);

  return <div ref={divRef}>Hello, world!</div>;
}
```
