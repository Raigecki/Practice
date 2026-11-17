// Fixed version — spoilers. Each fix is marked FIX #n (see BUGS.md).
import type { AuditLog, Clock, Reservation } from "./types";
import { EnvBusyError, EnvNotFoundError, NotOwnerError } from "./types";

interface EnvState {
  owner: string | null;
  expiresAt: number;
}

export class EnvReservations {
  private readonly envs = new Map<string, EnvState>();
  private readonly clock: Clock;
  private readonly audit: AuditLog;

  constructor(envIds: string[], clock: Clock, audit: AuditLog) {
    for (const id of envIds) this.envs.set(id, { owner: null, expiresAt: 0 });
    this.clock = clock;
    this.audit = audit;
  }

  async reserve(envId: string, user: string, ttlSeconds: number): Promise<Reservation> {
    const env = this.getEnv(envId);
    if (this.isHeld(env) && env.owner !== user) {
      throw new EnvBusyError(envId, env.owner!);
    }

    // FIX #1: claim synchronously, right after the check. No await between check and write,
    // so no other reserve() can interleave (JS is single-threaded between awaits).
    const previous = { ...env };
    const now = this.clock.now();
    env.owner = user;
    env.expiresAt = now + ttlSeconds * 1000; // FIX #2: seconds → milliseconds

    try {
      await this.audit.record({ action: "reserve", envId, user, at: now });
    } catch (err) {
      // FIX #1 (cont.): audit failed → the reservation doesn't count; roll back.
      // Only roll back if nobody changed it in the meantime.
      if (env.owner === user && env.expiresAt === now + ttlSeconds * 1000) Object.assign(env, previous);
      throw err;
    }
    return { envId, user, expiresAt: env.expiresAt };
  }

  async release(envId: string, user: string): Promise<void> {
    const env = this.getEnv(envId);
    if (!this.isHeld(env)) return; // FIX #3: no-op (and no audit entry) when not held
    if (env.owner !== user) throw new NotOwnerError(envId, user); // FIX #3: owner check
    env.owner = null;
    await this.audit.record({ action: "release", envId, user, at: this.clock.now() });
  }

  holder(envId: string): string | null {
    const env = this.getEnv(envId);
    return this.isHeld(env) ? env.owner : null;
  }

  listFree(): string[] {
    return [...this.envs.entries()]
      .filter(([, env]) => !this.isHeld(env))
      .map(([id]) => id)
      .sort();
  }

  private getEnv(envId: string): EnvState {
    const env = this.envs.get(envId);
    if (!env) throw new EnvNotFoundError(envId); // FIX #4: typed error instead of a TypeError
    return env;
  }

  private isHeld(env: EnvState): boolean {
    return env.owner !== null && this.clock.now() < env.expiresAt;
  }
}
