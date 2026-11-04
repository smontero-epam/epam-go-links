import type { CreateLinkInput, Link } from "../../shared/link.ts";

/**
 * Storage boundary for links. Methods are async so a database-backed
 * implementation can replace the in-memory one without touching the routes.
 * Slugs passed in are already normalized.
 */
export interface LinkRepository {
  /** Links sorted by slug, optionally filtered by slug, URL or description (case-insensitive). */
  list(query?: string): Promise<Link[]>;
  get(slug: string): Promise<Link | undefined>;
  /** @throws {SlugTakenError} when the slug already exists. */
  create(input: CreateLinkInput): Promise<Link>;
  /** Increments the visit count; returns the updated link, or undefined if it doesn't exist. */
  recordVisit(slug: string): Promise<Link | undefined>;
}

// Uniqueness is enforced by the repository (a unique index in a real database),
// so check-then-insert races can't create duplicates.
export class SlugTakenError extends Error {
  constructor(readonly slug: string) {
    super(`Slug "${slug}" already exists`);
    this.name = "SlugTakenError";
  }
}
