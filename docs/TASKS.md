# TASKS — epam-go-links

Give Claude Code **one task at a time**: "Do Task N from docs/TASKS.md." Review the diff, run the app or tests, commit, then continue.

## Git workflow: one branch and one pull request per task

`main` only receives changes through pull requests. For each task:

```bash
git switch main && git pull
git switch -c <branch from the task>        # e.g. feat/scaffold
# … Claude Code does the task, you review the diff, tests pass …
git add -A && git commit -m "<commit message from the task>"
git push -u origin HEAD
gh pr create --fill                          # or open the PR on github.com
gh pr merge --squash --delete-branch         # after reviewing the PR yourself
```

- **Squash merge** keeps one clean commit per task on `main`.
- In each PR description write two lines: what changed and how you verified it.
- You can review and merge your own PRs; no approvals are required.

Tasks marked *optional* can be skipped; list anything skipped under "Next steps" in the README.

---

## Task 1 — Scaffold
- Create `package.json` (`"type": "module"`, `"engines": { "node": ">=26" }`, `"packageManager": "pnpm@<output of pnpm -v>"`), `tsconfig.json` (strict), `vite.config.ts` with the proxy, and the folder layout from `CLAUDE.md`.
- Install with pnpm: `pnpm add fastify zod react react-dom` and `pnpm add -D typescript tsx vite @vitejs/plugin-react vitest concurrently @types/react @types/react-dom @types/node`.
- pnpm blocks dependency install scripts by default. If it warns about `esbuild` (used by Vite and tsx), allow it with `pnpm approve-builds` or `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` in `package.json`.
- Scripts: `dev`, `test`, `typecheck`, `build`.
- Add `.gitignore` (node_modules, dist). Commit `pnpm-lock.yaml`.

**Done when:** `pnpm dev` starts both processes and `pnpm typecheck` passes.
**Branch:** `chore/scaffold` · **Commit:** `chore: scaffold project`

## Task 2 — Shared validation
- `shared/link.ts`: `normalizeSlug`, zod schemas for slug, URL, description and the create payload, following SPEC §3 (reserved words, http/https only, lengths). Export the `Link` type.
- `test/link-validation.test.ts`: valid slugs, normalization (`"Design-System "`), invalid characters, double hyphens, reserved words, `javascript:` URL, relative URL, too-long values.

**Done when:** tests pass.
**Branch:** `feat/link-validation` · **Commit:** `feat: shared link validation`

## Task 3 — Repository + API
- `LinkRepository` interface: `list(query?)`, `get(slug)`, `create(input)`, `recordVisit(slug)`.
- `InMemoryLinkRepository` with a `Map` and the seed data from SPEC §2.
- `server/errors.ts`: `AppError(code, status, message, details?)` and a Fastify error handler producing the SPEC §4 error format (zod errors → `VALIDATION_ERROR` with field details; unknown errors → `INTERNAL_ERROR` without leaking details).
- `server/app.ts`: `buildApp({ repo })` with request IDs (reuse a valid incoming `x-request-id`, else UUID) echoed in the response header.
- Routes: `GET /api/links`, `GET /api/links/:slug`, `POST /api/links`, `GET /health`.

**Done when:** typecheck passes and manual `curl` calls return the status codes in the SPEC.
**Branch:** `feat/links-api` · **Commit:** `feat: links API with validation and error handling`

## Task 4 — Redirect route
- `GET /go/:slug` per SPEC §4: 302 + `Cache-Control: no-store` and visit count; unknown → `/?missing=<slug>`; invalid → `/?invalid=<raw>`.
- Domain log events: `link_created`, `link_redirect`, `link_miss`.

**Branch:** `feat/redirect` · **Commit:** `feat: go/:slug redirect`

## Task 5 — API tests
`test/api.test.ts` with `app.inject()` and a fresh repository per test:
1. `POST` valid → 201, `Location` header, then appears in `GET /api/links`.
2. `POST` duplicate → 409 `SLUG_TAKEN`.
3. `POST` invalid → 400 with `details` for `slug` and `url`.
4. `GET /go/oncall` → 302 to the URL, and `visits` becomes 1.
5. `GET /go/unknown` → 302 to `/?missing=unknown`.
6. Responses include `x-request-id`; an incoming valid ID is echoed back.

**Branch:** `test/api` · **Commit:** `test: API behavior`

## Task 6 — Web UI
- `web/src/api.ts`: typed `listLinks`, `createLink`; parse the error JSON into `{ code, message, fieldErrors }`.
- `App.tsx`: header, banner for `?missing` / `?invalid`, `CreateLinkForm`, `SearchBox`, `LinkList`.
- Follow SPEC §6 for states (loading, empty, no results, error + retry), copy button, `aria-live` status, field errors with `aria-describedby`, focus management.
- `styles.css`: simple, readable, visible focus outlines, responsive down to mobile width.

**Done when:** you can create a link, see it, search it, copy it and visit it; errors show under the right field; it works with the keyboard only.
**Branch:** `feat/web-ui` · **Commit:** `feat: web UI`

## Task 7 — README
Use the README skeleton below. Keep it honest and short.

**Branch:** `docs/readme` · **Commit:** `docs: README`

## Task 8 — Optional
- Visit count sorting toggle, or "most visited" badge.
- A `GET /api/metrics` endpoint with total links, redirects and misses.

---

## README skeleton

```markdown
# epam-go-links

A small internal go-links service: create memorable shortcuts like `go/oncall` and get redirected to the real URL.

## Run it
Requires Node.js 26 (LTS) and pnpm.
    pnpm install
    pnpm dev           # API on :3000, web on http://localhost:5173
    pnpm test

Try it: open http://localhost:5173/go/oncall, or http://localhost:5173/go/new-thing to see the "create it" flow.

## What's included
- Create, list/search and visit shortcuts
- Validation shared between client and server (zod)
- Consistent error format with request IDs
- Structured logs, visit counts, health endpoint
- Accessible form and list (labels, aria-live, keyboard)

## Assumptions
- Internal tool on a trusted network; no authentication in v1.
- Slugs are lowercase and case-insensitive; one level (no `go/team/page`).
- In production, `go` would be a DNS alias pointing to this service.

## Trade-offs
- **In-memory storage**, behind a `LinkRepository` interface: zero setup to run; data resets on restart. Swapping in SQLite/Postgres means one new repository class.
- **302 instead of 301** so link targets can change.
- **Fastify over NestJS** for a small service: built-in logging and request IDs with less ceremony.
- **One package** instead of a monorepo: simpler to run; split into pnpm workspaces later if it grows.
- **pnpm**: fast installs and a strict dependency tree (no phantom dependencies).
- No editing/deleting yet: it needs ownership rules first (who can change a link?).

## How I used AI
I wrote a spec and project instructions first (CLAUDE.md, docs/SPEC.md, docs/TASKS.md), then used Claude Code task by task, reviewing every diff and running the tests after each step.

## Next steps
- Persistent storage (Postgres) with migrations
- SSO + link ownership, edit/delete with an audit trail
- Detect broken destinations (periodic checks)
- Metrics endpoint/dashboard (top links, misses → links people expect)
- Browser extension or DNS setup so `go/` works without the host
- E2E tests with Playwright
```
