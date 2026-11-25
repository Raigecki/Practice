import type { Board, BoxShape, Cell, ValidationResult } from "./types";
import { InvalidBoardError } from "./types";

const STANDARD: BoxShape = { boxRows: 3, boxCols: 3 };

/** Throws on a malformed board, returns n. */
function assertWellFormed(board: Board, { boxRows, boxCols }: BoxShape): number {
  const n = boxRows * boxCols;
  if (!Number.isInteger(boxRows) || !Number.isInteger(boxCols) || boxRows < 1 || boxCols < 1) {
    throw new InvalidBoardError(`Bad box shape ${boxRows}x${boxCols}`);
  }
  if (board.length !== n) throw new InvalidBoardError(`Expected ${n} rows, got ${board.length}`);
  board.forEach((row, r) => {
    if (row.length !== n) throw new InvalidBoardError(`Row ${r} has ${row.length} cells, expected ${n}`);
    row.forEach((v, c) => {
      if (!Number.isInteger(v) || v < 0 || v > n) throw new InvalidBoardError(`Bad value ${v} at (${r}, ${c})`);
    });
  });
  return n;
}

const boxIndex = (r: number, c: number, { boxRows, boxCols }: BoxShape, n: number) =>
  Math.floor(r / boxRows) * (n / boxCols) + Math.floor(c / boxCols);

/** O(n^2): one pass, bucketing each filled cell by (unit, value). */
export function validateBoard(board: Board, shape: BoxShape = STANDARD): ValidationResult {
  const n = assertWellFormed(board, shape);
  const seen = new Map<string, Cell[]>();
  const record = (key: string, cell: Cell) => {
    const cells = seen.get(key);
    if (cells) cells.push(cell);
    else seen.set(key, [cell]);
  };

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      record(`row${r}:${v}`, [r, c]);
      record(`col${c}:${v}`, [r, c]);
      record(`box${boxIndex(r, c, shape, n)}:${v}`, [r, c]);
    }
  }

  const conflictIds = new Set<number>();
  for (const cells of seen.values()) {
    if (cells.length > 1) for (const [r, c] of cells) conflictIds.add(r * n + c);
  }
  const conflicts = [...conflictIds].sort((a, b) => a - b).map((id): Cell => [Math.floor(id / n), id % n]);
  return { valid: conflicts.length === 0, conflicts };
}

/**
 * Backtracking with bitmasks per row/col/box, always branching on the empty cell
 * with the fewest candidates (MRV). Calls `onSolution` for each solution; it returns
 * true to stop the search.
 */
function search(board: Board, shape: BoxShape, onSolution: (solved: Board) => boolean): void {
  const n = assertWellFormed(board, shape);
  if (!validateBoard(board, shape).valid) return;

  const grid = board.map((row) => [...row]);
  const rows = new Array<number>(n).fill(0);
  const cols = new Array<number>(n).fill(0);
  const boxes = new Array<number>(n).fill(0);
  const empties: Cell[] = [];
  const full = (1 << (n + 1)) - 2; // bits 1..n

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = grid[r][c];
      if (v === 0) empties.push([r, c]);
      else {
        const bit = 1 << v;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[boxIndex(r, c, shape, n)] |= bit;
      }
    }
  }

  const candidates = (r: number, c: number) => full & ~(rows[r] | cols[c] | boxes[boxIndex(r, c, shape, n)]);
  const popcount = (x: number) => {
    let count = 0;
    while (x) {
      x &= x - 1;
      count++;
    }
    return count;
  };

  /** Returns true when the caller asked to stop. */
  const step = (filled: number): boolean => {
    if (filled === empties.length) return onSolution(grid.map((row) => [...row]));

    // Pick the most constrained remaining cell and swap it into position `filled`.
    let bestIdx = -1;
    let bestCount = Infinity;
    for (let i = filled; i < empties.length; i++) {
      const [r, c] = empties[i];
      const count = popcount(candidates(r, c));
      if (count < bestCount) {
        bestCount = count;
        bestIdx = i;
        if (count <= 1) break;
      }
    }
    if (bestCount === 0) return false;
    [empties[filled], empties[bestIdx]] = [empties[bestIdx], empties[filled]];

    const [r, c] = empties[filled];
    const b = boxIndex(r, c, shape, n);
    let options = candidates(r, c);
    while (options) {
      const bit = options & -options;
      options ^= bit;
      grid[r][c] = 31 - Math.clz32(bit);
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      const stop = step(filled + 1);
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
      grid[r][c] = 0;
      if (stop) return true;
    }
    return false;
  };

  step(0);
}

export function solve(board: Board, shape: BoxShape = STANDARD): Board | null {
  let result: Board | null = null;
  search(board, shape, (solved) => {
    result = solved;
    return true;
  });
  return result;
}

export function countSolutions(board: Board, shape: BoxShape = STANDARD, limit = Infinity): number {
  let count = 0;
  if (limit <= 0) {
    assertWellFormed(board, shape);
    return 0;
  }
  search(board, shape, () => ++count >= limit);
  return count;
}
