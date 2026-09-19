/**
 * Reading-level budget for the text a student is required to read.
 *
 * These limits exist because many students are reading English as a second
 * language. Copy that drifts past these limits turns a lesson gate into a
 * reading test. The HTML course (v2) was written for 8–13; the Python course
 * (v3) is pitched at 10–16, so it keeps the same per-string caps but may use
 * the Python words it teaches (variable) and gets a per-lesson total budget.
 */
import { HTML_LESSONS, type Lesson } from '@/lib/lessons'
import { PY_LESSONS } from '@/lib/py-lessons'

const MAX_WORDS = { chip: 5, success: 8, label: 6, hint: 10, brief: 8 }

// Words a 9-year-old ESL reader should not have to decode to make progress.
// Code identifiers are exempt: they are names on screen, not prose.
const TOO_ADVANCED = [
  'milestone', 'milestones', 'customize', 'customise', 'prototype', 'placeholder',
  'gradient', 'variable', 'variables', 'duration', 'specific', 'realistic',
  'memorable', 'challenge', 'celebration', 'energetic', 'description',
  'collection', 'encouraging', 'instructions', 'statement', 'interaction',
  'personalize', 'genuinely',
]

// Words the Python course teaches on purpose, so they are not "too advanced" there.
const TAUGHT_IN_PYTHON = ['variable', 'variables']

function words(text: string) {
  return text.trim().split(/\s+/).length
}

function prose(text: string) {
  // Drop code-ish tokens before judging vocabulary.
  return text
    .split(/\s+/)
    .filter((token) => !/[.#<>{}()[\]]|--|[a-z][A-Z]/.test(token))
    .join(' ')
}

type Entry = { where: string; kind: keyof typeof MAX_WORDS; text: string }

const entriesFor = (lessons: Lesson[]): Entry[] => lessons.flatMap((lesson) => [
  ...(lesson.homeworkBrief ? [{ where: `${lesson.id}`, kind: 'brief' as const, text: lesson.homeworkBrief }] : []),
  ...lesson.tasks.flatMap((task) => [
    { where: `${lesson.id}/${task.id}`, kind: 'chip' as const, text: task.chip },
    { where: `${lesson.id}/${task.id}`, kind: 'success' as const, text: task.success },
    ...(task.checks ?? []).flatMap((check) => [
      { where: `${lesson.id}/${task.id}`, kind: 'label' as const, text: check.label },
      { where: `${lesson.id}/${task.id}`, kind: 'hint' as const, text: check.hint },
    ]),
  ]),
])

describe.each([
  ['HTML course', HTML_LESSONS, [] as string[], 1400],
  // Two weeks measure ~250 words each; leave room for the 12-week track.
  ['Python course', PY_LESSONS, TAUGHT_IN_PYTHON, 300 * PY_LESSONS.length],
] as const)('%s reading level', (_name, lessons, allowed, budget) => {
  const entries = entriesFor([...lessons])

  it('has text to check', () => {
    expect(entries.length).toBeGreaterThanOrEqual(lessons.length * 30)
  })

  it('keeps every student-facing string inside its word budget', () => {
    const overLong = entries
      .filter((entry) => words(entry.text) > MAX_WORDS[entry.kind])
      .map((entry) => `${entry.where} ${entry.kind} (${words(entry.text)} words): ${entry.text}`)
    expect(overLong).toEqual([])
  })

  it('avoids vocabulary above the target reading level', () => {
    const found: string[] = []
    for (const entry of entries) {
      for (const token of prose(entry.text).toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)) {
        if (TOO_ADVANCED.includes(token) && !allowed.includes(token)) found.push(`${entry.where} ${entry.kind}: "${token}" in "${entry.text}"`)
      }
    }
    expect(found).toEqual([])
  })

  it('keeps the total reading load down', () => {
    const total = entries.reduce((sum, entry) => sum + words(entry.text), 0)
    // HTML: was 1,835 words for 6 lessons before the copy pass; 886 after it,
    // and ~1,240 once each week gained homework. Keep new content inside a budget.
    expect(total).toBeLessThan(budget)
  })
})
