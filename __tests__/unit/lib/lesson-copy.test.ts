/**
 * Reading-level budget for the text a student is required to read.
 *
 * These limits exist because many students are reading English as a second
 * language. Copy that drifts past these limits turns a lesson gate into a
 * reading test. The course is pitched at 10–16: short per-string caps, the
 * Python words it teaches (variable) allowed, and a per-lesson total budget.
 */
import type { Lesson } from '@/lib/lessons'
import { PY_LESSONS } from '@/lib/py-lessons'

const MAX_WORDS = {
  chip: 5,
  success: 8,
  label: 6,
  hint: 10,
  question: 10,
  option: 6,
  explain: 12,
  go: 14,
}

// Words a 9-year-old ESL reader should not have to decode to make progress.
// Code identifiers are exempt: they are names on screen, not prose.
const TOO_ADVANCED = [
  'milestone',
  'milestones',
  'customize',
  'customise',
  'prototype',
  'placeholder',
  'gradient',
  'variable',
  'variables',
  'duration',
  'specific',
  'realistic',
  'memorable',
  'challenge',
  'celebration',
  'energetic',
  'description',
  'collection',
  'encouraging',
  'instructions',
  'statement',
  'interaction',
  'personalize',
  'genuinely',
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

// The short strings a non-quiz step shows besides its prompt.
const stepWords = (step: NonNullable<Lesson['tasks'][number]['steps']>[number]): string[] => {
  switch (step.kind) {
    case 'try':
      return step.chips ?? []
    case 'learn':
      return step.frames.flatMap((f) => [f.note, ...(f.speak ? [f.speak] : [])])
    case 'order':
      return []
    case 'walk':
      return step.frames.flatMap((f) => (f.note ? [f.note] : []))
    case 'bug':
      return [step.explain]
    case 'match':
      return step.pairs.map((p) => p.right)
    case 'stage':
      return step.palette.map((b) => b.label)
    default:
      return []
  }
}

type Entry = { where: string; kind: keyof typeof MAX_WORDS; text: string }

const entriesFor = (lessons: Lesson[]): Entry[] =>
  lessons.flatMap((lesson) => [
    ...lesson.tasks.flatMap((task) => [
      { where: `${lesson.id}/${task.id}`, kind: 'chip' as const, text: task.chip },
      { where: `${lesson.id}/${task.id}`, kind: 'success' as const, text: task.success },
      ...(task.go
        ? [{ where: `${lesson.id}/${task.id}`, kind: 'go' as const, text: task.go }]
        : []),
      ...(task.then
        ? [{ where: `${lesson.id}/${task.id}`, kind: 'go' as const, text: task.then.go }]
        : []),
      ...(task.steps ?? []).flatMap((step) => [
        { where: `${lesson.id}/${task.id}`, kind: 'question' as const, text: step.prompt },
        ...(step.kind === 'choose'
          ? [
              ...step.options.map((text) => ({
                where: `${lesson.id}/${task.id}`,
                kind: 'option' as const,
                text,
              })),
              { where: `${lesson.id}/${task.id}`, kind: 'explain' as const, text: step.explain },
            ]
          : stepWords(step).map((text) => ({
              where: `${lesson.id}/${task.id}`,
              kind: 'option' as const,
              text,
            }))),
      ]),
      ...(task.checks ?? []).flatMap((check) => [
        { where: `${lesson.id}/${task.id}`, kind: 'label' as const, text: check.label },
        { where: `${lesson.id}/${task.id}`, kind: 'hint' as const, text: check.hint },
      ]),
    ]),
  ])

describe('Python course reading level', () => {
  const lessons = PY_LESSONS
  const allowed = TAUGHT_IN_PYTHON
  // Two weeks measure ~250 words each; leave room for the 12-week track.
  const budget = 300 * PY_LESSONS.length
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
      for (const token of prose(entry.text)
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)) {
        if (TOO_ADVANCED.includes(token) && !allowed.includes(token))
          found.push(`${entry.where} ${entry.kind}: "${token}" in "${entry.text}"`)
      }
    }
    expect(found).toEqual([])
  })

  it('keeps the total reading load down', () => {
    // Steps are read once, on the way to the editor, so they get their own budget
    // and do not eat into the per-lesson budget for the task text.
    const STEP_KINDS = ['question', 'option', 'explain', 'go']
    const total = entries
      .filter((e) => !STEP_KINDS.includes(e.kind))
      .reduce((sum, entry) => sum + words(entry.text), 0)
    const steps = entries
      .filter((e) => STEP_KINDS.includes(e.kind))
      .reduce((sum, entry) => sum + words(entry.text), 0)
    expect(total).toBeLessThan(budget)
    expect(steps).toBeLessThan(
      60 * lessons.length + 220 * lessons.filter((l) => l.tasks.some((t) => t.steps)).length
    )
  })
})
