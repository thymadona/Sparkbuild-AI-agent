# Cross-origin isolation for /board: plan

Read `requirements.md` first. Two groups.

## 1. Isolate the board

- **Goal:** `/board/[id]` loads cross-origin isolated in every browser, including iPad Safari,
  so `input()` asks for its answer in the box under the code. Entering and leaving the board are
  full page loads. The dead `/editor` rule is gone.
- **Skills:** `project-architecture`, `ai-tutor`.
- **Risk:** the worker's policy doesn't match the page's, and Python never starts ("Python could
  not start"). An entry to the board still does a client-side navigation, so the headers never
  apply. A future outside asset without CORP or CORS stops loading on the board.
- **Gate:** continue.

## 2. Friendly fallback, docs, ship

- **Goal:** when a page still isn't isolated, a student who hits `input()` sees a friendly note
  instead of a raw `EOFError`. `CLAUDE.md` and the skills say the board is isolated. The PR ticks
  roadmap phase 6.
- **Skills:** `ai-tutor`.
- **Risk:** the note fires on an `EOFError` that isn't from `input()`, or it hides the error from
  the tutor's run evidence. The note should sit next to the error, not replace it.
- **Gate:** stop for review. The owner does the iPad check by hand before merge.
