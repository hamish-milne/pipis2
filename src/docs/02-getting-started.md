## Getting started

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

### How it works

JSX works by transforming HTML-like syntax (`<foo bar={baz} />`) into function calls (`jsx("foo", { bar: baz })`). The first argument is either a string representing an HTML tag (if lowercase), or a function representing a custom component (if uppercase).

The result of a JSX expression is a 'JSX Element', which can be anything you like. In _pipis_, it's a function with the signature `(parent?: Node, sibling?: Node | null, shadow?: true) => Node | null`. This function is responsible for rendering the element into the DOM when a parent is provided, and cleaning it up when called without a parent.

For 'intrinsic' elements, a.k.a. HTML tags, _pipis_ creates and persists the corresponding DOM nodes and, on mount, binds any reactive values to the appropriate attributes or content. When the element is unmounted, the bindings are removed, allowing the GC to do its thing.

For custom components, that is any function accepting a 'props' object and returning a JSX Element, we simply call the component function with the provided props. The expression `<Foo />` is identical to `Foo({})`, and you can use them interchangeably.

A fragment (`<>...</>`), representing a collection of child nodes without a wrapping DOM node, is simply an ordinary component called `Fragment` with a custom mount behavior that renders its children into the parent. You can even call it directly if you want.
