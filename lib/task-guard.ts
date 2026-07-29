import type { Lesson, LessonTask } from './lessons'

// Task types the student must complete themselves. Core tasks are the lesson;
// homework is the assignment. Both withhold build mode. 'choice' and 'bonus' are
// optional extras and never block it.
const GATED_TYPES: LessonTask['type'][] = ['core', 'homework']

/**
 * Keeps the lesson and the homework the student's work rather than the AI's.
 *
 * While a gated task is still open, build mode is withheld for that project: the
 * tutor may point and explain, but it may not write the file. Once the gated
 * tasks are done, build mode returns, so creative and bonus work is unrestricted.
 *
 * Gating on recorded progress rather than on live checks is deliberate — the
 * check evaluator needs a DOM, which the Node runtime does not have, and
 * progress is server-side truth.
 */
export function pendingCoreTask(lesson: Lesson | null, completedTaskIds: string[]): LessonTask | null {
  if (!lesson) return null
  const done = new Set(completedTaskIds)
  return lesson.tasks.find((task) => GATED_TYPES.includes(task.type) && !done.has(task.id)) ?? null
}

export function buildTaskNudge(task: LessonTask): string {
  const isHomework = task.type === 'homework'
  return [
    `THIS STUDENT IS WORKING ON ${isHomework ? 'HOMEWORK' : 'A LESSON TASK'}: "${task.chip}".`,
    `Goal: ${task.success}`,
    'They must make this change themselves. Never write or edit their code, even if they ask you to.',
    isHomework ? 'This is homework. Doing it for them defeats the point — hint only.' : '',
    `Point them at the line that contains the comment "${task.commentAnchor}".`,
    'If they ask you to do it for them: one warm sentence, then one tiny step they can do.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Homework tasks for a lesson, in catalog order. */
export function homeworkTasks(lesson: Lesson | null): LessonTask[] {
  return (lesson?.tasks ?? []).filter((task) => task.type === 'homework')
}

/** True when every homework task for the lesson is recorded as complete. */
export function homeworkComplete(lesson: Lesson | null, completedTaskIds: string[]): boolean {
  const homework = homeworkTasks(lesson)
  if (homework.length === 0) return false
  const done = new Set(completedTaskIds)
  return homework.every((task) => done.has(task.id))
}
