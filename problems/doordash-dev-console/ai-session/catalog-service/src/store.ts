import type { Lifecycle, Service } from "./types";

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
const LIFECYCLES: Lifecycle[] = ["experimental", "production", "deprecated"];

export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
    this.field = field;
  }
}

/** Validates untrusted input (e.g. a POST body) into a Service. */
export function parseService(input: unknown): Service {
  if (typeof input !== "object" || input === null) throw new ValidationError("body", "must be an object");
  const raw = input as Record<string, unknown>;

  if (typeof raw.name !== "string" || !NAME_PATTERN.test(raw.name)) {
    throw new ValidationError("name", "must be lowercase kebab-case, 2-63 chars");
  }
  if (typeof raw.owner !== "string" || raw.owner.length === 0) {
    throw new ValidationError("owner", "is required");
  }
  if (!LIFECYCLES.includes(raw.lifecycle as Lifecycle)) {
    throw new ValidationError("lifecycle", `must be one of ${LIFECYCLES.join(", ")}`);
  }
  if (raw.tier !== 1 && raw.tier !== 2 && raw.tier !== 3) {
    throw new ValidationError("tier", "must be 1, 2 or 3");
  }
  const tags = raw.tags ?? [];
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
    throw new ValidationError("tags", "must be an array of strings");
  }

  return {
    name: raw.name,
    owner: raw.owner,
    lifecycle: raw.lifecycle as Lifecycle,
    tier: raw.tier,
    description: typeof raw.description === "string" ? raw.description : undefined,
    tags: [...new Set(tags.map((t) => t.toLowerCase()))],
    links: typeof raw.links === "object" && raw.links !== null ? (raw.links as Service["links"]) : {},
    oncallRotation: typeof raw.oncallRotation === "string" ? raw.oncallRotation : undefined,
    lastDeployAt: typeof raw.lastDeployAt === "number" ? raw.lastDeployAt : undefined,
  };
}

export interface ListFilter {
  owner?: string;
  lifecycle?: Lifecycle;
}

/** In-memory catalog. In production this is Postgres; the interface is what matters. */
export class CatalogStore {
  private readonly services = new Map<string, Service>();

  upsert(service: Service): { created: boolean } {
    const created = !this.services.has(service.name);
    this.services.set(service.name, structuredClone(service));
    return { created };
  }

  get(name: string): Service | undefined {
    const s = this.services.get(name);
    return s && structuredClone(s);
  }

  remove(name: string): boolean {
    return this.services.delete(name);
  }

  /** Sorted by name. */
  list(filter: ListFilter = {}): Service[] {
    return [...this.services.values()]
      .filter((s) => (filter.owner ? s.owner === filter.owner : true))
      .filter((s) => (filter.lifecycle ? s.lifecycle === filter.lifecycle : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => structuredClone(s));
  }
}
