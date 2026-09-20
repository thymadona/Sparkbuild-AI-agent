import type { Lesson, LessonTask } from '@/lib/lessons'
import type { BoardState } from './reducer'

// One board page per lesson task, in catalog order. The page id is derived from
// the task id rather than invented by the tutor, so the binding survives a
// reload and cannot drift: page "t_name-tag" is always the "Save your name" task.
//
// Pages that do not match this shape are "loose" — a board migrated by
// boardFromFiles ("p_main"), or one drawn freehand before this existed. They
// still render; they just have no task attached.
const PREFIX = 't_'

export const taskPageId = (task: LessonTask) => `${PREFIX}${task.id}`

export function taskForPageId(lesson: Lesson | null, pageId: string | null): LessonTask | null {
  if (!lesson || !pageId?.startsWith(PREFIX)) return null
  const id = pageId.slice(PREFIX.length)
  return lesson.tasks.find((t) => t.id === id) ?? null
}

export function taskIndexForPageId(lesson: Lesson | null, pageId: string | null): number {
  const task = taskForPageId(lesson, pageId)
  return task && lesson ? lesson.tasks.indexOf(task) : -1
}

// Whether this task's page has been opened yet.
export const hasTaskPage = (board: BoardState, task: LessonTask) =>
  board.pages.some((p) => p.id === taskPageId(task))

// The node id for a task's code node. Node ids allow only letters, digits and
// underscore (lib/board/schema.ts NodeId), but task ids contain hyphens.
export const taskCodeNodeId = (task: LessonTask) => `code_${task.id.replace(/[^a-zA-Z0-9_]/g, '_')}`

// The project file a task is worked in. Only multi-file tasks (bugzap) name one,
// and they do it on their checks; everything else is the lesson's entry file.
export function taskFile(task: LessonTask, entry: string): string {
  for (const check of task.checks ?? []) if ('file' in check && check.file) return check.file
  return entry
}

// Homework is done after class and stays shut until the lesson itself is
// finished. isTaskLocked deliberately does not cover this (the old task panel
// gated it separately), so the board applies the same rule here.
export function isTaskOpen(lesson: Lesson, index: number, done: Set<string>): boolean {
  const task = lesson.tasks[index]
  if (!task) return false
  if (task.type !== 'homework') return true
  return lesson.tasks.every((t) => t.type !== 'core' || done.has(t.id))
}
