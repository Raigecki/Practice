# Catalog Diff

_Format: 45–60 minutes, Code Craft. Parts are revealed one at a time. Don't read ahead._

This is the reported "menu change detector" question, set in Developer Console terms.

---

## Part 1

Developer Console's service catalog is built from `catalog-info.yaml` files in every repo. Every hour, an ingestion job produces a full snapshot of all entities. We want to show a "what changed" feed and notify owners.

An entity looks like this:

```ts
{ kind: "Component", namespace: "default", name: "ledger", owner: "group:payments",
  lifecycle: "production", tags: ["java"], dependsOn: ["resource:ledger-db"] }
```

An entity is identified by its **ref**: `kind:namespace/name`. Refs are case-insensitive, and the namespace defaults to `"default"`.

**Write `diffCatalog(before, after)`** that returns which refs were **added**, **removed** and **changed** between two snapshots.

- Output refs normalized (lowercase) and sorted.
- A snapshot containing the same ref twice is invalid. Throw `DuplicateEntityError`.

---

## Part 2

"Changed" isn't useful by itself. Owners want to know *what* changed.

**For each changed entity, list the field changes** (`owner`, `lifecycle`, `tags`, `dependsOn`) with `before` and `after`:

- Tags are a set. Reordering or duplicating tags is not a change.
- Owner refs are case-insensitive.
- `dependsOn` contains refs. Compare them normalized. `"component:payments"` and `"component:default/payments"` are the same thing.
- List changes in a fixed field order.

---

## Part 3

People delete services and forget that others depend on them.

**Write `danglingDependencies(snapshot)`** that returns every entity whose `dependsOn` points at a ref that isn't in the snapshot, with the missing refs (normalized, de-duplicated, sorted).

---

## Discussion

- The catalog has 50k entities and snapshots run every hour. Is a full diff OK? How would you move to incremental ingestion (webhooks on repo push)?
- How would you publish these changes so other systems can react (Kafka topic, event schema, idempotency)?
- Which changes deserve a notification, and to whom? (an owner change notifies both the old and new owner, deprecation notifies dependents)
- Would you block a PR that creates a dangling dependency, or only warn? Where does that check run?
