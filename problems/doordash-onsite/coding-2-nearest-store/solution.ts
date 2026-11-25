import type { Store } from "./types";

/**
 * For each query (a store name), return the name of the nearest OTHER store that shares
 * its avenue (x) or its street (y), or null if there is none.
 */
export function nearestStores(stores: Store[], queries: string[]): (string | null)[] {
  throw new Error("Not implemented");
}
