import { LESSONS } from '@/lib/lessons'
import { ASK_LINE, BUG_LINE, NOTE } from '@/lib/py-lessons'
import { JUDGED, judged } from '@/lib/task-checks'
import {
  buildTaskNudge,
  detectConfusion,
  escalationTier,
  isTaskLocked,
  pendingCoreTask,
} from '@/lib/task-guard'

const week3 = LESSONS.find((lesson) => lesson.id === 103)!
const coreIds = week3.tasks.filter((task) => task.type === 'core').map((task) => task.id)
const optionalIds = week3.tasks
  .filter((task) => task.type === 'choice' || task.type === 'bonus')
  .map((task) => task.id)

describe('pendingCoreTask', () => {
  it('returns the first open core task', () => {
    expect(pendingCoreTask(week3, [])?.id).toBe(coreIds[0])
    expect(pendingCoreTask(week3, [coreIds[0]])?.id).toBe(coreIds[1])
  })

  it('returns null once every core task is done', () => {
    expect(pendingCoreTask(week3, coreIds)).toBeNull()
  })

  it('ignores unfinished choice and bonus tasks', () => {
    expect(optionalIds.length).toBeGreaterThan(0)
    expect(pendingCoreTask(week3, coreIds)).toBeNull()
  })

  it('is not fooled by completing optional tasks first', () => {
    expect(pendingCoreTask(week3, optionalIds)?.id).toBe(coreIds[0])
  })

  it('returns null for a project with no lesson', () => {
    expect(pendingCoreTask(null, [])).toBeNull()
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
    expect(nudge).not.toContain(task.commentAnchor) // the comment line is hidden from the student
    expect(nudge).toMatch(/never write or edit their code/i)
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

  it('restates the no-write-code constraint at tier 3 so it cannot license build behavior', () => {
    const task = week3.tasks[0]
    expect(buildTaskNudge(task, 3)).toMatch(/may not edit or write their file/i)
  })

  it('keeps the no-other-task guardrail through every escalation tier', () => {
    const task = week3.tasks[0]
    expect(buildTaskNudge(task, 2)).toMatch(/do not bring up another task/i)
    expect(buildTaskNudge(task, 3)).toMatch(/do not bring up another task/i)
  })

  // Week 9: finding the planted bug is the task, so no tier may show the fixed line.
  it('escalates a review task by shrinking the test, never by showing the line', () => {
    const feed = LESSONS.find((l) => l.id === 109)!.tasks.find((t) => t.id === 'feed-rex')!
    for (const tier of [2, 3] as const) {
      const nudge = buildTaskNudge(feed, tier)
      expect(nudge).toContain(`ESCALATION LEVEL ${tier}`)
      expect(nudge).not.toMatch(/exactly as it should read|fill-in-the-blank/)
      expect(nudge).toMatch(/Never show or name the broken line/)
    }
    expect(buildTaskNudge(feed)).not.toContain('Point them at the line')
    expect(buildTaskNudge(feed)).toContain('Point them at a value to test')
    expect(buildTaskNudge(week3.tasks[0], 3)).toMatch(/exactly as it should read/)
  })

  it('lists the requirements as a rubric and makes the tutor the judge', () => {
    const task = week3.tasks.find((t) => t.id === 'times-table')!
    const nudge = buildTaskNudge(task)
    for (const c of task.checks ?? []) expect(nudge).toContain(`- ${c.label}`)
    expect(nudge).toContain(`task_complete with taskId "${task.id}"`)
    expect(nudge).toMatch(/Never call task_complete because the student says they are done/i)
    expect(nudge).not.toMatch(/NOT DONE YET|: DONE\./)
  })

  it('still says what to do for a task with no checks', () => {
    const nudge = buildTaskNudge({ ...week3.tasks[0], checks: undefined })
    expect(nudge).not.toContain('Every requirement must be met')
    expect(nudge).toContain('task_complete')
  })
})

describe('escalationTier', () => {
  it.each([
    [0, false, 1],
    [1, false, 1],
    [2, false, 2],
    [3, false, 2],
    [4, false, 3],
    [0, true, 3],
  ] as const)('stuckTurns=%s confused=%s -> tier %s', (stuckTurns, confused, expected) => {
    expect(escalationTier(stuckTurns, confused)).toBe(expected)
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
    expect(
      detectConfusion('help me replace the name and intro', 'help me replace the name and intro')
    ).toBe(true)
    expect(
      detectConfusion('Help me replace the name and intro!', 'help me replace the name and intro')
    ).toBe(true)
  })

  it('is not fooled by a different message', () => {
    expect(detectConfusion('help me add a button', 'help me replace the name and intro')).toBe(
      false
    )
  })

  it('does not treat "no" as confusion', () => {
    expect(detectConfusion('no')).toBe(false)
  })
})

// Rule 4: a director task's notes and "# ask:" checks only prove the lines exist, so the
// tutor is told to judge them. Tutor weeks keep their rubric word for word.
describe('judged checks (director weeks only)', () => {
  const lessonById = (id: number) => LESSONS.find((l) => l.id === id)!
  const taskOf = (lessonId: number, id: string) =>
    lessonById(lessonId).tasks.find((t) => t.id === id)!

  it("leaves week 7's notes task exactly as before", () => {
    const explain = taskOf(107, 'hw-explain-dex')
    expect(explain.checks!.some((c) => judged(c))).toBe(false)
    expect(buildTaskNudge(explain)).toContain('- You added 3 notes with #\n')
    expect(buildTaskNudge(explain)).not.toContain(JUDGED)
  })

  it('checks week 8 notes on the server and leaves the ask to the tutor', () => {
    for (const t of lessonById(108).tasks)
      for (const c of t.checks!) {
        if (c.kind !== 'sourceMatches') continue
        if (c.pattern === ASK_LINE) expect(`${t.id}: ${judged(c)}`).toBe(`${t.id}: true`)
        if (c.pattern === NOTE) expect(`${t.id}: ${c.ownWords}`).toBe(`${t.id}: true`)
      }
    expect(buildTaskNudge(taskOf(108, 'make-pet'))).toContain(`- You wrote # ask: (${JUDGED})`)
  })

  it('leaves the week 9 # bug: line to the tutor, with notes checked on the server', () => {
    for (const t of lessonById(109).tasks) {
      const bugs = t.checks!.filter((c) => c.kind === 'sourceMatches' && c.pattern === BUG_LINE)
      expect(`${t.id}: ${bugs.length}`).toBe(`${t.id}: 1`)
      expect(`${t.id}: ${judged(bugs[0])}`).toBe(`${t.id}: true`)
    }
    expect(buildTaskNudge(taskOf(109, 'feed-rex'))).toContain(`- You wrote # bug: (${JUDGED})`)
  })

  it('leaves the week 10 plan lines to the tutor, and never lets escalation write them', () => {
    const show = taskOf(110, 'party-show')
    for (const label of ['You wrote # goal:', 'You wrote 2 # step: lines', 'You wrote # done:'])
      expect(buildTaskNudge(show)).toContain(`- ${label} (${JUDGED})`)
    expect(buildTaskNudge(show, 1)).not.toContain('Never show a "# goal:"')
    for (const tier of [2, 3] as const)
      expect(buildTaskNudge(show, tier)).toContain('Never show a "# goal:"')
    expect(buildTaskNudge(taskOf(109, 'feed-rex'), 3)).not.toContain('# goal:')
  })
})
