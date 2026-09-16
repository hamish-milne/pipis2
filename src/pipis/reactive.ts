import { type Reactive, REACTIVE } from "./core";

/** A {@link Reactive} value with synchronous, always-up-to-date read access via `.value`. */
export type ReactiveReadonly<T> = Reactive<T> & {
  get value(): T;
};

/** A {@link ReactiveReadonly} value that can also be written to via `.value`, notifying subscribers. */
export type ReactiveState<T> = ReactiveReadonly<T> & {
  set value(newValue: T);
};

class ReactiveStateImpl<T> implements ReactiveState<T> {
  declare [REACTIVE]: true;
  declare private _s: ((newValue: T) => void)[];
  declare private _v: T;

  constructor(initialValue: T) {
    this[REACTIVE] = true;
    this._s = [];
    this._v = initialValue;
  }

  get value(): T {
    return this._v;
  }

  set value(newValue: T) {
    if (this._v !== newValue) {
      this._v = newValue;
      for (const callback of this._s) {
        callback(newValue);
      }
    }
  }

  subscribe(callback: (newValue: T) => void) {
    this._s.push(callback);
    callback(this.value);
    const binding_cleanup = () => {
      const index = this._s.indexOf(callback);
      if (index !== -1) {
        this._s.splice(index, 1);
      }
    };
    return binding_cleanup;
  }
}

/** Creates a simple, independently-writable {@link ReactiveState} value. */
export function reactive<T>(initialValue: T): ReactiveState<T> {
  return new ReactiveStateImpl(initialValue);
}

const UNDEFINED = Symbol();

class ReactiveSelect<TIn, TOut> implements ReactiveReadonly<TOut> {
  declare [REACTIVE]: true;
  declare private _i: ReactiveReadonly<TIn>;
  declare private _c: (input: TIn) => TOut;

  constructor(input: ReactiveReadonly<TIn>, compute: (input: TIn) => TOut) {
    this[REACTIVE] = true;
    this._i = input;
    this._c = compute;
  }

  get value(): TOut {
    return this._c(this._i.value);
  }

  subscribe(callback: (newValue: TOut) => void) {
    let prevValue: TOut | typeof UNDEFINED = UNDEFINED;
    const SelectBinding_subscribe = (newValue: TIn) => {
      const newOut = this._c(newValue);
      if (newOut !== prevValue) {
        prevValue = newOut;
        callback(prevValue);
      }
    };
    return this._i.subscribe(SelectBinding_subscribe);
  }
}

/** Derives a read-only reactive value from `input` by applying `compute`, only notifying subscribers when the result actually changes. */
export function select<TIn, TOut>(
  input: ReactiveReadonly<TIn>,
  compute: (input: TIn) => TOut,
): ReactiveReadonly<TOut>;
/** Derives a read-only reactive value by selecting a single property key out of `input`. */
export function select<TIn, TKey extends keyof TIn>(
  input: ReactiveReadonly<TIn>,
  key: TKey,
): ReactiveReadonly<TIn[TKey]>;

export function select<TIn, TOut>(
  input: ReactiveReadonly<TIn>,
  compute: ((input: TIn) => TOut) | keyof TIn,
): ReactiveReadonly<TOut> {
  return new ReactiveSelect(
    input,
    typeof compute === "function" ? compute : (input: TIn) => input[compute] as TOut,
  );
}

class ReactiveConstant<T> implements ReactiveReadonly<T> {
  declare [REACTIVE]: true;
  declare private _v: T;

  constructor(value: T) {
    this[REACTIVE] = true;
    this._v = value;
  }

  get value(): T {
    return this._v;
  }

  subscribe(callback: (newValue: T) => void) {
    callback(this._v);
    return () => {};
  }
}

/** Wraps a static value as a {@link ReactiveReadonly}, for APIs that require a reactive input. */
export function constant<T>(value: T): ReactiveReadonly<T> {
  return new ReactiveConstant(value);
}
