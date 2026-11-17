// This code has bugs. Find them and fix them in place. See README.md.
import type { AuditLog, Clock, Reservation } from "./types";
import { EnvBusyError, NotOwnerError } from "./types";

interface EnvState {
  owner: string | null;
  expiresAt: number;
}

/**
 * Developer Console "Staging Environments" plugin backend.
 * Engineers reserve one of a fixed pool of shared staging environments for a while.
 */
export class EnvReservations {
  private readonly envs = new Map<string, EnvState>();
  private readonly clock: Clock;
  private readonly audit: AuditLog;

  constructor(envIds: string[], clock: Clock, audit: AuditLog) {
    for (const id of envIds) this.envs.set(id, { owner: null, expiresAt: 0 });
    this.clock = clock;
    this.audit = audit;
  }

  /**
   * Reserve `envId` for `user` for `ttlSeconds`. Re-reserving an env you already hold extends it.
   * The reservation only counts if it was audited; if auditing fails, the env must stay as it was.
   */
  async reserve(envId: string, user: string, ttlSeconds: number): Promise<Reservation> {
    const env = this.getEnv(envId);
    if (this.isHeld(env) && env.owner !== user) {
      throw new EnvBusyError(envId, env.owner!);
    }

    await this.audit.record({ action: "reserve", envId, user, at: this.clock.now() });

    env.owner = user;
    env.expiresAt = this.clock.now() + ttlSeconds;
    return { envId, user, expiresAt: env.expiresAt };
  }

  /**
   * Release an env you hold. Releasing an env that isn't held (free or expired) is a no-op.
   * Releasing someone else's env throws NotOwnerError.
   */
  async release(envId: string, user: string): Promise<void> {
    const env = this.getEnv(envId);
    env.owner = null;
    await this.audit.record({ action: "release", envId, user, at: this.clock.now() });
  }

  /** Who holds the env right now, or null. */
  holder(envId: string): string | null {
    const env = this.getEnv(envId);
    return this.isHeld(env) ? env.owner : null;
  }

  /** Free env ids, sorted. */
  listFree(): string[] {
    return [...this.envs.entries()]
      .filter(([, env]) => !this.isHeld(env))
      .map(([id]) => id)
      .sort();
  }

  private getEnv(envId: string): EnvState {
    return this.envs.get(envId)!;
  }

  private isHeld(env: EnvState): boolean {
    return env.owner !== null && this.clock.now() < env.expiresAt;
  }
}
