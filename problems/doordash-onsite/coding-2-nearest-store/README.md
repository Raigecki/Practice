# Coding 2: Nearest Store

Read [PROMPT.md](PROMPT.md). Implement in `solution.ts`. Types are in `types.ts`.
`reference.ts` has a working solution (spoilers).

Run: `npx vitest run problems/doordash-onsite/coding-2-nearest-store`

Set a 45-minute timer. Aim to pass every test except `follow-up: performance` within about 25 minutes, then spend the rest on the follow-up.

## Source

This is based on a 2021 onsite report (a reject):

> coding2: A variation of [LeetCode 1779]. Solved it quickly. Interviewer asked for more optimized solution. I gave ideas but he had his own approach in mind which really wasn't optimized in the worst case.
>
> ...didn't expect they would cite something like **code quality** as a reason.
>
> They are machines literally and won't guide you much... They don't want anything short of full solution with all test cases passed.

## What to practice here

- **State the worst case yourself.** The "own approach" in the report was most likely grouping stores by `x` and `y` and scanning each group. That's O(n) per query when everyone is on one line, so O(n·q) overall. Say this out loud before they ask.
- **Code quality was the stated reason for the reject.** Write clear names and small helpers. The `x` branch and the `y` branch are the same logic with the coordinates swapped, so write it once and call it twice. Don't copy and paste it.
- **Edge cases before running anything:** the query is unknown, the store is alone on both lines, ties on distance, ties across the avenue and the street, and the store matching itself.
- **Clarify before coding.** Can two stores share a point? Does a store count as its own match? What does "smallest name" mean? These are decided in the prompt here, but in the real round you'd have to ask.

## Clarifications (decided for these tests)

- No duplicate points or names.
- Names compare with `<`, not `localeCompare`.
- An unknown query returns `null` and doesn't throw.

## Also from the same loop

Coding 1 was **Valid Sudoku** (LC 36) with the follow-up **Sudoku Solver** (LC 37). See [../coding-1-sudoku/](../coding-1-sudoku/).
