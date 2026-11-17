import { costByTeam, topServices, weekOverWeekSpikes } from "./solution";
import type { BillingRow, Catalog } from "./types";
import { UNATTRIBUTED } from "./types";

let seq = 0;
const row = (date: string, costCents: number, tags: BillingRow["tags"] = {}): BillingRow => ({
  date,
  resourceId: `r-${seq++}`,
  costCents,
  tags,
});

const catalog: Catalog = {
  "payments-api": { team: "payments" },
  ledger: { team: "payments" },
  "search-indexer": { team: "search" },
  "dev-console": { team: "devprod" },
};

describe("DoorDash Dev Console: Cost Explorer", () => {
  describe("Part 1: costByTeam (team tags only)", () => {
    it("sums cost per team for the month, highest first", () => {
      const rows = [
        row("2026-10-01", 500, { team: "search" }),
        row("2026-10-02", 1_000, { team: "payments" }),
        row("2026-10-31", 700, { team: "search" }),
      ];
      expect(costByTeam(rows, "2026-10")).toEqual([
        { team: "search", costCents: 1_200 },
        { team: "payments", costCents: 1_000 },
      ]);
    });

    it("ignores rows outside the month", () => {
      const rows = [
        row("2026-09-30", 9_999, { team: "search" }),
        row("2026-10-15", 100, { team: "search" }),
        row("2026-11-01", 9_999, { team: "search" }),
      ];
      expect(costByTeam(rows, "2026-10")).toEqual([{ team: "search", costCents: 100 }]);
    });

    it("untagged rows go to 'unattributed'", () => {
      const rows = [row("2026-10-01", 300), row("2026-10-01", 200, { team: "search" })];
      expect(costByTeam(rows, "2026-10")).toEqual([
        { team: UNATTRIBUTED, costCents: 300 },
        { team: "search", costCents: 200 },
      ]);
    });

    it("ties break alphabetically", () => {
      const rows = [row("2026-10-01", 100, { team: "zeta" }), row("2026-10-01", 100, { team: "alpha" })];
      expect(costByTeam(rows, "2026-10").map((t) => t.team)).toEqual(["alpha", "zeta"]);
    });

    it("credits (negative cost) are netted", () => {
      const rows = [row("2026-10-01", 1_000, { team: "search" }), row("2026-10-20", -400, { team: "search" })];
      expect(costByTeam(rows, "2026-10")).toEqual([{ team: "search", costCents: 600 }]);
    });

    it("empty input", () => {
      expect(costByTeam([], "2026-10")).toEqual([]);
    });
  });

  describe("Part 2: catalog attribution", () => {
    it("falls back to the catalog via the service tag", () => {
      const rows = [row("2026-10-01", 400, { service: "ledger" })];
      expect(costByTeam(rows, "2026-10", catalog)).toEqual([{ team: "payments", costCents: 400 }]);
    });

    it("an explicit team tag wins over the catalog", () => {
      const rows = [row("2026-10-01", 400, { service: "ledger", team: "search" })];
      expect(costByTeam(rows, "2026-10", catalog)).toEqual([{ team: "search", costCents: 400 }]);
    });

    it("unknown service stays unattributed", () => {
      const rows = [row("2026-10-01", 400, { service: "ghost" })];
      expect(costByTeam(rows, "2026-10", catalog)).toEqual([{ team: UNATTRIBUTED, costCents: 400 }]);
    });

    it("doesn't trip over prototype keys", () => {
      const rows = [row("2026-10-01", 400, { service: "toString" })];
      expect(costByTeam(rows, "2026-10", catalog)).toEqual([{ team: UNATTRIBUTED, costCents: 400 }]);
    });
  });

  describe("Part 3: topServices", () => {
    const rows = [
      row("2026-10-01", 900, { service: "payments-api" }),
      row("2026-10-02", 300, { service: "ledger" }),
      row("2026-10-03", 300, { service: "ledger" }),
      row("2026-10-04", 500, { service: "search-indexer" }),
      row("2026-10-05", 5_000), // no service tag → excluded
      row("2026-10-06", 50, { service: "mystery-box" }),
      row("2026-09-30", 9_000, { service: "dev-console" }), // other month
    ];

    it("top N services by cost with their owning team", () => {
      expect(topServices(rows, catalog, "2026-10", 2)).toEqual([
        { service: "payments-api", team: "payments", costCents: 900 },
        { service: "ledger", team: "payments", costCents: 600 },
      ]);
    });

    it("n larger than the number of services returns all", () => {
      expect(topServices(rows, catalog, "2026-10", 10).map((s) => s.service)).toEqual([
        "payments-api",
        "ledger",
        "search-indexer",
        "mystery-box",
      ]);
    });

    it("services missing from the catalog are labeled unattributed", () => {
      expect(topServices(rows, catalog, "2026-10", 10).at(-1)).toEqual({
        service: "mystery-box",
        team: UNATTRIBUTED,
        costCents: 50,
      });
    });

    it("n <= 0 returns nothing", () => {
      expect(topServices(rows, catalog, "2026-10", 0)).toEqual([]);
    });
  });

  describe("Part 4: weekOverWeekSpikes", () => {
    const opts = { weekStart: "2026-10-12", thresholdPct: 50, minCostCents: 1_000 };

    it("flags a team whose spend grew more than the threshold", () => {
      const rows = [
        row("2026-10-05", 1_000, { team: "search" }), // previous week
        row("2026-10-12", 1_200, { team: "search" }), // current week
        row("2026-10-18", 1_000, { team: "search" }), // current week (last day)
      ];
      expect(weekOverWeekSpikes(rows, catalog, opts)).toEqual([
        { team: "search", previousCents: 1_000, currentCents: 2_200, increaseCents: 1_200, pctChange: 120 },
      ]);
    });

    it("exactly at the threshold is not a spike", () => {
      const rows = [row("2026-10-05", 2_000, { team: "search" }), row("2026-10-12", 3_000, { team: "search" })];
      expect(weekOverWeekSpikes(rows, catalog, opts)).toEqual([]);
    });

    it("week boundaries are half-open [start, start + 7d)", () => {
      const rows = [
        row("2026-10-04", 99_999, { team: "search" }), // before previous week
        row("2026-10-11", 1_000, { team: "search" }), // last day of previous week
        row("2026-10-19", 99_999, { team: "search" }), // first day of next week
        row("2026-10-12", 1_000, { team: "search" }),
      ];
      expect(weekOverWeekSpikes(rows, catalog, opts)).toEqual([]);
    });

    it("new spend (no previous week) is flagged with pctChange null", () => {
      const rows = [row("2026-10-13", 5_000, { service: "dev-console" })];
      expect(weekOverWeekSpikes(rows, catalog, opts)).toEqual([
        { team: "devprod", previousCents: 0, currentCents: 5_000, increaseCents: 5_000, pctChange: null },
      ]);
    });

    it("small teams below minCostCents are ignored", () => {
      const rows = [row("2026-10-05", 10, { team: "tiny" }), row("2026-10-12", 900, { team: "tiny" })];
      expect(weekOverWeekSpikes(rows, catalog, opts)).toEqual([]);
    });

    it("sorted by absolute increase, pct rounded to 1 decimal, works across months", () => {
      const rows = [
        row("2026-09-28", 3_000, { team: "payments" }),
        row("2026-10-05", 5_000, { team: "payments" }),
        row("2026-09-28", 10_000, { team: "search" }),
        row("2026-10-05", 20_000, { team: "search" }),
        row("2026-09-28", 10_000, { team: "flat" }),
        row("2026-10-05", 10_000, { team: "flat" }),
      ];
      const spikes = weekOverWeekSpikes(rows, catalog, { ...opts, weekStart: "2026-10-05" });
      expect(spikes.map((s) => [s.team, s.increaseCents])).toEqual([
        ["search", 10_000],
        ["payments", 2_000],
      ]);

      const rows2 = [row("2026-10-05", 3_000, { team: "a" }), row("2026-10-12", 7_000, { team: "a" })];
      expect(weekOverWeekSpikes(rows2, catalog, opts)[0].pctChange).toBe(133.3);
    });
  });
});
