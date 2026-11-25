/** n x n grid. 0 = empty, otherwise 1..n. */
export type Board = number[][];

export interface BoxShape {
  /** Rows per box. */
  boxRows: number;
  /** Columns per box. n = boxRows * boxCols. */
  boxCols: number;
}

export type Cell = [row: number, col: number];

export interface ValidationResult {
  valid: boolean;
  /** Every cell involved in a duplicate, unique, sorted row-major. Empty when valid. */
  conflicts: Cell[];
}

/** The board itself is malformed: wrong dimensions, or a value that isn't 0..n. */
export class InvalidBoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBoardError";
  }
}
