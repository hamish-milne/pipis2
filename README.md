# pipis

_pipis_ is an ultra-lightweight framework for front-end web development. Write components in JSX, keep state in-line or bind to your favourite state management solution. Weighs less than 1KB.

## Why?

- **Performance by default**. No vDOM, no diffing, no memoization traps. Components update only when their bound state changes.
- **Fully customizable**. Write your own element functions to directly interact with the DOM, and use them alongside conventional components.
- **No hooks**. Component functions get called once, returning an element function that lasts as long as you need it.
- **Extreme simplicity**. Elements are functions: pass a parent node to attach to the DOM, pass nothing to clean them up. Stack traces behave normally. No magic.

## Getting Started

```tsx
// Write components in JSX, static by default:
function MyComponent() {
  return <div>Hello, world!</div>;
}

// Add simple reactive state inline:
import { reactive } from "pipis";
function Counter() {
  const count = reactive(0);
  return (
    <div>
      <button onClick={() => count.value--}>-</button>
      {/* Reactive values can be used as attributes or content */}
      <span>{count}</span>
      <button onClick={() => count.value++}>+</button>
    </div>
  );
}

// Pass anything you like as a prop:
import type { Reactive, ReactiveState } from "pipis";
function TextInput(props: { entry: ReactiveState<string> }) {
  return <input value={props.entry} onchange={(e) => (props.entry.value = e.target.value)} />;
}
function Greeting(props: { name: Reactive<string> }) {
  return <p>Hello, {props.name}!</p>;
}
function App() {
  // There's no performance cost to hoisting reactive state out of the component.
  const text = reactive("");
  return (
    <div>
      <TextInput entry={text} />
      <Greeting name={text} />
    </div>
  );
}

// Mount the app to the DOM
App()(document.body);
```

## How it works

JSX works by transforming HTML-like syntax (`<foo bar={baz} />`) into function calls (`jsx("foo", { bar: baz })`). The first argument is either a string representing an HTML tag (if lowercase), or a function representing a custom component (if uppercase).

The result of a JSX expression is a 'JSX Element', which can be anything you like. In _pipis_, it's a function with the signature `(parent?: Element) => void`. This function is responsible for rendering the element into the DOM when a parent is provided, and cleaning it up when called without a parent.

For 'intrinsic' elements, a.k.a. HTML tags, _pipis_ creates and persists the corresponding DOM nodes and, on mount, binds any reactive values to the appropriate attributes or content. When the element is unmounted, the bindings are removed, allowing the GC to do its thing.

For custom components, that is any function accepting a 'props' object and returning a JSX Element, we simply call the component function with the provided props. The expression `<Foo />` is identical to `Foo({})`, and you can use them interchangeably.

A fragment (`<>...</>`), representing a collection of child nodes without a wrapping DOM element, is simply an ordinary component called `Fragment` with a custom mount behavior that renders its children into the parent. You can even call it directly if you want.

## Reactive bindings

A reactive value is any object that satisfies the following interface:

```ts
interface Reactive<T> {
  // A brand to identify reactive values at runtime
  readonly [REACTIVE]: true;
  // Subscribes to changes in the reactive value and returns a cleanup function to unsubscribe.
  subscribe(callback: (newValue: T) => void): Cleanup;
}
```

You can create simple reactive values using the `reactive` function provided by _pipis_. This returns an object with a `value` property that is both readable and writable, and automatically notifies subscribers when it changes.

The `select` function allows you to create a derived reactive value based on an existing source value. You can either provide a function to compute the derived value, or a key to select a specific property from the input object.

```ts
const state = reactive({ count: 0 });
state.value = { count: 1 };

const count1 = select(state, (s) => s.count);
const count2 = select(state, "count");
```

When you pass a reactive value as an attribute or child of an intrinsic element (a DOM node), _pipis_ will automatically subscribe to changes and update the DOM accordingly.

In custom components, reactive values have no special handling - the props array is passed unmodified to the component function. There is no concept of 're-rendering'; instead, the reactive value is passed all the way down to the leaf components that actually use it. When a change is detected, only the parts of the DOM that depend on the reactive value are updated.

When defining a prop, consider if you want the allowed value to be static (`T`), reactive (`Reactive<T>`), or either (`T | Reactive<T>`). You can check if a value is reactive at runtime with the `isReactive` function. A rule of thumb is to accept both if you're passing a value down the tree without inspecting it, otherwise defaulting to static unless you know the value can change dynamically.

