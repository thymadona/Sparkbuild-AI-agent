import { CURRENT_LESSON_VERSION } from '@/lib/lessons'
import { PY_LESSONS } from '@/lib/py-lessons'
import { badgesFor, levelFor, streakFor, taskXp, todayISO, xpFor, LEVELS, XP_BOSS } from '@/lib/xp'

const week1 = PY_LESSONS[0]
const row = (
  completedTaskIds: string[],
  lessonId = week1.id,
  lessonVersion: number | null = CURRENT_LESSON_VERSION
) => ({ lessonId, lessonVersion, completedTaskIds })

describe('xpFor', () => {
  it('pays by task type, with a bigger prize for the boss', () => {
    const boss = week1.tasks.find((t) => t.boss)!
    const core = week1.tasks.find((t) => t.type === 'core' && !t.boss)!
    const homework = week1.tasks.find((t) => t.type === 'homework')!
    expect(taskXp(core)).toBe(10)
    expect(taskXp(homework)).toBe(15)
    expect(taskXp(boss)).toBe(XP_BOSS)
    expect(xpFor([row([core.id, boss.id, homework.id])])).toBe(10 + XP_BOSS + 15)
  })

  it('counts a task once even when the lesson has two projects', () => {
    expect(xpFor([row(['first-words']), row(['first-words', 'name-tag'])])).toBe(20)
  })

  it('ignores unknown tasks, unpinned projects and the retired web course', () => {
    expect(
      xpFor([row(['nope']), row(['first-words'], week1.id, null), row(['identity'], 1, 2)])
    ).toBe(0)
  })
})

describe('badgesFor', () => {
  it('awards a lesson badge only when its boss is beaten', () => {
    expect(badgesFor([row(['first-words', 'name-tag'])])).toEqual([])
    expect(badgesFor([row(['boot-up'])])).toEqual([week1.badge])
  })
})

describe('levelFor', () => {
  it('starts at Rookie and reports progress toward the next level', () => {
    expect(levelFor(0)).toEqual({ name: 'Rookie', next: 'Coder', into: 0, span: 100 })
    expect(levelFor(130)).toMatchObject({ name: 'Coder', next: 'Scripter', into: 30, span: 150 })
  })

  it('tops out at the last level', () => {
    const last = LEVELS[LEVELS.length - 1]
    expect(levelFor(last.xp + 5000)).toEqual({ name: last.name, next: null, into: 5000, span: 0 })
  })
})

describe('streakFor', () => {
  const today = '2026-03-10'
  it('counts consecutive days ending today', () => {
    expect(streakFor(['2026-03-10', '2026-03-09', '2026-03-08'], today)).toBe(3)
  })
  it('stays alive through yesterday', () => {
    expect(streakFor(['2026-03-09', '2026-03-08'], today)).toBe(2)
  })
  it('breaks after a missed day and ignores older runs', () => {
    expect(streakFor(['2026-03-08', '2026-03-07'], today)).toBe(0)
    expect(streakFor(['2026-03-10', '2026-03-08'], today)).toBe(1)
  })
  it('crosses month and year boundaries', () => {
    expect(streakFor(['2026-01-01', '2025-12-31', '2025-12-30'], '2026-01-01')).toBe(3)
  })
})

describe('todayISO', () => {
  it('returns a calendar date in the configured timezone', () => {
    const instant = new Date('2026-03-10T20:00:00Z')
    process.env.APP_TIMEZONE = 'Asia/Phnom_Penh' // UTC+7: already the 11th
    expect(todayISO(instant)).toBe('2026-03-11')
    delete process.env.APP_TIMEZONE
    expect(todayISO(instant)).toBe('2026-03-10')
  })
})
