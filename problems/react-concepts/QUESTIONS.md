# Questions

_One round at a time. Answer under each `>` line. Mark guesses with `?`._

---

## Round 1: Rendering fundamentals

**1.1** What's the difference between a React **element**, a **component**, and a **node** (`ReactNode`)?

> A component is a function or class that returns UI
> An element is a description of what to render (type, props, key)
> Node is anything that is renderable, element, string, number, boolean, null, array

**1.2** What does JSX compile to? Why must component names start with a capital letter?

> JSX compile calls createElement so it's really just creating DOM nodes based on the JSX structure. lowercasae tags become strings <div> (an html div tag) and Capitalized names become variable references

**1.3** Props vs state: what's the difference, and who "owns" each?

> Props are arguments passed in to a component from the parent and state is a property of a component that
> maintains its value between renders

**1.4** List everything that causes a component to re-render. (A common wrong answer is in this question's answer key. Don't fall for it.)

> A change in state, if a parent rerenders

**1.5** What's the difference between the **render phase** and the **commit phase**? Which one touches the DOM?

> Render phase is when React computes a new element tree and reconciles the difference with the previous one. Commit applies the mionimal dom changes, attaches refs, then runs effects.

**1.6** What does "one-way data flow" mean in React, and how does a child change its parent's data?

> Data should generally flow from parent to child. A child can change parent data by the parent passing down the callback mutator as props or through the use of context

**1.7** Predict what renders when `count` is `0`:

```jsx
<div>{count && <p>You have {count} items</p>}</div>
```

How would you fix it?

> It would render 0 because 0 is not falsy. falsy is false, null, and undefined. Fix it with count > 0 or !!count &&

**1.8** What's the difference between writing `<Header />` and calling `Header()` directly in JSX? Why does it matter?

> <Header /> creates

**1.9** What are Fragments for? When do you need the long form `<Fragment>` instead of `<>`?

> Fragments are used to contain a list of ReactNodes without adding a DOM elements, mostly used when you are returning them from a function or component or inside of tables and lists to not polute the DOM. You use the <Framents> when you need to give it a property like a key

---

## Round 2: State & updates

**2.1** Predict `count` after one click, starting from 0:

```jsx
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
```

Within the same function, the variable count refers to the current state so it will set it to 1 3 times.

What about `setCount(c => c + 1)` three times? And `setCount(count + 5); setCount(c => c + 1);`?

> for `setCount(c => c + 1)` it uses the previous count and sets it to 3
> `setCount(coount + 5)` if only once then it will be 5
> ` setCount(c => c + 1)` if only once then 5 + 1 = 6

**2.2** Predict what this logs, and explain why:

```jsx
function handleClick() {
  setCount(count + 1);
  console.log(count);
}
```

> It will print out current value of count because count still returns to the current value of count during this render.

**2.3** What is **batching**? What changed about it in React 18? How do you opt out?

> Batching updates multiple states within the same tick ( 1 re-render). Before react 18 batching is only for event handlers. After it's all. opt out using `flushSycn(() => setX())`

**2.4** Spot the bug:

```jsx
const [items, setItems] = useState([]);
function add(item) {
  items.push(item);
  setItems(items);
}
```

Why does React need you to not mutate state?

> React compares with Object.is, which in this case compares the reference so while the state did change, there is no rerender.
> use `setItems(prev => [...items, item])`

**2.5** What happens if you call `setState` with the same value it already has?

> Same as for objects Object.is will short out when the value is the same so it won't rerender

**2.6** What's the difference between `useState(computeInitial())` and `useState(() => computeInitial())`?

> The first one will call the function on every render. It really should be inside a useEffect with dependency. The second one is a lazy initializer and only runs on mount.

**2.7** Spot the anti-pattern and fix it:

```jsx
const [first, setFirst] = useState("");
const [last, setLast] = useState("");
const [fullName, setFullName] = useState("");
useEffect(() => setFullName(first + " " + last), [first, last]);
```

