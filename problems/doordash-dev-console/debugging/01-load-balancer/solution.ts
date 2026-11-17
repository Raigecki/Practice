// This code has bugs. Find them and fix them in place. See README.md.

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
    this.nodes.push({ id, healthy: true });
  }

  removeNode(id: string): void {
    const i = this.nodes.findIndex((n) => n.id === id);
    if (i === -1) return;
    this.nodes.splice(i, 1);
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
    if (this.nodes.length === 0) throw new NoHealthyNodesError();

    let node = this.nodes[this.cursor];
    let tries = 0;
    while (!node.healthy && tries < this.nodes.length) {
      this.cursor = (this.cursor + 1) % this.nodes.length;
      node = this.nodes[this.cursor];
      tries++;
    }
    this.cursor = this.cursor + 1 % this.nodes.length;
    return node.id;
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
    const i = this.ring.findIndex((p) => p.nodeId === id);
    if (i !== -1) this.ring.splice(i, 1);
  }

  getNode(key: string): string {
    if (this.ring.length === 0) throw new NoHealthyNodesError();
    const h = fnv1a(key);
    let lo = 0;
    let hi = this.ring.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].hash < h) lo = mid + 1;
      else hi = mid;
    }
    return this.ring[lo].nodeId;
  }
}
