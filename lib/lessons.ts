import type { TaskCheck } from './task-checks'
import { PY_LESSONS } from './py-lessons'

// 'homework' tasks are done at home, after class. Like core tasks they hold back
// build mode, so the AI cannot do the assignment for the student.
export type LessonTaskType = 'core' | 'choice' | 'bonus' | 'homework'

// Projects pin the catalog version they were created on. Only the Python
// course (3) exists now; older versions resolve to no lesson.
export const CURRENT_LESSON_VERSION = 3

export interface LessonTask {
  id: string
  type: LessonTaskType
  chip: string
  success: string
  prompt: string
  commentAnchor: string
  // How the student works it out: 🔮 predict, ✏️ change, 🛠 make, 🐞 bugzap,
  // 💬 direct the AI, 📝 explain. Only shown as an icon.
  kind?: 'predict' | 'change' | 'make' | 'bugzap' | 'direct' | 'explain'
  // The week's boss fight: worth extra XP, and finishing it earns the badge.
  boss?: boolean
  // When present, the student cannot mark the task done until the file shows
  // the change. Tasks without checks stay self-reported.
  checks?: TaskCheck[]
}

export interface Lesson {
  id: number
  title: string
  description: string
  // Starter program, relative to public/templates.
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
