import type { LessonTaskType } from '@/lib/lessons'

export const TASK_LABELS: Record<LessonTaskType, string> = {
  core: 'Core mission',
  choice: 'Make it yours',
  bonus: 'Bonus challenge',
  homework: 'Homework',
}

// Type scale for lesson UI. Keeps everything at 14px or larger and drops the
// letterspaced 10px caps, which are the hardest thing on screen to read.
export const SCALE = {
  label: 'text-xs font-semibold', chip: 'text-sm leading-snug', check: 'text-base', hint: 'text-base', button: 'text-sm', meta: 'text-sm',
}
