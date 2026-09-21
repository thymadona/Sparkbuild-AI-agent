import { LESSONS } from '@/lib/lessons'
import {
  isTaskOpen,
  taskCodeNodeId,
  taskFile,
  taskForPageId,
  taskIndexForPageId,
  taskPageId,
} from '@/lib/board/tasks'
import { NodeId } from '@/lib/board/schema'

const lesson = LESSONS[0]

describe('board task pages', () => {
  it('binds a page to a task by id, both ways', () => {
    for (const task of lesson.tasks) {
      expect(taskForPageId(lesson, taskPageId(task))).toBe(task)
      expect(taskIndexForPageId(lesson, taskPageId(task))).toBe(lesson.tasks.indexOf(task))
    }
  })

  it('leaves loose pages alone', () => {
    // boardFromFiles migrates pre-board work onto a page called p_main, and
    // free-form boards name their own. Neither has a task.
    expect(taskForPageId(lesson, 'p_main')).toBeNull()
    expect(taskForPageId(lesson, 'p1')).toBeNull()
    expect(taskForPageId(null, taskPageId(lesson.tasks[0]))).toBeNull()
    expect(taskIndexForPageId(lesson, 'p_main')).toBe(-1)
  })

  it('makes a legal node id from every task id in the catalog', () => {
    // Task ids contain hyphens; NodeId does not allow them.
    for (const l of LESSONS)
      for (const task of l.tasks) {
        expect(NodeId.safeParse(taskCodeNodeId(task)).success).toBe(true)
      }
    expect(taskCodeNodeId(lesson.tasks.find((t) => t.id === 'name-tag')!)).toBe('code_name_tag')
  })

  it('sends a task to the file its own checks name', () => {
    const bugzap = lesson.tasks.find((t) => t.id === 'hw-bug-quote')!
    expect(taskFile(bugzap, 'main.py')).toBe('bugzap.py')
    expect(taskFile(lesson.tasks[0], 'main.py')).toBe('main.py')
  })

  it('keeps homework shut until every core task is done', () => {
    const homeworkIndex = lesson.tasks.findIndex((t) => t.type === 'homework')
    const core = lesson.tasks.filter((t) => t.type === 'core').map((t) => t.id)

    expect(isTaskOpen(lesson, homeworkIndex, new Set())).toBe(false)
    expect(isTaskOpen(lesson, homeworkIndex, new Set(core.slice(0, -1)))).toBe(false)
    expect(isTaskOpen(lesson, homeworkIndex, new Set(core))).toBe(true)
    // Everything else is open on its own terms; ordering is isTaskLocked's job.
    expect(isTaskOpen(lesson, 0, new Set())).toBe(true)
  })
})
