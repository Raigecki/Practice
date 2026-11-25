# Coding 1: Sudoku

Read [PROMPT.md](PROMPT.md) one part at a time. Implement in `solution.ts`. Types are in `types.ts`.
`reference.ts` has a working solution (spoilers).

Run: `npx vitest run problems/doordash-onsite/coding-1-sudoku`

Set a 45-minute timer. Target: Part 1 in about 12 minutes, Part 2 passing by about 35. Part 3 only if you have time left.

## Source

From a 2021 onsite report (a reject):

> coding 1: validate sudoku and follow-up solve sudoku. Couldn't solve follow-up in time. Made a small error that was causing stackoverflow, realized after the interview.
>
> They don't want anything short of full solution with all test cases passed. ...cited code quality as a reason.

## What to practice here

- **Leave time for the follow-up.** Part 1 should be fast and clean. The round is really decided by Part 2.
- **Make the recursion obviously terminating.** Recursion depth is at most the number of empty cells (81 for 9x9). A stack overflow there means a recursive call that doesn't advance. Common causes are calling `solve(board)` again on the same cell, or forgetting to move to the next cell when the current one is already filled. Recurse on an explicit index (`k` from `0` to `n*n`) or on a list of empty cells, so every call makes progress.
- **Undo after each try.** Set the cell, recurse, then reset it to 0 if the recursion failed. Most wrong answers come from a missing undo.
- **Reuse code between parts.** If Part 2 and Part 3 each have their own backtracking loop, interviewers mark it down as duplicated code. Write one search function that both use.
- **Generalize the box math once.** The box index is `floor(r / boxRows) * (n / boxCols) + floor(c / boxCols)`. Hard-coding `3` everywhere fails the 4x4 and 6x6 tests on purpose.

## Clarifications (decided for these tests)

- `conflicts` lists every cell in every duplicate. That includes a cell that conflicts in more than one unit, listed once.
- Valid but unsolvable givens return `null`. They don't throw.
- `solve` on an already solved board returns a copy, not the same array.
- Plain backtracking (row-major, checking row, column and box) passes the timed test. Bitmasks and picking the most constrained cell are optional discussion points, not required.
