import type { TaskCheck } from './task-checks'
import { PY_LESSONS } from './py-lessons'

// 'homework' tasks are done at home, after class. Like core tasks they hold back
// build mode, so the AI cannot do the assignment for the student.
export type LessonTaskType = 'core' | 'choice' | 'bonus' | 'homework'

// Projects pin the catalog version they were created on. Only the Python
// course (3) exists now; older versions resolve to no lesson.
export const CURRENT_LESSON_VERSION = 3

// Scripted concept steps a task page shows before its code editor opens
// (app/board/LiveBoard.tsx reveals them one at a time). Graded on the client with
// no LLM call: a wrong answer twice shows the answer, then Next moves on, so a step never dead-ends a child.
export type LessonStep =
  | {
      kind: 'choose'
      prompt: string
      code?: string
      options: string[]
      answer: number
      explain: string
    }
  // A tiny live preview: the student fills `template`'s {} (tap a chip or type) and Sparky says it.
  | { kind: 'try'; prompt: string; template: string; chips?: string[]; need: number }
  // Explain first: one frame per idea, a line of code and what Sparky says about it.
  // `hl` is the part of `code` to light up; `speak` is what Sparky says aloud (absent: he just listens).
  | {
      kind: 'learn'
      prompt: string
      frames: { code: string; note: string; hl?: string; speak?: string }[]
    }
  // Tap the lines into order (`lines` is the right order), then Sparky says them.
  | { kind: 'order'; prompt: string; lines: string[] }
  // Tap the broken line (`bugLine` counts from 0 in `code`).
  | { kind: 'bug'; prompt: string; code: string; bugLine: number; explain: string }
  // A live scene (lib/board/scenes): tap blocks into a program, Run, reach the goal.
  // `solution` indexes `palette`; a test checks that it really wins.
  | {
      kind: 'stage'
      scene: 'room' | 'grid' | 'boxes' | 'machine'
      prompt: string
      config?: Record<string, unknown>
      goal: Record<string, unknown>
      palette: { label: string; ops: string[] }[]
      solution: number[]
    }
  // Step through a short program one line at a time (frames are checked against a real run in a test).
  // `vars` maps a name to its value, or to a list of items; `out` is what was printed so far.
  | { kind: 'walk'; prompt: string; code: string; frames: WalkFrame[] }
  // Tap a code piece, then what it does.
  | { kind: 'match'; prompt: string; pairs: { left: string; right: string }[] }

export interface WalkFrame {
  line: number
  vars: Record<string, string | string[]>
  out?: string
  stack?: string[]
  note?: string
}

export interface LessonTask {
  id: string
  type: LessonTaskType
  chip: string
  success: string
  prompt: string
  // Tasks that share one starter file find their block by this `# TASK: <id>`
  // comment. A task with its own `starter` has no anchor: it is its own program.
  commentAnchor?: string
  // This task's own program, seeded into its code node when its page opens. The
  // checks then judge that program alone, never the code of a neighbouring task.
  starter?: string
  // Start from the final code of this earlier task (`starter` is appended), for
  // tasks that build on what the student made, like the boss and the homework.
  from?: string
  // How the student works it out: 🔮 predict, ✏️ change, 🛠 make, 🐞 bugzap,
  // 💬 direct the AI, 📝 explain. Only shown as an icon.
  kind?: 'predict' | 'change' | 'make' | 'bugzap' | 'direct' | 'explain'
  // The week's boss fight: worth extra XP, and finishing it earns the badge.
  boss?: boolean
  // When present, the student cannot mark the task done until the file shows
  // the change. Tasks without checks stay self-reported.
  checks?: TaskCheck[]
  // Concept steps before the editor. Absent: the page opens straight on the editor.
  steps?: LessonStep[]
  // What to do in the editor, said once above it when the steps end. Without it
  // the editor would appear with no word about what to change.
  go?: string
  // A second, separate program for the same task, shown under the first once
  // check `after` (an index into `checks`) passes. It is its own file with its
  // own code block, Run button and output, so the two run independently.
  then?: { file: string; source: string; go: string; after: number }
}

export interface Lesson {
  id: number
  title: string
  description: string
  // Key of the starter program in lib/lessons/templates.ts.
  templateFile: string
  // File the student edits and runs (main.py).
  starterFile: string
  // Extra files seeded next to the starter: project filename -> template path.
  extraFiles?: Record<string, string>
  // The scene Sparky lives in for this week's Output tab (weeks with a world).
  scene?: 'robot' | 'vault'
  // Badge earned by beating the boss task.
  badge?: string
  // Who writes the code. 'tutor' (default): the student types it and build
  // mode stays locked until core work is done. 'director': the student
  // directs the AI, so build mode is open and tasks are checked by outcome.
  aiPolicy?: 'tutor' | 'director'
  // One short line telling the student what this week's homework is about.
  homeworkBrief?: string
  tasks: LessonTask[]
}

export const LESSONS: Lesson[] = PY_LESSONS

// A project pinned to any other version predates the Python course and has no
// lesson to resolve to. Bump the version by adding a catalog — never edit the
// old one in place, since lesson_progress stores task ids as plain strings.
export function getLessonForProject(lessonId: number, lessonVersion: number | null) {
  if (lessonVersion !== CURRENT_LESSON_VERSION) return null
  return LESSONS.find((lesson) => lesson.id === lessonId) ?? null
}
