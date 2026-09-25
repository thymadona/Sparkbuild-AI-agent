import fs from 'fs'
import path from 'path'
import {
  ASK_LINE,
  BUG_LINE,
  DONE_LINE,
  GOAL_LINE,
  NOTE,
  PY_LESSONS,
  STEP_LINE,
} from '@/lib/py-lessons'
import {
  CURRENT_LESSON_VERSION,
  LESSONS,
  TASK_ID_ALIASES,
  getLessonForProject,
} from '@/lib/lessons'
import { runPythonChecks } from '@/lib/python-checks'
import { allChecksPassed, isRuntimeCheck, runTaskChecks } from '@/lib/task-checks'
import { templateFor } from '@/lib/lessons/templates'
import { taskFile, taskStarter } from '@/lib/board/tasks'
import { emptyBoard } from '@/lib/board/reducer'
import { nodeExec } from '@/__tests__/helpers/pyodide'

jest.setTimeout(120_000)

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8')
const template = (file: string) => templateFor(file)
// Reference solutions live outside public/ so students cannot fetch them.
const solution = (file: string) =>
  read('__tests__/fixtures/py', file.replace('py/', '').replace(/\.py$/, '.solution.py'))

// The files a new project holds for a lesson, and the fully solved version.
type Lesson = (typeof PY_LESSONS)[number]

// A week-1 task is its own program: the reference solution is one block per task in
// the fixture, and a task that builds on another (`from`) starts from that one's finished code.
// A `from` task with an empty starter (week 11's show steps) edits that code anywhere, so its
// block is the whole finished program.
const block = (lesson: Lesson, id: string) => {
  const m = solution(lesson.templateFile).match(
    new RegExp(`^# TASK: ${id}\\n([\\s\\S]*?)(?=^# TASK: |$(?![\\s\\S]))`, 'm')
  )
  if (!m) throw new Error(`no solution block for ${id}`)
  return m[1]
}
const finished = (lesson: Lesson, id: string): string => {
  const t = lesson.tasks.find((x) => x.id === id)!
  const whole = !t.from || t.starter === ''
  return `${whole ? '' : `${finished(lesson, t.from!)}\n`}${block(lesson, id)}`
}
function programOf(lesson: Lesson, task: Lesson['tasks'][number], solved: boolean): string {
  if (solved) return finished(lesson, task.id)
  const from = task.from
  const board = from
    ? {
        pages: [{ id: `t_${from}`, title: '', nodeIds: ['c'] }],
        activePageId: null,
        focusId: null,
        nodes: {
          c: {
            id: 'c',
            parentId: null,
            createdBy: 'student' as const,
            type: 'code' as const,
            language: 'python' as const,
            source: finished(lesson, from),
            editable: true,
          },
        },
      }
    : emptyBoard()
  return taskStarter(board, task)!
}

