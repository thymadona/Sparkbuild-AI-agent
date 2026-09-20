import type { Lesson } from './lessons'

// The file a student edits and runs. Lessons name it; a project with no
// lesson (created before the Python course) is assumed to hold main.py.
export function entryFileFor(lesson: Lesson | null, _files?: Record<string, string>): string {
  return lesson?.starterFile ?? 'main.py'
}
