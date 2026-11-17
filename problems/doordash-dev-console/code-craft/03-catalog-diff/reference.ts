// Reference solution — spoilers. Tests run against ./solution, not this file.
import type {
  CatalogDiff,
  ChangedEntity,
  DanglingDependency,
  DiffField,
  Entity,
  EntityRef,
  FieldChange,
} from "./types";
import { DuplicateEntityError } from "./types";

const DEFAULT_NAMESPACE = "default";

export function entityRef(e: Pick<Entity, "kind" | "namespace" | "name">): EntityRef {
  return `${e.kind}:${e.namespace ?? DEFAULT_NAMESPACE}/${e.name}`.toLowerCase();
}

/** "Component:payments" → "component:default/payments". */
export function normalizeRef(raw: string): EntityRef {
  const colon = raw.indexOf(":");
  const kind = raw.slice(0, colon);
  const rest = raw.slice(colon + 1);
  const withNamespace = rest.includes("/") ? rest : `${DEFAULT_NAMESPACE}/${rest}`;
  return `${kind}:${withNamespace}`.toLowerCase();
}

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

/** Canonical form of each diffable field, so comparison is a plain string/array equality. */
function canonical(e: Entity): Record<DiffField, string | string[]> {
  return {
    owner: e.owner.toLowerCase(),
    lifecycle: e.lifecycle,
    tags: uniqueSorted(e.tags),
    dependsOn: uniqueSorted(e.dependsOn.map(normalizeRef)),
  };
}

const FIELDS: DiffField[] = ["owner", "lifecycle", "tags", "dependsOn"];

function indexByRef(snapshot: Entity[]): Map<EntityRef, Entity> {
  const index = new Map<EntityRef, Entity>();
  for (const entity of snapshot) {
    const ref = entityRef(entity);
    if (index.has(ref)) throw new DuplicateEntityError(ref);
    index.set(ref, entity);
  }
  return index;
}

const sameValue = (a: string | string[], b: string | string[]): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

export function diffCatalog(before: Entity[], after: Entity[]): CatalogDiff {
  const prev = indexByRef(before);
  const next = indexByRef(after);

  const added = [...next.keys()].filter((ref) => !prev.has(ref)).sort();
  const removed = [...prev.keys()].filter((ref) => !next.has(ref)).sort();

  const changed: ChangedEntity[] = [];
  for (const [ref, nextEntity] of next) {
    const prevEntity = prev.get(ref);
    if (!prevEntity) continue;
    const a = canonical(prevEntity);
    const b = canonical(nextEntity);
    const changes: FieldChange[] = FIELDS.filter((f) => !sameValue(a[f], b[f])).map((field) => ({
      field,
      before: a[field],
      after: b[field],
    }));
    if (changes.length > 0) changed.push({ ref, changes });
  }
  changed.sort((x, y) => (x.ref < y.ref ? -1 : 1));

  return { added, removed, changed };
}

export function danglingDependencies(snapshot: Entity[]): DanglingDependency[] {
  const index = indexByRef(snapshot);
  const result: DanglingDependency[] = [];
  for (const [ref, entity] of index) {
    const missing = uniqueSorted(entity.dependsOn.map(normalizeRef)).filter((dep) => !index.has(dep));
    if (missing.length > 0) result.push({ ref, missing });
  }
  return result.sort((x, y) => (x.ref < y.ref ? -1 : 1));
}
