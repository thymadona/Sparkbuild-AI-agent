import type { Lesson } from './lessons'

// The file a student edits and runs. Lessons name it; free-form projects
// are web pages unless they hold a main.py and no index.html.
export function entryFileFor(lesson: Lesson | null, files: Record<string, string> | undefined): string {
  if (lesson?.starterFile) return lesson.starterFile
  return files?.['main.py'] !== undefined && files['index.html'] === undefined ? 'main.py' : 'index.html'
}
