# Code Craft: Cost Explorer

Read [PROMPT.md](PROMPT.md) one part at a time. Implement in `solution.ts`. Types are in `types.ts`.
`reference.ts` has a working solution (spoilers).

Run: `npx vitest 02-cost-explorer`

This ties to the Developer Console team's stated direction of using the data it collects to drive cost exploration.

## Clarifications (decided for these tests)

- Dates are UTC `"YYYY-MM-DD"` strings. ISO dates sort correctly as strings, so you don't need `Date` for range checks. You only need it to add or subtract days.
- Attribution: team tag, then catalog lookup via the service tag, then `"unattributed"`.
- Watch out for `catalog[service]` when the service is `"toString"`. Use `Object.hasOwn` or a `Map`.
- Sort by cost descending, then name ascending.
- Spike: `pct = (current - previous) / previous * 100`, rounded to 1 decimal, flagged only when strictly greater than the threshold.

## What interviewers reportedly score

- One attribution helper reused by all parts, not three copies.
- Integer cents throughout, never floats for money.
- Clear names. Edge cases like credits, empty input and boundaries handled on purpose and tested.
