/** A simplified Backstage catalog entity (think: one parsed catalog-info.yaml). */
export interface Entity {
  kind: string; // "Component", "API", "System", ...
  /** Defaults to "default". */
  namespace?: string;
  name: string;
  /** e.g. "group:payments" */
  owner: string;
  lifecycle: "experimental" | "production" | "deprecated";
  tags: string[];
  /** Entity refs: "kind:namespace/name", or "kind:name" for the default namespace. */
  dependsOn: string[];
}

/** Normalized, lowercase "kind:namespace/name". */
export type EntityRef = string;

export type DiffField = "owner" | "lifecycle" | "tags" | "dependsOn";

export interface FieldChange {
  field: DiffField;
  /** For tags/dependsOn: sorted, de-duplicated (and for dependsOn, normalized) arrays. */
  before: string | string[];
  after: string | string[];
}

export interface ChangedEntity {
  ref: EntityRef;
  /** In DiffField order: owner, lifecycle, tags, dependsOn. */
  changes: FieldChange[];
}

export interface CatalogDiff {
  added: EntityRef[];
  removed: EntityRef[];
  changed: ChangedEntity[];
}

export interface DanglingDependency {
  ref: EntityRef;
  missing: EntityRef[];
}

export class DuplicateEntityError extends Error {
  readonly ref: EntityRef;
  constructor(ref: EntityRef) {
    super(`Duplicate entity in snapshot: ${ref}`);
    this.name = "DuplicateEntityError";
    this.ref = ref;
  }
}
