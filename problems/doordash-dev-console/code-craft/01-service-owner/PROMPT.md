# Service Owner Resolver

_Format: 60 minutes, Code Craft. Parts are revealed one at a time. Don't read ahead._

---

## Part 1

Developer Console has a "Who owns this?" widget. When an engineer is paged for a service they don't know, they type the service name and we show the owning team and who is on call right now.

The data lives in three internal services. You get a client for each:

```ts
catalog.getService(name)          // → { name, ownerTeamId, tier } | null
teams.getTeam(teamId)             // → { id, name, slackChannel }
oncall.getCurrentOnCall(teamId)   // → { userId, endsAt } | null (null = nobody on call)
```

**Write `resolveOwner(serviceName)`** that returns the service, the team and the current on-call engineer.

- If the service doesn't exist, throw a `ServiceNotFoundError`.
- The widget feels slow, so make sure we aren't waiting on calls one at a time when we don't need to.

No database or SQL: the clients are passed into your class's constructor, and each method returns a Promise as if it were a network call. The tests provide fake clients with this data:

| Service    | ownerTeamId | Team                        | On call         |
| ---------- | ----------- | --------------------------- | --------------- |
| `payments` | `t-pay`     | Payments, `#payments-eng`   | alice           |
| `ledger`   | `t-pay`     | Payments, `#payments-eng`   | alice           |
| `search`   | `t-search`  | Search, `#search-eng`       | nobody (`null`) |

### Example

```ts
const resolver = new OwnerResolver({ catalog, teams, oncall });
await resolver.resolveOwner("payments");
```

Output:

```ts
{
  service: "payments",
  teamId: "t-pay",
  team: { id: "t-pay", name: "Payments", slackChannel: "#payments-eng" },
  onCall: { userId: "alice", endsAt: 1000 },
  warnings: [],
}
```

`resolveOwner("nope")` → throws `ServiceNotFoundError`.

---

## Part 2

The on-call service is flaky. Sometimes it errors, and sometimes it hangs for 30 seconds. Right now that takes down the whole widget.

**Make `resolveOwner` resilient:**

- Each upstream call gets a timeout (`timeoutMs`, default 200).
- If the team lookup or the on-call lookup fails or times out, still return what you have, with `team: null` / `onCall: null`, and add a warning (`"team_unavailable"`, `"oncall_unavailable"`) so the UI can show "on-call info unavailable".
- If the catalog fails, we can't answer at all. Let that error propagate (a timeout rejects with `UpstreamTimeoutError`).

Be ready to explain why the catalog is treated differently.

---

## Part 3

An agent in Developer Console needs owners for every service touched by an incident, sometimes 200 at once.

**Write `resolveOwners(serviceNames)`:**

- Return one result per input, **in input order**.
- One bad service must not fail the batch: `{ service, ok: false, error: "not_found" | "catalog_unavailable" }`.
- Don't fire 200 requests at the catalog at once. At most `maxConcurrency` (default 5) resolutions may be in flight.

---

## Part 4

The teams service team says we're hammering them. Most services in a batch belong to a handful of teams.

**Add a team cache:**

- A fetched team is cached for `teamCacheTtlMs` (default 60s). Use the injected `now()`, not `Date.now()`.
- Failed lookups are not cached.
- If two resolutions need the same team at the same moment, only **one** request goes to the teams service.

---

## Discussion

- This is a library inside one process. How would you make it a service the agent and the UI both call? What does the API look like?
- Where would the cache live when there are 20 instances of the service? What are the tradeoffs of in-process vs. Redis?
- Is the on-call cache safe to add with the same TTL? What goes wrong if it's stale during an incident?
- Would you retry the catalog? How many times, with what backoff, and how does that interact with the timeout?
- How would you know in production that the on-call service is degrading? (metrics, alerts, the warning rate)
