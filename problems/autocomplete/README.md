# Dish Search (Autocomplete)

_Format: about 60 minutes in an interview, frontend. Parts are revealed one at a time. Don't read ahead._
_Your first attempt will take longer than that, and that's fine. Write down how long each part takes you._

Build a typeahead search box for dishes, the kind that sits at the top of a food delivery app.

Rules:

- No UI or data-fetching libraries. No lodash: write any debounce yourself.
- Use TypeScript (`.tsx`). The `Dish` and `SearchResponse` types are in [src/App.tsx](src/App.tsx).
- Styling doesn't matter, but the active option has to be visibly highlighted.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/search?q=piz` | `{ query, results: Dish[] }`: up to 10 case-insensitive substring matches |

The server is slow in a deliberate way: **shorter queries take longer** (about 900ms for 1 character, about 150ms for 4 or more). The server terminal logs every request with a running count.

Searching for `error` returns a 500.

## Run

```sh
npm install
npm run dev
```

---

## Part 1: Basic search (~15 min)

- A text input. As the user types, fetch results for the current text and show them in a list below.
- Each result shows the dish name and its price as `$12.99`.
- **Bold the part of the name that matches** the query. Searching `chick` shows **Chick**en Katsu.
- States:
  - **empty input:** no list, no request
  - **loading:** a "Searching..." indicator
  - **no matches:** "No dishes match "xyz""
  - **error:** "Something went wrong" (test it by searching `error`)
- Clicking a result fills the input with its name, closes the list, and shows `Selected: {name}` below the input.

> Think: matching is case-insensitive. Make sure your highlighter is too, and that it keeps the original casing.

---

## Part 2: Races and request volume (~20 min)

Type `pizza` quickly, then watch the screen and the server log.

- **Bug to fix:** the list can end up showing results for `p` or `pi` while the input says `pizza`. Find out why, then fix it so **the list always matches the latest query.**
  Name at least two ways to fix it, and their tradeoffs.
- **Debounce:** only fire a request after the user stops typing for **300ms**. Write a `useDebouncedValue(value, ms)` hook yourself.
- Typing `pizza` at normal speed should now produce **one** request (check the log).
- Also abort requests that are no longer needed. An aborted request must not flash the error state.

> Think: debouncing alone doesn't fix the race. Why not? (Hint: what if the user pauses for 350ms halfway through?)

---

## Part 3: Keyboard and accessibility (~20 min)

Make it a real combobox:

- **ArrowDown / ArrowUp** move the active option and wrap around. Moving the mouse over an option also makes it active.
- **Enter** selects the active option, the same as clicking it.
- **Escape** closes the list. Pressing it again clears the input.
- Clicking outside the component closes the list. Focusing the input again reopens it if there are results.
- The active option resets when the results change.
- ARIA:
  - The input has `role="combobox"`, `aria-expanded`, `aria-controls` (pointing to the list) and `aria-autocomplete="list"`.
  - The list has `role="listbox"`, and each option has `role="option"`, a unique `id` and `aria-selected`.
  - The input has `aria-activedescendant` set to the active option's `id`. **Focus stays on the input the whole time.**

> Think: why does focus stay on the input instead of moving onto the options? What would break if it moved?
> Gotcha: clicking an option fires the input's `blur` *before* the option's `click`. If blur closes the list, the click never lands. How do you get around that?

---

## Part 4: Cache and make it reusable (~15 min)

- **Cache** results by query. Retyping a query you've already searched (such as backspacing from `pizz` to `piz`) shows results **instantly with no request** (check the log). Where should the cache live so it survives re-renders but isn't shared by every instance on the page?
- Only search once there are at least **2 characters**. With 1 character, show "Keep typing..."
- Extract a generic, reusable component:

  ```tsx
  <Autocomplete<Dish>
    label="Search dishes"
    fetchOptions={(query, signal) => Promise<Dish[]>}
    getOptionId={(d) => d.id}
    getOptionLabel={(d) => d.name}
    renderOption={(d, { query, active }) => ReactNode}
    onSelect={(d) => void}
  />
  ```

  Then render **two** of them on the page: one for dishes, and one that searches a hard-coded local array of cuisines (wrap the filter in a `Promise`). They must not share cache or state.

> Think: `fetchOptions` is an inline arrow, so it's a new function on every render. If it's in your effect's dependency array, what happens? What are your options?

---

## Follow-up discussion (no code)

- Debounce vs throttle: when would you want throttle for a search box?
- How would you prefetch or "warm" results for likely queries?
- The list has 10,000 results instead of 10. What changes?
- How would you test the race-condition fix without real network timing?