> I'm not sure. it's weird though. it's basically saying that fullname has dependnecy on first name and last name. It causes an extra render because we have to set fullName. Instead just calculate it as `const fullName = firstName + lastName`. If it's an expensive calculation, use memo

**2.8** Predict: does the counter's state reset when `isPlayerA` toggles? Why or why not?

```jsx
{
  isPlayerA ? <Counter person="A" /> : <Counter person="B" />;
}
```

Give two ways to make it reset.

> Terinary renders only 1 counter so only the props change but props doesn't neccesarily cause rerender.
> To make it reset, you have to define it twice
> `isPlayerA && <Counter person="A/>`
> `!isPlayerA && <Counter person="B/>`
> or use a key `isPlayerA ? <Counter key="A" person="A" /> : <Counter key="B" person="B" />`
> because the key no longer matches to React destroys the old instance and creates a new one

**2.9** When would you pick `useReducer` over `useState`?

> We use useReducer when the state has a complex structure and multiple variables need to be changed together. It makes the state centralized and testable.

**2.10** You want to store a **function** in state. What goes wrong with `useState(myFn)` and `setHandler(myFn)`, and what's the fix?

>

---

## Round 3: Effects

**3.1** When exactly does a `useEffect` callback run relative to render and paint? When does its cleanup run?

> useEffect runs after reconcilliation (render) and commit

**3.2** Explain the three forms: no dependency array, `[]`, and `[a, b]`. How does React compare dependencies?

> no deps means its every render. [] means the effect runs on mount of that component. `[a, b]` means it runs when a or b changes

**3.3** In development, your effect runs, cleans up, and runs again on mount. Why? What is that telling you?

> `useEffect(() => {
  const conn = connect(roomId)
  return () => conn.disconnect()
}, [roomId])`

the return is not called. react stores it to use when the component unmounts. Else, there will be a leak. Without strict mode, if we have no clean up, we will have 2 connections.

**3.4** Why does this loop forever?

```jsx
const options = { roomId };
useEffect(() => {
  connect(options);
  setStatus("connected");
}, [options]);
```

> option gets set to a new object because we are using the {} object literal which will create a new object every render.

**3.5** What's the bug in this data fetch, and how do you fix it?

```jsx
useEffect(() => {
  fetch(`/api/user/${id}`)
    .then((r) => r.json())
    .then(setUser);
}, [id]);
```

> There is a race condition to setUser because we can't guarantee the requests will finish in order. So, we need to add a variable `let ignore = false`. Then inside of `.then(u => if (!ignore) setUser(u))` and `return () => ignore = true`
> this way each run of useEffect gets its own variable. , So the results from fetch can come After the cleanup. having the dependency on id ensures that between user clicks, the cleanup for the previous request happens. leaving the last click to be the only one where ignore is false?

**3.6** Predict what the counter shows after 5 seconds, and fix it two different ways:

```jsx
useEffect(() => {
  const t = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(t);
}, []);
```

> Oh, i think it'll just be count + 1 right? because before returning it's still the same snapshot?
> so you need `setInterval(() => setCount(prev => prev + 1), 1000`
> or add count to deps so it creates a new interval every tick

**3.7** `useEffect` vs `useLayoutEffect`: what's the difference, and when do you need the layout version?

> useEffect runs after paint asynchronously. useLayoutEffect is synchronous before paint. (Used for tooltip positioning, scroll restoration, etc) It blocks the paint though.

**3.8** Name three situations where you **don't** need an effect, and say what to do instead.

> Derived data - filtering, calculations, etc. Do it in useMemo.
> displaying something based on click - try to use callback functions
> Resetting the state on prop change. use Key or usecallback to parents onChange

**3.9** Why can't you write `useEffect(async () => { ... })`?

> useEffect expects a cleanup or nothing at all. So to define an async function it has to be
> `useEffect(() => { (async() => {}) })`

---

## Round 4: Refs, DOM & forms

**4.1** `useRef` vs `useState`: when do you use each? Does changing `ref.current` re-render?

