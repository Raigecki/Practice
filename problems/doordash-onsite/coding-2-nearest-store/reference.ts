import type { Store } from "./types";

interface Best {
  name: string;
  distance: number;
}

/**
 * O(n log n) to build, O(1) per query.
 *
 * Group stores by avenue and by street, and sort each group by the other coordinate.
 * Points are unique, so on one line the nearest store is always an immediate neighbour
 * in sorted order. Each store therefore has at most 4 candidates: left/right on its avenue
 * and left/right on its street. Precompute every store's answer once, then answer queries
 * with a map lookup.
 */
export function nearestStores(stores: Store[], queries: string[]): (string | null)[] {
  const best = new Map<string, Best | null>();
  for (const store of stores) best.set(store.name, null);

  const consider = (from: Store, to: Store, distance: number) => {
    const current = best.get(from.name) ?? null;
    if (current === null || distance < current.distance || (distance === current.distance && to.name < current.name)) {
      best.set(from.name, { name: to.name, distance });
    }
  };

  /** Groups stores that share `lineKey`, sorts each group by `posKey`, links neighbours. */
  const linkNeighbours = (lineKey: (s: Store) => number, posKey: (s: Store) => number) => {
    const lines = new Map<number, Store[]>();
    for (const store of stores) {
      const key = lineKey(store);
      const line = lines.get(key);
      if (line) line.push(store);
      else lines.set(key, [store]);
    }
    for (const line of lines.values()) {
      line.sort((a, b) => posKey(a) - posKey(b));
      for (let i = 1; i < line.length; i++) {
        const prev = line[i - 1];
        const curr = line[i];
        const distance = posKey(curr) - posKey(prev);
        consider(prev, curr, distance);
        consider(curr, prev, distance);
      }
    }
  };

  linkNeighbours((s) => s.x, (s) => s.y); // same avenue
  linkNeighbours((s) => s.y, (s) => s.x); // same street

  return queries.map((q) => best.get(q)?.name ?? null);
}
