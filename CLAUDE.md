# CLAUDE.md — epam-go-links

Context for Claude Code. Read this file, then `docs/SPEC.md`, before doing any task from `docs/TASKS.md`.

## What this is

A small internal **go links** service (`go/design-system` → `https://…`), built as a **60-minute interview exercise**. It is the first iteration a team would keep developing, so favor clarity and good judgment over features.

The evaluators care about: API design, validation, error handling, accessibility, maintainable code, project organization, observability and documentation. They explicitly do **not** want auth, Docker, CI/CD or deployment work.

## Stack (decided; don't change without asking)

- **Language:** TypeScript everywhere, `strict: true`.
- **Runtime:** Node.js 26 (LTS). ES modules (`"type": "module"`).
- **Server:** Fastify (current stable major) with its built-in pino logger and request IDs.
- **Validation:** zod (shared schemas in `shared/`, used by the server; the web app may import them for client-side checks).
- **Storage:** in-memory, behind a `LinkRepository` interface. No database. The README must say this is intentional and how to swap it.
- **Web:** React + Vite. Plain CSS (one stylesheet, CSS variables). No UI library.
- **Tests:** Vitest. Server tests use `app.inject()` (no network, no supertest).
- **Package manager:** **pnpm** only. Never use npm or yarn, and never create `package-lock.json` or `yarn.lock`. Commit `pnpm-lock.yaml`.
- **Dev runner:** `concurrently` + `tsx watch` for the server; Vite proxies `/api`, `/go` and `/health` to the server.

## Project layout

```
epam-go-links/
├── package.json            # one package; scripts below; "packageManager": "pnpm@<version>"
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts          # root: web/, proxy to http://localhost:3000
├── README.md
├── CLAUDE.md
├── .claude/
│   ├── skills/             # task-workflow, verify-ui
│   └── agents/             # unit-test-writer, e2e-test-writer
├── docs/
│   ├── SPEC.md
│   └── TASKS.md
├── shared/
│   └── link.ts             # zod schemas, slug normalization, types
├── server/
│   ├── index.ts            # starts the server (port 3000)
│   ├── app.ts              # buildApp(deps) → FastifyInstance (used by tests)
│   ├── errors.ts           # AppError + error handler (consistent error JSON)
│   ├── routes/
│   │   ├── links.ts        # /api/links
│   │   ├── redirect.ts     # /go/:slug
│   │   └── health.ts       # /health
│   └── repo/
│       ├── link-repository.ts            # interface
│       └── in-memory-link-repository.ts  # Map-based implementation + seed data
├── web/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts          # typed fetch helpers, parses the error JSON
│       ├── styles.css
│       └── components/     # LinkList, CreateLinkForm, SearchBox, etc.
└── test/
    ├── link-validation.test.ts
    └── api.test.ts
```

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Server on :3000 and Vite on :5173 together |
| `pnpm test` | Run Vitest once |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Build the web app (server runs with tsx) |

## Rules for the agent

1. **Work on one task from `docs/TASKS.md` at a time.** Don't start the next task until asked.
2. **Follow `docs/SPEC.md` exactly** for routes, status codes, payloads and validation. If something is unclear or seems wrong, stop and ask instead of guessing.
3. **Keep diffs small** and focused on the task. No refactors outside the task.
4. **After every task:** run `pnpm typecheck` and `pnpm test`, and fix failures before reporting done.
5. **No new dependencies** beyond the stack above without explaining why. Add them with `pnpm add` / `pnpm add -D`.
6. **Out of scope:** auth, users, editing/deleting links, Docker, CI, databases, deployment. Don't add them.
7. **Code style:** small functions, descriptive names, no `any`, no commented-out code. Comments explain *why*, not *what*.
8. **Errors:** never leak stack traces to clients. Every error response uses the format in `docs/SPEC.md` and includes the request ID.
9. **Logging:** use the Fastify logger (`request.log`), structured fields, never `console.log` in server code. Don't log full request bodies.
10. **Accessibility:** every input has a label; errors are linked with `aria-describedby`; status messages use an `aria-live` region; everything works with the keyboard.
11. When you finish a task, summarize: what changed, how you verified it, and anything to note for the README (assumptions, trade-offs).
12. **Git:** never commit to `main` directly. Each task is done on its own branch (name given in `docs/TASKS.md`) and merged through a pull request. Don't push, open PRs or merge unless the developer asks; suggest the commit message and a two-line PR description (what changed, how it was verified).
