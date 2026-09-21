---
name: xp-and-streak
description: How the game layer works — XP per task type (`XP_PER_TASK`, `XP_BOSS`), the 7 levels (`LEVELS`, `levelFor`), badges won by a lesson's boss task (`badgesFor`), XP derived from `lesson_progress` at read time (`xpFor`), and the streak stored in `activity_days` (`recordActivity` on task completion, `streakFor`, `todayISO` with `APP_TIMEZONE`), plus `getPlayerStats` and where `PlayerCard` renders it. Use for anything mentioning XP, points, level, level up, badge, streak, daily streak, activity_days, PlayerCard, player stats, getPlayerStats, recordActivity, APP_TIMEZONE, timezone, gamification, rewards, leaderboard. Use this before exploring `lib/xp.ts`, `lib/player-stats.ts`, `components/PlayerCard.tsx` — it already maps them.
---

# XP, levels, badges (derived) and streak (stored)

XP, level and badges are **computed from `lesson_progress` + the catalog** on every read; only
the streak needs a table.

## Files

| Path                                           | Exports                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/xp.ts`                                    | `XP_PER_TASK`, `XP_BOSS`, `LEVELS`, `taskXp(task)`, `xpFor(rows)`, `badgesFor(rows)`, `levelFor(xp)`, `streakFor(days, today)`, `todayISO(now?)`, types `ProgressRow`, `PlayerStats`. Pure. |
| `lib/player-stats.ts`                          | `getPlayerStats(userId) → PlayerStats` (fail-open to zeros), `recordActivity(userId)`.                                                                                                      |
| `lib/db/schemas/activity-days.ts`              | `activity_days (user_id uuid FK cascade, day date)` PK `(user_id, day)`.                                                                                                                    |
| `components/PlayerCard.tsx`                    | Level name, XP bar, streak pill, badges. Rendered by `app/lessons/page.tsx` (`LessonsClient` sidebar) and `app/dashboard/page.tsx`.                                                         |
| `app/board/TaskHeader.tsx`, `lib/lesson-ui.ts` | `+N XP` per task via `taskXp`; labels `TASK_LABELS` (Core mission / Make it yours / Bonus challenge / Homework; boss → 🏆 Boss fight).                                                      |

## Values

```ts
XP_PER_TASK = { core: 10, choice: 15, bonus: 20, homework: 15 }
XP_BOSS = 40                     // taskXp(task) = task.boss ? XP_BOSS : XP_PER_TASK[task.type]
LEVELS = [Rookie 0, Coder 100, Scripter 250, Debugger 450, Agent 750, Director 1100, Studio Head 1700]
```

`levelFor(xp) → { name, next: string | null, into, span }` — highest level with
`xp >= threshold`; `into`/`span` drive the progress bar; `span = 0` at the top level.

## How XP and badges are computed

`ProgressRow = { lessonId, lessonVersion, completedTaskIds }` — one per project, joined from
`lesson_progress ⋈ projects where projects.user_id = ?`.

- `xpFor`: for each row, resolve the lesson with `getLessonForProject(lessonId, lessonVersion)`
  (rows from old versions contribute nothing); **dedupe by `${version}:${lessonId}`** so a task
  counts once even if a student has two projects for the same lesson; sum `taskXp` for done
  ids that still exist in the catalog.
- `badgesFor`: `lesson.badge` when the lesson's `boss` task id is in the done set.
- Consequence: removing or renaming a task id in the catalog silently changes everyone's XP —
  see the versioning rule in `lesson-authoring`.

## Streak

- `recordActivity(userId)` — `INSERT INTO activity_days (user_id, day) VALUES (?, todayISO()) ON CONFLICT DO NOTHING`.
  **Only caller: `recordTaskDone` (`lib/task-progress.ts`)**, once the tutor's `task_complete`
  has passed the turn route's guard and the write committed (errors swallowed, logged; a repeat
  of an already-done task records nothing). Resetting progress (PUT) records nothing; merely
  opening the board records nothing.
- `todayISO(now)` — `Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'UTC' })`.
  Set `APP_TIMEZONE` (e.g. `Asia/Phnom_Penh`) or the day boundary is UTC midnight.
- `getPlayerStats` reads `activity_days` for the user, `ORDER BY day DESC LIMIT 400`, then
  `streakFor(days, todayISO())`: start at today if present, else yesterday (a streak survives
  until the end of the next day), count consecutive `YYYY-MM-DD` days backwards (UTC date
  arithmetic on the strings — correct because the strings are already zone-adjusted).

## Not built (the plan mentions them; progress does not record the inputs)

+5 "solo" bonus (no hint used) and +5 "predict" bonus (first-try guess).

## Tests

- `__tests__/unit/lib/xp.test.ts` — `xpFor`, `badgesFor`, `levelFor`, `streakFor` across month/year boundaries, `todayISO` with `APP_TIMEZONE=Asia/Phnom_Penh`.
- `__tests__/integration/player-stats.test.ts` — Rookie baseline, XP/badges scoped to the student, retired-course rows ignored, streak read from `activity_days`.
- `__tests__/integration/api/task-complete.test.ts` — one activity day on success, none on refusal.
