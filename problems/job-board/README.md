# Job Board

_Format: about 60 minutes in an interview, frontend. Parts are revealed one at a time. Don't read ahead._
_Your first attempt will take longer than that, and that's fine. Write down how long each part takes you._

Build a job board that loads postings from a Hacker-News-style API, a few at a time.

Rules:

- No data-fetching libraries (no React Query or SWR). Use `fetch` with React state and effects.
- Use TypeScript (`.tsx`). The `Job` type is in [src/App.tsx](src/App.tsx).
- Styling doesn't matter beyond being readable.

## What it looks like

A vertical list of simple cards (a `<ul>` of `<li>`s is fine), with a button underneath:

```
Job Board
┌──────────────────────────────────────────────────┐
│ Parcelwise is hiring a Senior Frontend Engineer ↗│  ← title, a link if url exists
│ By parcelwise · 11/11/2026, 9:14:02 AM           │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ Lumen Labs is hiring a Product Designer          │
│ By lumenlabs · 11/11/2026, 7:44:02 AM            │
└──────────────────────────────────────────────────┘
  ... (6 per page)

[ Load more jobs ]
```

The id list is deliberately separate from the job details, the same as the real Hacker News API: fetch all the ids once, then fetch each job in the current page by its id.

## API

The mock server runs alongside Vite. `/api` is proxied to it.

| Endpoint | Returns |
| --- | --- |
| `GET /api/jobstories` | `number[]`: all job ids, newest first (40 of them) |
| `GET /api/item/:id` | `Job` |

Each item request has a **random delay of 100–1200ms**, so responses come back in random order. The server terminal logs every request with a counter. Keep an eye on it.

Optional query params for any endpoint: `?delay=ms` sets a fixed delay, and `?failRate=0.3` makes about 30% of requests return a 500.

## Run

```sh
npm install
npm run dev
```

---

## Part 1: Load and paginate (~20 min)

- On load, fetch the job ids, then fetch and show the **first 6** jobs.
- Each job shows:
  - its **title**, as a link that opens in a new tab if the job has a `url`, otherwise plain text
  - **"By {by} · {date}"**, with the date formatted by `toLocaleString()` (note that `time` is in seconds)
- A **"Load more jobs"** button below the list fetches and appends the next 6.
- While a page is loading, the button says "Loading..." and is disabled.
- Hide the button when there are no more jobs.
- Show a loading state on first load (before any jobs appear).

> Think: what state do you need? Write the shapes down before you write any JSX.
> Hint: is the list of ids the same kind of state as the list of loaded jobs?

---

## Part 2: Make it robust (~20 min)

Turn on `?failRate=0.3` for your **item** requests.

- **Order:** jobs must always render in id order (newest first), however their responses arrive. Check that yours already does, and explain why it does or doesn't.
- **Errors:** if any item in a page fails, show an error message with a **Retry** button. Retry refetches **only that page**. Jobs that already loaded stay on screen, and nothing is duplicated.
- If the ids request fails, show an error with Retry too.
- **No double fetches:**
  - Clicking "Load more" quickly several times must load exactly one page.
  - StrictMode (already on in `main.tsx`) mounts effects twice in dev. The first page must still be fetched and shown **once**, so check the server log.

> Think: `Promise.all` vs `Promise.allSettled`. Which do you want here, and why?

---

## Part 3: Extract a hook and clean up (~15 min)

- Move all the fetching and pagination logic into a `useJobs(pageSize)` hook in `src/useJobs.ts`. `App` should only render.
  Decide on the hook's return shape yourself and be ready to justify it.
- Add a **page size selector** (6 / 10 / 20). Changing it resets the list and starts again from the first page.
- If the page size changes **while a page is in flight**, the old responses must not leak into the new list. Use an `AbortController`, and make sure an aborted request doesn't show as an error.
- Unmounting mid-fetch must not set state or log errors. (Add a temporary "hide board" toggle to test this.)

> Think: what exactly goes in the effect's dependency array, and what does its cleanup do?

---

## Part 4: Infinite scroll (~15 min)

- Replace the button with **infinite scroll**: when a sentinel element below the list scrolls into view, load the next page.
- Use `IntersectionObserver`, not scroll events.
- It must not fire a second load while one is in flight, or after the last page.
- Disconnect the observer on cleanup.
- Keep a "Load more" button as a fallback for keyboard and screen-reader users. Should it stay visible, or be visually hidden?

> Think: your observer callback reads `loading` and `hasMore`. Will it see the current values or stale ones? How do you know?

---

## Follow-up discussion (no code)

- How would you show "3 new jobs posted. Show them" if new ids appear at the top while the user is scrolled down?
- 40 ids today, 4,000 tomorrow. What breaks first, and what would you change?
- When would you reach for React Query instead, and what does it give you that you just built by hand?
