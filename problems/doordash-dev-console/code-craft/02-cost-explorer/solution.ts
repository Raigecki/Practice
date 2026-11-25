import {
  UNATTRIBUTED,
  type BillingRow,
  type Catalog,
  type ServiceCost,
  type Spike,
  type SpikeOptions,
  type TeamCost,
} from "./types";

function attributeTeam(
  tags: { service?: string; team?: string },
  catalog: Catalog,
) {
  return (
    tags.team || (tags.service && catalog[tags.service]?.team) || UNATTRIBUTED
  );
}

/** Parts 1 and 2. `month` is "YYYY-MM". */
export function costByTeam(
  rows: BillingRow[],
  month: string,
  catalog: Catalog = {},
): TeamCost[] {
  const teamCost = new Map<string, number>();
  for (const row of rows) {
    const { date, costCents, tags } = row;

    const team = attributeTeam(tags, catalog);

    if (!date.startsWith(month + "-")) {
      continue;
    }
    teamCost.set(team, (teamCost.get(team) ?? 0) + costCents);
  }
  return Array.from(teamCost)
    .map(([key, value]) => ({
      team: key,
      costCents: value,
    }))
    .sort((a, b) => b.costCents - a.costCents || a.team.localeCompare(b.team));
}

/** Part 3. */
export function topServices(
  rows: BillingRow[],
  catalog: Catalog,
  month: string,
  n: number,
): ServiceCost[] {
  const serviceMap = new Map<string, ServiceCost>();

  for (const row of rows) {
    const { date, costCents, tags } = row;
    if (!date.startsWith(month + "-") || !tags.service) {
      continue;
    }

    const service = serviceMap.get(tags.service);

    if (service) {
      service.costCents += costCents;
    } else {
      serviceMap.set(tags.service, {
        service: tags.service,
        team: catalog[tags.service]?.team ?? UNATTRIBUTED,
        costCents,
      });
    }
  }
  return Array.from(serviceMap.values())
    .sort(
      (a, b) => b.costCents - a.costCents || a.service.localeCompare(b.service),
    )
    .slice(0, Math.max(0, n));
}

function addDays(date: string, days: number) {
  const _date = new Date(date + "T00:00:00Z");
  _date.setUTCDate(_date.getUTCDate() + days);
  return _date.toISOString().slice(0, 10);
}

/** Part 4. */
export function weekOverWeekSpikes(
  rows: BillingRow[],
  catalog: Catalog,
  options: SpikeOptions,
): Spike[] {
  const teamCostPrev = new Map<string, number>();
  const teamCostCurr = new Map<string, number>();

  const currWeekEnd = addDays(options.weekStart, 7);
  const prevWeekStart = addDays(options.weekStart, -7);

  for (const row of rows) {
    const team = attributeTeam(row.tags, catalog);

    if (row.date < prevWeekStart || row.date >= currWeekEnd) {
      continue;
    }
    if (row.date >= prevWeekStart && row.date < options.weekStart) {
      teamCostPrev.set(team, (teamCostPrev.get(team) ?? 0) + row.costCents);
    } else if (row.date >= options.weekStart && row.date < currWeekEnd) {
      teamCostCurr.set(team, (teamCostCurr.get(team) ?? 0) + row.costCents);
    }
  }

  return Array.from(teamCostCurr)
    .map(([key, value]) => {
      const prevCost = teamCostPrev.get(key) ?? 0;
      const currCost = value;

      return {
        team: key,
        previousCents: prevCost,
        currentCents: currCost,
        increaseCents: currCost - prevCost,
        pctChange:
          prevCost <= 0
            ? null
            : Math.round(((currCost - prevCost) / prevCost) * 100 * 10) / 10,
      };
    })
    .filter(
      (cost) =>
        cost.currentCents >= options.minCostCents &&
        (cost.pctChange === null || cost.pctChange > options.thresholdPct),
    )
    .sort(
      (a, b) =>
        b.increaseCents - a.increaseCents || a.team.localeCompare(b.team),
    );
}

/**
 * Follow up:
 * 1. If there are 2 billion rows, the simpliest first solution would be real-time aggreation. The costs
 * percent changes is continuously updated.
 * 2. In the DB. We can probably index a hash of (day + service) and enforce it to be unique.
 * 3. The most fair way is to also track each usage per team separately and charge from that team's budget.
 * First start with showing each team their usage data. When we find that the data is accurate, we can charge
 * each team's budget. Splitting the total cost will cause rouding errors so I can use the largest remainder method
 * to accurately attribute cost to each team.
 * I think it's best to give each team a report of their utilization to incentivize implementing auto scaling
 * to get a more efficient usage.
 * 4. This is a problem if the data comes in a few days late. The only way to mitigate this is to keep a
 * separate record of which team owns which service per day and always check the aggregation against that
 * 5. huh????????
 *
 */
