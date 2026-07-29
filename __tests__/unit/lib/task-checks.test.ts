/**
 * @jest-environment jsdom
 */
import { LESSONS } from '@/lib/lessons'
import { allChecksPassed, firstUnmetCheck, runTaskChecks } from '@/lib/task-checks'
import fs from 'fs'
import path from 'path'

const template = fs.readFileSync(path.join(process.cwd(), 'public/templates/score-page.html'), 'utf8')

function readTemplate(file: string) {
  return fs.readFileSync(path.join(process.cwd(), 'public/templates', file), 'utf8')
}

const week3 = LESSONS.find((lesson) => lesson.id === 3)!
const task = (id: string) => week3.tasks.find((item) => item.id === id)!

describe('lesson check coverage', () => {
  it('gives every task in every current lesson at least one check', () => {
    const unchecked = LESSONS.flatMap((lesson) =>
      lesson.tasks.filter((item) => !item.checks?.length).map((item) => `${lesson.id}/${item.id}`),
    )
    expect(unchecked).toEqual([])
  })

  // The invariant that fixes "a student can mark a task done without doing it":
  // on the starter template, no task may be satisfiable.
  it.each(LESSONS.map((lesson) => [lesson.id, lesson.title, lesson] as const))(
    'lesson %i (%s) has no task that passes on the untouched template',
    (_id, _title, lesson) => {
      const starter = readTemplate(lesson.templateFile)
      const passingOnStarter = lesson.tasks
        .filter((item) => allChecksPassed(runTaskChecks(item.checks, starter)))
        .map((item) => item.id)
      expect(passingOnStarter).toEqual([])
    },
  )

  it('reports every individual check as unmet on the untouched template', () => {
    const wronglyPassing: string[] = []
    for (const lesson of LESSONS) {
      const starter = readTemplate(lesson.templateFile)
      for (const item of lesson.tasks) {
        for (const result of runTaskChecks(item.checks, starter)) {
          if (result.passed) wronglyPassing.push(`${lesson.id}/${item.id}: ${result.label}`)
        }
      }
    }
    expect(wronglyPassing).toEqual([])
  })

  // A typo'd selector also "fails on the starter", which would trap a student
  // forever. Every textChanged check must point at an element that exists and
  // currently holds exactly the text it claims to be replacing.
  it('anchors every textChanged check to a real element holding the starter text', () => {
    const broken: string[] = []
    for (const lesson of LESSONS) {
      const doc = new DOMParser().parseFromString(readTemplate(lesson.templateFile), 'text/html')
      for (const item of lesson.tasks) {
        for (const check of item.checks ?? []) {
          if (check.kind !== 'textChanged') continue
          const element = doc.querySelector(check.selector)
          if (!element) {
            broken.push(`${lesson.id}/${item.id}: no element matches ${check.selector}`)
            continue
          }
          const actual = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
          const expected = check.from.replace(/\s+/g, ' ').trim()
          if (actual.toLowerCase() !== expected.toLowerCase()) {
            broken.push(`${lesson.id}/${item.id}: ${check.selector} holds "${actual}", check says "${expected}"`)
          }
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('lets a student satisfy every check with a real edit', () => {
    // Simulates the edit each check asks for, then requires the check to pass.
    const stillFailing: string[] = []
    for (const lesson of LESSONS) {
      const starter = readTemplate(lesson.templateFile)
      for (const item of lesson.tasks) {
        for (const check of item.checks ?? []) {
          let edited = starter
          if (check.kind === 'textChanged') {
            const doc = new DOMParser().parseFromString(starter, 'text/html')
            const element = doc.querySelector(check.selector)!
            element.textContent = 'a student wrote this'
            edited = `<!doctype html>${doc.documentElement.outerHTML}`
          } else if (check.kind === 'sourceOmits') {
            edited = starter.split(check.snippet).join('a student wrote this')
          } else if (check.kind === 'sourceMatches') {
            // Repeat the documented example enough times to clear `min`.
            const example = check.example ?? "7: 'one whole week'; target.style.width = '40px'"
            edited = `${starter}\n<!-- ${example.repeat(check.min ?? 1)} -->`
          }
          const [result] = runTaskChecks([check], edited)
          if (!result.passed) stillFailing.push(`${lesson.id}/${item.id}: ${check.label}`)
        }
      }
    }
    expect(stillFailing).toEqual([])
  })

  it('documents an example for every sourceMatches check', () => {
    const missing = LESSONS.flatMap((lesson) =>
      lesson.tasks.flatMap((task) =>
        (task.checks ?? [])
          .filter((check) => check.kind === 'sourceMatches' && !check.example)
          .map((check) => `${lesson.id}/${task.id}: ${check.label}`),
      ),
    )
    expect(missing).toEqual([])
  })

  it('gives every lesson homework with checks', () => {
    for (const lesson of LESSONS) {
      const homework = lesson.tasks.filter((task) => task.type === 'homework')
      expect(homework.length).toBeGreaterThanOrEqual(2)
      expect(lesson.homeworkBrief).toBeTruthy()
      for (const task of homework) {
        expect(task.checks?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })
})

describe('runTaskChecks', () => {
  it('returns no checks for a task that has none', () => {
    expect(runTaskChecks(undefined, template)).toEqual([])
  })

  it('fails every Week #3 check on the untouched template', () => {
    for (const lessonTask of week3.tasks) {
      const results = runTaskChecks(lessonTask.checks, template)
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((result) => !result.passed)).toBe(true)
    }
  })

  it('passes textChanged only when the element text really differs', () => {
    const edited = template.replace(
      '<h1>My <span style="color:var(--orange)">reading</span> streak.</h1>',
      '<h1>My piano streak.</h1>',
    )
    const results = runTaskChecks(task('goal').checks, edited)

    expect(results[0].passed).toBe(true)
    expect(results[1].passed).toBe(false)
    expect(firstUnmetCheck(results)?.hint).toContain('line under the title')
  })

  it('does not accept a whitespace or letter-case edit as a change', () => {
    const cosmetic = template.replace(
      '<h1>My <span style="color:var(--orange)">reading</span> streak.</h1>',
      '<h1>  MY   READING\n  STREAK.  </h1>',
    )
    expect(runTaskChecks(task('goal').checks, cosmetic)[0].passed).toBe(false)
  })

  it('fails textChanged when the element is deleted', () => {
    const removed = template.replace(/<h1>[\s\S]*?<\/h1>/, '')
    expect(runTaskChecks(task('goal').checks, removed)[0].passed).toBe(false)
  })

  it('tracks each milestone message independently', () => {
    const partial = template
      .replace('First step complete — you started!', 'You began. That counts.')
      .replace('Five wins! You are building momentum.', 'Five days of piano!')
    const results = runTaskChecks(task('milestones').checks, partial)

    expect(results.map((result) => result.passed)).toEqual([true, false, true])
    expect(allChecksPassed(results)).toBe(false)
  })

  it('passes the whole milestones task once all three are rewritten', () => {
    const rewritten = template
      .replace('First step complete — you started!', 'Day one done.')
      .replace('Three in a row! Your streak has a spark.', 'Three days strong.')
      .replace('Five wins! You are building momentum.', 'Five days of piano!')
    expect(allChecksPassed(runTaskChecks(task('milestones').checks, rewritten))).toBe(true)
  })

  it('counts milestones for the bonus task', () => {
    expect(runTaskChecks(task('custom-milestone').checks, template)[0].passed).toBe(false)

    const withFourth = template.replace(
      "5: 'Five wins! You are building momentum.'",
      "5: 'Five wins! You are building momentum.', 7: 'One whole week!'",
    )
    expect(runTaskChecks(task('custom-milestone').checks, withFourth)[0].passed).toBe(true)
  })

  it('detects the customized buttons and reward card', () => {
    const edited = template
      .replace('>I did it! +1<', '>Practiced today! +1<')
      .replace('>Reset<', '>Start over<')
      .replace('My reward at 7 days: a cosy movie night 🍿', 'My reward at 7 days: new sheet music 🎹')

    expect(allChecksPassed(runTaskChecks(task('counter').checks, edited))).toBe(true)
    expect(allChecksPassed(runTaskChecks(task('reward').checks, edited))).toBe(true)
  })

  it('fails open on an invalid pattern instead of blocking the student', () => {
    const results = runTaskChecks(
      [{ kind: 'sourceMatches', pattern: '([unclosed', label: 'broken', hint: 'broken' }],
      template,
    )
    expect(results[0].passed).toBe(true)
  })
})
