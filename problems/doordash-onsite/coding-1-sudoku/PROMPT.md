# Sudoku: Validate, Solve, Count

_Format: 45 minutes, LeetCode style. Part 1 is the warm-up, and Part 2 is the follow-up the interviewer expects you to finish. Part 3 is a bonus if you have time. Hints are rare, and they expect complete, passing code. Don't read ahead._

Based on LeetCode 36 and 37, with changes: any box shape, every conflicting cell reported, malformed input rejected, and no guarantee that a solution exists.

The board is an `n x n` grid of numbers. `0` means empty, otherwise the value is `1..n`. It's divided into boxes of `boxRows x boxCols`, where `n = boxRows * boxCols`. The default is a standard 9x9 with 3x3 boxes. A 6x6 board uses 2x3 boxes, meaning 2 rows by 3 columns.

---

## Part 1: Validate

```ts
validateBoard(board: Board, shape?: BoxShape): { valid: boolean; conflicts: [row, col][] }
```

A board is valid if no value repeats in any **row**, **column** or **box**. Empty cells are ignored, and the board doesn't need to be solvable.

- Return **every** cell involved in any duplicate, each cell once, sorted row-major (by row, then column). The UI uses this list to highlight the bad cells in red.
- If the board is malformed, throw `InvalidBoardError`. Malformed means the wrong number of rows or columns for the shape, or a value that isn't an integer in `0..n`.
- Don't mutate the input.

```
row 0: 5 3 . . 7 . . . 7      ← two 7s
→ { valid: false, conflicts: [[0, 4], [0, 8]] }
```

---

## Part 2: Solve

```ts
solve(board: Board, shape?: BoxShape): Board | null
```

Return a **new** board with every empty cell filled so the board is complete and valid. Keep every given value.

- Return `null` if there's no solution. That covers givens that already conflict, and boards whose givens are valid but lead to a dead end.
- Throw `InvalidBoardError` on malformed input, as in Part 1.
- Don't mutate the input.
- It must solve a hard 9x9 puzzle with 17 givens well within the time limit.

---

## Part 3: Count solutions (bonus)

```ts
countSolutions(board: Board, shape?: BoxShape, limit = Infinity): number
```

A proper puzzle has exactly one solution. Return how many solutions the board has, but **stop searching once you reach `limit`**. An empty 9x9 board has about 6.7 × 10^21 solutions, so `countSolutions(empty, _, 2)` must return 2 immediately.

---

## Discussion

- What's the time complexity of validation? And of solving, in the worst case?
- Your recursion depth: what's the maximum? Could it overflow the stack? (The candidate in the source report hit a stack overflow.)
- How would you speed up the solver? (bitmasks per unit, picking the most constrained cell first, constraint propagation)
- How would you **generate** a puzzle with a unique solution? (Hint: Part 3.)
