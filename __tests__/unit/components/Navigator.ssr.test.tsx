/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import Navigator from '@/components/Navigator'
import type { Lesson } from '@/lib/lessons'

// A lesson task whose check can only be evaluated with a DOM.
const lesson: Lesson = {
  id: 3,
  title: 'Week #3 — Streak Spark',
  description: 'Test lesson',
  templateFile: 'score-page.html',
  tasks: [
    {
      id: 'goal',
      type: 'core',
      chip: 'Choose a goal',
      success: 'Your tracker shows your own goal.',
      prompt: 'goal',
      commentAnchor: 'TASK: goal name',
      checks: [
        { kind: 'textChanged', selector: 'h1', from: 'My reading streak.', label: 'The title names your goal', hint: 'Change the big title.' },
        { kind: 'textChanged', selector: '.subtitle', from: 'starter line', label: 'You wrote your own intro', hint: 'Rewrite the line.' },
      ],
    },
  ],
}

const STARTER = '<!doctype html><html><body><h1>My reading streak.</h1><p class="subtitle">starter line</p></body></html>'

function tree() {
  return (
    <Navigator
      lesson={lesson}
      projectId="project-1"
      code={STARTER}
      initialCompletedTaskIds={[]}
      onHighlight={() => {}}
      onPrompt={() => {}}
    />
  )
}

// jsdom provides DOMParser, but the Node server runtime does not. Removing it
// for the server render is what makes this test reproduce production.
function markup() {
  const original = globalThis.DOMParser
  // @ts-expect-error simulating a runtime without DOMParser
  delete globalThis.DOMParser
  try {
    return renderToString(tree())
  } finally {
    globalThis.DOMParser = original
  }
}

describe('Navigator server rendering', () => {
  // Regression: checks fail open when they cannot run, and they can never run
  // during server rendering. Evaluating them there reported every check as
  // passed, so the server sent "2/2" while the browser rendered "0/2" — a
  // hydration mismatch, plus a moment where the student could hand in
  // unfinished work.
  it('does not claim any check has passed in the server-rendered markup', () => {
    const html = markup()

    expect(html).not.toContain('2/2')
    expect(html).not.toContain('Your code does it')
  })

  it('renders a neutral placeholder until the checks can run', () => {
    expect(markup()).toContain('Checking your code')
  })

  it('keeps the done button disabled in the server-rendered markup', () => {
    const html = markup()

    expect(html).toContain('Not yet — keep going')
    expect(html).toContain('disabled')
    expect(html).not.toContain('Mark done')
  })

  it('hydrates the server markup without a mismatch', async () => {
    const errors: string[] = []
    const spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    })

    const container = document.createElement('div')
    container.innerHTML = markup()
    document.body.appendChild(container)

    await act(async () => {
      hydrateRoot(container, tree())
    })

    spy.mockRestore()
    expect(errors.filter((message) => /hydrat/i.test(message))).toEqual([])
    // After mount the checks have run against the starter file: nothing passes.
    expect(container.textContent).toContain('Checked in your code: 0/2')
  })
})
