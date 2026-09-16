/** @jsxRuntime automatic */
/** @jsxImportSource ./pipis */

import { select, reactive } from "./pipis/reactive";
import { ErrorBoundary, Portal, PortalTarget, Repeat, Suspense } from "./pipis/dynamic";
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
  const portalTarget = reactive<Element | undefined>(undefined);

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
      promise={new Promise<string>((resolve) => setTimeout(() => resolve("Some data"), 2000))}
      placeholder=""
      success={(data) => <p>Content loaded successfully: {data}</p>}
      error={(err) => <p>Error: {select(err, (e) => (e as Error)?.message ?? "Unknown error")}</p>}
    >
      <p>Loading...</p>
    </Suspense>
  );
}

export function Main() {
  return (
    <>
      <Counter />
      <TodoApp />
      <PortalExample />
      <ErrorBoundaryExample />
      <SuspenseExample />
    </>
  );
}

Main()(document.body);