>

**4.2** When is a DOM ref's `.current` filled in? Why shouldn't you read or write `ref.current` during render?

>

**4.3** How do you pass a ref to a custom function component? How did React 19 change this?

>

**4.4** What is `useImperativeHandle` for?

>

**4.5** Controlled vs uncontrolled inputs: what's the difference, and what causes the "changing an uncontrolled input to be controlled" warning?

>

**4.6** What's a **callback ref**, and what new thing can a callback ref return in React 19?

>

---

## Round 5: Lists, keys & identity

**5.1** What is the `key` prop for? What does React do with it?

>

**5.2** What goes wrong when you use the array index as a key? When is it actually fine?

>

**5.3** What happens with `key={Math.random()}`?

>

**5.4** Do keys need to be globally unique? Can a child component read its own `key` from props?

>

**5.5** Spot the bug and describe the symptom a user would see:

```jsx
function Form() {
  const [text, setText] = useState("");
  function Input() {
    return <input value={text} onChange={(e) => setText(e.target.value)} />;
  }
  return <Input />;
}
```

>

**5.6** You have `<ProfileEditor userId={id} />` and want all its internal state wiped when `id` changes. What's the one-line fix?

>

---

## Round 6: Performance & memoization

**6.1** What does `React.memo` do, and how does it compare props? Why might it do nothing here?

```jsx
<MemoChild style={{ color: "red" }} onClick={() => select(id)} />
```

>

**6.2** `useMemo` vs `useCallback`: what's the difference? Write `useCallback` in terms of `useMemo`.

>

**6.3** When should you **not** reach for `useMemo` / `useCallback`?

>

**6.4** Why can Context cause excessive re-renders? Give three ways to reduce them.

>

**6.5** Without using `memo`, how can you stop a slow child from re-rendering when a parent's unrelated state changes? (Two composition techniques.)

>

**6.6** What is the React Compiler, and what does it change about the previous three questions?

>

**6.7** `useTransition` vs `useDeferredValue`: what problem do they solve, and when do you use each?

>

**6.8** How do you code-split a component in React? What has to wrap it?

>

**6.9** A list of 10,000 rows is slow. What's the standard fix?

>

---

## Round 7: Patterns & architecture

**7.1** What are the Rules of Hooks? _Why_ do they exist? (Mechanism, not "because the linter says so".)

>

**7.2** If two components call the same custom hook `useToggle()`, do they share state?

>

**7.3** HOCs, render props, custom hooks: what problem do they all solve, and why did hooks mostly replace the other two?

>

**7.4** What do error boundaries catch? List **four** things they _don't_ catch. Can you write one with hooks?

>

**7.5** What are Portals for? If a click happens inside a portal, where does the event bubble to?

>

**7.6** What is "lifting state up"? What's the opposite move, and why would you make it?

>

**7.7** How do you decide between local state, Context, and an external store (Redux/Zustand/TanStack Query)? What's the difference between client state and server state?

>

**7.8** What are synthetic events? Where does React actually attach listeners (and what changed in React 17)?

>

**7.9** Composition vs inheritance: how does React reuse UI, and what is a compound component?

>

---

## Round 8: React 18/19, SSR & internals

**8.1** Name the headline features of React 18.

>

**8.2** Name the headline features of React 19.

>

**8.3** What is `use()`, and how is it different from `useContext`?

>

**8.4** Explain `useActionState`, `useFormStatus`, and `useOptimistic` in one sentence each.

>

**8.5** Server Components vs Client Components: what can each do? What does `"use client"` actually mean? Can a Client Component import a Server Component?

>

**8.6** What does `"use server"` mark?

>

**8.7** What is hydration? Name three things that cause a hydration mismatch.

>

**8.8** CSR vs SSR vs SSG vs streaming SSR: one line each, plus a tradeoff.

>

**8.9** What is Suspense, and what can it wait for?

>

**8.10** What is React Fiber, and what did it enable? What does StrictMode do?

>
