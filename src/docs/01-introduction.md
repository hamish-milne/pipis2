## Introduction

_pipis_ is a tiny front-end framework for building UIs in JSX — under 1KB, no virtual DOM, no build magic. Write components like you would in React, but state updates go straight to the DOM node that needs them, nothing else re-runs.

### Why?

- **Fast by default.** No vDOM, no diffing, no memoization to think about. Only the DOM nodes bound to changed state ever update.
- **Under 1KB.** Or if you import absolutely everything, under 2KB gzipped. Your app's code is the bundle.
- **No hooks, no re-renders.** Components run once and return a function that mounts and unmounts them. No dependency arrays, no stale closures, no rules of hooks.
- **Just functions.** An element is a function that inserts its content into the DOM: call it with a parent node to mount, call it with nothing to unmount. Stack traces look normal. Nothing is hidden from you.
- **Bring your own state.** Use the built-in `reactive` helper, or wire up Zustand, RxJS, or anything else with a `subscribe` method.
