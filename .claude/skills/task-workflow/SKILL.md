---
name: task-workflow
description: Carry out one task or feature in epam-go-links end to end — branch from main, implement against docs/SPEC.md, verify with typecheck/tests, and hand back a summary with a commit message and PR description. Use when asked to "do Task N", add a feature, or fix a bug in this repo.
---

# Doing a task in epam-go-links

`CLAUDE.md` holds the rules; this is the order to apply them in, plus gotchas found while building v1.

## 1. Start clean

1. `git status --short` must be clean. If the previous task's branch has uncommitted work, stop and ask.
2. Confirm the previous PR is merged: `git fetch -q && git log --oneline -3 origin/main`.
3. `git switch main && git pull --ff-only && git switch -c <branch>` — use the branch name from `docs/TASKS.md`; otherwise `feat/…`, `fix/…`, `test/…`, `docs/…` or `chore/…`.

## 2. Read before writing

- Read the relevant section of `docs/SPEC.md`. If the spec doesn't cover a case (a status code, a response shape, an edge case), **ask the developer** with concrete options and a recommendation, then write the decision back into `docs/SPEC.md` in the same branch.
- Probe library behaviour you're unsure of with a throwaway script before building on it. Put it in a scratch directory, never in the repo, and use a `.mts` extension so tsx treats it as an ES module.

## 3. Implement

- Shared rules (slug, URL, description) live only in `shared/link.ts`; server and web import them.
- New routes: a Fastify plugin in `server/routes/`, registered in `server/app.ts`; throw `AppError` (or let zod throw) so `server/errors.ts` produces the standard error JSON.
- Storage goes through `LinkRepository` only.
- Stay inside the task. If you notice something outside it (e.g. a deprecation warning), report it and suggest a separate branch instead of fixing it in place.

## 4. Verify

    pnpm typecheck
    pnpm test

Also run `pnpm build` when web code changed. For server behaviour, start the server and `curl` the routes you touched (see the `verify-ui` skill for process cleanup). For UI changes, use the `verify-ui` skill.

## 5. Hand back

Summarize: what changed, how it was verified (with real results, including failures), and anything for the README (assumptions, trade-offs). Suggest a commit message and a two-line PR description (what changed / how verified). Don't commit, push or open PRs unless asked.

## Gotchas seen on this project

- **`node` not found** in a shell that predates the Node install: prepend `C:\Program Files\nodejs` to `PATH` for that command (`export PATH="/c/Program Files/nodejs:$PATH"` in Git Bash).
- **pnpm 12** records allowed build scripts (esbuild) under `allowBuilds` in `pnpm-workspace.yaml`. Keep that file.
- **zod 4**: use `.overwrite()` to normalize while keeping string checks, and `{ abort: true }` to get one message per field.
- **Fastify routing**: `/go/:slug` returns JSON errors for nested or over-long paths, which is why the redirect route is `/go/*`.
