import { describe, expect, it } from "vitest";
import { nearestStores } from "./solution";
import type { Store } from "./types";

const s = (name: string, x: number, y: number): Store => ({ name, x, y });

/** Deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** O(n * q) oracle. */
function bruteForce(stores: Store[], queries: string[]): (string | null)[] {
  const byName = new Map(stores.map((st) => [st.name, st]));
  return queries.map((q) => {
    const me = byName.get(q);
    if (!me) return null;
    let bestName: string | null = null;
    let bestDist = Infinity;
    for (const other of stores) {
      if (other.name === me.name) continue;
      if (other.x !== me.x && other.y !== me.y) continue;
      const d = Math.abs(other.x - me.x) + Math.abs(other.y - me.y);
      if (d < bestDist || (d === bestDist && bestName !== null && other.name < bestName)) {
        bestDist = d;
        bestName = other.name;
      }
    }
    return bestName;
  });
}

function randomStores(n: number, range: number, rand: () => number): Store[] {
  const seen = new Set<string>();
  const out: Store[] = [];
  while (out.length < n) {
    const x = Math.floor(rand() * range) - Math.floor(range / 2);
    const y = Math.floor(rand() * range) - Math.floor(range / 2);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s(`store-${out.length}-${Math.floor(rand() * 1000)}`, x, y));
  }
  return out;
}

describe("DoorDash onsite coding 2: Nearest Store", () => {
  describe("examples", () => {
    it("example 1", () => {
      const stores = [s("c1", 3, 3), s("c2", 2, 2), s("c3", 1, 3)];
      expect(nearestStores(stores, ["c1", "c2", "c3"])).toEqual(["c3", null, "c1"]);
    });

    it("example 2", () => {
      const stores = [s("fast", 0, 0), s("burger", 0, 4), s("pho", 3, 0), s("taco", 3, 4)];
      expect(nearestStores(stores, ["fast", "taco"])).toEqual(["pho", "burger"]);
    });
  });

  describe("rules", () => {
    it("only stores on the same avenue or street count, even if another is closer", () => {
      const stores = [s("home", 0, 0), s("diagonal", 1, 1), s("far", 0, 100)];
      expect(nearestStores(stores, ["home"])).toEqual(["far"]);
    });

    it("a nearer store beats a lexicographically smaller one", () => {
      const stores = [s("q", 0, 0), s("aaa", 0, 10), s("zzz", 0, 3)];
      expect(nearestStores(stores, ["q"])).toEqual(["zzz"]);
    });

    it("ties on distance break by smaller name", () => {
      const stores = [s("q", 0, 0), s("zed", 0, 5), s("abe", 5, 0)];
      expect(nearestStores(stores, ["q"])).toEqual(["abe"]);
    });

    it("ties on both sides of the same street", () => {
      const stores = [s("mid", 0, 2), s("up", 0, 3), s("down", 0, 1)];
      expect(nearestStores(stores, ["mid"])).toEqual(["down"]);
    });

    it("names compare by code unit, not locale (uppercase sorts before lowercase)", () => {
      const stores = [s("q", 0, 0), s("apple", 0, 1), s("Banana", 1, 0)];
      expect(nearestStores(stores, ["q"])).toEqual(["Banana"]);
    });

    it("a store never matches itself", () => {
      expect(nearestStores([s("solo", 7, 7)], ["solo"])).toEqual([null]);
    });

    it("unknown query names return null", () => {
      expect(nearestStores([s("a", 0, 0), s("b", 0, 1)], ["ghost", "a"])).toEqual([null, "b"]);
    });

    it("handles negative coordinates", () => {
      const stores = [s("a", -5, -5), s("b", -5, 10), s("c", -20, -5)];
      expect(nearestStores(stores, ["a", "b", "c"])).toEqual(["b", "a", "a"]);
    });

    it("keeps query order and allows repeats", () => {
      const stores = [s("a", 0, 0), s("b", 0, 2), s("c", 9, 9)];
      expect(nearestStores(stores, ["c", "b", "a", "b"])).toEqual([null, "a", "b", "a"]);
    });

    it("empty inputs", () => {
      expect(nearestStores([], [])).toEqual([]);
      expect(nearestStores([], ["x"])).toEqual([null]);
      expect(nearestStores([s("a", 0, 0)], [])).toEqual([]);
    });

    it("handles large coordinates", () => {
      const stores = [s("a", 1e9, -1e9), s("b", 1e9, 1e9), s("c", -1e9, -1e9)];
      expect(nearestStores(stores, ["a", "b", "c"])).toEqual(["b", "a", "a"]);
    });
  });

  describe("randomized vs brute force", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      it(`seed ${seed}`, () => {
        const rand = rng(seed);
        const stores = randomStores(800, 40, rand);
        const queries = shuffle(stores.map((st) => st.name), rand);
        queries.push("missing");
        expect(nearestStores(stores, queries)).toEqual(bruteForce(stores, queries));
      });
    }
  });

  describe("follow-up: performance (n = q = 100,000)", () => {
    it("every store on one avenue (worst case for scanning each line)", { timeout: 3000 }, () => {
      const rand = rng(42);
      const n = 100_000;
      const ys = shuffle(Array.from({ length: n }, (_, i) => i * 3), rand);
      const stores = ys.map((y, i) => s(`s${i}`, 0, y));
      const queries = stores.map((st) => st.name);
      const result = nearestStores(stores, queries);
      expect(result).toHaveLength(n);
      // Spot-check against the brute force on a few queries.
      const sample = [queries[0], queries[777], queries[n - 1]];
      expect(sample.map((q) => result[queries.indexOf(q)])).toEqual(bruteForce(stores, sample));
    });

    it("half on one avenue, half on one street", { timeout: 3000 }, () => {
      const rand = rng(7);
      const half = 50_000;
      const stores: Store[] = [];
      for (let i = 1; i <= half; i++) stores.push(s(`v${i}`, 0, i * 2));
      for (let i = 1; i <= half; i++) stores.push(s(`h${i}`, -i * 2, 0));
      shuffle(stores, rand);
      const queries = stores.map((st) => st.name);
      const result = nearestStores(stores, queries);
      const at = (name: string) => result[queries.indexOf(name)];
      expect(at("v1")).toBe("v2"); // (0,2): v2 at (0,4) dist 2. h1 is (-2,0), not on its line.
      expect(at("h1")).toBe("h2");
      expect(at("v25000")).toBe("v24999");
    });
  });
});
