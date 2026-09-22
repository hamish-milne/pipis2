# Nice extras

## Event target typing

When assigning DOM event handlers as props, the handler type is augmented to include the correct type for `event.target` based on the element type.

```tsx
function App() {
  const entry = reactive("");
  // No need to cast!
  return <input onchange={(e) => (entry.value = e.target.value)} />;
}
```
