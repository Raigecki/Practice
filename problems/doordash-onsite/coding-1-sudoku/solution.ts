import type { Board, BoxShape, Cell, ValidationResult } from "./types";
import { InvalidBoardError } from "./types";

const STANDARD: BoxShape = { boxRows: 3, boxCols: 3 };

/** Part 1. */
export function validateBoard(
  board: Board,
  shape: BoxShape = STANDARD,
): ValidationResult {
  if (
    board.length < 1 ||
    !Number.isInteger(shape.boxCols) ||
    !Number.isInteger(shape.boxRows) ||
    !(
      board.length / shape.boxCols === shape.boxRows &&
      board.length / shape.boxRows === shape.boxCols
    )
  ) {
    throw new InvalidBoardError("Malformed board");
  }

  const invalidCellsMap = new Map<string, number[]>();

  let rowSet = new Map<number, number[]>();
  let colMap = new Map<number, Map<number, number[]>>();
  let boxMap = new Map<string, Map<number, number[]>>();

  for (let i = 0; i < board.length; i++) {
    if (board.length !== board[i].length) {
      throw new InvalidBoardError(
        `Board is not symetrical at row ${i}; ${board.length} x ${board[i].length}`,
      );
    }
    for (let j = 0; j < board[0].length; j++) {
      const value = board[i][j];

      if (value < 0 || value > board.length || !Number.isInteger(value)) {
        throw new InvalidBoardError(`Invalid value at ${i}, ${j}: ${value}`);
      }
      if (value === 0) continue;

      ///////Check rows/////////

      const rowVal = rowSet.get(value);
      if (rowVal) {
        invalidCellsMap.set(`${i},${j}`, [i, j]);
        invalidCellsMap.set(`${rowVal[0]},${rowVal[1]}`, [
          rowVal[0],
          rowVal[1],
        ]);
      }
      rowSet.set(value, [i, j]);

      /////////Check columns/////////

      let currCol = colMap.get(j);
      if (!currCol) {
        currCol = new Map();
        colMap.set(j, currCol);
      }
      const colVal = currCol.get(value);
      if (colVal) {
        invalidCellsMap.set(`${i},${j}`, [i, j]);
        invalidCellsMap.set(`${colVal[0]},${colVal[1]}`, [
          colVal[0],
          colVal[1],
        ]);
      }
      currCol.set(value, [i, j]);

      ///////Check box//////////
      const currBoxCoor = `${Math.trunc(i / shape.boxRows)},${Math.trunc(j / shape.boxCols)}`;
      let currBox = boxMap.get(currBoxCoor);
      if (!currBox) {
        currBox = new Map();
        boxMap.set(currBoxCoor, currBox);
      }
      const boxVal = currBox.get(value);
      if (boxVal) {
        invalidCellsMap.set(`${i},${j}`, [i, j]);
        invalidCellsMap.set(`${boxVal[0]},${boxVal[1]}`, [
          boxVal[0],
          boxVal[1],
        ]);
      }
      currBox.set(value, [i, j]);
    }
    rowSet = new Map();
  }
  return {
    valid: invalidCellsMap.size === 0,
    conflicts: Array.from(invalidCellsMap.values())
      .map((c) => [c[0], c[1]] as Cell)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  };
}

/** Part 2. Returns a new solved board, or null if there is no solution. Never mutates `board`. */
export function solve(board: Board, shape: BoxShape = STANDARD): Board | null {
  throw new Error("Not implemented");
}

/** Part 3. Counts solutions, stopping early once `limit` is reached. */
export function countSolutions(
  board: Board,
  shape: BoxShape = STANDARD,
  limit = Infinity,
): number {
  throw new Error("Not implemented");
}
