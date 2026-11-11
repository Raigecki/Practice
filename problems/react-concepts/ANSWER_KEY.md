# Answer Key

_Don't open this until the round has been graded. **Bold** marks the phrase an interviewer is listening for._

---

## Round 1: Rendering fundamentals

**1.1** A **component** is a function (or class) that returns UI. An **element** is the plain, immutable object a component call or JSX produces (`{ type, props, key }`): a *description* of what to render, not a DOM node. A **node** (`ReactNode`) is anything renderable: elements, strings, numbers, `null`/`undefined`/booleans (these render nothing), arrays, portals.

**1.2** `<Foo a={1}>hi</Foo>` compiles to `jsx(Foo, { a: 1, children: "hi" })` (`React.createElement` before the React 17 automatic runtime). Lowercase tags become **strings** (`"div"`, a host element). Capitalized names become **variable references** (your component). `<foo />` would try to render an unknown HTML tag.

**1.3** **Props** are inputs passed in by the parent. They're read-only to the child, and the parent owns them. **State** is memory owned by the component itself, changed through its setter, and it triggers a re-render. One component's state is often another component's props.

**1.4** A component re-renders when (1) **its own state changes**, (2) **its parent re-renders** (by default, even if the props are identical), or (3) **a context it reads changes**. A custom hook's state changing counts as (1). The common wrong answer is "when its props change": props changing isn't a trigger on its own. The parent re-rendering is. Props only matter when the child is wrapped in `memo`.

**1.5** **Render** is React calling your components to compute the new element tree and diffing it against the previous one (reconciliation). It must be **pure**, and it can be interrupted or repeated in concurrent mode. **Commit** applies the minimal DOM changes, attaches refs, then runs layout effects. Passive effects (`useEffect`) run afterwards. Only commit touches the DOM.

**1.6** Data flows **down** through props. A child can't modify a parent's data directly. The parent passes a **callback** (`onChange`) and the child calls it. This makes data flow predictable and traceable: to find where a value comes from, you walk up the tree.

**1.7** It renders the text **"0"**. `&&` returns its left operand when that operand is falsy, and React renders the number `0`, though it skips `false`, `null` and `undefined`. Fix it with `count > 0 && …`, `!!count && …`, or a ternary `count ? … : null`.

**1.8** `<Header />` creates an element, so React mounts `Header` as **its own component with its own fiber**: its own hooks/state, lifecycle and DevTools entry, and it can bail out of re-rendering. `Header()` just runs the function inline, so its hooks get attached **to the caller**. That breaks the rules of hooks if the call is conditional, and the component has no identity of its own.

**1.9** Fragments group children without adding a wrapper DOM node. That matters inside a `<table>`/`<ul>`, for flex/grid layout, and for not polluting the DOM. Use `<Fragment key={id}>` when you need a **key** (mapping a list where each item returns multiple siblings). The `<>` shorthand can't take props.

---

## Round 2: State & updates

**2.1** The first version gives **1**. Each call uses the same render's snapshot of `count` (0), so it queues "set to 1" three times. Three `c => c + 1` updaters give **3**, because updaters are queued and each one receives the previous result. `setCount(count + 5); setCount(c => c + 1)` gives **6**: "replace with 5", then 5 + 1.

**2.2** It logs the **old** value. State is a **snapshot per render**: `count` is a `const` captured by this render's closure. `setCount` schedules a re-render, and the new value shows up only in the next render's `count`.

**2.3** Batching means multiple state updates in the same tick are grouped into **one re-render**. Before React 18, updates were batched only inside React event handlers. With `createRoot`, React 18 added **automatic batching everywhere**: `setTimeout`, promises, native listeners. To opt out, use `flushSync(() => setX(...))` from `react-dom`.

**2.4** It **mutates** the array, then passes the **same reference** to the setter. React compares with `Object.is`, sees no change, and skips the re-render. Even when something else does cause a render, mutation breaks `memo`, `useMemo` deps and effect deps (they all compare references), and it corrupts previous-render snapshots. Fix: `setItems(prev => [...prev, item])`.

