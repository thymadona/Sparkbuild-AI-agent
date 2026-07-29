import { LESSONS, LEGACY_LESSONS } from '@/lib/lessons'
import { buildTaskNudge, homeworkComplete, homeworkTasks, pendingCoreTask } from '@/lib/task-guard'

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
})
