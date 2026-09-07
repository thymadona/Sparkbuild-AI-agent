import { LESSONS, LEGACY_LESSONS } from '@/lib/lessons'
import {
  buildTaskNudge,
  detectConfusion,
  escalationTier,
  homeworkComplete,
  homeworkTasks,
  isTaskLocked,
  pendingCoreTask,
} from '@/lib/task-guard'
import { runTaskChecks } from '@/lib/task-checks'

const week3 = LESSONS.find((lesson) => lesson.id === 3)!
const coreIds = week3.tasks.filter((task) => task.type === 'core').map((task) => task.id)
const homeworkIds = week3.tasks.filter((task) => task.type === 'homework').map((task) => task.id)
const optionalIds = week3.tasks.filter((task) => task.type === 'choice' || task.type === 'bonus').map((task) => task.id)

describe('pendingCoreTask', () => {
  it('returns the first open core task', () => {
    expect(pendingCoreTask(week3, [])?.id).toBe(coreIds[0])
    expect(pendingCoreTask(week3, [coreIds[0]])?.id).toBe(coreIds[1])
  })

  it('moves on to homework once the core tasks are done', () => {
    expect(pendingCoreTask(week3, coreIds)?.id).toBe(homeworkIds[0])
  })

  it('returns null only when core and homework are both done', () => {
    expect(pendingCoreTask(week3, [...coreIds, ...homeworkIds])).toBeNull()
  })

  it('ignores unfinished choice and bonus tasks', () => {
    expect(optionalIds.length).toBeGreaterThan(0)
    expect(pendingCoreTask(week3, [...coreIds, ...homeworkIds])).toBeNull()
  })

  it('is not fooled by completing optional tasks first', () => {
    expect(pendingCoreTask(week3, optionalIds)?.id).toBe(coreIds[0])
  })

  it('returns null for a project with no lesson', () => {
    expect(pendingCoreTask(null, [])).toBeNull()
  })

  it('works for legacy lesson catalogs too', () => {
    const legacy = LEGACY_LESSONS.find((lesson) => lesson.id === 3)!
    expect(pendingCoreTask(legacy, [])?.id).toBe(legacy.tasks[0].id)
  })
})

