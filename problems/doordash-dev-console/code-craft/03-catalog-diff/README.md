# Code Craft: Catalog Diff

Read [PROMPT.md](PROMPT.md) one part at a time. Implement in `solution.ts`. Types are in `types.ts`.
`reference.ts` has a working solution (spoilers).

Run: `npx vitest 03-catalog-diff`

## Clarifications (decided for these tests)

- Ref = `${kind}:${namespace ?? "default"}/${name}`, lowercased.
- A dependency written `kind:name` (no slash) means the default namespace.
- Field changes report **canonical** values: owner lowercased, tags sorted and de-duplicated, dependsOn normalized, sorted and de-duplicated.
- `changed` is sorted by ref.

## What interviewers reportedly score

- Normalize once (a `canonical()` helper) so comparisons stay simple. Don't scatter `.toLowerCase()` calls everywhere.
- Index by ref in a `Map`, which makes the diff O(n). Don't do nested loops.
- Explicit handling of invalid input (duplicates).
