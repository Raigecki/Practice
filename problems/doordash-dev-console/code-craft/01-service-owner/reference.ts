// Reference solution — spoilers. Tests run against ./solution, not this file.
import type { BatchResult, OwnerInfo, ResolverDeps, ResolverOptions, Team, Warning } from "./types";
import { ServiceNotFoundError, UpstreamTimeoutError } from "./types";

function withTimeout<T>(promise: Promise<T>, ms: number, upstream: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeoutError(upstream, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class OwnerResolver {
  private readonly deps: ResolverDeps;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly maxConcurrency: number;
  private readonly teamCacheTtlMs: number;

  private readonly teamCache = new Map<string, { team: Team; fetchedAt: number }>();
  private readonly teamInFlight = new Map<string, Promise<Team>>();

  constructor(deps: ResolverDeps, options: ResolverOptions = {}) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 200;
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 5);
    this.teamCacheTtlMs = options.teamCacheTtlMs ?? 60_000;
  }

  async resolveOwner(serviceName: string): Promise<OwnerInfo> {
    // Catalog is the source of truth: if it fails we can't answer, so let it throw.
    const service = await withTimeout(
      this.deps.catalog.getService(serviceName),
      this.timeoutMs,
      "catalog",
    );
    if (!service) throw new ServiceNotFoundError(serviceName);

    // Team and on-call are enrichment: fetch in parallel, degrade on failure.
    const [team, onCall] = await Promise.allSettled([
      this.getTeam(service.ownerTeamId),
      withTimeout(
        this.deps.oncall.getCurrentOnCall(service.ownerTeamId),
        this.timeoutMs,
        "oncall",
      ),
    ]);

    const warnings: Warning[] = [];
    if (team.status === "rejected") warnings.push("team_unavailable");
    if (onCall.status === "rejected") warnings.push("oncall_unavailable");

    return {
      service: service.name,
      teamId: service.ownerTeamId,
      team: team.status === "fulfilled" ? team.value : null,
      onCall: onCall.status === "fulfilled" ? onCall.value : null,
      warnings,
    };
  }

  async resolveOwners(serviceNames: string[]): Promise<BatchResult[]> {
    const results = new Array<BatchResult>(serviceNames.length);
    let next = 0;

    // Worker pool: N workers pull the next index until the list is drained.
    const worker = async () => {
      while (next < serviceNames.length) {
        const i = next++;
        const service = serviceNames[i];
        try {
          results[i] = { service, ok: true, owner: await this.resolveOwner(service) };
        } catch (err) {
          results[i] = {
            service,
            ok: false,
            error: err instanceof ServiceNotFoundError ? "not_found" : "catalog_unavailable",
          };
        }
      }
    };

    const workers = Math.min(this.maxConcurrency, serviceNames.length);
    await Promise.all(Array.from({ length: workers }, worker));
    return results;
  }

  private getTeam(teamId: string): Promise<Team> {
    const cached = this.teamCache.get(teamId);
    if (cached && this.now() - cached.fetchedAt < this.teamCacheTtlMs) {
      return Promise.resolve(cached.team);
    }

    // Dedupe concurrent lookups for the same team (cache stampede protection).
    const pending = this.teamInFlight.get(teamId);
    if (pending) return pending;

    const request = withTimeout(this.deps.teams.getTeam(teamId), this.timeoutMs, "teams")
      .then((team) => {
        this.teamCache.set(teamId, { team, fetchedAt: this.now() });
        return team;
      })
      .finally(() => this.teamInFlight.delete(teamId));

    this.teamInFlight.set(teamId, request);
    return request;
  }
}