**2.5** React compares with **`Object.is`**. If the value is the same, it **bails out**: children don't re-render and no effects run. (It may still call the component once before bailing out. That's harmless.)

**2.6** `useState(computeInitial())` runs `computeInitial` **on every render**, and every result after the first is thrown away. Passing the function `useState(() => computeInitial())` (or `useState(computeInitial)`) makes it a **lazy initializer** that runs only on mount. Use it for anything expensive, like parsing localStorage or building big structures.

**2.7** This is **derived state**: redundant state plus an effect to keep it in sync. It causes an extra render with a stale value in between, and it's a bug magnet. Fix: compute it during render, `const fullName = first + " " + last;`. If the computation is expensive, wrap it in `useMemo`.

**2.8** **No.** State is tied to a **position in the tree** plus the **component type**. Both branches render `<Counter>` in the same slot, so React treats it as the same component and only the props change. To force a reset: (1) give them different keys, `key="A"` / `key="B"`, or (2) render them in different positions: `{isPlayerA && <Counter … />}{!isPlayerA && <Counter … />}`.

**2.9** Use `useReducer` when **the next state depends on the previous state in non-trivial ways**, when several pieces of state change together, or when you want the update logic **centralized and testable** outside the component (a pure `(state, action) => state` function). Another bonus: `dispatch` is stable, so it's easy to pass down through context.

**2.10** `useState(myFn)` treats `myFn` as a **lazy initializer** and calls it. `setHandler(myFn)` treats it as an **updater** and calls it with the previous state. Either way you end up storing its *return value*. Fix: wrap it, as in `useState(() => myFn)` and `setHandler(() => myFn)`. (A ref is often the better fit anyway.)

---

## Round 3: Effects

**3.1** An effect runs **after the commit**, and normally **after the browser paints** (it doesn't block paint). One nuance: effects from a discrete user input like a click are flushed before the next paint. The **cleanup** runs **before the effect runs again** (with the old closure's values) and **on unmount**.

**3.2** With **no array**, the effect runs after **every** render. With `[]`, it runs on **mount** and cleans up on unmount. With `[a, b]`, it runs on mount and whenever any dependency has changed, compared with **`Object.is`** against the previous render, so a new object or function counts as changed every time.

**3.3** That's **StrictMode** in dev. It mounts, unmounts, and remounts each component to prove **your effect's cleanup correctly undoes its setup**. If the double run causes a bug (two connections, a doubled fetch result, a leaked listener), your cleanup is missing or wrong, and the same bug would hit in production on remounts or fast-refresh. It doesn't happen in production builds.

**3.4** `options` is a **new object every render**, so the dependency always "changes". The effect sets state, which re-renders, which creates a new `options`, which re-runs the effect, forever. Fix: create the object **inside** the effect and depend on the primitive (`[roomId]`), or `useMemo` it.

**3.5** It's a **race condition**. If `id` changes quickly (1 → 2), the response for user 1 can arrive *after* the one for user 2 and overwrite it. The code also never cleans up, so it can set state after unmount. Fix it with a cleanup:

```js
useEffect(() => {
  let ignore = false;               // or AbortController + signal
  fetch(...).then(r => r.json()).then(u => { if (!ignore) setUser(u); });
  return () => { ignore = true; };  // controller.abort()
}, [id]);
```

(In real apps, a data library like TanStack Query, a framework loader, or `use()` + Suspense handles this.)

**3.6** It **shows 1**. The interval's closure captured `count = 0` from the first render, and `[]` means it never re-subscribes, so it keeps setting `0 + 1`. This is a **stale closure**. Fixes: (1) a functional updater, `setCount(c => c + 1)` (best here). (2) Add `count` to the deps, which recreates the interval every tick. (3) Keep the latest value in a ref. (4) In React 19.2+, `useEffectEvent`.

