// Fixed version — spoilers. Each fix is marked FIX #n (see BUGS.md).

export class NoHealthyNodesError extends Error {
  constructor() {
    super("No healthy nodes available");
    this.name = "NoHealthyNodesError";
  }
}

interface BackendNode {
  id: string;
  healthy: boolean;
}

/**
 * 32-bit FNV-1a followed by murmur3's fmix32 finalizer (plain FNV-1a clusters similar keys
 * like "order-1", "order-2"; the finalizer spreads them out). This function is correct.
 */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Hands out backend nodes in rotation, skipping unhealthy ones.
 * `cursor` always points at the node that should be tried next.
 */
export class RoundRobinBalancer {
  private nodes: BackendNode[] = [];
  private cursor = 0;

  addNode(id: string): void {
    if (this.nodes.some((n) => n.id === id)) return; // FIX #4: adding is idempotent
    this.nodes.push({ id, healthy: true });
  }

  removeNode(id: string): void {
    const i = this.nodes.findIndex((n) => n.id === id);
    if (i === -1) return;
    this.nodes.splice(i, 1);
    if (i < this.cursor) this.cursor--; // FIX #2: everything after i shifted left by one
    if (this.cursor >= this.nodes.length) this.cursor = 0;
  }

  markDown(id: string): void {
    const node = this.nodes.find((n) => n.id === id);
    if (node) node.healthy = false;
  }

  markUp(id: string): void {
    const node = this.nodes.find((n) => n.id === id);
    if (node) node.healthy = true;
  }

  next(): string {
    for (let tries = 0; tries < this.nodes.length; tries++) {
      const node = this.nodes[this.cursor];
      this.cursor = (this.cursor + 1) % this.nodes.length; // FIX #1: parenthesize the modulo
      if (node.healthy) return node.id;
    }
    throw new NoHealthyNodesError(); // FIX #3: never hand out an unhealthy node
  }

  size(): number {
    return this.nodes.length;
  }
}

/**
 * Consistent hash ring with virtual nodes: each node is placed `replicas` times on a
 * 32-bit ring; a key belongs to the first point clockwise from hash(key).
 */
export class ConsistentHashRing {
  private ring: { hash: number; nodeId: string }[] = [];
  private readonly replicas: number;

  constructor(replicas = 100) {
    this.replicas = replicas;
  }

  addNode(id: string): void {
    if (this.ring.some((p) => p.nodeId === id)) return;
    for (let r = 0; r < this.replicas; r++) {
      this.ring.push({ hash: fnv1a(`${id}#${r}`), nodeId: id });
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  removeNode(id: string): void {
    this.ring = this.ring.filter((p) => p.nodeId !== id); // FIX #5: remove every virtual node
  }

  getNode(key: string): string {
    if (this.ring.length === 0) throw new NoHealthyNodesError();
    const h = fnv1a(key);
    // Lower bound: first point with hash >= h.
    let lo = 0;
    let hi = this.ring.length; // FIX #6: search space includes "past the end"
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].hash < h) lo = mid + 1;
      else hi = mid;
    }
    return this.ring[lo % this.ring.length].nodeId; // FIX #6: past the end wraps to the first point
  }
}
