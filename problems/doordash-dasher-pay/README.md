# DoorDash Code Craft: Dasher Pay

Given a chronological event stream for one dasher's day, compute active time and pay.

Run: `npx vitest doordash`. Implement in `solution.ts`; types are in `types.ts`.
`reference.ts` has a working solution — spoilers.

## Input

```ts
interface DasherEvent {
  orderId: string;
  dasherId: string;
  timestamp: number; // minutes since midnight
  status: "ACCEPTED" | "ARRIVED" | "PICKED_UP" | "FULFILLED" | "CANCELED";
}
```

Events are sorted by timestamp. Money is in **integer cents** (`baseRateCents: 30` = $0.30/min).

## Clarifications (decided for these tests)

These are the questions you'd ask the interviewer. The tests assume:

- An order is ongoing from `ACCEPTED` until `FULFILLED` or `CANCELED`.
- Canceled minutes **are** paid by default; `payCanceledTime: false` drops the canceled order entirely.
- An order that is never closed (or closed without being accepted) is ignored.
- Accept and fulfill at the same timestamp = 0 minutes.
- Peak windows are half-open `[start, end)`, sorted, and non-overlapping.

## Parts

1. **`activeMinutes(events)`** — minutes with ≥1 ongoing delivery. Overlapping orders do **not** multiply time.
   Example: 8:30 pickup, 9:10 dropoff, 10:20 pickup, 12:15 pickup, 12:45 dropoff, 14:25 dropoff → 40 + 245 = 285.
2. **`basicPay(events, options)`** — each minute pays `ongoing orders × baseRate`. 3 orders for 1 minute = 3 × rate.
3. **`storeWaitPay(events, options)`** — an order is *waiting at the store* from `ARRIVED` until `PICKED_UP` (or until it closes, if it never gets picked up). During any minute where ≥1 order is waiting, the other orders are not billed and the wait is billed once (multiplier = 1, even if several orders are waiting at the same time). Otherwise it's the same as Part 2.
4. **`peakPay(events, peakWindows, options)`** — same as Part 2, but minutes inside a peak window pay double. Intervals that straddle a boundary are cut at that boundary.
   **Constraint:** events and windows arrive as two separate sorted lists. Do **not** concatenate them and re-sort; walk them with two pointers or binary-search the boundaries.

## Follow-ups (discussion, no tests)

How would you turn this batch function into a service called by an upstream system?

- API shape: push events one at a time vs. compute over a whole day? Is the result idempotent?
- Events arriving out of order, duplicated, or late (after the day was paid out).
- State storage per dasher/order; what's the partition key?
- A downstream service (payout, rate config) is slow or down: retries, timeouts, idempotency keys, dead-letter queue.
- Rate and peak-window config changing mid-day: which version applies to an order?
- Timezones and DST for "peak hours"; ISO-8601 vs. epoch input.
- Money: integer cents, rounding rules, auditing how a payout was computed.
