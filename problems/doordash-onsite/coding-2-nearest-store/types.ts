export interface Store {
  /** Unique across all stores. */
  name: string;
  /** Avenue number. Stores on the same avenue share x. */
  x: number;
  /** Street number. Stores on the same street share y. */
  y: number;
}
