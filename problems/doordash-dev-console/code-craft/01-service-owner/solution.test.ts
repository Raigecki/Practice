import { OwnerResolver } from "./solution";
import type {
  CatalogClient,
  CatalogService,
  OnCallClient,
  OnCallShift,
  Team,
  TeamClient,
} from "./types";
import { ServiceNotFoundError, UpstreamTimeoutError } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SERVICES: Record<string, CatalogService> = {
  payments: { name: "payments", ownerTeamId: "t-pay", tier: 1 },
  ledger: { name: "ledger", ownerTeamId: "t-pay", tier: 1 },
  search: { name: "search", ownerTeamId: "t-search", tier: 2 },
};
for (let i = 0; i < 12; i++) {
  SERVICES[`svc-${i}`] = { name: `svc-${i}`, ownerTeamId: "t-search", tier: 3 };
}

const TEAMS: Record<string, Team> = {
  "t-pay": { id: "t-pay", name: "Payments", slackChannel: "#payments-eng" },
  "t-search": { id: "t-search", name: "Search", slackChannel: "#search-eng" },
};

const SHIFTS: Record<string, OnCallShift | null> = {
  "t-pay": { userId: "alice", endsAt: 1_000 },
  "t-search": null,
};

/** Fake upstream that counts calls and concurrency, with configurable latency/failures. */
class Upstream {
  calls = 0;
  inFlight = 0;
  maxInFlight = 0;
  delayMs = 0;
  failNext = 0;
  failAll = false;

  async call<T>(value: () => T): Promise<T> {
    this.calls++;
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await sleep(this.delayMs);
      if (this.failAll || this.failNext > 0) {
        this.failNext = Math.max(0, this.failNext - 1);
        throw new Error("upstream 503");
      }
      return value();
    } finally {
      this.inFlight--;
    }
  }
}

function setup(options: ConstructorParameters<typeof OwnerResolver>[1] = {}) {
  const catalogUp = new Upstream();
  const teamsUp = new Upstream();
  const oncallUp = new Upstream();
  let clock = 0;

  const catalog: CatalogClient = {
    getService: (name) => catalogUp.call(() => SERVICES[name] ?? null),
  };
  const teams: TeamClient = {
    getTeam: (id) => teamsUp.call(() => TEAMS[id]),
  };
  const oncall: OnCallClient = {
    getCurrentOnCall: (id) => oncallUp.call(() => SHIFTS[id] ?? null),
  };

  const resolver = new OwnerResolver({ catalog, teams, oncall, now: () => clock }, options);
  return {
    resolver,
    catalogUp,
    teamsUp,
    oncallUp,
    setClock: (t: number) => {
      clock = t;
    },
  };
}

