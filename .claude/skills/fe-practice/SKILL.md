---
name: fe-practice
description: History and coaching notes for the user's frontend interview practice in leet-challenges (React/TS component exercises like the accordion and carousel). Load when creating a new FE exercise, reviewing the user's solution, or when they ask to "check my work" on a problem in problems/.
---

# Frontend practice: history and coaching notes

## How the user likes to practice

- Exercises live in `problems/<name>/` with a `README.md` (parts revealed one at a time, "don't read ahead") and a Vite + React 19 + TS scaffold copied from `problems/doordash-store-cards`.
- They write the code. Claude reviews it when asked to "check my work": read the files, run `npx tsc --noEmit -p .`, and list the bugs with file:line links, blocking issues first.
- Give hints and small snippets, not full solutions, unless they're stuck or ask for one. Explain *why* (they want concepts to stick "100%").
- Be realistic about timings. The accordion README's 15 min/part was too aggressive. Parts 1–2 took them about 2 hours the first time.
- Never commit (see global memory).

## Session log

### 2026-11-04 → 11-09: `problems/doordash-help-accordion` (goal: practice Context)

Compound `<Accordion>` with `Item` / `Trigger` / `Content` / `Toolbar`. Parts 1–4 completed.

Final design:
- Two contexts: `AccordionContext` (accordion-wide state) and `ItemContext` (`value`, `disabled`, `triggerId`, `contentId` from `useId`). Each has a throwing `useXContext()` hook.
- Open state is a `string[]` in both modes. The accordion is controlled when `value !== undefined`, and "nothing open" is `null`.
- `onValueChange` sends the *next* value.
- Props are a discriminated union (`SingleProps | MultipleProps`), with `type: "multiple"` required. Branch on `type === "multiple"`.
- A single item registry in a `useRef` (`{itemId, triggerId, value, disabled}`), registered in `useEffect` with cleanup. A `size` state counter makes the Toolbar's "N of M" re-render.
- Keyboard: `findEnabled(start, dir)` loop with wrap-around that skips disabled triggers. Home/End start at -1 / n.

Concepts learned this session:
- Nearest-provider scoping.
- `ReactNode` vs `JSX.Element`.
- Controlled vs uncontrolled: one source of truth, no syncing.
- `setState` updates on the next render; use the functional updater.
- Correlated-union narrowing in TypeScript.
- `useId` and ARIA (`aria-expanded` on the trigger, `aria-controls`, `role="region"`, `aria-labelledby`).
- Tab order and `tabIndex`.
- Side effects belong in effects, and every effect cleans up.
- Ref vs state.

Known limitations they skipped:
- Registration order vs DOM order. The fix is `querySelectorAll` on the root.
- Closing an outer section unmounts the inner accordion, which resets its state.
- The context value isn't memoized.

Suggested follow-up: rewrite `AccordionContext.tsx` from scratch, timed. The target is Parts 1–2 in about 25 min.

### 2026-11-09: `problems/react-concepts` (trivia drill)

A conceptual Q&A drill with no code. `QUESTIONS.md` has 8 rounds and 68 questions: fundamentals, state, effects, refs/forms, keys, perf, patterns, and React 18/19/SSR. Each round mixes "explain X", "predict the output" and "spot the bug" questions. `ANSWER_KEY.md` is the reference, and bold marks the phrase an interviewer listens for.

Grading flow: they say "check round N", Claude grades each answer ✅/🟡/❌, explains the gaps, and asks 1–2 interviewer-style follow-ups. Record the scores in the README table. Started: (not yet).

### 2026-11-09: `problems/job-board` + `problems/autocomplete` (scaffolded, not started)

GreatFrontEnd-style exercises the user chose to drill **async work, races and effect cleanup**, the gaps the accordion left. Both are scaffolded with `.tsx` (main.tsx and App.tsx) plus their own mock servers (ports 3004 / 3005) that log a running request count.
- **Job Board:** HN-style `/api/jobstories` + `/api/item/:id` with random 100–1200ms delays and an optional `?failRate`. Parts: paginate 6 at a time → order/errors/retry-one-page/no double fetch under StrictMode → `useJobs` hook + AbortController on page-size change → IntersectionObserver infinite scroll (stale closure trap).
- **Autocomplete:** `/api/search?q=`. Shorter queries are slower, so stale responses land last. `q=error` returns a 500. Parts: basic + highlight → race fix + hand-rolled debounce + abort → combobox keyboard/ARIA (`aria-activedescendant`, blur-before-click gotcha) → per-instance cache + generic `<Autocomplete<T>>`.
- Watch for: setting state from aborted requests, missing effect cleanup, `Promise.all` dropping a whole page, and inline `fetchOptions` in deps causing refetch loops.

## Recurring mistakes to watch for

- **Changing the state shape mid-build** (string → Set → Record → array). Push them to decide the shape up front.
- **Truthiness checks where `!== undefined` is meant** (`if (value)`, `!!x`). This broke controlled mode several times.
- **Calling setState or registering during render** instead of in `useEffect`.
- **Discarded return values:** `arr.filter(...)` not assigned, `onClick={() => fn}` not called, `getNext()` result unused.
- **Mutating state in place** (`Set.add` on state) and spreading an array into an object (`{...arr}`).
- **Inverted conditions and swapped directions** (`index !== -1`, ArrowDown passing -1), plus loops missing `step++`.
- **Writing `App.jsx` instead of `.tsx`,** so prop and undefined-variable bugs slip past `tsc`. Suggest `.tsx`.
- **`as` casts** hiding real bugs.
- **Saying "fixed" before saving.** If the code is unchanged, ask them to save and re-check.

## Interview playbook they asked for (reinforce it next time)

1. Clarify the questions that change the design (single/multiple, controlled, a11y level, dynamic items).
2. Write the consumer JSX first, then sketch the context and state shapes as comments.
3. Build in vertical slices and run each one in the browser.
4. When a new requirement lands, ask "what does this need to know, and do I already have it?" so you build one registry, not two.
5. Think out loud, and name the tradeoffs you're skipping.
