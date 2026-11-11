import { twoSum } from "./solution";

// Answer order doesn't matter, so compare sorted.
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe("1. Two Sum", () => {
  describe("basic", () => {
    it("example 1", () => {
      expect(sorted(twoSum([2, 7, 11, 15], 9))).toEqual([0, 1]);
    });

    it("example 2", () => {
      expect(sorted(twoSum([3, 2, 4], 6))).toEqual([1, 2]);
    });
  });

  describe("corner cases", () => {
    it("duplicate values", () => {
      expect(sorted(twoSum([3, 3], 6))).toEqual([0, 1]);
    });

    it("does not reuse the same element", () => {
      expect(sorted(twoSum([3, 2, 4], 6))).not.toEqual([0, 0]);
    });

    it("negative numbers", () => {
      expect(sorted(twoSum([-1, -2, -3, -4, -5], -8))).toEqual([2, 4]);
    });

    it("zeros", () => {
      expect(sorted(twoSum([0, 4, 3, 0], 0))).toEqual([0, 3]);
    });
  });
});
