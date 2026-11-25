import type { Board, BoxShape, ValidationResult } from "./types";
import { InvalidBoardError } from "./types";

const STANDARD: BoxShape = { boxRows: 3, boxCols: 3 };

/** Part 1. */
export function validateBoard(board: Board, shape: BoxShape = STANDARD): ValidationResult {
  throw new Error("Not implemented");
}

/** Part 2. Returns a new solved board, or null if there is no solution. Never mutates `board`. */
export function solve(board: Board, shape: BoxShape = STANDARD): Board | null {
  throw new Error("Not implemented");
}

/** Part 3. Counts solutions, stopping early once `limit` is reached. */
export function countSolutions(board: Board, shape: BoxShape = STANDARD, limit = Infinity): number {
  throw new Error("Not implemented");
}
