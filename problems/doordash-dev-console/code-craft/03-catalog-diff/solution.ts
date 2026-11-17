import type { CatalogDiff, DanglingDependency, Entity } from "./types";

/** Parts 1 and 2. */
export function diffCatalog(before: Entity[], after: Entity[]): CatalogDiff {
  throw new Error("Not implemented");
}

/** Part 3. */
export function danglingDependencies(snapshot: Entity[]): DanglingDependency[] {
  throw new Error("Not implemented");
}
