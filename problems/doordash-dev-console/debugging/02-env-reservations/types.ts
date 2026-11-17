export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export interface AuditEntry {
  action: "reserve" | "release";
  envId: string;
  user: string;
  at: number;
}

/** Compliance requires every reservation change to be audited. May be slow; may fail. */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export interface Reservation {
  envId: string;
  user: string;
  /** Epoch ms. The environment is free again at exactly this time. */
  expiresAt: number;
}

export class EnvNotFoundError extends Error {
  constructor(envId: string) {
    super(`Unknown environment: ${envId}`);
    this.name = "EnvNotFoundError";
  }
}

export class EnvBusyError extends Error {
  readonly heldBy: string;
  constructor(envId: string, heldBy: string) {
    super(`${envId} is reserved by ${heldBy}`);
    this.name = "EnvBusyError";
    this.heldBy = heldBy;
  }
}

export class NotOwnerError extends Error {
  constructor(envId: string, user: string) {
    super(`${user} does not hold ${envId}`);
    this.name = "NotOwnerError";
  }
}