**3.7** `useEffect` runs **after paint**, asynchronously. `useLayoutEffect` runs **synchronously after DOM mutations but before paint**, and it blocks paint. Use the layout version when you need to **measure the DOM and then change it** (tooltip positioning, scroll restoration) without a visible flicker. It's a no-op warning on the server. (`useInsertionEffect` runs even earlier and is meant for CSS-in-JS libraries.)

**3.8** From react.dev's "You Might Not Need an Effect":
- **Derived data** (filtering a list, computing a total): calculate it during render, plus `useMemo` if it's expensive.
- **Responding to a user event** (posting a form, showing a toast after a click): put the logic in the **event handler**, not in an effect watching state.
- **Resetting state when a prop changes**: use a `key`.
- Others: notifying the parent of a change (call `onChange` in the same handler), chains of effects that set state (compute it all in the handler), and fetching on mount (a framework or data library).

Rule of thumb: effects are for **synchronizing with external systems**. If no external system is involved, you probably don't need one.

**3.9** An `async` function returns a **Promise**, but React expects the effect to return **either nothing or a cleanup function**. Define an async function inside and call it, `useEffect(() => { (async () => { … })(); }, [])`, and handle the race with an ignore flag.

---

## Round 4: Refs, DOM & forms

**4.1** Use **state** for values that affect what's rendered. Changing state re-renders. Use a **ref** for a mutable box that persists across renders **without causing re-renders**: DOM nodes, timer IDs, previous values, "latest callback". Changing `ref.current` does **not** re-render, which means the UI won't reflect it.

**4.2** React sets it during the **commit phase**, after the DOM node is created and before layout effects run. On unmount it's set back to `null`. Reading it during render gives you the previous commit's value (or `null` on the first render), and writing it during render makes the component impure and unpredictable. Read and write refs in **effects and event handlers**.

**4.3** Before React 19, you wrapped the component in **`forwardRef((props, ref) => …)`** because `ref` wasn't a normal prop. In **React 19**, function components receive **`ref` as a regular prop**, so `function Input({ ref, ...props })` just works. `forwardRef` will be deprecated.

**4.4** It **customizes what the parent gets** through the ref. Instead of the raw DOM node, you expose a limited imperative API like `{ focus(), scrollIntoView() }`. It's used with the ref passed into a child. Use it sparingly, since props are preferred over imperative APIs.

**4.5** In a **controlled** input, React state is the source of truth: `value={x}` plus `onChange`. In an **uncontrolled** input, the DOM holds the value and you read it through a ref or `FormData`, optionally with `defaultValue`. The warning fires when `value` starts as **`undefined`** (so React treats the input as uncontrolled) and later becomes a string. The fix is to initialize with `""`, not `undefined`/`null`. (This is the same `!== undefined` controlled check you wrote in your Accordion.)

**4.6** A callback ref passes a **function** as `ref`: `ref={node => …}`. React calls it with the node on attach (and, before React 19, with `null` on detach). It's useful for measuring nodes, refs on a dynamic list, or attaching observers. In **React 19** it can **return a cleanup function**, called on detach instead of the `null` call, just like an effect.

---

## Round 5: Lists, keys & identity

**5.1** A key gives each sibling a **stable identity** across renders, so reconciliation can match "this item before" to "this item now". React uses it to **move, insert, or delete** the right DOM nodes and to **keep each item's state** attached to the right item. A different key at the same position means unmount the old component and mount a new one.

**5.2** When items are **reordered, inserted, or removed** (except at the end), index keys tie identity to the *position* rather than the item. **State and DOM state end up on the wrong item**: input text, checkbox state, focus and animations jump between rows. It also causes unnecessary re-renders. Index keys are **fine when the list is static**: it never reorders or filters, and items have no state.

**5.3** Every render produces new keys, so React **unmounts and remounts every item on every render**. All child state is lost, inputs lose focus, and it's slow.

**5.4** No. Keys only need to be **unique among siblings** in the same array. And no, `key` is **not passed as a prop** (`props.key` is `undefined`, and React warns). If the child needs the ID, pass it separately: `<Row key={id} id={id} />`.

