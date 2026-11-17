import { ConsistentHashRing, fnv1a, NoHealthyNodesError, RoundRobinBalancer } from "./solution";

const take = (lb: RoundRobinBalancer, n: number) => Array.from({ length: n }, () => lb.next());

function balancer(...ids: string[]) {
  const lb = new RoundRobinBalancer();
  ids.forEach((id) => lb.addNode(id));
  return lb;
}

/** Independent brute-force owner lookup, used as the oracle for the ring. */
function expectedOwner(nodes: string[], replicas: number, key: string): string {
  const points = nodes
    .flatMap((id) => Array.from({ length: replicas }, (_, r) => ({ hash: fnv1a(`${id}#${r}`), id })))
    .sort((a, b) => a.hash - b.hash);
  const h = fnv1a(key);
  return (points.find((p) => p.hash >= h) ?? points[0]).id;
}

describe("Debugging: Load Balancer", () => {
  describe("RoundRobinBalancer", () => {
    it("rotates through nodes in order and wraps around", () => {
      expect(take(balancer("a", "b", "c"), 7)).toEqual(["a", "b", "c", "a", "b", "c", "a"]);
    });

    it("single node always returns that node", () => {
      expect(take(balancer("only"), 3)).toEqual(["only", "only", "only"]);
    });

    it("skips unhealthy nodes", () => {
      const lb = balancer("a", "b", "c");
      lb.markDown("b");
      expect(take(lb, 4)).toEqual(["a", "c", "a", "c"]);
    });

    it("a node marked up rejoins the rotation", () => {
      const lb = balancer("a", "b");
      lb.markDown("b");
      expect(take(lb, 2)).toEqual(["a", "a"]);
      lb.markUp("b");
      expect(take(lb, 2)).toEqual(["b", "a"]);
    });

    it("throws NoHealthyNodesError when every node is down", () => {
      const lb = balancer("a", "b");
      lb.markDown("a");
      lb.markDown("b");
      expect(() => lb.next()).toThrow(NoHealthyNodesError);
    });

    it("throws NoHealthyNodesError when empty", () => {
      expect(() => new RoundRobinBalancer().next()).toThrow(NoHealthyNodesError);
    });

    it("adding the same node twice doesn't double its share", () => {
      const lb = balancer("a", "b", "a");
      expect(lb.size()).toBe(2);
      expect(take(lb, 4)).toEqual(["a", "b", "a", "b"]);
    });

    it("removing an already-served node doesn't skip the next one", () => {
      const lb = balancer("a", "b", "c");
      expect(take(lb, 2)).toEqual(["a", "b"]);
      lb.removeNode("a");
      expect(take(lb, 3)).toEqual(["c", "b", "c"]);
    });

    it("removing the node that was up next moves on to the following node", () => {
      const lb = balancer("a", "b", "c");
      expect(take(lb, 1)).toEqual(["a"]);
      lb.removeNode("b");
      expect(take(lb, 3)).toEqual(["c", "a", "c"]);
    });

    it("removing the last node in the list wraps correctly", () => {
      const lb = balancer("a", "b", "c");
      expect(take(lb, 2)).toEqual(["a", "b"]);
      lb.removeNode("c");
      expect(take(lb, 2)).toEqual(["a", "b"]);
    });

    it("stays fair over many calls", () => {
      const lb = balancer("a", "b", "c");
      const counts: Record<string, number> = {};
      for (const id of take(lb, 300)) counts[id] = (counts[id] ?? 0) + 1;
      expect(counts).toEqual({ a: 100, b: 100, c: 100 });
    });
  });

  describe("ConsistentHashRing", () => {
    const keys = Array.from({ length: 2_000 }, (_, i) => `order-${i}`);

    it("matches a brute-force lookup for every key (including wrap-around)", () => {
      const ring = new ConsistentHashRing(3);
      ["a", "b", "c"].forEach((n) => ring.addNode(n));
      for (const key of keys) {
        expect(ring.getNode(key)).toBe(expectedOwner(["a", "b", "c"], 3, key));
      }
    });

    it("a key hashing past the last point wraps to the first point", () => {
      const ring = new ConsistentHashRing(1);
      ring.addNode("a");
      ring.addNode("b");
      const maxPoint = Math.max(fnv1a("a#0"), fnv1a("b#0"));
      const key = keys.find((k) => fnv1a(k) > maxPoint)!;
      expect(key).toBeDefined();
      expect(ring.getNode(key)).toBe(expectedOwner(["a", "b"], 1, key));
    });

    it("removing a node removes all of its virtual nodes", () => {
      const ring = new ConsistentHashRing(50);
      ["a", "b", "c"].forEach((n) => ring.addNode(n));
      ring.removeNode("b");
      expect(keys.some((k) => ring.getNode(k) === "b")).toBe(false);
    });

    it("removing a node only moves that node's keys", () => {
      const ring = new ConsistentHashRing(50);
      ["a", "b", "c"].forEach((n) => ring.addNode(n));
      const before = new Map(keys.map((k) => [k, ring.getNode(k)]));
      ring.removeNode("b");
      for (const key of keys) {
        if (before.get(key) !== "b") expect(ring.getNode(key)).toBe(before.get(key));
      }
    });

    it("spreads keys roughly evenly with virtual nodes", () => {
      const ring = new ConsistentHashRing(100);
      ["a", "b", "c"].forEach((n) => ring.addNode(n));
      const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
      for (const key of keys) counts[ring.getNode(key)]++;
      for (const n of Object.values(counts)) {
        expect(n).toBeGreaterThan(keys.length * 0.2);
        expect(n).toBeLessThan(keys.length * 0.47);
      }
    });

    it("throws when empty", () => {
      expect(() => new ConsistentHashRing().getNode("x")).toThrow(NoHealthyNodesError);
    });
  });
});
