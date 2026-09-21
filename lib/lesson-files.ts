import type { Lesson } from './lessons'
import { templateFor } from './lessons/templates'

// The files a new project for this lesson holds: the starter plus any extra
// files (e.g. bugzap.py). Built on the server from the catalog, never from
// anything the caller sends.
export function lessonFiles(lesson: Lesson): Record<string, string> {
  const files: Record<string, string> = { [lesson.starterFile]: templateFor(lesson.templateFile) }
  for (const [name, file] of Object.entries(lesson.extraFiles ?? {}))
    files[name] = templateFor(file)
  return files
}
