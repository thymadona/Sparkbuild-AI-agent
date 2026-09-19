import type { Lesson } from './lessons'

// Fetches a lesson's starter file plus any extra files (e.g. bugzap.py) from
// public/templates. Client-only: the templates are static assets.
export async function fetchLessonFiles(lesson: Lesson) {
  const get = async (file: string) => (await fetch(`/templates/${file}`)).text()
  const templateHtml = await get(lesson.templateFile)
  const extraFiles: Record<string, string> = {}
  for (const [name, file] of Object.entries(lesson.extraFiles ?? {})) extraFiles[name] = await get(file)
  return { templateHtml, extraFiles }
}
