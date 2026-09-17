/** @jsxRuntime automatic */
/** @jsxImportSource ./pipis */

import { select, reactive } from "./pipis/reactive";
import {
  ErrorBoundary,
  List,
  Portal,
  PortalTarget,
  Repeat,
  Suspense,
  type PortalTargetValue,
} from "./pipis/dynamic";
import type { JSXElement } from "./pipis/core";

export function Counter() {
  const count = reactive(0);

  return (
    <div>
      <p>{count}</p>
      <button onclick={() => count.value++}>Increment</button>
    </div>
  );
}

export function TodoApp() {
  const todos = reactive<readonly string[]>([]);
  const newTodo = reactive("");

  function todoItem(index: number) {
    return (
      <li>
        {select(todos, (t) => t[index])}
        <button
          onclick={() => {
            todos.value = todos.value.filter((_, i) => i !== index);
          }}
        >
          Remove
        </button>
      </li>
    );
  }

  return (
    <>
      <ul>
        <Repeat count={select(todos, (t) => t.length)}>{todoItem}</Repeat>
      </ul>
      <div>
        <input type="text" value={newTodo} onchange={(e) => (newTodo.value = e.target.value)} />
        <button
          onclick={() => {
            todos.value = [...todos.value, newTodo.value];
            newTodo.value = "";
          }}
        >
          Add Todo
        </button>
      </div>
    </>
  );
}

function PortalExample() {
  const portalTarget = reactive<PortalTargetValue>(undefined);

  return (
    <>
      <div>
        <PortalTarget ref={portalTarget} />
      </div>
      <Portal target={portalTarget}>
        <p>This will be rendered in the portal target</p>
      </Portal>
    </>
  );
}

function ComponentThatThrowsOnMount(): JSXElement {
  return () => {
    throw new Error("ComponentThatThrowsOnMount threw an error on mount");
  };
}

function ErrorBoundaryExample() {
  return (
    <ErrorBoundary
      fallback={(err) => (
        <p>Error: {select(err, (e) => (e as Error)?.message ?? "Unknown error")}</p>
      )}
    >
      <ComponentThatThrowsOnMount />
    </ErrorBoundary>
  );
}

function SuspenseExample() {
  return (
    <Suspense
      promise={() => new Promise<string>((resolve) => setTimeout(() => resolve("Some data"), 2000))}
      placeholder=""
      success={(data) => <p>Content loaded successfully: {data}</p>}
      error={(err) => <p>Error: {select(err, (e) => (e as Error)?.message ?? "Unknown error")}</p>}
    >
      <p>Loading...</p>
    </Suspense>
  );
}

function ListExample() {
  const items = reactive<readonly string[]>(["Item 1", "Item 2", "Item 3"]);

  // Insertion test: every 0.2s, add a new item to the list in a random position
  setInterval(() => {
    const newItem = `Item ${items.value.length + 1}`;
    const index = Math.floor(Math.random() * (items.value.length + 1));
    items.value = [...items.value.slice(0, index), newItem, ...items.value.slice(index)];
    // items.value = [...items.value, newItem];
  }, 1000);

  return (
    <ul>
      <List items={items} itemKey={(item) => item}>
        {(item, index) => <li>{item}</li>}
      </List>
    </ul>
  );
}

export function Main() {
  return (
    <>
      <Counter />
      <TodoApp />
      <ErrorBoundaryExample />
      <PortalExample />
      <SuspenseExample />
      <ListExample />
    </>
  );
}

Main()(document.body);
