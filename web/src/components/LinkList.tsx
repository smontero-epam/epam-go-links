import { useEffect, useState } from "react";
import type { Link } from "../../../shared/link.ts";
import type { LinksState } from "../hooks.ts";

const COPIED_FEEDBACK_MS = 2000;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

type LinkListProps = {
  state: LinksState;
  onRetry: () => void;
  announce: (message: string) => void;
};

function shortcutUrl(slug: string): string {
  return `${window.location.origin}/go/${slug}`;
}

function summary(count: number, query: string): string {
  const noun = count === 1 ? "shortcut" : "shortcuts";
  return query ? `${count} ${noun} matching “${query}”` : `${count} ${noun}`;
}

type SortOrder = "slug" | "visits";

const SORT_ANNOUNCEMENTS: Record<SortOrder, string> = {
  slug: "Sorted by shortcut name, A to Z",
  visits: "Sorted by visits, most visited first",
};

// The API already returns links sorted by slug, so only "visits" needs sorting here.
function sortLinks(links: Link[], order: SortOrder): Link[] {
  if (order === "slug") {
    return links;
  }
  return [...links].sort((a, b) => b.visits - a.visits || a.slug.localeCompare(b.slug));
}

type SortButtonProps = {
  label: string;
  direction: "ascending" | "descending";
  active: boolean;
  onClick: () => void;
};

// The sort state is conveyed by aria-sort on the header cell; the arrow is visual only.
function SortButton({ label, direction, active, onClick }: SortButtonProps) {
  const arrow = direction === "ascending" ? "▲" : "▼";
  return (
    <button type="button" className="sort-button" onClick={onClick}>
      {label}
      <span className="sort-indicator" aria-hidden="true">
        {active ? arrow : "↕"}
      </span>
    </button>
  );
}

export function LinkList({ state, onRetry, announce }: LinkListProps) {
  const [copiedSlug, setCopiedSlug] = useState<string>();
  const [sortOrder, setSortOrder] = useState<SortOrder>("slug");

  function changeSort(order: SortOrder) {
    if (order !== sortOrder) {
      setSortOrder(order);
      announce(SORT_ANNOUNCEMENTS[order]);
    }
  }

  useEffect(() => {
    if (!copiedSlug) {
      return;
    }
    const timer = setTimeout(() => setCopiedSlug(undefined), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copiedSlug]);

  async function copyShortcut(slug: string) {
    const url = shortcutUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      announce(`Copied ${url}`);
    } catch {
      announce(`Couldn't copy automatically. The link is ${url}`);
    }
  }

  if (state.status === "loading") {
    return <p className="list-message">Loading shortcuts…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="list-message list-error" role="alert">
        <p>Couldn't load shortcuts. {state.message}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (state.links.length === 0) {
    return (
      <p className="list-message">
        {state.query ? `No shortcuts match “${state.query}”.` : "No shortcuts yet. Create the first one."}
      </p>
    );
  }

  return (
    <>
      <p className="list-summary" aria-live="polite">
        {summary(state.links.length, state.query)}
      </p>
      {/* Focusable so keyboard users can scroll the table on narrow screens. */}
      <div className="table-scroll" role="region" aria-labelledby="links-heading" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col" aria-sort={sortOrder === "slug" ? "ascending" : undefined}>
                <SortButton
                  label="Shortcut"
                  direction="ascending"
                  active={sortOrder === "slug"}
                  onClick={() => changeSort("slug")}
                />
              </th>
              <th scope="col">Destination</th>
              <th scope="col">Description</th>
              <th
                scope="col"
                className="numeric"
                aria-sort={sortOrder === "visits" ? "descending" : undefined}
              >
                <SortButton
                  label="Visits"
                  direction="descending"
                  active={sortOrder === "visits"}
                  onClick={() => changeSort("visits")}
                />
              </th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortLinks(state.links, sortOrder).map((link) => (
              <LinkRow
                key={link.slug}
                link={link}
                copied={copiedSlug === link.slug}
                onCopy={() => void copyShortcut(link.slug)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type LinkRowProps = { link: Link; copied: boolean; onCopy: () => void };

function LinkRow({ link, copied, onCopy }: LinkRowProps) {
  return (
    <tr>
      <th scope="row">
        <a href={`/go/${link.slug}`}>go/{link.slug}</a>
      </th>
      <td>
        <span className="truncate" title={link.url}>
          {link.url}
        </span>
      </td>
      <td>{link.description}</td>
      <td className="numeric">
        {link.visits.toLocaleString()}
        {link.lastVisitedAt && (
          <span className="last-visited">
            Last{" "}
            <time dateTime={link.lastVisitedAt}>{dateFormat.format(new Date(link.lastVisitedAt))}</time>
          </span>
        )}
      </td>
      <td>
        <button type="button" className="button-small" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
          <span className="visually-hidden"> link to go/{link.slug}</span>
        </button>
      </td>
    </tr>
  );
}