describe("DoorDash Dev Console: Service Owner Resolver", () => {
  describe("Part 1: resolveOwner", () => {
    it("returns team and on-call for a known service", async () => {
      const { resolver } = setup();
      await expect(resolver.resolveOwner("payments")).resolves.toEqual({
        service: "payments",
        teamId: "t-pay",
        team: TEAMS["t-pay"],
        onCall: { userId: "alice", endsAt: 1_000 },
        warnings: [],
      });
    });

    it("onCall is null (no warning) when nobody is on call", async () => {
      const { resolver } = setup();
      const owner = await resolver.resolveOwner("search");
      expect(owner.onCall).toBeNull();
      expect(owner.warnings).toEqual([]);
    });

    it("throws ServiceNotFoundError for an unknown service", async () => {
      const { resolver } = setup();
      await expect(resolver.resolveOwner("nope")).rejects.toBeInstanceOf(ServiceNotFoundError);
    });

    it("fetches team and on-call in parallel, not sequentially", async () => {
      const { resolver, teamsUp, oncallUp } = setup();
      teamsUp.delayMs = 40;
      oncallUp.delayMs = 40;
      const start = Date.now();
      await resolver.resolveOwner("payments");
      expect(Date.now() - start).toBeLessThan(75);
    });
  });

  describe("Part 2: partial failures and timeouts", () => {
    it("on-call failure degrades to a warning", async () => {
      const { resolver, oncallUp } = setup();
      oncallUp.failAll = true;
      const owner = await resolver.resolveOwner("payments");
      expect(owner.team).toEqual(TEAMS["t-pay"]);
      expect(owner.onCall).toBeNull();
      expect(owner.warnings).toEqual(["oncall_unavailable"]);
    });

    it("team failure degrades to a warning but keeps teamId", async () => {
      const { resolver, teamsUp } = setup();
      teamsUp.failAll = true;
      const owner = await resolver.resolveOwner("payments");
      expect(owner.teamId).toBe("t-pay");
      expect(owner.team).toBeNull();
      expect(owner.warnings).toEqual(["team_unavailable"]);
    });

    it("both enrichments failing gives both warnings, in order", async () => {
      const { resolver, teamsUp, oncallUp } = setup();
      teamsUp.failAll = true;
      oncallUp.failAll = true;
      const owner = await resolver.resolveOwner("payments");
      expect(owner.warnings).toEqual(["team_unavailable", "oncall_unavailable"]);
    });

    it("slow on-call times out instead of blocking", async () => {
      const { resolver, oncallUp } = setup({ timeoutMs: 20 });
      oncallUp.delayMs = 150;
      const start = Date.now();
      const owner = await resolver.resolveOwner("payments");
      expect(Date.now() - start).toBeLessThan(100);
      expect(owner.warnings).toEqual(["oncall_unavailable"]);
    });

    it("catalog errors propagate (we can't answer without it)", async () => {
      const { resolver, catalogUp } = setup();
      catalogUp.failAll = true;
      await expect(resolver.resolveOwner("payments")).rejects.toThrow("upstream 503");
    });

    it("slow catalog rejects with UpstreamTimeoutError", async () => {
      const { resolver, catalogUp } = setup({ timeoutMs: 20 });
      catalogUp.delayMs = 150;
      await expect(resolver.resolveOwner("payments")).rejects.toBeInstanceOf(UpstreamTimeoutError);
    });
  });

  describe("Part 3: resolveOwners (batch)", () => {
    it("returns results in input order with per-item errors", async () => {
      const { resolver } = setup();
      const results = await resolver.resolveOwners(["search", "nope", "payments"]);
      expect(results.map((r) => [r.service, r.ok])).toEqual([
        ["search", true],
        ["nope", false],
        ["payments", true],
      ]);
      expect(results[1]).toEqual({ service: "nope", ok: false, error: "not_found" });
    });

    it("catalog outage maps to catalog_unavailable without failing the batch", async () => {
      const { resolver, catalogUp } = setup();
      catalogUp.failNext = 1;
      const results = await resolver.resolveOwners(["payments", "search"]);
      expect(results[0]).toEqual({ service: "payments", ok: false, error: "catalog_unavailable" });
      expect(results[1].ok).toBe(true);
    });

    it("empty input", async () => {
      const { resolver } = setup();
      await expect(resolver.resolveOwners([])).resolves.toEqual([]);
    });

    it("respects maxConcurrency but still runs in parallel", async () => {
      const { resolver, catalogUp } = setup({ maxConcurrency: 3 });
      catalogUp.delayMs = 5;
      const names = Array.from({ length: 12 }, (_, i) => `svc-${i}`);
      const results = await resolver.resolveOwners(names);
      expect(results.every((r) => r.ok)).toBe(true);
      expect(catalogUp.maxInFlight).toBe(3);
    });
  });

  describe("Part 4: team cache", () => {
    it("caches team lookups within the TTL", async () => {
      const { resolver, teamsUp, setClock } = setup({ teamCacheTtlMs: 60_000 });
      await resolver.resolveOwner("payments");
      setClock(59_999);
      await resolver.resolveOwner("ledger");
      expect(teamsUp.calls).toBe(1);
    });

    it("refetches once the TTL has elapsed", async () => {
      const { resolver, teamsUp, setClock } = setup({ teamCacheTtlMs: 60_000 });
      await resolver.resolveOwner("payments");
      setClock(60_000);
      await resolver.resolveOwner("payments");
      expect(teamsUp.calls).toBe(2);
    });

    it("does not cache failures", async () => {
      const { resolver, teamsUp } = setup();
      teamsUp.failNext = 1;
      expect((await resolver.resolveOwner("payments")).team).toBeNull();
      expect((await resolver.resolveOwner("payments")).team).toEqual(TEAMS["t-pay"]);
      expect(teamsUp.calls).toBe(2);
    });

    it("dedupes concurrent lookups for the same team", async () => {
      const { resolver, teamsUp } = setup();
      teamsUp.delayMs = 10;
      await Promise.all([resolver.resolveOwner("payments"), resolver.resolveOwner("ledger")]);
      expect(teamsUp.calls).toBe(1);
    });
  });
});
