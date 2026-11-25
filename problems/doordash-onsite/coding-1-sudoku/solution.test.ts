import { describe, expect, it } from "vitest";
import { countSolutions, solve, validateBoard } from "./solution";
import type { Board, BoxShape } from "./types";
import { InvalidBoardError } from "./types";

/** "53..7...." → [5,3,0,0,7,0,0,0,0] */
const parse = (...rows: string[]): Board => rows.map((row) => [...row].map((ch) => (ch === "." ? 0 : Number(ch))));
const empty = (n: number): Board => Array.from({ length: n }, () => new Array(n).fill(0));
const clone = (b: Board): Board => b.map((row) => [...row]);

const SIX: BoxShape = { boxRows: 2, boxCols: 3 };
const FOUR: BoxShape = { boxRows: 2, boxCols: 2 };

/** Independent checker: complete, every unit is a permutation of 1..n. */
function isSolved(board: Board, { boxRows, boxCols }: BoxShape): boolean {
  const n = boxRows * boxCols;
  const units: number[][] = [];
  for (let i = 0; i < n; i++) {
    units.push(board[i]);
    units.push(board.map((row) => row[i]));
  }
  for (let br = 0; br < n; br += boxRows) {
    for (let bc = 0; bc < n; bc += boxCols) {
      const box: number[] = [];
      for (let r = br; r < br + boxRows; r++) for (let c = bc; c < bc + boxCols; c++) box.push(board[r][c]);
      units.push(box);
    }
  }
  return units.every((u) => u.length === n && [...u].sort((a, b) => a - b).every((v, i) => v === i + 1));
}

function keepsGivens(puzzle: Board, solved: Board): boolean {
  return puzzle.every((row, r) => row.every((v, c) => v === 0 || solved[r][c] === v));
}

const PUZZLE = parse(
  "53..7....",
  "6..195...",
  ".98....6.",
  "8...6...3",
  "4..8.3..1",
  "7...2...6",
  ".6....28.",
  "...419..5",
  "....8..79",
);

const SOLUTION = parse(
  "534678912",
  "672195348",
  "198342567",
  "859761423",
  "426853791",
  "713924856",
  "961537284",
  "287419635",
  "345286179",
);

const SIX_SOLVED = parse("123456", "456123", "231564", "564231", "312645", "645312");