**5.5** `Input` is **defined inside `Form`**, so every render of `Form` creates a **new component type**. React sees a different type at that position, **unmounts the old input and mounts a fresh one**. The user sees the **input lose focus after every keystroke**, and any state inside `Input` resets. Fix: define components at module level and pass props, or just inline the JSX.

**5.6** `<ProfileEditor key={id} userId={id} />`. A changed key remounts the component with fresh state, with no reset effect needed.

---

## Round 6: Performance & memoization

**6.1** `React.memo` skips re-rendering a component when its props are **shallowly equal** to the last render's (`Object.is` per prop). You can pass a custom comparator. Here it does nothing, because `{ color: "red" }` and the arrow function are **new references every render**, so the shallow compare always fails. Fix: hoist the constant object out of the component, `useMemo` it, and wrap the callback in `useCallback`.

**6.2** `useMemo(fn, deps)` caches **the result of calling `fn`**. `useCallback(fn, deps)` caches **the function itself**. `useCallback(fn, deps) === useMemo(() => fn, deps)`. Both only help when something downstream compares references: a `memo` child, another hook's deps, or an effect's deps.

**6.3** Don't use them **by default**. Skip them when the computation is cheap, when the consumer isn't memoized (a `useCallback` passed to a non-`memo` child does nothing), or when the deps change every render anyway. They cost memory and comparisons and add noise. **Measure with the Profiler first.**

**6.4** **Every consumer re-renders when the context value changes**, even if it only uses one field, and a provider value like `value={{ a, b }}` is a **new object every render**, so all consumers re-render whenever the provider's parent renders. Mitigations: (1) **`useMemo` the value** (and `useCallback` the functions in it). (2) **Split contexts** (state vs dispatch, or by how often they update). (3) **Move the provider down** to where it's needed. (4) For selector-style subscriptions, use an external store with `useSyncExternalStore` (Zustand, Redux). (This is the "context value isn't memoized" limitation you skipped in the Accordion.)

**6.5** (1) **Move state down**: extract the part that owns the changing state into its own component, so the slow sibling isn't its descendant. (2) **Lift content up / pass children**: `<ColorPicker><SlowTree /></ColorPicker>`. `SlowTree`'s element is created by the *grandparent*, so when `ColorPicker`'s state changes, the `children` prop is the same element reference and React skips it.

**6.6** It's a **build-time compiler** (a Babel plugin, stable in 2025) that **automatically memoizes** components and values: it inserts the equivalent of `memo`/`useMemo`/`useCallback` at a finer grain than you'd write by hand. With it, manual memoization is mostly unnecessary, but it **requires your code to follow the Rules of React** (pure render, no mutation). Code that breaks the rules gets skipped or behaves wrongly.

**6.7** Both mark updates as **non-urgent** so urgent ones (typing, clicking) stay responsive while React renders the expensive update in the background and can interrupt it. **`useTransition`** gives you `[isPending, startTransition]`. Use it when **you own the state setter**: wrap the setter call. **`useDeferredValue(value)`** gives you a lagging copy of a value. Use it when you **only receive the value** (as a prop, say) and can't wrap the update.

**6.8** `const Chart = lazy(() => import("./Chart"))`, rendered inside **`<Suspense fallback={<Spinner />}>`**. The bundler splits the chunk, and it loads the first time the component renders. Route-level splitting is the usual first win.

**6.9** **Virtualization (windowing)**: render only the rows in or near the viewport, using `react-window`, `react-virtuoso` or `@tanstack/react-virtual`. Also: stable keys, memoized rows, pagination or infinite scroll.

---

## Round 7: Patterns & architecture

**7.1** Rules: **(1) call hooks only at the top level**, not in conditions, loops or after early returns. **(2) Call them only from React function components or custom hooks.** Why: React doesn't know hooks by name. It stores each component's hook state as a **list ordered by call order** on the fiber, and on each render it matches the 1st `useState` call to slot 1, and so on. If a condition skips a call, every later hook reads the wrong slot. (`use()` is the exception to rule 1.)

**7.2** **No.** Custom hooks share **logic**, not state. Each call creates its own independent state, exactly as if the hook's body were pasted into each component. To share state, lift it up, or use context or an external store.

