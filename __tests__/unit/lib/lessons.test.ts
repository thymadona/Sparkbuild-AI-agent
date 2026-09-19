import { CURRENT_LESSON_VERSION, getLessonForProject } from '@/lib/lessons'

describe('getLessonForProject', () => {
  it('uses refreshed tasks only for projects created with the current template version', () => {
    expect(getLessonForProject(1, 2)?.tasks[0].commentAnchor).toBe('TASK: identity')
    expect(getLessonForProject(1, null)?.tasks[0].commentAnchor).toBe('CHANGE THIS: Your name and one sentence about you')
  })

  it('resolves the Python course for current-version projects', () => {
    expect(CURRENT_LESSON_VERSION).toBe(3)
    expect(getLessonForProject(101, CURRENT_LESSON_VERSION)?.starterFile).toBe('main.py')
    // Ids 1-6 belong to the HTML catalog, not the Python one.
    expect(getLessonForProject(1, CURRENT_LESSON_VERSION)).toBeNull()
  })

  it('falls back to the legacy catalog for versions no catalog owns', () => {
    expect(getLessonForProject(1, 99)?.tasks[0].commentAnchor).toBe('CHANGE THIS: Your name and one sentence about you')
  })
})
