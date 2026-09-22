import type { LessonTask, LessonTaskType } from '@/lib/lessons'

export const TASK_LABELS: Record<LessonTaskType, string> = {
  core: 'Core mission',
  choice: 'Make it yours',
  bonus: 'Bonus challenge',
}

// Type scale for lesson UI. Keeps everything at 14px or larger and drops the
// letterspaced 10px caps, which are the hardest thing on screen to read.
export const SCALE = {
  label: 'text-xs font-semibold',
  chip: 'text-sm leading-snug',
  check: 'text-base',
  hint: 'text-base',
  button: 'text-sm',
  meta: 'text-sm',
}

const KIND_ICON = {
  predict: '🔮',
  change: '✏️',
  make: '🛠',
  bugzap: '🐞',
  direct: '💬',
  explain: '📝',
} as const

// Small label above a task: what kind of task it is, or "Boss fight".
export function taskLabel(task: LessonTask) {
  const base = task.boss ? 'Boss fight' : TASK_LABELS[task.type]
  return `${task.boss ? '🏆' : task.kind ? KIND_ICON[task.kind] : ''} ${base}`.trim()
}