**7.3** All three solve **reusing stateful logic across components**. HOCs (`withAuth(Comp)`) cause wrapper hell, prop name collisions and implicit dependencies, and they're hard to type. Render props cause nesting pyramids. **Hooks** compose as plain function calls, add no extra tree nodes, and make data flow explicit (`const user = useAuth()`). HOCs and render props still show up in older libraries.

**7.4** Error boundaries catch errors thrown **during rendering, in lifecycle methods, and in constructors** of the tree below them, then render a fallback. They **don't** catch errors in: **event handlers**, **async code** (`setTimeout`, promises), **server-side rendering**, or **the boundary itself**. **No hooks API**: an error boundary must be a **class** component (`static getDerivedStateFromError` + `componentDidCatch`), or you use the `react-error-boundary` library. For event handler errors, use try/catch, or set state to rethrow during render.

**7.5** Portals render children **into a different DOM node** (`createPortal(child, document.body)`) for modals, tooltips and toasts, escaping `overflow: hidden` and z-index stacking contexts. The event **bubbles through the React tree, not the DOM tree**, so a parent component's `onClick` fires even though the DOM node lives elsewhere. Context works through portals too.

**7.6** **Lifting state up** moves state to the closest common ancestor so siblings can share it. The parent passes the value and a setter down. The opposite is **colocation / pushing state down**: keep state as close as possible to where it's used, so fewer components re-render and the code is easier to reason about. Lift only as high as needed.

**7.7** **Local state** first. **Context** for low-frequency, widely needed values (theme, auth user, locale) or for avoiding prop drilling in a subtree, like compound components. **An external store** (Zustand/Redux) for frequently updated, app-wide client state where you need selector subscriptions or devtools. **Server state** (data from an API: cached, shared, it goes stale and needs refetching) belongs in **TanStack Query/SWR or framework loaders**, not hand-rolled in context. Client state means UI state the app owns entirely, like open modals or form drafts.

