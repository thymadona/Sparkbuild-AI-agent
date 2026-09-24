# Delete dead code: plan

Two groups, each small enough for one review. Read `requirements.md` first. Skills:
`project-architecture`, then `ai-tutor` for the board and hook.

## 1. Delete files and trim the hook

- Delete `components/SparkyWorld.tsx`, `components/PythonRunner.tsx`, `app/board/page.tsx`,
  `app/board/BoardClient.tsx`, `app/board/fixture.ts`, `lib/lesson-project.ts` and `PROGRESS.md`.
- `hooks/usePythonRunner.ts`: remove the `world` state, its setter in the `done` handler and the
  `world` return value. Drop the `SparkyEvent` import if it becomes unused. Keep `isolated`, which
  LiveBoard still needs.
- `public/py-runtime.py`: its header comment points at `components/SparkyWorld.tsx`. Say the
  events feed `worldContains` checks instead. The worker still sends `events`.
- Check that nothing imports the deleted files (`bunx tsc --noEmit`). Leave `proxy.ts` and
  `lib/auth/guard.ts` as they are.

## 2. Config, comments and docs, then ship

- `next.config.js`: delete the `/templates/:path*.html` block. In the `/editor` block's comment,
  replace "an up-front inputs box in PythonRunner" with the board's fallback path. The block
  itself stays for phase 6.
- Reword the stale comments to match today's behaviour:
  - `lib/task-guard.ts` (lines 5 and 11–13) and `lib/lessons.ts` (lines 4–6 and 134): the first
    open core task is the one Sparky works on and the only one `task_complete` may finish. There is
    no build mode. Line 134 says "re-locks build mode". Replace it with what really happens: later
    tasks lock again.
  - `app/api/projects/[id]/turn/route.ts:147` and `__tests__/helpers/db.ts:97`: drop the
    `/api/generate` reference and say which code reads `updated_at` now.
  - `app/board/TaskHeader.tsx:27`: keep it only if it is still useful without naming "Mark done".
- Docs:
  - `CLAUDE.md` Known issues: remove the dead-files bullet. Keep "Comments still mention…" only if
    anything is left.
  - `.claude/skills/project-architecture/SKILL.md`: the "History" paragraph (no `PROGRESS.md`,
    director is built now) and "Known dead code".
  - `.claude/skills/ai-tutor/SKILL.md`: the file-table row for `page.tsx`/`BoardClient`/`fixture`,
    and the dead-code bullet.
  - `.claude/skills/lesson-authoring/SKILL.md:163`: `scene` has no renderer. Drop the SparkyWorld
    mention.
  - `.claude/skills/lesson-progress/SKILL.md`: the `lib/lesson-project.ts` row and its two
    known-issue bullets, and "build mode" in the Gating section.
- Work through `validation.md`, open the PR and tick roadmap phase 4. The PR notes no migration
  and no env change.
