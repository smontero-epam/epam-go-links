---
name: verify-ui
description: Run epam-go-links locally and check a change in a real browser, keyboard only, then clean up the dev processes. Use after changing anything in web/ or a route the UI depends on, or when asked to "check it in the browser".
---

# Verifying the app in a browser

## 1. Start the app

1. Make sure ports 3000 and 5173 are free first. If something is listening, find out what it is before acting: it may be the developer's own `pnpm dev`. Never stop a process you didn't start; use another port instead (`PORT=3100` for the API).
2. Run `pnpm dev` in the background and wait until both `http://localhost:5173/` and `http://localhost:3000/health` answer.

## 2. Use a browser on this machine

The dev server only listens on localhost. If browser automation reports `ERR_CONNECTION_REFUSED` while `curl` works, the connected browser is probably on another computer: list the connected browsers and ask the developer which one to use. Don't pick one yourself.

## 3. What to check

Drive it with the keyboard (Tab, Shift+Tab, Enter, Escape), and read state with small DOM queries rather than relying only on screenshots:

- **Validation:** submit invalid input → messages under the right fields, `aria-invalid` and `aria-describedby` set, focus on the first invalid field. Server errors (e.g. 409) map to the field too.
- **Success:** the status region (`role="status"`, `aria-live="polite"`) announces it; the form clears; the list refreshes.
- **List states:** loading, empty, no search results, and load error with a working Retry. To simulate failures, temporarily replace `window.fetch` in the page, then restore it — don't stop the server.
- **Redirect flows:** `/go/<unknown>` (banner, slug pre-filled, focus on URL), `/go/Bad%20Name` (naming-rules banner), and a known link (redirect, then visits go up after going back).
- **Narrow screens:** if resizing the window doesn't change `innerWidth` (a maximized window), load the app in a 375px-wide iframe and compare `document.documentElement.scrollWidth` with `clientWidth`. Only the table region should scroll sideways.
- **Console:** no errors.

Keep track of how many Tab stops you press; one extra can activate a link and navigate away.

## 4. Clean up

Stopping a background task doesn't always stop the Node processes it spawned (notably on Windows). After stopping, check ports 3000/5173 (and any extra port you used) and stop leftover processes **only if** their command line is this project's `tsx`/`vite` and you started them. Close any browser tabs you opened.