**7.8** `SyntheticEvent` is React's **cross-browser wrapper** around native events, with the same interface (`stopPropagation`, `preventDefault`, plus `e.nativeEvent`). React uses **event delegation**: one listener per event type at the root. **Since React 17 it's attached to the root container** (`createRoot`'s node), not `document`, so multiple React versions or apps can coexist. React 17 also **removed event pooling**, so you can read `e.target` asynchronously now.

**7.9** React favours **composition**: components accept `children` or other elements as props ("slots") and are combined, instead of extending base classes. A **compound component** is a set of components that work together and share implicit state through context, like `<Accordion><Accordion.Item><Accordion.Trigger/>…`. That's exactly what you built.

---

## Round 8: React 18/19, SSR & internals

**8.1** React 18: **`createRoot`** (opts into concurrent rendering), **automatic batching**, **transitions** (`useTransition`, `useDeferredValue`), **Suspense on the server** with **streaming SSR** (`renderToPipeableStream`) and **selective hydration**, new hooks **`useId`**, **`useSyncExternalStore`** and `useInsertionEffect`, and stricter StrictMode (double effects).

**8.2** React 19: **Actions** (async functions in transitions, `<form action={fn}>`), **`useActionState`**, **`useFormStatus`**, **`useOptimistic`**, the **`use()`** API, **`ref` as a prop** (no `forwardRef`), **`<Context>` as a provider** (no `.Provider`), **ref cleanup functions**, **document metadata** (`<title>`/`<meta>` hoisted to `<head>`), stylesheet/script support and preloading APIs, **Server Components and Server Actions** stable, and better hydration error diffs. The React Compiler shipped separately.

**8.3** `use(resource)` reads a **Promise** (suspends until it resolves, integrating with Suspense and error boundaries) or a **Context**. Unlike every other hook, it **can be called conditionally** and inside loops, though still only during render, not in event handlers. `useContext` can only read context and must follow the top-level rule.

**8.4** **`useActionState(action, initial)`** wraps an action and returns `[state, formAction, isPending]`, so the action's return value becomes state (e.g. form errors). **`useFormStatus()`** (from `react-dom`), called in a child of a `<form>`, gives `{ pending, data, method, action }` for that form's submission (e.g. disabling a submit button). **`useOptimistic(state, updateFn)`** shows a temporary optimistic value while an async action is in flight, and it automatically reverts to the real state when the action finishes or fails.

**8.5** **Server Components** run only on the server (or at build time). They can be `async`, read databases and secrets directly, and **ship zero JS**, but they **can't use state, effects, event handlers or browser APIs**. **Client Components** are the normal React you know: interactive, with hooks. They're prerendered on the server and hydrated in the browser. `"use client"` marks a **boundary**: this module and everything it imports become part of the client bundle. It doesn't mean "client-only rendering". A Client Component **can't import** a Server Component, but it **can receive one as `children`/props** from a Server parent.

**8.6** `"use server"` marks **Server Functions (Server Actions)**: async functions that run on the server but **can be called from the client** (as a form `action`, or invoked directly). The framework turns them into an RPC endpoint. It is **not** how you mark Server Components (those are the default). Treat their arguments as untrusted input: validate and authorize them.

**8.7** **Hydration** means taking server-rendered HTML and attaching React to it in the browser: rebuilding the component tree, wiring up event handlers and effects, and expecting the first client render to **match the server HTML exactly**. Mismatch causes: **`Date.now()`/`Math.random()`** in render, **`typeof window` / `localStorage` branches** in render, **locale or timezone formatting** differences, **invalid HTML nesting** (`<div>` inside `<p>`), and browser extensions modifying the DOM. Fixes: move it into `useEffect`, use `useId`, or `suppressHydrationWarning` for unavoidable text.

**8.8** **CSR**: an empty HTML shell, and JS renders everything. Cheap hosting, but a slow first paint and poor SEO. **SSR**: HTML is rendered on the server per request, then hydrated. Fast first paint and SEO, but server cost, TTFB, and the page isn't interactive until hydration. **SSG**: HTML is rendered at build time and served from a CDN. Fastest, but stale until a rebuild (ISR mitigates that). **Streaming SSR**: the server sends the HTML shell immediately and streams in Suspense boundaries as their data resolves, with **selective hydration** prioritizing what the user interacts with. Better TTFB, but more complexity.

**8.9** Suspense lets a component **"wait" declaratively**. While something inside a `<Suspense fallback>` boundary isn't ready, React shows the nearest fallback. It can wait for **lazy-loaded code** (`React.lazy`), **data** through Suspense-enabled sources (`use(promise)`, Relay, TanStack Query's suspense mode, framework loaders and RSC), and server **streaming**. It does **not** detect a plain `fetch` inside `useEffect`.

**8.10** **Fiber** is the reconciler rewrite from React 16. Each component instance is a **fiber node** (a unit of work holding its type, props, state, hook list and links to child/sibling/parent), so rendering can be **split into chunks, paused, prioritized, resumed or thrown away**. That made **concurrent rendering, transitions, Suspense and error boundaries** possible. The old stack reconciler was recursive and synchronous, so it couldn't be interrupted. **StrictMode** (dev only) **double-invokes render functions and initializers** to surface impurity, **mounts → unmounts → remounts** to verify effect and ref cleanup, and warns about deprecated APIs.

---

**Sources:**
- [GreatFrontEnd top React questions](https://github.com/greatfrontend/top-reactjs-interview-questions)
- [sudheerj/reactjs-interview-questions](https://github.com/sudheerj/reactjs-interview-questions)
- [GreatFrontEnd: 100+ React interview questions (2026)](https://www.greatfrontend.com/blog/100-react-interview-questions-straight-from-ex-interviewers)
- react.dev: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect), [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state), [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates), [React 19 release post](https://react.dev/blog/2024/12/05/react-19)
- [r/reactjs: senior interview prep thread](https://redlib.hackliberty.org/r/reactjs/comments/1eot251/interview_prep_for_a_senior_frontend_developer)
