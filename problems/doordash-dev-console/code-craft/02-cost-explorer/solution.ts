import type { BillingRow, Catalog, ServiceCost, Spike, SpikeOptions, TeamCost } from "./types";

/** Parts 1 and 2. `month` is "YYYY-MM". */
export function costByTeam(rows: BillingRow[], month: string, catalog: Catalog = {}): TeamCost[] {
  throw new Error("Not implemented");
}

/** Part 3. */
export function topServices(
  rows: BillingRow[],
  catalog: Catalog,
  month: string,
  n: number,
): ServiceCost[] {
  throw new Error("Not implemented");
}

/** Part 4. */
export function weekOverWeekSpikes(
  rows: BillingRow[],
  catalog: Catalog,
  options: SpikeOptions,
): Spike[] {
  throw new Error("Not implemented");
}