// The files a new project holds for a lesson, and the fully solved version. For a
// task that owns its program, the entry file is that program instead of the shared file.
function filesFor(lesson: Lesson, solved: boolean, task?: Lesson['tasks'][number]) {
  const get = solved ? solution : template
  return {
    [lesson.starterFile!]:
      task?.starter !== undefined ? programOf(lesson, task, solved) : get(lesson.templateFile),
    ...Object.fromEntries(
      Object.entries(lesson.extraFiles ?? {}).map(([name, file]) => [name, get(file)])
    ),
    // A task's second program is seeded by the board when it appears (lib/lessons.ts `then`).
    ...Object.fromEntries(
      lesson.tasks
        .filter((t) => t.then)
        .map((t) => {
          const base = lesson.templateFile.replace(/^py\//, '').replace(/\.py$/, '')
          return [
            t.then!.file,
            solved
              ? read(
                  '__tests__/fixtures/py',
                  `${base}-${t.then!.file.replace(/\.py$/, '')}.solution.py`
                )
              : t.then!.source,
          ]
        })
    ),
  }
}

async function results(lesson: (typeof PY_LESSONS)[number], solved: boolean, taskId: string) {
  const task = lesson.tasks.find((t) => t.id === taskId)!
  const files = filesFor(lesson, solved, task)
  const entry = lesson.starterFile!
  const verdicts = await runPythonChecks(task.checks!, files, entry, nodeExec)
  // Static checks read the file the task works in (bugzap.py for a bugzap task), as verifyTask does.
  return runTaskChecks(task.checks, files[taskFile(task, entry)], verdicts)
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

  // A shipped task id is how lesson_progress remembers what a student
  // finished. Renaming or removing one without an alias makes a completed
  // task look undone again (lib/lessons.ts hasCompletedTask). Register a
  // rename in TASK_ID_ALIASES, or restore the id, to fix a failure here.
  it('never renames or removes a shipped task id without a working alias', () => {
    const frozen = JSON.parse(read('__tests__/fixtures/frozen-task-ids.json')) as Record<
      string,
      string[]
    >
    const liveByLesson = new Map(
      PY_LESSONS.map((l) => [String(l.id), new Set(l.tasks.map((t) => t.id))])
    )
    const violations: string[] = []
    for (const [lessonId, ids] of Object.entries(frozen)) {
      const live = liveByLesson.get(lessonId)
      for (const id of ids) {
        const aliasTarget = TASK_ID_ALIASES[id]
        const ok = live?.has(id) || (aliasTarget != null && live?.has(aliasTarget))
        if (!ok) {
          violations.push(
            `${lessonId}/${id}: gone with no working alias — restore it, or add ` +
              `"${id}": "<new-id>" to TASK_ID_ALIASES in lib/lessons.ts`
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('TASK_ID_ALIASES only points at live ids, one hop, no collisions', () => {
    const liveIds = new Set(PY_LESSONS.flatMap((l) => l.tasks.map((t) => t.id)))
    for (const [oldId, newId] of Object.entries(TASK_ID_ALIASES)) {
      expect(liveIds.has(oldId)).toBe(false)
      expect(liveIds.has(newId)).toBe(true)
      expect(TASK_ID_ALIASES[newId]).toBeUndefined()
    }
  })

  it.each(PY_LESSONS.map((l) => [l.title, l] as const))('%s is well formed', (_title, lesson) => {
    const ids = lesson.tasks.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(lesson.tasks.filter((t) => t.boss)).toHaveLength(1)
    expect(lesson.tasks.find((t) => t.boss)!.type).toBe('core')
    expect(lesson.badge).toBeTruthy()
    expect(lesson.tasks.filter((t) => t.type === 'bonus').length).toBeGreaterThanOrEqual(2)
    expect(lesson.tasks.some((t) => t.kind === 'bugzap')).toBe(true)

    const files = filesFor(lesson, false)
    for (const t of lesson.tasks) {
      expect(t.checks?.length).toBeGreaterThan(0)
      if (t.starter !== undefined) {
        // Its own program: no anchor to lose, but a `from` must name an earlier task.
        expect(t.commentAnchor).toBeUndefined()
        if (t.from)
          expect(lesson.tasks.findIndex((x) => x.id === t.from)).toBeLessThan(
            lesson.tasks.indexOf(t)
          )
        continue
      }
      // Each anchor must exist in the starter, or highlighting silently breaks.
      const inSomeFile = Object.values(files).some((code) => code.includes(t.commentAnchor!))
      expect(`${t.id}: ${inSomeFile}`).toBe(`${t.id}: true`)
    }
    // A second program waits on a real check, and something must actually check it.
    for (const t of lesson.tasks) {
      if (!t.then) continue
      expect(t.checks![t.then.after]).toBeDefined()
      expect(t.checks!.some((c) => isRuntimeCheck(c) && c.file === t.then!.file)).toBe(true)
    }
    // A check aimed at another file needs that file to be seeded.
    for (const t of lesson.tasks) {
      for (const c of t.checks!) {
        if (isRuntimeCheck(c) && c.file) expect(Object.keys(files)).toContain(c.file)
      }
    }
  })
})

// Director weeks (mission rule 4): code counts only once the student has explained it,
// and Bolt reads the student's code, so no starter may tell it the goal.
describe.each(
  PY_LESSONS.filter((l) => l.aiPolicy === 'director').map((l) => [l.title, l] as const)
)('%s: director rules', (_title, lesson) => {
  const has = (t: Lesson['tasks'][number], pattern: string) =>
    t.checks!.some((c) => c.kind === 'sourceMatches' && c.pattern === pattern)

  // Week 8 starts from a request (# ask:); week 9 on can start from Bolt's code under review
  // (# bug:); week 10 on can start from the student's plan (# goal:).
  it('asks for # notes on every task and a # ask:, # bug: or # goal: line on every core task', () => {
    expect(lesson.tasks.filter((t) => !has(t, NOTE)).map((t) => t.id)).toEqual([])
    expect(
      lesson.tasks
        .filter(
          (t) => t.type === 'core' && !has(t, ASK_LINE) && !has(t, BUG_LINE) && !has(t, GOAL_LINE)
        )
        .map((t) => t.id)
    ).toEqual([])
  })

  // Every starter already lacks notes, an ask, a bug line and a plan, so prove the behaviour
  // checks bite on their own: no task passes on a judged line alone.
  it('fails every task on its starter even without the notes, ask, bug and plan checks', async () => {
    const passing: string[] = []
    for (const t of lesson.tasks) {
      const checks = t.checks!.filter(
        (c) =>
          !(
            c.kind === 'sourceMatches' &&
            [NOTE, ASK_LINE, BUG_LINE, GOAL_LINE, STEP_LINE, DONE_LINE].includes(c.pattern)
          )
      )
      const files = filesFor(lesson, false, t)
      const entry = lesson.starterFile!
      const verdicts = await runPythonChecks(checks, files, entry, nodeExec)
      if (allChecksPassed(runTaskChecks(checks, files[taskFile(t, entry)], verdicts)))
        passing.push(t.id)
    }
    expect(passing).toEqual([])
  })

  it('has no starter comment besides a # TASK: anchor', () => {
    const starters = [
      ...lesson.tasks.flatMap((t) => (t.starter !== undefined ? [t.starter] : [])),
      template(lesson.templateFile),
      ...Object.values(lesson.extraFiles ?? {}).map(template),
    ]
    const commented = starters
      .flatMap((code) => code.split('\n'))
      .filter((line) => !/^# TASK: [\w-]+$/.test(line))
      // Drop string literals first: a # inside quotes is not a comment.
      .filter((line) => line.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '').includes('#'))
    expect(commented).toEqual([])
  })
})

describe.each(PY_LESSONS.map((l) => [l.title, l] as const))('%s: real Python', (_title, lesson) => {
  it('has no task that passes on the untouched starter', async () => {
    const passing: string[] = []
    for (const t of lesson.tasks) {
      if (allChecksPassed(await results(lesson, false, t.id))) passing.push(t.id)
    }
    expect(passing).toEqual([])
  })

  it('passes every task with the reference solution', async () => {
    const failing: string[] = []
    for (const t of lesson.tasks) {
      for (const r of await results(lesson, true, t.id))
        if (!r.passed) failing.push(`${t.id}: ${r.label}`)
    }
    expect(failing).toEqual([])
  })

  it('lets a student satisfy every source check with its documented example', () => {
    const failing: string[] = []
    for (const t of lesson.tasks) {
      const starter = filesFor(lesson, false, t)[taskFile(t, lesson.starterFile!)]
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
      expect(allChecksPassed(await results(lesson, false, t.id))).toBe(false)
      expect(allChecksPassed(await results(lesson, true, t.id))).toBe(true)
    }
  })
})

describe('plan lines (week 10 on)', () => {
  const found = (pattern: string, line: string) => new RegExp(pattern, 'm').test(line)

  it('needs 3+ words after the colon', () => {
    expect(found(GOAL_LINE, '# goal: Rex says hi')).toBe(true)
    expect(found(GOAL_LINE, '# goal: a party')).toBe(false)
    expect(found(STEP_LINE, '# step: print each snack')).toBe(true)
    expect(found(DONE_LINE, '# done: it works')).toBe(false)
  })

  it('never counts as a # note', () => {
    for (const line of ['# goal: Rex says hi', '# step: print each snack', '# done: I see 3'])
      expect(found(NOTE, line)).toBe(false)
  })
})

describe('week 11: one program, one step per task', () => {
  const week11 = PY_LESSONS.find((l) => l.id === 111)!
  const chained = week11.tasks.filter((t) => t.from)

  it('starts each step from the finished program of the step before', () => {
    expect(chained.map((t) => t.id)).toEqual([
      'show-question',
      'show-score',
      'show-final',
      'hw-prize',
    ])
    for (const t of chained)
      expect(programOf(week11, t, false).startsWith(finished(week11, t.from!))).toBe(true)
  })

  it('needs a new # ask: for each core step, so a carried ask never counts', () => {
    const asks = (code: string) => code.match(new RegExp(ASK_LINE, 'gm'))?.length ?? 0
    for (const t of chained.filter((x) => x.type === 'core')) {
      const check = t.checks!.find((c) => c.kind === 'sourceMatches' && c.pattern === ASK_LINE)!
      expect((check as { min?: number }).min ?? 1).toBe(asks(finished(week11, t.from!)) + 1)
    }
  })
})

describe('week 1: tasks are their own programs', () => {
  const week1 = PY_LESSONS[0]
  const intro = week1.tasks.find((t) => t.id === 'intro-3')!
  const on = async (program: string) => {
    const files = { 'main.py': program }
    return runTaskChecks(
      intro.checks,
      program,
      await runPythonChecks(intro.checks!, files, 'main.py', nodeExec)
    )
  }

  it('does not count the same line three times as three lines about you', async () => {
    expect(allChecksPassed(await on('print("Hi")\nprint("Hi")\nprint("Hi")\n'))).toBe(false)
    expect(allChecksPassed(await on('print("Hi")\nprint("I like chess")\nprint("Bye")\n'))).toBe(
      true
    )
  })

  it('judges intro-3 on its own program, with no help from first-words', async () => {
    expect(allChecksPassed(await on('print("a")\nprint("b")\n'))).toBe(false)
  })

  it('still passes intro-3 and name-tag on a whole-file program from before tasks owned theirs', async () => {
    // Old boards hold one shared file; the task-local checks are looser, so that code still counts.
    const old = solution('py/w1.py')
    for (const id of ['intro-3', 'name-tag']) {
      const t = week1.tasks.find((x) => x.id === id)!
      const verdicts = await runPythonChecks(t.checks!, { 'main.py': old }, 'main.py', nodeExec)
      expect(allChecksPassed(runTaskChecks(t.checks, old, verdicts))).toBe(true)
    }
  })
})
