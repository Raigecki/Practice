import type {
  BatchResult,
  CatalogService,
  OnCallShift,
  OwnerInfo,
  ResolverDeps,
  ResolverOptions,
  Team,
  Warning,
} from "./types";
import { ServiceNotFoundError, UpstreamTimeoutError } from "./types";

// function withTimeout<T>(
//   promise: Promise<T>,
//   timeout: number,
//   upstream: string,
// ): Promise<T> {
//   let timerId: ReturnType<typeof setTimeout> | undefined;
//   const timer = new Promise<never>((_, reject) => {
//     timerId = setTimeout(
//       () => reject(new UpstreamTimeoutError(upstream, timeout)),
//       timeout,
//     );
//   });
//   return Promise.race([promise, timer]).finally(() => clearTimeout(timerId));
// }

function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  upstream: string,
) {
  let timerId: any;
  const timer = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new UpstreamTimeoutError(upstream, timeout)),
      timeout,
    );
  });
  return Promise.race([timer, promise]).finally(() => clearTimeout(timerId));
}

export class OwnerResolver {
  private readonly deps: ResolverDeps;
  private readonly options: ResolverOptions;
  private readonly teamCache: Map<string, { team: Team; lastFetched: number }>;
  private readonly inFlightCache: Map<string, Promise<Team>>;

  constructor(deps: ResolverDeps, options: ResolverOptions = {}) {
    this.deps = deps;
    this.options = options;
    this.teamCache = new Map();
    this.inFlightCache = new Map();
  }

  /** Parts 1, 2 and 4. */
  async resolveOwner(serviceName: string): Promise<OwnerInfo> {
    const timeout = this.options.timeoutMs ?? 200;
    const service = await withTimeout<CatalogService | null>(
      this.deps.catalog.getService(serviceName),
      timeout,
      "catalog",
    );

    if (service === null) {
      throw new ServiceNotFoundError(serviceName);
    }

    const { ownerTeamId } = service;

    const [teamRes, onCallsRes] = await Promise.allSettled([
      this.getTeam(ownerTeamId, timeout),
      withTimeout<OnCallShift | null>(
        this.deps.oncall.getCurrentOnCall(ownerTeamId),
        timeout,
        "oncall",
      ),
    ]);

    const warnings: Warning[] = [];

    let team = null;
    if (teamRes.status === "fulfilled") {
      team = teamRes.value;
    } else {
      warnings.push("team_unavailable");
    }

    let onCall = null;
    if (onCallsRes.status === "fulfilled") {
      onCall = onCallsRes.value;
    } else {
      warnings.push("oncall_unavailable");
    }

    return {
      service: serviceName,
      teamId: ownerTeamId,
      team,
      onCall,
      warnings,
    };
  }

  /** Part 3. Results come back in input order. */
  async resolveOwners(serviceNames: string[]): Promise<BatchResult[]> {
    const max = this.options.maxConcurrency ?? 5;
    let i = 0;

    const batch: BatchResult[] = Array(serviceNames.length);

    const worker = async () => {
      while (i < serviceNames.length) {
        const curr = i;
        const name = serviceNames[curr];
        i++;
        try {
          const ownerInfo = await this.resolveOwner(name);
          batch[curr] = {
            service: serviceNames[curr],
            ok: true,
            owner: ownerInfo,
          };
        } catch (err) {
          batch[curr] = {
            service: serviceNames[curr],
            ok: false,
            error:
              err instanceof ServiceNotFoundError
                ? "not_found"
                : "catalog_unavailable",
          };
        }
      }
    };

    await Promise.all(Array.from({ length: max }, () => worker()));
    return batch;
  }

  private getTeam = async (teamId: string, timeout: number): Promise<Team> => {
    const now = this.deps.now ?? (() => Date.now());
    const ttl = this.options.teamCacheTtlMs ?? 60_000;

    const cacheResult = this.teamCache.get(teamId);

    if (cacheResult && now() - cacheResult.lastFetched < ttl) {
      return cacheResult.team;
    }

    const isInFlight = this.inFlightCache.get(teamId);
    if (isInFlight) {
      return isInFlight;
    }

    const request = withTimeout(
      this.deps.teams.getTeam(teamId),
      timeout,
      "team",
    )
      .then((team) => {
        this.teamCache.set(teamId, { team, lastFetched: now() });
        return team;
      })
      .finally(() => this.inFlightCache.delete(teamId));

    this.inFlightCache.set(teamId, request);

    return request;
  };
}