describe("DoorDash onsite coding 1: Sudoku", () => {
  describe("Part 1: validateBoard", () => {
    it("a partially filled valid board", () => {
      expect(validateBoard(PUZZLE)).toEqual({ valid: true, conflicts: [] });
    });

    it("a completely solved board", () => {
      expect(validateBoard(SOLUTION)).toEqual({ valid: true, conflicts: [] });
    });

    it("an empty board is valid", () => {
      expect(validateBoard(empty(9))).toEqual({ valid: true, conflicts: [] });
    });

    it("duplicate in a row", () => {
      const b = clone(PUZZLE);
      b[0][8] = 7; // row 0 already has 7 at col 4
      expect(validateBoard(b)).toEqual({ valid: false, conflicts: [[0, 4], [0, 8]] });
    });

    it("duplicate in a column", () => {
      const b = clone(PUZZLE);
      b[8][0] = 4; // col 0 already has 4 at row 4
      expect(validateBoard(b)).toEqual({ valid: false, conflicts: [[4, 0], [8, 0]] });
    });

    it("duplicate in a box only (different row and column)", () => {
      const b = clone(PUZZLE);
      b[2][0] = 3; // box 0 has 3 at (0,1); row 2 and col 0 have no 3
      expect(validateBoard(b)).toEqual({ valid: false, conflicts: [[0, 1], [2, 0]] });
    });

    it("reports every cell in every conflict, unique and row-major", () => {
      const b = clone(PUZZLE);
      b[0][2] = 5; // row 0 and box 0 with (0,0)
      b[1][1] = 5; // box 0 with (0,0) and (0,2), row 1 with (1,5)
      b[7][8] = 9; // col 8 with (8,8), row 7 with (7,5), box 8 with (8,8)
      expect(validateBoard(b)).toEqual({
        valid: false,
        conflicts: [
          [0, 0],
          [0, 2],
          [1, 1],
          [1, 5],
          [7, 5],
          [7, 8],
          [8, 8],
        ],
      });
    });

    it("works on a 4x4 board with 2x2 boxes", () => {
      expect(validateBoard(parse("12..", "34..", "....", "...."), FOUR).valid).toBe(true);
      expect(validateBoard(parse("12..", "31..", "....", "...."), FOUR)).toEqual({
        valid: false,
        conflicts: [[0, 0], [1, 1]],
      });
    });

    it("works on a 6x6 board with 2x3 boxes (rows x cols)", () => {
      expect(validateBoard(SIX_SOLVED, SIX).valid).toBe(true);
      const b = clone(SIX_SOLVED);
      // Swapping two cells in row 0 keeps the row valid but breaks both columns and boxes.
      [b[0][2], b[0][3]] = [b[0][3], b[0][2]];
      const result = validateBoard(b, SIX);
      expect(result.valid).toBe(false);
      expect(result.conflicts).toContainEqual([0, 2]);
      expect(result.conflicts).toContainEqual([0, 3]);
    });

    it("throws InvalidBoardError for malformed boards", () => {
      expect(() => validateBoard(PUZZLE.slice(0, 8))).toThrow(InvalidBoardError);
      expect(() => validateBoard([...PUZZLE.slice(0, 8), [1, 2, 3]])).toThrow(InvalidBoardError);
      const tooBig = clone(PUZZLE);
      tooBig[4][4] = 10;
      expect(() => validateBoard(tooBig)).toThrow(InvalidBoardError);
      const negative = clone(PUZZLE);
      negative[4][4] = -1;
      expect(() => validateBoard(negative)).toThrow(InvalidBoardError);
      const fraction = clone(PUZZLE);
      fraction[4][4] = 1.5;
      expect(() => validateBoard(fraction)).toThrow(InvalidBoardError);
      expect(() => validateBoard(PUZZLE, FOUR)).toThrow(InvalidBoardError); // 9x9 board, shape says 4x4
    });

    it("does not mutate the board", () => {
      const b = clone(PUZZLE);
      validateBoard(b);
      expect(b).toEqual(PUZZLE);
    });
  });

  describe("Part 2: solve", () => {
    it("solves the standard puzzle", () => {
      expect(solve(PUZZLE)).toEqual(SOLUTION);
    });

    it("does not mutate the input", () => {
      const b = clone(PUZZLE);
      solve(b);
      expect(b).toEqual(PUZZLE);
    });

    it("an already solved board returns an equal copy, not the same object", () => {
      const result = solve(SOLUTION);
      expect(result).toEqual(SOLUTION);
      expect(result).not.toBe(SOLUTION);
    });

    it("returns null when the givens already conflict", () => {
      const b = clone(PUZZLE);
      b[0][8] = 5;
      expect(solve(b)).toBeNull();
    });

    it("returns null when the givens are valid but there is no solution", () => {
      const b = empty(9);
      b[0] = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // (0,8) must be 9...
      b[5][8] = 9; // ...but column 8 already has a 9
      expect(validateBoard(b).valid).toBe(true);
      expect(solve(b)).toBeNull();
    });

    it("fills an empty 4x4 board", () => {
      const result = solve(empty(4), FOUR);
      expect(result).not.toBeNull();
      expect(isSolved(result!, FOUR)).toBe(true);
    });

    it("solves a 6x6 puzzle with 2x3 boxes", () => {
      const puzzle = parse("1...5.", "..61..", "2....4", ".6.2..", "..2..5", "6....2");
      const result = solve(puzzle, SIX);
      expect(result).not.toBeNull();
      expect(isSolved(result!, SIX)).toBe(true);
      expect(keepsGivens(puzzle, result!)).toBe(true);
    });

    it("throws InvalidBoardError for malformed boards", () => {
      expect(() => solve(PUZZLE.slice(0, 8))).toThrow(InvalidBoardError);
    });

    it("solves a very hard puzzle quickly (17 givens)", { timeout: 5000 }, () => {
      const hard = parse(
        "8........",
        "..36.....",
        ".7..9.2..",
        ".5...7...",
        "....457..",
        "...1...3.",
        "..1....68",
        "..85...1.",
        ".9....4..",
      );
      const result = solve(hard);
      expect(result).not.toBeNull();
      expect(isSolved(result!, { boxRows: 3, boxCols: 3 })).toBe(true);
      expect(keepsGivens(hard, result!)).toBe(true);
    });
  });

  describe("Part 3: countSolutions", () => {
    it("a well-formed puzzle has exactly one solution", () => {
      expect(countSolutions(PUZZLE)).toBe(1);
    });

    it("an empty 4x4 board has 288 solutions", () => {
      expect(countSolutions(empty(4), FOUR)).toBe(288);
    });

    it("stops at the limit (an empty 9x9 has ~6.7e21 solutions)", { timeout: 2000 }, () => {
      expect(countSolutions(empty(9), undefined, 2)).toBe(2);
    });

    it("0 for conflicting or unsolvable boards", () => {
      const conflicting = clone(PUZZLE);
      conflicting[0][8] = 5;
      expect(countSolutions(conflicting)).toBe(0);
    });

    it("detects an ambiguous puzzle", () => {
      // Clear rows 0 and 1. Swapping those two whole rows is always another valid solution.
      const b = clone(SOLUTION);
      b[0] = new Array(9).fill(0);
      b[1] = new Array(9).fill(0);
      expect(countSolutions(b, undefined, 2)).toBe(2);
    });

    it("limit 1 behaves like 'is it solvable?'", () => {
      expect(countSolutions(PUZZLE, undefined, 1)).toBe(1);
      const unsolvable = empty(9);
      unsolvable[0] = [1, 2, 3, 4, 5, 6, 7, 8, 0];
      unsolvable[5][8] = 9;
      expect(countSolutions(unsolvable, undefined, 1)).toBe(0);
    });
  });
});
