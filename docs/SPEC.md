# SPEC — epam-go-links (v1)

## 1. Goal

Employees create short, memorable shortcuts to internal URLs and use them from the browser:
`go/oncall` → `https://wiki.example.com/oncall`.

Users can:
1. **Create** a shortcut.
2. **View and search** existing shortcuts.
3. **Visit** a shortcut and be redirected.

## 2. Data model

```ts
type Link = {
  slug: string;          // normalized, e.g. "design-system"
  url: string;           // absolute http(s) URL
  description?: string;  // optional, max 200 chars
  createdAt: string;     // ISO 8601
  visits: number;        // incremented on each successful redirect
  lastVisitedAt?: string;
};
```

Seed data (so the app isn't empty on first run):

| slug | url | description |
|---|---|---|
| `design-system` | `https://design.example.com` | Component library and guidelines |
| `oncall` | `https://wiki.example.com/oncall` | On-call schedule and runbooks |
| `payroll` | `https://hr.example.com/payroll` | Payroll portal |

## 3. Validation rules

**Slug**
- Trim whitespace and convert to lowercase before validating (`"Design-System "` → `"design-system"`).
- Allowed: lowercase letters, digits and single hyphens between them. Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Length: 1–64 characters.
- Reserved (rejected): `api`, `go`, `health`, `new`, `assets`.
- Must be unique (case-insensitive, guaranteed by normalization).

**URL**
- Required, trimmed, max 2048 characters.
- Must parse with `new URL()` and use the `http:` or `https:` protocol. Everything else (`javascript:`, `data:`, `ftp:`, relative URLs) is rejected. This prevents stored XSS and open redirects to non-web schemes.

**Description**
- Optional, trimmed, max 200 characters. Empty string is treated as absent.

## 4. API

All JSON. Every response includes an `x-request-id` header. If the request has a valid `x-request-id` (8–64 chars of `[A-Za-z0-9-_]`), reuse it; otherwise generate a UUID.

### `GET /api/links?q=<text>`
- Returns `200` with `{ "items": Link[] }`, sorted by slug.
- `q` (optional) filters case-insensitively by slug, URL or description.

### `GET /api/links/:slug`
- `200` with the `Link`, or `404 LINK_NOT_FOUND`.

### `POST /api/links`
Body: `{ "slug": string, "url": string, "description"?: string }`
- `201` with the created `Link` and a `Location: /api/links/<slug>` header.
- `400 VALIDATION_ERROR` with field details when the body is invalid.
- `409 SLUG_TAKEN` when the slug already exists.

### `GET /go/:slug`
- Found: `302` with `Location: <url>` and `Cache-Control: no-store`. Increment `visits`, set `lastVisitedAt`.
  - **302, not 301:** browsers cache 301s permanently, so changing a link's target later wouldn't work.
- Not found: `302` to `/?missing=<slug>`, so the UI can offer to create it (the classic go-links behavior). Log it as a miss.
- Invalid slug format (e.g. `go/Hello World!`): `302` to `/?invalid=<raw value>`, so the UI can explain the naming rules. A JSON error would be unfriendly here, because this route is visited directly in the browser.

### `GET /health`
- `200` with `{ "status": "ok" }`.

### `GET /api/metrics`
- `200` with `{ "links": number, "redirects": number, "misses": number }`.
- `redirects` is the sum of all links' `visits`. `misses` counts redirects for valid but unknown slugs (`link_miss`); invalid names are not counted. `misses` is in memory and resets on restart.

### Error format (all errors)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": [{ "field": "slug", "message": "Use lowercase letters, numbers and hyphens." }]
  },
  "requestId": "9f0c2e2a-…"
}
```

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body or params fail validation (`details` per field) |
| `VALIDATION_ERROR` | 400 / 413 / 415 | Request rejected before validation: malformed JSON, body too large, unsupported `Content-Type` (keeps the HTTP status, no `details`) |
| `LINK_NOT_FOUND` | 404 | Unknown slug on the API |
| `NOT_FOUND` | 404 | Unknown route |
| `SLUG_TAKEN` | 409 | Duplicate slug |
| `INTERNAL_ERROR` | 500 | Anything unexpected (generic message, details only in logs) |

## 5. Observability

- Structured JSON logs from Fastify/pino, one line per request with method, URL, status, duration and request ID.
- Domain log events with fields: `link_created { slug }`, `link_redirect { slug, visits }`, `link_miss { slug }`.
- `visits` and `lastVisitedAt` per link, shown in the UI.
- `GET /health` for load balancers and uptime checks.
- `GET /api/metrics` for totals: links, redirects and misses.

## 6. Web UI

One page.

**Header:** app name and a one-line explanation ("Short links to internal resources. Visit go/<name> in your browser.").

**Banner from redirects:**
- `?missing=<slug>`: "go/<slug> doesn't exist yet. Create it?" and pre-fill the form's slug, then focus the URL field.
- `?invalid=<raw>`: explain that the shortcut name isn't valid.

**Create form:**
- Fields: Shortcut (with a visible `go/` prefix), Destination URL, Description (optional).
- Client-side checks with the shared zod schema, and server errors mapped to the right field.
- On success: clear the form, show "Created go/<slug>" in an `aria-live="polite"` region, and refresh the list.
- On error: show the message under each field (`aria-describedby`, `aria-invalid`) and move focus to the first invalid field.
- Disable the submit button while saving.

**List:**
- Search box filtering by slug, URL or description (debounced ~200 ms, or client-side filtering of the loaded list).
- Each row: `go/<slug>` as a link to `/go/<slug>`, destination URL (truncated, full URL in `title`), description, visits, and a **Copy** button that copies `<origin>/go/<slug>`.
- States: loading, empty ("No shortcuts yet. Create the first one."), no search results, and load error with a **Retry** button.

**Accessibility:** semantic HTML (`main`, `form`, `table` or `ul`), labels on every input, visible focus styles, sufficient color contrast, keyboard-only use works end to end.

## 7. Out of scope for v1 (document in the README)

Authentication and ownership of links, editing and deleting, persistent storage, analytics dashboards, rate limiting, Docker, CI/CD, deployment, a real `go/` DNS alias or browser extension.
