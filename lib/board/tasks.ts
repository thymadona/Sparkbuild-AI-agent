import type { Lesson, LessonTask } from '@/lib/lessons'
import type { BoardState } from './reducer'
import type { BoardNode } from './schema'
import { pageCode, pageCodeNodeId } from './code'

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

// The program a task's editor opens with, or null when the task has no starter of
// its own (it then works in the shared file, see `blockOf`). A task that builds
// on an earlier one starts from that page's final code, then its own starter.
export function taskStarter(board: BoardState, task: LessonTask): string | null {
  if (task.starter === undefined) return null
  const base = task.from ? pageCode(board, `${PREFIX}${task.from}`) : null
  return base ? `${base.replace(/\n*$/, '')}\n\n${task.starter}` : task.starter
}

// The project file a task is worked in. Only multi-file tasks (bugzap) name one,
// and they do it on their checks; everything else is the lesson's entry file.
export function taskFile(task: LessonTask, entry: string): string {
  for (const check of task.checks ?? [])
    if ('file' in check && check.file && check.file !== task.then?.file) return check.file
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

// --- Concept steps: scripted questions shown before a task's editor -----------

// Deterministic, so a reload resumes where the student was and a double-run
// effect cannot add a step twice.
export const stepNodeId = (task: LessonTask, i: number) =>
  `step_${task.id.replace(/[^a-zA-Z0-9_]/g, '_')}_${i}`

export function stepNode(task: LessonTask, i: number): BoardNode | null {
  const step = task.steps?.[i]
  if (!step) return null
  const base = {
    id: stepNodeId(task, i),
    parentId: null,
    createdBy: 'system' as const,
    answered: false,
  }
  if (step.kind === 'try') {
    return {
      ...base,
      type: 'sandbox',
      prompt: step.prompt,
      template: step.template,
      chips: step.chips ?? [],
      value: '',
      said: '',
      seen: [],
      need: step.need,
    }
  }
  if (step.kind === 'learn')
    return { ...base, type: 'learn', prompt: step.prompt, frames: step.frames, frame: 0 }
  // Tiles start reversed (never the answer) and stay put across a reload.
  if (step.kind === 'order')
    return {
      ...base,
      type: 'order',
      prompt: step.prompt,
      lines: step.lines,
      arranged: [],
      attempts: 0,
    }
  if (step.kind === 'bug')
    return {
      ...base,
      type: 'bug',
      prompt: step.prompt,
      code: step.code,
      bugLine: step.bugLine,
      explain: step.explain,
      picked: null,
      attempts: 0,
    }
  if (step.kind === 'stage')
    return {
      ...base,
      type: 'stage',
      prompt: step.prompt,
      scene: step.scene,
      config: step.config ?? {},
      goal: step.goal,
      palette: step.palette,
      solution: step.solution,
      program: [],
      attempts: 0,
    }
  if (step.kind === 'match')
    return {
      ...base,
      type: 'match',
      prompt: step.prompt,
      pairs: step.pairs,
      matched: [],
      picked: null,
      attempts: 0,
    }
  return {
    ...base,
    type: 'quiz',
    kind: step.code ? 'predict_output' : 'multiple_choice',
    prompt: step.prompt,
    code: step.code,
    options: step.options,
    answer: step.answer,
    explain: step.explain,
    picked: null,
    attempts: 0,
  }
}

// Sparky's cheer for finishing the step before, so each new box opens with a pat on the back.
// Cycles by step number: varied, never the same one twice in a row.
const CHEERS = [
  'Great job!',
  'Good job!',
  'Nice one!',
  'Awesome!',
  'Well done!',
  'You got it!',
  'Super!',
  'Way to go!',
]
export const cheer = (i: number) => CHEERS[i % CHEERS.length]

// What the student has to DO on a step, in words a 10-year-old can follow. Said by Sparky when the box
// opens, and given to the tutor, so nobody is left staring at a card wondering what to press.
export function stepAction(node: BoardNode): string {
  switch (node.type) {
    case 'learn':
      return node.frame >= node.frames.length - 1
        ? 'Tap Got it when you are ready.'
        : 'Tap Next to keep going.'
    case 'sandbox':
      return node.chips.length
        ? 'Tap a line, then press Say it.'
        : 'Type your words. Then press Say it.'
    case 'quiz':
      return 'Tap the answer you think is right.'
    case 'order':
      return 'Tap the lines in order. Then press Say it.'
    case 'bug':
      return 'Tap the line with the mistake.'
    case 'match':
      return 'Tap a code piece. Then tap what it does.'
    case 'stage':
      return 'Tap blocks to build a program. Then press Run.'
    default:
      return ''
  }
}

// The next step to reveal: the first whose node is missing, provided every
// step already shown is answered. null when nothing is due (a step is still
// open, or all are shown).
export function nextStepIndex(board: BoardState, task: LessonTask): number | null {
  const steps = task.steps ?? []
  for (let i = 0; i < steps.length; i++) {
    const n = board.nodes[stepNodeId(task, i)]
    if (!n) return i
    if (!('answered' in n) || !n.answered) return null
  }
  return null
}

// True while a task with steps has no editor yet. The task's code is then
// nothing: the caller must not fall back to boardCode (a previous task's
// program), or the checks would judge, and auto-complete on, code the student
// never wrote for this task.
export function awaitingEditor(
  board: BoardState,
  task: LessonTask | null,
  pageId: string | null
): boolean {
  return !!task?.steps?.length && !pageCodeNodeId(board, pageId)
}
