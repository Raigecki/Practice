# Cost Explorer

_Format: 60 minutes, Code Craft. Parts are revealed one at a time. Don't read ahead._

---

## Part 1

Developer Console is adding cost exploration, so teams can see what their infrastructure costs and act on it.

We get a daily export of cloud billing line items:

```ts
{ date: "2026-10-03", resourceId: "i-0abc", costCents: 1250, tags: { team: "search" } }
```

Money is in integer cents. Rows can be negative (credits and refunds).

**Write `costByTeam(rows, month)`** that returns total cost per team for a month (`"2026-10"`), highest first.

- Rows with no `team` tag go into a bucket called `"unattributed"`.
- Output order must be deterministic. Break ties alphabetically.

---

## Part 2

Half the spend is "unattributed" because people forget the team tag. But many of those resources do have a `service` tag, and the service catalog knows who owns every service.

**Add a `catalog` parameter** (`{ "payments-api": { team: "payments" } }`):

- If a row has a `team` tag, use it.
- Otherwise, if it has a `service` tag that's in the catalog, use the catalog's team.
- Otherwise it's unattributed.

---

## Part 3

**Write `topServices(rows, catalog, month, n)`** that returns the `n` most expensive services that month, each with its owning team from the catalog (`"unattributed"` if the service isn't in the catalog). Rows with no service tag are skipped.

---

## Part 4

Finance wants alerts when a team's spend jumps.

**Write `weekOverWeekSpikes(rows, catalog, { weekStart, thresholdPct, minCostCents })`:**

- The current week is the 7 days starting at `weekStart`. The previous week is the 7 days before it.
- Flag a team when its increase is **more than** `thresholdPct` percent.
- Skip teams whose current-week spend is under `minCostCents`. Going from $1 to $3 isn't worth paging anyone over.
- If the previous week was zero (or negative), it's new spend. Flag it with `pctChange: null`.
- Sort by the absolute increase, biggest first.

---

## Discussion

- The real billing export is about 2 billion rows a month. What changes? (pre-aggregation, partitioning by day, a columnar store or warehouse, incremental rollups)
- Billing data arrives up to 3 days late and the cloud provider sometimes restates past days. How do you keep the numbers correct and avoid alerting twice?
- A shared Kafka cluster serves 40 teams. How would you split its cost between them? (showback vs. chargeback, allocating by usage)
- The catalog changes ownership mid-month. Which team gets the cost: the owner at the time, or today's owner?
- How would an **agent** use this? Design the tool interface you'd give an LLM to answer "why did search's spend go up last week?"
