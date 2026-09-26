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

describe('demo prompt rules', () => {
  const week8 = LESSONS.find((l) => l.id === 108)!
  const week12 = LESSONS.find((l) => l.id === 112)!
  const DEMO = 'DEMO RULE'

  it('reach only demo lessons, so weeks 1–11 keep their prompt', () => {
    for (const lesson of LESSONS)
      expect(`${lesson.id}: ${promptOf(lesson).includes(DEMO)}`).toBe(
        `${lesson.id}: ${lesson.demo === true}`
      )
    expect(LESSONS.filter((l) => l.demo).map((l) => l.id)).toEqual([112])
  })

  it('keep the explain rule and add the demo rule after it, with no Bolt in week 12', () => {
    expect(explainRule(week12).startsWith(`${explainRule(week8)}\n\n${DEMO}`)).toBe(true)
    expect(explainRule(week12)).not.toContain('PLAN RULE')
    expect(week12.aiPolicy).toBeUndefined()
    expect(lessonLayer(week12, '', week12.tasks[0])).not.toContain('helper robot')
  })

  // The DEMO RULE keys on the task notes: one question in the core tasks and the choice,
  // three in the boss, none in the bonuses.
  it('names the demo questions only in the core tasks and the choice', () => {
    const named = (phrase: string) =>
      week12.tasks.filter((t) => t.prompt.includes(phrase)).map((t) => t.id)
    expect(named('Demo question:')).toEqual(['demo-run', 'demo-explain', 'demo-change', 'demo-own'])
    expect(named('Demo: three questions')).toEqual(['demo-day'])
  })
})
