# Cross-origin isolation for /board: validation

## Acceptance

- Opening a lesson from `/lessons` the normal way (clicking it, not typing the URL) lands on a
  board where `window.crossOriginIsolated` is `true`, in laptop Chrome and on a real iPad.
- On that board, running a Week 3 `input()` task shows the answer box. Typing an answer lets the
  program continue, and the answer shows in the output. Sparky can then complete the task.
- Python still loads on the board in both browsers (no "Python could not start").
- Clicking back to `/lessons` gives a normal page: `crossOriginIsolated` is `false` there.
- On a page that isn't isolated, `input()` shows the friendly note next to the error.
- The board still looks right at phone, tablet and laptop widths: fonts load, and Sparky talks.

## Tests

- A unit test on `next.config.js`'s `headers()`: `/board/:path*` has COOP `same-origin` and
  COEP `require-corp`, `/py-worker.js` has COEP `require-corp`, and no rule mentions `/editor`.
- A hook test (jsdom, not isolated): an `EOFError` from `input()` adds the friendly note.

## Commands (all must pass)

```bash
bun run test
bun run lint            # only the known no-page-custom-font warning
bun run format:check
```

## By hand (owner, before merge)

On a Vercel preview, open a Week 3 lesson from `/lessons` on a real iPad and in laptop Chrome.
Answer an `input()` and check the task completes. Start a new lesson, then press the browser's
Back button: `/lessons` reloads with no stuck spinner, and the new lesson shows as started. In
DevTools, check that the console shows no blocked-resource (COEP) errors.
