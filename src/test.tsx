/** @jsxRuntime automatic */
/** @jsxImportSource ./pipis */

import { select, reactive } from "./pipis/reactive";
import { Repeat } from "./pipis/dynamic";

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

export function Main() {
  return (
    <>
      <Counter />
      <TodoApp />
    </>
  );
}

Main()(document.body);
