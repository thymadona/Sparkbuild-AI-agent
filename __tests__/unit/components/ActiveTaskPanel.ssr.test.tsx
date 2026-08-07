/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ActiveTaskPanel from '@/components/ActiveTaskPanel'
import type { LessonTask } from '@/lib/lessons'

// A lesson task whose check can only be evaluated with a DOM.
const task: LessonTask = {
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
}

const STARTER = '<!doctype html><html><body><h1>My reading streak.</h1><p class="subtitle">starter line</p></body></html>'

function tree(onMarkDone: () => void = () => {}) {
  return (
    <ActiveTaskPanel
      task={task}
      code={STARTER}
      isSaving={false}
      saveError={null}
      onMarkDone={onMarkDone}
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

describe('ActiveTaskPanel server rendering', () => {
  // Regression: checks fail open when they cannot run, and they can never run
  // during server rendering. Evaluating them there reported every check as
  // passed, which would render the Mark done button enabled the moment the
  // page hydrated, even though the student had not actually finished it.
  it('renders a neutral placeholder until the checks can run', () => {
    expect(markup()).toContain('Checking your code')
  })

  it('does not render an enabled Mark done button in the server-rendered markup', () => {
    const html = markup()

    expect(html).not.toContain('Mark done')
  })

  it('keeps Mark done disabled after hydration, and reports no hydration mismatch', async () => {
    const onMarkDone = jest.fn()
    const errors: string[] = []
    const spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    })

    const container = document.createElement('div')
    container.innerHTML = markup()
    document.body.appendChild(container)

    await act(async () => {
      hydrateRoot(container, tree(onMarkDone))
    })

    spy.mockRestore()
    expect(errors.filter((message) => /hydrat/i.test(message))).toEqual([])
    // After mount the checks have run against the starter file: nothing passes.
    const button = container.querySelector('button')!
    expect(button.textContent).toContain('Not yet')
    expect(button.disabled).toBe(true)

    await act(async () => { button.click() })
    expect(onMarkDone).not.toHaveBeenCalled()
  })
})
