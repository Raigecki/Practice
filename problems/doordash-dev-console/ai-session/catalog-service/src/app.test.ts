import { createApp } from "./handlers";
import { CatalogStore } from "./store";

const DAY = 24 * 60 * 60 * 1000;

export function seededApp(now = 100 * DAY) {
  const store = new CatalogStore();
  const handle = createApp(store, { now: () => now });
  const post = (body: unknown) => handle({ method: "POST", path: "/services", body });

  post({
    name: "payments-api",
    owner: "payments",
    lifecycle: "production",
    tier: 1,
    tags: ["java", "payments"],
    description: "Charges customers and refunds orders",
    links: { runbook: "https://wiki/payments-runbook", dashboard: "https://grafana/payments" },
    oncallRotation: "PD-PAY",
    lastDeployAt: now - 2 * DAY,
  });
  post({
    name: "ledger",
    owner: "payments",
    lifecycle: "production",
    tier: 1,
    tags: ["kotlin"],
    description: "Double-entry ledger for payments",
    links: {},
    lastDeployAt: now - 45 * DAY,
  });
  post({ name: "search-indexer", owner: "search", lifecycle: "experimental", tier: 3, tags: ["python"], links: {} });
  post({ name: "old-payments", owner: "payments", lifecycle: "deprecated", tier: 2, tags: ["payments"], links: {} });

  return { store, handle };
}

describe("catalog-service (existing behavior)", () => {
  it("lists services sorted by name, filterable by owner", () => {
    const { handle } = seededApp();
    const res = handle({ method: "GET", path: "/services", query: { owner: "payments" } });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }[]).map((s) => s.name)).toEqual(["ledger", "old-payments", "payments-api"]);
  });

  it("gets a service by name, 404 when missing", () => {
    const { handle } = seededApp();
    expect(handle({ method: "GET", path: "/services/ledger" }).status).toBe(200);
    expect(handle({ method: "GET", path: "/services/nope" }).status).toBe(404);
  });

  it("validates POST bodies", () => {
    const { handle } = seededApp();
    const res = handle({ method: "POST", path: "/services", body: { name: "Bad Name", owner: "x", lifecycle: "production", tier: 1 } });
    expect(res).toEqual({ status: 400, body: { error: expect.stringContaining("name"), field: "name" } });
  });

  it("upsert returns 201 on create and 200 on update", () => {
    const { handle } = seededApp();
    const body = { name: "new-svc", owner: "devprod", lifecycle: "experimental", tier: 3 };
    expect(handle({ method: "POST", path: "/services", body }).status).toBe(201);
    expect(handle({ method: "POST", path: "/services", body }).status).toBe(200);
  });

  it("search ranks name matches first and deprecated last", () => {
    const { handle } = seededApp();
    const res = handle({ method: "GET", path: "/search", query: { q: "payments" } });
    expect((res.body as { name: string }[]).map((h) => h.name)).toEqual(["payments-api", "ledger", "old-payments"]);
  });

  it("deletes", () => {
    const { handle } = seededApp();
    expect(handle({ method: "DELETE", path: "/services/ledger" }).status).toBe(204);
    expect(handle({ method: "GET", path: "/services/ledger" }).status).toBe(404);
  });
});
