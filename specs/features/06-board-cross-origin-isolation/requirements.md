# Cross-origin isolation for /board: requirements

Roadmap phase 6. The isolation headers still target the deleted `/editor` page, so `/board` is not
isolated. The worker gets no SharedArrayBuffer, and Python `input()` raises `EOFError` even though
the board already has an answer box (`RunInput`) waiting for it.

## Scope

- `/board/*` sends `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`. `/py-worker.js` sends the same COEP.
- Delete the `/editor/:path*` rule.
- Entering the board (start or resume a lesson from `/lessons` or a lesson page) and leaving it
  (the board's links back to `/lessons`) become full page loads.
- When `input()` runs on a page that isn't isolated, the student sees a short, kid-friendly note
  telling them to try another browser (Chrome or Safari), as well as the error.
- Docs: remove the `CLAUDE.md` known issue, and update the `project-architecture` and `ai-tutor`
  skill lines that say the board isn't isolated.

## Non-goals

- No site-wide isolation. Only `/board` and the worker get the headers.
- No change to how tasks are checked or completed. Lesson checks still feed `inputs` up front
  through the check worker. That is a separate worker path and needs no SharedArrayBuffer.
- No prompt change, so no tutor-eval run.
- No new lessons or new `input()` tasks.

## Decisions and why

- **`require-corp`, not `credentialless`.** Safari doesn't support `credentialless`, and every
  browser on an iPad or iPhone runs Safari's engine, so `credentialless` would leave all iOS
  students with the bug. Everything the board loads from another site today (the Pyodide files on
  jsDelivr, the Google Fonts CSS and font files) sends `Cross-Origin-Resource-Policy: cross-origin`,
  so nothing breaks. The board shows no outside images.
- **`/board` only, with full-page entry and exit.** COOP and COEP only take effect when a page
  fully loads. A client-side navigation into the board would leave it unisolated, and one out of
  it would carry the strict policy onto other pages. Site-wide headers would avoid the reload, but
  every outside asset on every page (staff, invoices, future avatars) would then need CORP or CORS.
  The cost is one reload when a lesson opens.
- **Friendly note, not silence.** With `require-corp`, almost no student should be unisolated.
  For the few who are, a raw `EOFError` looks like their bug when it isn't.

## Constraints

- The page and the worker must use the same COEP value. If the worker has no COEP that Safari
  understands, Safari refuses to start it under a `require-corp` page.
- From now on, any outside resource loaded on `/board` must send CORP or CORS headers. Say so in
  the `next.config.js` comment.
- COOP `same-origin` cuts `window.opener` links. Sign-in happens on `/login`, not the board, so
  nothing is affected today. Don't add popups to the board.
- No migration, no env change, no shipped task id touched.
