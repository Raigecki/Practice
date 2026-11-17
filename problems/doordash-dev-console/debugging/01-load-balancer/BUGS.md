# Spoilers: the 6 bugs

<details><summary>Click to reveal</summary>

1. **`next()`: operator precedence.** `this.cursor + 1 % this.nodes.length` is `cursor + (1 % n)` = `cursor + 1`. The cursor grows without bound, and `nodes[cursor]` becomes `undefined` after one full rotation, so the next call crashes on `.healthy`. Fix: `(this.cursor + 1) % this.nodes.length`.
2. **`removeNode()`: the cursor isn't adjusted.** Splicing index `i` shifts every later node left by one. If `i < cursor`, the cursor now points one node too far, which skips a node (and makes it look like another got hammered). Fix: `if (i < this.cursor) this.cursor--`.
3. **`next()`: returns an unhealthy node when all are down.** The loop gives up after `n` tries but still returns `node.id`. Fix: throw `NoHealthyNodesError`.
4. **`addNode()`: duplicates.** Adding an existing id pushes it again and doubles its share of traffic. Fix: make add idempotent.
5. **`ConsistentHashRing.removeNode()`: removes only one virtual node.** `findIndex` + `splice` removes 1 of `replicas` points, so the node keeps receiving keys. Fix: `filter` out every point for that node.
6. **`getNode()`: no wrap-around.** With `hi = length - 1`, a key that hashes past the last point lands on the **last** point instead of wrapping to the **first**. Fix: search `[0, length)` and take `ring[lo % length]`.

</details>
