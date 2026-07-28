import { CURRENT_LESSON_VERSION, getLessonForProject } from '@/lib/lessons'

describe('getLessonForProject', () => {
  it('uses refreshed tasks only for projects created with the current template version', () => {
    expect(getLessonForProject(1, CURRENT_LESSON_VERSION)?.tasks[0].commentAnchor).toBe('TASK: identity')
    expect(getLessonForProject(1, null)?.tasks[0].commentAnchor).toBe('CHANGE THIS: Your name and one sentence about you')
  })
})
