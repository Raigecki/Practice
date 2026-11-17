export interface BillingRow {
  /** UTC day, "YYYY-MM-DD". */
  date: string;
  resourceId: string;
  /** Integer cents. Can be negative (credits/refunds). */
  costCents: number;
  /** Cloud resource tags. Often missing; that's the point. */
  tags: { service?: string; team?: string };
}

/** Service catalog: service name → owning team. */
export type Catalog = Record<string, { team: string }>;

export const UNATTRIBUTED = "unattributed";

export interface TeamCost {
  team: string;
  costCents: number;
}

export interface ServiceCost {
  service: string;
  /** From the catalog, or UNATTRIBUTED if the service isn't in it. */
  team: string;
  costCents: number;
}

export interface SpikeOptions {
  /** First day of the current week, "YYYY-MM-DD". */
  weekStart: string;
  /** Flag when the increase is strictly greater than this percentage. */
  thresholdPct: number;
  /** Ignore teams whose current-week cost is below this (noise filter). */
  minCostCents: number;
}

export interface Spike {
  team: string;
  previousCents: number;
  currentCents: number;
  increaseCents: number;
  /** Rounded to 1 decimal. null when the previous week was <= 0 ("new spend"). */
  pctChange: number | null;
}
