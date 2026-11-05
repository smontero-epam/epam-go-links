# epam-go-links

A small internal go-links service: create memorable shortcuts like `go/oncall` and get redirected to the real URL.

## Run it

Requires Node.js 26 (LTS) and pnpm. The version is pinned in `.nvmrc` (`nvm use`, `fnm use`, etc.).

    pnpm install
    pnpm dev           # API on :3000, web on http://localhost:5173
    pnpm test
    pnpm typecheck
    pnpm test:e2e      # Playwright, Chromium; starts both dev servers (or reuses running ones)

Before the first `pnpm test:e2e`, download the browser once: `pnpm exec playwright install chromium`. The e2e tests share the dev servers' in-memory data, so each test creates its own uniquely named links.

Try it: open http://localhost:5173/go/oncall, or http://localhost:5173/go/new-thing to see the "create it" flow. (The seed links point to placeholder `example.com` hosts, so the destination page itself won't load.)

The server reads `PORT` (default `3000`), `HOST` (default `localhost`) and `LOG_LEVEL` (default `info`).

## What's included

- Create, list/search and visit shortcuts
- Validation shared between client and server (zod)
- Consistent error format with request IDs
- Structured logs, visit counts, health endpoint
- Accessible form and list (labels, aria-live, keyboard)

## API

Full contract in [docs/SPEC.md](docs/SPEC.md).

| Route | Result |
|---|---|
| `GET /api/links?q=` | `200 { items }`, sorted by slug; `q` matches slug, URL or description |
| `GET /api/links/:slug` | `200` link, or `404 LINK_NOT_FOUND` |
| `POST /api/links` | `201` + `Location`, `400 VALIDATION_ERROR`, or `409 SLUG_TAKEN` |
| `GET /go/:slug` | `302` to the URL; unknown → `/?missing=`, invalid → `/?invalid=` |
| `GET /health` | `200 { "status": "ok" }` |
| `GET /api/metrics` | `200 { links, redirects, misses }` (misses reset on restart) |

Every error looks like this and carries the same ID as the `x-request-id` response header:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The request is invalid.",
             "details": [{ "field": "slug", "message": "…" }] },
  "requestId": "9f0c2e2a-…" }
```

## Project layout

    shared/link.ts     zod schemas + slug normalization, used by server and web
    server/app.ts      buildApp({ repo }): request IDs, logging, error handling, routes
    server/routes/     links (/api/links), redirect (/go/*), health
    server/repo/       LinkRepository interface + in-memory implementation
    web/src/           React app: api.ts (typed fetch), hooks.ts, components/
    test/              validation unit tests + API tests via app.inject()
    e2e/               Playwright browser tests (create, validation, search, copy, redirects, keyboard)

## Working on it with Claude Code

Read `CLAUDE.md` (rules) and `docs/SPEC.md` (contract) first. The `.claude/` folder adds:

| | Name | Use it for |
|---|---|---|
| Skill | `task-workflow` | One task end to end: branch, implement against the spec, verify, summary + PR text |
| Skill | `verify-ui` | Running the app and checking a change in the browser, keyboard only, then cleaning up processes |
| Agent | `unit-test-writer` | Vitest unit/API tests (`test/`), via `app.inject()` |
| Agent | `e2e-test-writer` | Playwright tests (`e2e/`); on first use it asks before installing Playwright |

Skills load when a request matches them (or call them as `/task-workflow`, `/verify-ui`). Ask for an agent by name, e.g. "use the e2e-test-writer agent to cover the create flow".

## Observability

- One JSON log line per request: `method`, `url`, `statusCode`, `durationMs`, `requestId`.
- Domain events: `link_created { slug }`, `link_redirect { slug, visits }`, `link_miss { slug }`.
- A valid incoming `x-request-id` (8–64 chars of `[A-Za-z0-9_-]`) is reused, so logs can be correlated across services; otherwise a UUID is generated.
- Unexpected errors are logged with the stack; clients only get `INTERNAL_ERROR` and the request ID. The UI shows that ID in error messages, so a user report can be matched to the log line.
- `visits` and `lastVisitedAt` per link, shown in the UI; the list can be sorted by visits.
- `GET /api/metrics`: total links, redirects (sum of visits) and misses (unknown slugs people tried).

## Assumptions

- Internal tool on a trusted network; no authentication in v1.
- Slugs are lowercase and case-insensitive; one level (no `go/team/page` — nested paths are treated as invalid names).
- In production, `go` would be a DNS alias pointing to this service.
- Unknown fields in a request body are ignored, not rejected. URLs are stored as entered (trimmed), not rewritten.

## Trade-offs

- **In-memory storage**, behind a `LinkRepository` interface: zero setup to run; data resets on restart. Swapping in SQLite/Postgres means one new class implementing the interface (with a unique index on `slug`, since the repository is what guarantees uniqueness) passed to `buildApp({ repo })` in `server/index.ts`.
- **302 instead of 301** so link targets can change. All redirects send `Cache-Control: no-store`, so a "missing" redirect doesn't stick once the link is created.
- **Fastify over NestJS** for a small service: built-in logging and request IDs with less ceremony.
- **One package** instead of a monorepo: simpler to run; split into pnpm workspaces later if it grows.
- **pnpm**: fast installs and a strict dependency tree (no phantom dependencies). `pnpm-workspace.yaml` only exists because pnpm 12 records the esbuild build-script approval there.
- No editing/deleting yet: it needs ownership rules first (who can change a link?).
- **`/go/*` wildcard route** instead of `/go/:slug`, so nested or over-long paths still get the friendly "invalid name" redirect instead of a JSON error in the browser.
- **Error codes beyond the original spec:** `NOT_FOUND` for unknown routes, and `VALIDATION_ERROR` with the real status for malformed JSON (400), unsupported content type (415) and oversized bodies (413). Added to SPEC §4.
- **Server-side search** (debounced 200 ms) rather than filtering in the browser: one implementation of the matching rules, and it keeps working when the list grows.
- **Table that scrolls sideways on small screens** instead of collapsing into cards, so it keeps real table semantics for screen readers.
- **The submit button uses `aria-disabled` while saving** instead of `disabled`, so keyboard focus isn't lost; repeat submits are still ignored.

## How it was built

The spec and project instructions came first (CLAUDE.md, docs/SPEC.md, docs/TASKS.md); the code was then written with Claude Code task by task, one branch and pull request per task, reviewing every diff and running the typecheck and tests after each step. Where the spec had a gap (error codes for unknown routes and Fastify's own 4xx errors), the agent stopped and asked instead of guessing, and the decision went back into the spec. The UI was checked by driving Chrome with the keyboard only, which caught a real bug (the page scrolled sideways at phone width).

## Next steps

- Persistent storage (Postgres) with migrations
- SSO + link ownership, edit/delete with an audit trail
- Detect broken destinations (periodic checks)
- Metrics dashboard and persisted miss counts per slug (misses → links people expect)
- Browser extension or DNS setup so `go/` works without the host
- Serve the built web app from the same server for a single-process deployment
