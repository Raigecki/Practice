# leet-challenges

LeetCode-style problems in TypeScript, each with basic tests and corner cases.

## Setup

```sh
npm install
```

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests on change |
| `npx vitest 0001` | Run tests for one problem (filters by path) |
| `npm run typecheck` | Type-check everything |
| `npm run new -- <number> <slug>` | Scaffold a new problem, e.g. `npm run new -- 21 merge-two-sorted-lists` |

## Layout

```
problems/
  0001-two-sum/
    README.md          problem statement + constraints
    solution.ts        exported solution function
    solution.test.ts   "basic" and "corner cases" test groups
  doordash-dasher-pay/ non-LeetCode problems use <company>-<slug>
shared/                ListNode / TreeNode with LeetCode array builders
scripts/new-problem.mjs
```

For linked-list and tree problems, import helpers from `shared`:

```ts
import { toList, fromList, toTree, fromTree } from "../../shared";

expect(fromList(reverseList(toList([1, 2, 3])))).toEqual([3, 2, 1]);
```