describe('homework helpers', () => {
  it('lists homework tasks for every current lesson', () => {
    for (const lesson of LESSONS) {
      expect(homeworkTasks(lesson).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('reports homework complete only when every homework task is done', () => {
    expect(homeworkComplete(week3, [])).toBe(false)
    expect(homeworkComplete(week3, coreIds)).toBe(false)
    expect(homeworkComplete(week3, [homeworkIds[0]])).toBe(false)
    expect(homeworkComplete(week3, homeworkIds)).toBe(true)
  })

  it('never reports complete for a lesson with no homework', () => {
    const legacy = LEGACY_LESSONS.find((lesson) => lesson.id === 3)!
    expect(homeworkTasks(legacy)).toEqual([])
    expect(homeworkComplete(legacy, [])).toBe(false)
    expect(homeworkComplete(null, [])).toBe(false)
  })
})

describe('isTaskLocked', () => {
  it('never locks the first task', () => {
    expect(isTaskLocked(week3.tasks, 0, new Set())).toBe(false)
  })

  it('locks a task while an earlier task is unfinished', () => {
    expect(isTaskLocked(week3.tasks, 1, new Set())).toBe(true)
  })

  it('unlocks once every earlier task is done', () => {
    const upToFirst = new Set(week3.tasks.slice(0, 1).map((task) => task.id))
    expect(isTaskLocked(week3.tasks, 1, upToFirst)).toBe(false)
  })

  it('never locks a homework task, whatever else is unfinished', () => {
    const homeworkIndex = week3.tasks.findIndex((task) => task.type === 'homework')
    expect(isTaskLocked(week3.tasks, homeworkIndex, new Set())).toBe(false)
  })

  it('locks choice and bonus tasks while any core task is unfinished', () => {
    const optionalIndex = week3.tasks.findIndex((task) => task.id === optionalIds[0])
    expect(isTaskLocked(week3.tasks, optionalIndex, new Set())).toBe(true)
  })

  it('unlocks choice and bonus tasks together once core is done, without ordering them against each other', () => {
    const done = new Set(coreIds)
    for (const id of optionalIds) {
      const index = week3.tasks.findIndex((task) => task.id === id)
      expect(isTaskLocked(week3.tasks, index, done)).toBe(false)
    }
  })
})

describe('buildTaskNudge', () => {
  it('forbids writing code and names the line to point at', () => {
    const task = week3.tasks[0]
    const nudge = buildTaskNudge(task)

    expect(nudge).toContain(task.chip)
    expect(nudge).toContain(task.success)
    expect(nudge).toContain(task.commentAnchor)
    expect(nudge).toMatch(/never write or edit their code/i)
  })

  it('says plainly when the task is homework', () => {
    const homework = homeworkTasks(week3)[0]
    const nudge = buildTaskNudge(homework)

    expect(nudge).toContain('HOMEWORK')
    expect(nudge).toMatch(/hint only/i)
  })

  it('defaults to tier 1, identical to the original single-arg call', () => {
    const task = week3.tasks[0]
    expect(buildTaskNudge(task)).toBe(buildTaskNudge(task, 1))
    expect(buildTaskNudge(task)).not.toMatch(/ESCALATION LEVEL/)
  })

  it('escalates to tier 2 and tier 3 with distinct, non-repeating markers', () => {
    const task = week3.tasks[0]
    const tier2 = buildTaskNudge(task, 2)
    const tier3 = buildTaskNudge(task, 3)

    expect(tier2).toContain('ESCALATION LEVEL 2')
    expect(tier2).not.toContain('ESCALATION LEVEL 3')
    expect(tier3).toContain('ESCALATION LEVEL 3')
    expect(tier3).not.toContain('ESCALATION LEVEL 2')
  })

  it('never reveals the answer text at tier 2 or 3 for homework', () => {
    const homework = homeworkTasks(week3)[0]
    const tier2 = buildTaskNudge(homework, 2)

    expect(tier2).toContain('ESCALATION LEVEL 2')
    expect(tier2).not.toMatch(/ESCALATION LEVEL 3/)
    expect(tier2).toMatch(/never state the answer/i)
  })

  it('restates the no-write-code constraint at tier 3 so it cannot license build behavior', () => {
    const task = week3.tasks[0]
    expect(buildTaskNudge(task, 3)).toMatch(/may not edit or write their file/i)
  })

  it('keeps the no-other-task guardrail through every escalation tier', () => {
    const task = week3.tasks[0]
    expect(buildTaskNudge(task, 2)).toMatch(/do not bring up another task/i)
    expect(buildTaskNudge(task, 3)).toMatch(/do not bring up another task/i)
  })

  it('flags textChanged checks as needing manual comparison, not silent completion', () => {
    const task = week3.tasks[0] // 'goal': two textChanged checks
    const nudge = buildTaskNudge(task)
    expect(nudge).toMatch(/not confirmed automatically/i)
    expect(nudge).toContain('My reading streak.')
    expect(nudge).toMatch(/do not bring up another task/i)
  })

  it('marks sourceOmits checks DONE or NOT DONE YET from real check results', () => {
    const palette = LESSONS.find((lesson) => lesson.id === 1)!.tasks.find((t) => t.id === 'palette')!
    const untouched = runTaskChecks(palette.checks, '--pink: #ff6b9d; --purple: #7655e8; --yellow: #ffd86b;')
    const changed = runTaskChecks(palette.checks, '--pink: #123456; --purple: #654321; --yellow: #abcdef;')

    expect(buildTaskNudge(palette, 1, untouched)).toContain('NOT DONE YET')
    expect(buildTaskNudge(palette, 1, changed)).not.toContain('NOT DONE YET')
    expect(buildTaskNudge(palette, 1, changed)).toContain('DONE')
  })

  it('falls back to the original guardrail for legacy tasks with no checks', () => {
    const legacy = LEGACY_LESSONS.find((lesson) => lesson.id === 3)!.tasks[0]
    const nudge = buildTaskNudge(legacy)
    expect(nudge).toMatch(/cannot see which parts/i)
    expect(nudge).not.toMatch(/NOT DONE YET|DONE\./)
  })
})

describe('escalationTier', () => {
  it.each([
    [0, false, false, 1],
    [1, false, false, 1],
    [2, false, false, 2],
    [3, false, false, 2],
    [4, false, false, 3],
    [0, true, false, 3],
    [9, false, true, 2],
    [0, true, true, 2],
  ] as const)('stuckTurns=%s confused=%s homework=%s -> tier %s', (stuckTurns, confused, isHomework, expected) => {
    expect(escalationTier(stuckTurns, confused, isHomework)).toBe(expected)
  })

  it('never returns tier 3 for homework, however stuck', () => {
    expect(escalationTier(100, true, true)).toBe(2)
  })
})

describe('detectConfusion', () => {
  it.each(['how', 'How', 'how?', "i don't know", 'idk', 'help', 'im stuck'])(
    'treats "%s" as confusion',
    (message) => {
      expect(detectConfusion(message)).toBe(true)
    }
  )

  it('does not false-positive on a normal request containing a confusion word', () => {
    expect(detectConfusion('help me add a button')).toBe(false)
    expect(detectConfusion('how do I add a button')).toBe(false)
  })

  it('treats an exact repeat of the previous user message as confusion', () => {
    expect(detectConfusion('help me replace the name and intro', 'help me replace the name and intro')).toBe(true)
    expect(detectConfusion('Help me replace the name and intro!', 'help me replace the name and intro')).toBe(true)
  })

  it('is not fooled by a different message', () => {
    expect(detectConfusion('help me add a button', 'help me replace the name and intro')).toBe(false)
  })

  it('does not treat "no" as confusion', () => {
    expect(detectConfusion('no')).toBe(false)
  })
})
