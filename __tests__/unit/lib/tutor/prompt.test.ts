import { LESSONS } from '@/lib/lessons'
import { explainRule, lessonLayer } from '@/lib/tutor/prompt'

const PLAN = 'PLAN RULE'
const BOLT_WAITS = 'Bolt writes code only once'

describe('plan-first prompt rules', () => {
  it('reach only plan-first lessons, so weeks 1–9 keep their prompt', () => {
    for (const lesson of LESSONS) {
      const prompt = `${explainRule(lesson)}\n${lessonLayer(lesson, '', lesson.tasks[0])}`
      const plan = lesson.planFirst === true
      expect(`${lesson.id}: ${prompt.includes(PLAN)}`).toBe(`${lesson.id}: ${plan}`)
      expect(`${lesson.id}: ${prompt.includes(BOLT_WAITS)}`).toBe(`${lesson.id}: ${plan}`)
    }
    expect(LESSONS.filter((l) => l.planFirst).map((l) => l.id)).toEqual([110])
  })

  it('keep the explain rule and add the plan rule after it in week 10', () => {
    const week10 = LESSONS.find((l) => l.id === 110)!
    const week9 = LESSONS.find((l) => l.id === 109)!
    expect(explainRule(week10).startsWith(explainRule(week9))).toBe(true)
    expect(explainRule(week10)).toContain('Never write, finish or reword a "# goal:"')
  })
})
