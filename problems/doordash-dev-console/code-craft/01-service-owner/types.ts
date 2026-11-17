export interface CatalogService {
  name: string;
  ownerTeamId: string;
  tier: 1 | 2 | 3;
}

export interface Team {
  id: string;
  name: string;
  slackChannel: string;
}

export interface OnCallShift {
  userId: string;
  /** Epoch ms when the shift ends. */
  endsAt: number;
}

/** Upstream clients. Every method may be slow, or reject. */
export interface CatalogClient {
  /** Resolves null when the service doesn't exist. */
  getService(name: string): Promise<CatalogService | null>;
}

export interface TeamClient {
  getTeam(teamId: string): Promise<Team>;
}

export interface OnCallClient {
  /** Resolves null when nobody is on call. */
  getCurrentOnCall(teamId: string): Promise<OnCallShift | null>;
}

export type Warning = "team_unavailable" | "oncall_unavailable";

export interface OwnerInfo {
  service: string;
  teamId: string;
  /** null when the team lookup failed or timed out (Part 2). */
  team: Team | null;
  /** null when nobody is on call, or the lookup failed or timed out. */
  onCall: OnCallShift | null;
  /** In this order: "team_unavailable", then "oncall_unavailable". */
  warnings: Warning[];
}

export type BatchResult =
  | { service: string; ok: true; owner: OwnerInfo }
  | { service: string; ok: false; error: "not_found" | "catalog_unavailable" };

export interface ResolverDeps {
  catalog: CatalogClient;
  teams: TeamClient;
  oncall: OnCallClient;
  /** Epoch ms. Defaults to Date.now. Used by the team cache (Part 4). */
  now?: () => number;
}

export interface ResolverOptions {
  /** Per-upstream-call timeout. Default 200. */
  timeoutMs?: number;
  /** Max resolveOwner calls in flight inside resolveOwners. Default 5. */
  maxConcurrency?: number;
  /** How long a fetched team stays cached. Default 60_000. */
  teamCacheTtlMs?: number;
}

export class ServiceNotFoundError extends Error {
  readonly service: string;
  constructor(service: string) {
    super(`Service not found: ${service}`);
    this.name = "ServiceNotFoundError";
    this.service = service;
  }
}

export class UpstreamTimeoutError extends Error {
  readonly upstream: string;
  constructor(upstream: string, ms: number) {
    super(`${upstream} timed out after ${ms}ms`);
    this.name = "UpstreamTimeoutError";
    this.upstream = upstream;
  }
}
