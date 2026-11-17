// Reference solution — spoilers. Tests run against ./solution, not this file.
import type { BillingRow, Catalog, ServiceCost, Spike, SpikeOptions, TeamCost } from "./types";
import { UNATTRIBUTED } from "./types";

/** Explicit team tag wins; otherwise fall back to the catalog via the service tag. */
function attributeTeam(row: BillingRow, catalog: Catalog): string {
  if (row.tags.team) return row.tags.team;
  const service = row.tags.service;
  if (service && Object.hasOwn(catalog, service)) return catalog[service].team;
  return UNATTRIBUTED;
}

function addTo(map: Map<string, number>, key: string, cents: number): void {
  map.set(key, (map.get(key) ?? 0) + cents);
}

/** Cost desc, then name asc — deterministic output matters for diffs and tests. */
function byCostThenName(a: [string, number], b: [string, number]): number {
  return b[1] - a[1] || a[0].localeCompare(b[0]);
}

function inMonth(row: BillingRow, month: string): boolean {
  return row.date.startsWith(`${month}-`);
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function costByTeam(rows: BillingRow[], month: string, catalog: Catalog = {}): TeamCost[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (inMonth(row, month)) addTo(totals, attributeTeam(row, catalog), row.costCents);
  }
  return [...totals].sort(byCostThenName).map(([team, costCents]) => ({ team, costCents }));
}

export function topServices(
  rows: BillingRow[],
  catalog: Catalog,
  month: string,
  n: number,
): ServiceCost[] {
  if (n <= 0) return [];
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.tags.service && inMonth(row, month)) addTo(totals, row.tags.service, row.costCents);
  }
  return [...totals]
    .sort(byCostThenName)
    .slice(0, n)
    .map(([service, costCents]) => ({
      service,
      team: Object.hasOwn(catalog, service) ? catalog[service].team : UNATTRIBUTED,
      costCents,
    }));
}

export function weekOverWeekSpikes(
  rows: BillingRow[],
  catalog: Catalog,
  { weekStart, thresholdPct, minCostCents }: SpikeOptions,
): Spike[] {
  // ISO dates compare correctly as strings, so the windows are plain string ranges.
  const prevStart = addDays(weekStart, -7);
  const nextStart = addDays(weekStart, 7);

  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const row of rows) {
    if (row.date >= weekStart && row.date < nextStart) {
      addTo(current, attributeTeam(row, catalog), row.costCents);
    } else if (row.date >= prevStart && row.date < weekStart) {
      addTo(previous, attributeTeam(row, catalog), row.costCents);
    }
  }

  const spikes: Spike[] = [];
  for (const [team, currentCents] of current) {
    if (currentCents < minCostCents) continue;
    const previousCents = previous.get(team) ?? 0;
    const increaseCents = currentCents - previousCents;

    if (previousCents <= 0) {
      spikes.push({ team, previousCents, currentCents, increaseCents, pctChange: null });
      continue;
    }
    const pct = (increaseCents / previousCents) * 100;
    if (pct > thresholdPct) {
      spikes.push({
        team,
        previousCents,
        currentCents,
        increaseCents,
        pctChange: Math.round(pct * 10) / 10,
      });
    }
  }

  return spikes.sort((a, b) => b.increaseCents - a.increaseCents || a.team.localeCompare(b.team));
}
