# Nearest Store

_Format: 45 minutes, LeetCode style. One problem, then a follow-up asking for a faster solution. The interviewer won't give hints. They expect a complete, working solution that handles every edge case._

A variation of LeetCode 1779, "Find Nearest Point That Has the Same X or Y Coordinate".

---

## Problem

DoorDash stores sit at grid intersections. A Dasher can only drive straight along an **avenue** (same `x`) or a **street** (same `y`). They can't cut diagonally.

You're given a list of `stores`, each with a unique `name` and a position `(x, y)`, plus a list of `queries`, each one a store name.

For each query, return the name of the **nearest other store** that shares the query store's `x` **or** its `y`.

- Distance is Manhattan distance, `|x1 - x2| + |y1 - y2|`. Since the two stores share a coordinate, it's really just the difference along the line.
- If several stores are equally near, return the one whose name is **smallest by plain string comparison** (`a < b`, so `"Banana" < "apple"`).
- Return `null` if no other store shares the avenue or street, or if the query isn't a known store.
- Return answers in query order.

```ts
nearestStores(stores: Store[], queries: string[]): (string | null)[]
```

### Example 1

```
stores  = [c1 (3,3), c2 (2,2), c3 (1,3)]
queries = [c1, c2, c3]
output  = [c3, null, c1]
```

`c1` and `c3` share `y = 3`, at distance 2. Nothing shares a line with `c2`.

### Example 2

```
stores  = [fast (0,0), burger (0,4), pho (3,0), taco (3,4)]
queries = [fast, taco]
output  = [pho, burger]
```

`fast` can reach `burger` (4) and `pho` (3), so `pho`. `taco` can reach `burger` (3) and `pho` (4), so `burger`.

### Constraints

- `0 <= stores.length <= 10^5`, `0 <= queries.length <= 10^5`
- Store names are unique. **No two stores share the same `(x, y)`.**
- `-10^9 <= x, y <= 10^9`

---

## Follow-up

_Asked once the basic solution passes._

Your solution has to handle `n = q = 10^5` well, including the worst case where every store is on the **same avenue**.

What's the time complexity of your solution in that worst case? Make it faster. The `follow-up: performance` tests have a 3-second limit.

---

## Discussion (if time remains)

- Stores open and close all day. How would you support `addStore` and `removeStore` without rebuilding everything?
- Now Dashers can drive anywhere, not just straight lines. Find the nearest store by real distance. What data structure would you use? (k-d tree, geohash or S2 cells, grid bucketing)
- How would this run as a service over millions of stores?
