/**
 * Counters that don't belong to any single link. In-memory, so they reset on
 * restart; visit counts live on the links themselves and survive a storage swap.
 */
export class RedirectMetrics {
  #misses = 0;

  recordMiss(): void {
    this.#misses += 1;
  }

  get misses(): number {
    return this.#misses;
  }
}
