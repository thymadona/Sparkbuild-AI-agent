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

export type EscalationTier = 1 | 2 | 3

/**
 * How hard the tutor should push. Turns 1-2 nudge as before; a student still
 * stuck on turn 3 needs something materially different, not a reworded
 * repeat. Homework caps at tier 2 — tier 3 hands over the target text, which
 * is exactly what the homework gate exists to withhold.
 */
export function escalationTier(stuckTurns: number, confused: boolean, isHomework: boolean): EscalationTier {
  if (isHomework) return stuckTurns >= 2 || confused ? 2 : 1
  if (confused || stuckTurns >= 4) return 3
  if (stuckTurns >= 2) return 2
  return 1
}

// Exact normalized phrases only — substring matching would fire on "help me
// add a button", which is a normal request, not confusion. Tuning knob: this
// list is a heuristic, extend it from real transcripts.
const CONFUSION_PHRASES = new Set([
  'how',
  'how do i',
  'how do i do it',
  'what',
  'huh',
  'idk',
  'i dont know',
  'i dont get it',
  'i dont understand',
  'im confused',
  'im stuck',
  'still stuck',
  'help',
  'help me',
  'i cant',
  'it doesnt work',
])

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()

/**
 * A student saying "how?" or re-sending the same message verbatim is stuck,
 * whatever the turn counter says. Exact repetition is the signature of the
 * transcript this feature exists to fix.
 */
export function detectConfusion(prompt: string, prevUserMessage?: string): boolean {
  const now = normalize(prompt)
  if (!now) return false
  if (CONFUSION_PHRASES.has(now)) return true
  return prevUserMessage != null && now === normalize(prevUserMessage)
}

function escalationBlock(task: LessonTask, tier: EscalationTier, isHomework: boolean): string {
  if (tier === 1) return ''

  if (tier === 2) {
    return [
      'ESCALATION LEVEL 2: your last hints did not work. Do NOT repeat your earlier wording — say it a completely different way.',
      isHomework
        ? `Narrow to the exact line with the comment "${task.commentAnchor}" and ask one question about what they want it to say. Never state the answer text — this is homework.`
        : `Show the exact line with the comment "${task.commentAnchor}" as a fill-in-the-blank, e.g. the exact tag with a blank where their words go.`,
      'One short step. No more than three sentences. Simple words — they are about 10.',
    ].join('\n')
  }

  return [
    'ESCALATION LEVEL 3: nothing you have tried is landing. Stop hinting. Do the first step with them.',
    `Show the line with the comment "${task.commentAnchor}" exactly as it should read, then ask them to type just the first word themselves.`,
    'You still may not edit or write their file. Show the text; they type it.',
    'Ask one yes/no question at the end so they can tell you if it worked.',
  ].join('\n')
}

export function buildTaskNudge(task: LessonTask, tier: EscalationTier = 1): string {
  const isHomework = task.type === 'homework'
  return [
    `THIS STUDENT IS WORKING ON ${isHomework ? 'HOMEWORK' : 'A LESSON TASK'}: "${task.chip}".`,
    `Goal: ${task.success}`,
    'They must make this change themselves. Never write or edit their code, even if they ask you to.',
    isHomework ? 'This is homework. Doing it for them defeats the point — hint only.' : '',
    `Point them at the line that contains the comment "${task.commentAnchor}".`,
    'If they ask you to do it for them: one warm sentence, then one tiny step they can do.',
    escalationBlock(task, tier, isHomework),
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

/** True when an earlier, non-homework task in the list isn't done yet. Homework has its own gate (coreComplete). */
export function isTaskLocked(tasks: LessonTask[], index: number, completed: Set<string>): boolean {
  const task = tasks[index]
  if (!task || task.type === 'homework') return false
  return tasks.slice(0, index).some((t) => t.type !== 'homework' && !completed.has(t.id))
}
