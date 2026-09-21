import fs from 'fs'
import path from 'path'
import { PY_LESSONS } from '@/lib/py-lessons'
import { CURRENT_LESSON_VERSION, LESSONS, getLessonForProject } from '@/lib/lessons'
import { runPythonChecks } from '@/lib/python-checks'
import { allChecksPassed, isRuntimeCheck, runTaskChecks } from '@/lib/task-checks'
import { nodeExec } from '@/__tests__/helpers/pyodide'

jest.setTimeout(120_000)

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8')
const template = (file: string) => read('public/templates', file)
// Reference solutions live outside public/ so students cannot fetch them.
const solution = (file: string) =>
  read('__tests__/fixtures/py', file.replace('py/', '').replace(/\.py$/, '.solution.py'))

// The files a new project holds for a lesson, and the fully solved version.
function filesFor(lesson: (typeof PY_LESSONS)[number], solved: boolean) {
  const get = solved ? solution : template
  return {
    [lesson.starterFile!]: get(lesson.templateFile),
    ...Object.fromEntries(
      Object.entries(lesson.extraFiles ?? {}).map(([name, file]) => [name, get(file)])
    ),
  }
}

async function results(
  lesson: (typeof PY_LESSONS)[number],
  files: Record<string, string>,
  taskId: string
) {
  const task = lesson.tasks.find((t) => t.id === taskId)!
  const entry = lesson.starterFile!
  const verdicts = await runPythonChecks(task.checks!, files, entry, nodeExec)
  return runTaskChecks(task.checks, files[entry], verdicts)
}

describe('python catalog', () => {
  it('is the only catalog: projects pinned to any other version resolve to no lesson', () => {
    expect(CURRENT_LESSON_VERSION).toBe(3)
    expect(LESSONS).toBe(PY_LESSONS)
    expect(getLessonForProject(101, 3)?.starterFile).toBe('main.py')
    expect(getLessonForProject(101, 2)).toBeNull()
    expect(getLessonForProject(101, null)).toBeNull()
    expect(getLessonForProject(1, 2)).toBeNull()
  })

  it('uses ids above the retired web course range still present in class_enabled_lessons', () => {
    for (const lesson of PY_LESSONS) expect(lesson.id).toBeGreaterThan(100)
    expect(new Set(PY_LESSONS.map((l) => l.id)).size).toBe(PY_LESSONS.length)
  })

  it.each(PY_LESSONS.map((l) => [l.title, l] as const))('%s is well formed', (_title, lesson) => {
    const ids = lesson.tasks.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(lesson.tasks.filter((t) => t.boss)).toHaveLength(1)
    expect(lesson.tasks.find((t) => t.boss)!.type).toBe('core')
    expect(lesson.badge).toBeTruthy()
    expect(lesson.tasks.filter((t) => t.type === 'homework').length).toBeGreaterThanOrEqual(2)
    expect(lesson.tasks.some((t) => t.kind === 'bugzap')).toBe(true)

    const files = filesFor(lesson, false)
    for (const t of lesson.tasks) {
      expect(t.checks?.length).toBeGreaterThan(0)
      // Each anchor must exist in the starter, or highlighting silently breaks.
      const inSomeFile = Object.values(files).some((code) => code.includes(t.commentAnchor))
      expect(`${t.id}: ${inSomeFile}`).toBe(`${t.id}: true`)
    }
    // A check aimed at another file needs that file to be seeded.
    for (const t of lesson.tasks) {
      for (const c of t.checks!) {
        if (isRuntimeCheck(c) && c.file) expect(Object.keys(files)).toContain(c.file)
      }
    }
  })
})

describe.each(PY_LESSONS.map((l) => [l.title, l] as const))('%s: real Python', (_title, lesson) => {
  it('has no task that passes on the untouched starter', async () => {
    const files = filesFor(lesson, false)
    const passing: string[] = []
    for (const t of lesson.tasks) {
      if (allChecksPassed(await results(lesson, files, t.id))) passing.push(t.id)
    }
    expect(passing).toEqual([])
  })

  it('passes every task with the reference solution', async () => {
    const files = filesFor(lesson, true)
    const failing: string[] = []
    for (const t of lesson.tasks) {
      for (const r of await results(lesson, files, t.id))
        if (!r.passed) failing.push(`${t.id}: ${r.label}`)
    }
    expect(failing).toEqual([])
  })

  it('lets a student satisfy every source check with its documented example', () => {
    const starter = filesFor(lesson, false)[lesson.starterFile!]
    const failing: string[] = []
    for (const t of lesson.tasks) {
      for (const c of t.checks!) {
        if (c.kind !== 'sourceMatches') continue
        const edited = `${starter}\n${Array.from({ length: c.min ?? 1 }, () => c.example).join('\n')}`
        if (!runTaskChecks([c], edited)[0].passed) failing.push(`${t.id}: ${c.label}`)
      }
    }
    expect(failing).toEqual([])
  })

  it('keeps gated bug files broken until they are fixed', async () => {
    // Every bugzap task must fail on its starter and pass on the fix.
    for (const t of lesson.tasks.filter((x) => x.kind === 'bugzap')) {
      expect(allChecksPassed(await results(lesson, filesFor(lesson, false), t.id))).toBe(false)
      expect(allChecksPassed(await results(lesson, filesFor(lesson, true), t.id))).toBe(true)
    }
  })
})
