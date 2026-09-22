# Cookbook

A collection of patterns and recipies for integrating other libraries with _pipis_.

## Zustand

The Store object from `zustand/vanilla` already has a `subscribe` function, so all we need to do is set the `[REACTIVE]` property to `true`:

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

## HighlightJS

```tsx
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);

export function HighlightJS({ children, language }: { children: string; language?: string }) {
  return (
    <code
      className={language ? `language-${language}` : undefined}
      ref={(el) => {
        el.textContent = children;
        hljs.highlightElement(el);
      }}
    />
  );
}
```
