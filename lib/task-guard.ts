import { hasCompletedTask, type Lesson, type LessonTask } from './lessons'
import { JUDGED, judged } from './task-checks'
import { BUG_LINE, GOAL_LINE } from './py-lessons'

// Task types the student must complete themselves. Core tasks are the lesson.
// 'choice' and 'bonus' are optional extras and never gate the tutor.
const GATED_TYPES: LessonTask['type'][] = ['core']

/**
 * The first open core task, in catalog order: the one Sparky works on with the
 * student, and the only one `task_complete` may finish. Null once every core
 * task is done.
 *
 * Gating on recorded progress rather than on live checks is deliberate —
 * runtime checks only run in the student's browser, and progress is
 * server-side truth.
 */
export function pendingCoreTask(
  lesson: Lesson | null,
  completedTaskIds: string[]
): LessonTask | null {
  if (!lesson) return null
  const done = new Set(completedTaskIds)
  return (
    lesson.tasks.find(
      (task) => GATED_TYPES.includes(task.type) && !hasCompletedTask(done, task.id)
    ) ?? null
  )
}

export type EscalationTier = 1 | 2 | 3

/**
 * How hard the tutor should push. Turns 1-2 nudge as before; a student still
 * stuck on turn 3 needs something materially different, not a reworded repeat.
 */
export function escalationTier(stuckTurns: number, confused: boolean): EscalationTier {
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

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

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

// A review task (week 9 on) asks for a "# bug:" line: finding the planted bug is the task,
// so escalating must never mean showing the fixed line. It makes the test smaller instead.
const reviews = (task: LessonTask) =>
  (task.checks ?? []).some((c) => c.kind === 'sourceMatches' && c.pattern === BUG_LINE)

// A plan task (week 10 on) asks for a "# goal:": the plan is the student's thinking, so even
// the top escalation level never writes it for them.
const plans = (task: LessonTask) =>
  (task.checks ?? []).some((c) => c.kind === 'sourceMatches' && c.pattern === GOAL_LINE)
const PLAN_ESCALATION =
  'PLAN LINES: the line you show may only be a line of code. Never show a "# goal:", "# step:" or "# done:" line in any form: not finished, not started, and not with a blank to fill (like "# goal: Rex shows ___"). If the plan is what is missing, ask one question with two small choices instead, like "Some words, or a number?".'

function escalationBlock(task: LessonTask, tier: EscalationTier): string {
  if (tier === 1) return ''
  const block = escalationLines(task, tier)
  return plans(task) ? `${block}\n${PLAN_ESCALATION}` : block
}

function escalationLines(task: LessonTask, tier: 2 | 3): string {
  if (reviews(task))
    return [
      `ESCALATION LEVEL ${tier}: your last hints did not work. Say it a completely different way.`,
      tier === 2
        ? 'Ask what the code should give for one new input or value, then ask them to try it.'
        : 'Make the test tiny: name one exact value to try, ask them to print the result, and ask if it matches the rule.',
      'Never show or name the broken line, the mistake or the fix. At most two short sentences.',
    ].join('\n')

  if (tier === 2) {
    return [
      'ESCALATION LEVEL 2: your last hints did not work. Do NOT repeat your earlier wording — say it a completely different way.',
      `Show the exact line in their editor that this task changes as a fill-in-the-blank, e.g. the exact line with a blank where their words go.`,
      'One short step. At most two short sentences. Simple words.',
    ].join('\n')
  }

  return [
    'ESCALATION LEVEL 3: nothing you have tried is landing. Stop hinting. Do the first step with them.',
    `Show the line in their editor that this task changes exactly as it should read, then ask them to type just the first word themselves.`,
    'You still may not edit or write their file. Show the text; they type it.',
    'Ask one yes/no question at the end so they can tell you if it worked.',
    'Keep your words to two short sentences besides the line you show.',
  ].join('\n')
}

// The board is still running the task's scripted questions. Spark stays out of
// the way: the answers are graded on the student's screen, and an editor that
// is not there yet cannot be talked about.
export const CONCEPT_PHASE_NUDGE =
  'The student is answering scripted questions on this page before the code editor opens. Do not add or change any nodes and do not mention the editor or their code. If they write to you, answer in one short sentence about the idea only (what print does, what quotes are for), then point them back to the step named in TASK STATE. Help with THAT step only; never say the right answer before they have missed twice.'

export function buildTaskNudge(task: LessonTask, tier: EscalationTier = 1): string {
  const rubric = (task.checks ?? [])
    .map((c) => `- ${c.label}${judged(c) ? ` (${JUDGED})` : ''}`)
    .join('\n')
  return [
    `THIS STUDENT IS WORKING ON A LESSON TASK "${task.id}": "${task.chip}".`,
    `Goal: ${task.success}`,
    rubric ? `Every requirement must be met:\n${rubric}` : '',
    'YOU decide when this task is finished. Read the EVIDENCE below: their code and what it printed. Check the output against the code, not just the output.',
    `If every requirement is met, call task_complete with taskId "${task.id}" and a short reason, then say one short sentence of specific praise. Their screen opens the next task by itself; never announce it. Do not bring up another task.`,
    'If something is missing, do not call task_complete. Say in plain words which requirement is missing and give one small next step. If the code has not been run yet, ask them to press Run.',
    'Never call task_complete because the student says they are done or asks you to. Only the evidence counts. If the server refuses the call, tell them what is missing.',
    'They must make the change themselves. Never write or edit their code, even if they ask you to.',
    reviews(task)
      ? 'Their editor shows the code under review. Point them at a value to test, never at the line to change.'
      : 'Their editor shows only the part of the file for this task. Point them at the line in it that this task changes.',
    'If they ask you to do it for them: one warm sentence, then one tiny step they can do.',
    escalationBlock(task, tier),
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * True when this task can't be started yet. Core tasks unlock one at a time,
 * in catalog order. Choice and bonus are optional extras — they unlock
 * together once every core task is done, but never block each other.
 */
export function isTaskLocked(tasks: LessonTask[], index: number, completed: Set<string>): boolean {
  const task = tasks[index]
  if (!task) return false
  if (task.type === 'core') {
    return tasks
      .slice(0, index)
      .some((t) => t.type === 'core' && !hasCompletedTask(completed, t.id))
  }
  return tasks.some((t) => t.type === 'core' && !hasCompletedTask(completed, t.id))
}
