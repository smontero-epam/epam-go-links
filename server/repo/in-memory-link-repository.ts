import type { CreateLinkInput, Link } from "../../shared/link.ts";
import { SlugTakenError, type LinkRepository } from "./link-repository.ts";

export const SEED_LINKS: readonly CreateLinkInput[] = [
  {
    slug: "design-system",
    url: "https://design.example.com",
    description: "Component library and guidelines",
  },
  {
    slug: "oncall",
    url: "https://wiki.example.com/oncall",
    description: "On-call schedule and runbooks",
  },
  {
    slug: "payroll",
    url: "https://hr.example.com/payroll",
    description: "Payroll portal",
  },
];

type InMemoryLinkRepositoryOptions = {
  seed?: readonly CreateLinkInput[];
  now?: () => Date;
};

function matchesQuery(link: Link, query: string): boolean {
  const needle = query.toLowerCase();
  return [link.slug, link.url, link.description ?? ""].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

export class InMemoryLinkRepository implements LinkRepository {
  readonly #links = new Map<string, Link>();
  readonly #now: () => Date;

  constructor({ seed = SEED_LINKS, now = () => new Date() }: InMemoryLinkRepositoryOptions = {}) {
    this.#now = now;
    for (const input of seed) {
      this.#insert(input);
    }
  }

  async list(query?: string): Promise<Link[]> {
    const links = [...this.#links.values()];
    const matching = query ? links.filter((link) => matchesQuery(link, query)) : links;
    return matching.sort((a, b) => a.slug.localeCompare(b.slug)).map(copyLink);
  }

  async get(slug: string): Promise<Link | undefined> {
    const link = this.#links.get(slug);
    return link && copyLink(link);
  }

  async create(input: CreateLinkInput): Promise<Link> {
    if (this.#links.has(input.slug)) {
      throw new SlugTakenError(input.slug);
    }
    return copyLink(this.#insert(input));
  }

  async recordVisit(slug: string): Promise<Link | undefined> {
    const link = this.#links.get(slug);
    if (!link) {
      return undefined;
    }
    link.visits += 1;
    link.lastVisitedAt = this.#now().toISOString();
    return copyLink(link);
  }

  #insert({ slug, url, description }: CreateLinkInput): Link {
    const link: Link = { slug, url, createdAt: this.#now().toISOString(), visits: 0 };
    if (description !== undefined) {
      link.description = description;
    }
    this.#links.set(slug, link);
    return link;
  }
}

// Callers get copies so they can't mutate stored state, as with a real database.
function copyLink(link: Link): Link {
  return { ...link };
}