You can create custom reactive values by implementing the `Reactive<T>` interface, which allows binding values to an existing state management framework. For example, the Store object from `zustand/vanilla` already has a `subscribe` function, so all we need to do is set the `[REACTIVE]` property to `true`:

```tsx
import { createStore } from "zustand/vanilla";
import { REACTIVE, select } from "pipis";

const store = createStore((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

const reactiveStore = Object.assign(store, { [REACTIVE]: true });

function App() {
  return (
    <div>
      <p>Count: {select(reactiveStore, (s) => s.count)}</p>
      <button onclick={store.increment}>Increment</button>
    </div>
  );
}
```

## Dynamic UI

Most apps don't use a fully dynamic layout - that is, creating elements of an unknown structure and quantity at runtime. Instead, they have a mostly static structure with dynamic content. _pipis_ is optimized for this common case, allowing you to efficiently update only the parts of the DOM that depend on reactive state.

You can use normal JavaScript branches and loops in your components to render different content based on props or any other variables, but remember that component functions are only called once; simple branches like these are 'static' and don't allow the dynamic addition or removal of elements once the component has been constructed:

```tsx
// The `text` prop is reactive, while the `big` prop is static.
function Header(props: { text: Reactive<string>; big: boolean }) {
  return props.big ? <h1>{props.text}</h1> : <h2>{props.text}</h2>;
}
```

Where the layout of a component does change, it usually fits into one of these common patterns:

1. Conditional rendering, where parts of the UI are added or removed (such as a tabbed interface)
2. List rendering, where a variable number of items is rendered in sequence
3. Reorderable content (such as a sortable list, or a panel layout)

For conditional rendering, you may not need any dynamic layout behaviour at all: consider instead using CSS and `data-*` attributes to show or hide elements with an ordinary binding. A modern browser can efficiently skip over elements with `display: none`, and this may even be more performant as it keeps the DOM structure intact.

```tsx
function App() {
  const isVisible = reactive(true);
  return (
    {/* This example uses Tailwind, but the same effect is achievable with plain CSS */}
    <p className="hidden data-visible:visible" data-visible={isVisible}>
      This paragraph is conditionally visible.
    </p>
  );
}
```

However you can also use the `OneOf` utility to actually mount and unmount elements based on a state value:

```tsx
function App() {
  const tab = reactive("home");
  return (
    <OneOf selector={tab}>
      {{
        home: <div>Home content</div>,
        profile: <div>Profile content</div>,
      }}
    </OneOf>
  );
}
```

For lists, you can use `Repeat` to render a variable number of items:

```tsx
function App() {
  const items = reactive(["Item 1", "Item 2", "Item 3"]);
  return (
    <Repeat count={select(items, "length")}>{(index) => <div>{select(items, index)}</div>}</Repeat>
  );
}
```

Or you can use `List` to render items from an array, with a 'key' function to allow re-ordering:

```tsx
function App() {
  const items = reactive(["Item 1", "Item 2", "Item 3"]);
  return (
    <List items={items} key={(item) => item}>
      {(item) => <div>{item}</div>}
    </List>
  );
}
```

Where all else fails, you can use `Dynamic` to render any content derived from any reactive value. Note that this will completely throw away and recreate the DOM elements whenever the state changes which, naturally, is bad for performance. Consider carefully if one of the more structured patterns above could be used instead.

```tsx
function App() {
  const content = reactive("Initial content");
  return <Dynamic content={content}>{(value) => <div>{value}</div>}</Dynamic>;
}
```

The times where you need to efficiently render a lot of dynamic content are quite rare and specialised (think a text editor or real-time game). For those cases, you can always implement your own render function that directly manipulates the DOM.

```tsx
// Consider a simple text editor where a controller gathers events and forwards them to the view.
// Instead of re-calculating the entire document with every keystroke, we can listen to these events
// and update the DOM incrementally.
function TextEditor() {
  return (parent?: Element) => {
    if (!parent) return;
    parent.onmessage = (event) => {
      switch (event.data.type) {
        case "insert":
          // Add a Text node at the specified position
          break;
        case "delete":
          // Delete the node at the specified position
          break;
      }
    };
  };
}
```

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

_useCallback_ can be omitted entirely because functions can be defined directly in the component body without worrying about unnecessary re-renders.
