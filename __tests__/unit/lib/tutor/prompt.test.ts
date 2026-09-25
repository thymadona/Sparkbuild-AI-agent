import { LESSONS } from '@/lib/lessons'
import { explainRule, lessonLayer } from '@/lib/tutor/prompt'

const PLAN = 'PLAN RULE'
const STEP = 'STEP RULE'
const BOLT_WAITS = 'Bolt writes code only once'

const promptOf = (lesson: (typeof LESSONS)[number]) =>
  `${explainRule(lesson)}\n${lessonLayer(lesson, '', lesson.tasks[0])}`

describe('plan-first prompt rules', () => {
  it('reach only plan-first lessons, so weeks 1–9 keep their prompt', () => {
    for (const lesson of LESSONS) {
      const prompt = promptOf(lesson)
      const plan = lesson.planFirst === true
      expect(`${lesson.id}: ${prompt.includes(PLAN)}`).toBe(`${lesson.id}: ${plan}`)
      expect(`${lesson.id}: ${prompt.includes(BOLT_WAITS)}`).toBe(`${lesson.id}: ${plan}`)
    }
    expect(LESSONS.filter((l) => l.planFirst).map((l) => l.id)).toEqual([110, 111])
  })

  it('keep the explain rule and add the plan rule after it in week 10', () => {
    const week10 = LESSONS.find((l) => l.id === 110)!
    const week9 = LESSONS.find((l) => l.id === 109)!
    expect(explainRule(week10).startsWith(explainRule(week9))).toBe(true)
    expect(explainRule(week10)).toContain('Never write, finish or reword a "# goal:"')
  })
})

describe('step-by-step prompt rules', () => {
  const week10 = LESSONS.find((l) => l.id === 110)!
  const week11 = LESSONS.find((l) => l.id === 111)!

  it('reach only step-by-step lessons, so weeks 1–10 keep their prompt', () => {
    for (const lesson of LESSONS)
      expect(`${lesson.id}: ${promptOf(lesson).includes(STEP)}`).toBe(
        `${lesson.id}: ${lesson.stepByStep === true}`
      )
    expect(LESSONS.filter((l) => l.stepByStep).map((l) => l.id)).toEqual([111])
  })

  it('keep the week 10 rules and add the step rule last in week 11', () => {
    const rule = explainRule(week11)
    expect(rule.startsWith(`${explainRule(week10)}\n\n${STEP}`)).toBe(true)
    expect(rule).toContain('Match it to the run only in the boss task')
    expect(rule).toContain('Ask only one "why" question per task')
  })

  // The STEP RULE keys on the task notes: the Bolt-built tasks ask for it, the others don't.
  it('asks why only in tasks where Bolt builds', () => {
    expect(
      week11.tasks.filter((t) => t.prompt.includes('Ask why about one Bolt line')).map((t) => t.id)
    ).toEqual(['show-plan', 'show-question', 'show-score', 'show-final', 'show-extra'])
  })
})
