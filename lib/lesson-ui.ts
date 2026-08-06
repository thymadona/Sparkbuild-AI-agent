import type { LessonTaskType } from '@/lib/lessons'

export const TASK_LABELS: Record<LessonTaskType, string> = {
  core: 'Core mission',
  choice: 'Make it yours',
  bonus: 'Bonus challenge',
  homework: 'Homework',
}

// Type scale. Kid mode keeps everything at 14px or larger and drops the
// letterspaced 10px caps, which are the hardest thing on screen to read.
export const SCALE = {
  kid: { label: 'text-xs font-semibold', chip: 'text-lg leading-snug', check: 'text-base', hint: 'text-base', button: 'text-lg', meta: 'text-sm' },
  pro: { label: 'text-[10px] font-semibold uppercase tracking-wider', chip: 'text-sm', check: 'text-xs', hint: 'text-xs', button: 'text-sm', meta: 'text-xs' },
}
