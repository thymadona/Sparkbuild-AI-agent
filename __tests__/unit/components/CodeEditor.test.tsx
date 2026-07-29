/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import CodeEditor from '@/components/CodeEditor'

// CodeMirror's DOM is not what we are testing here — the draft/autosave logic
// is. Swap the editor for a textarea that reports changes the same way.
jest.mock('@uiw/react-codemirror', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
      React.createElement('textarea', {
        'data-testid': 'code-input',
        value,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      }),
    EditorView: {
      baseTheme: () => ({}),
      decorations: { from: () => ({}) },
      scrollIntoView: () => ({}),
    },
  }
})

jest.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))

const STARTER = '<h1>My reading streak.</h1>'

function type(value: string) {
  fireEvent.change(screen.getByTestId('code-input'), { target: { value } })
}

describe('CodeEditor autosave', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('reports typing upward once the student pauses', () => {
    const onChange = jest.fn()
    render(<CodeEditor code={STARTER} onSave={jest.fn()} onChange={onChange} saveState="saved" />)

    type('<h1>My piano')
    type('<h1>My piano streak.</h1>')
    expect(onChange).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(300) })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('<h1>My piano streak.</h1>')
  })

  it('shows save status instead of a Save button when autosaving', () => {
    const { rerender } = render(<CodeEditor code={STARTER} onSave={jest.fn()} onChange={jest.fn()} saveState="saved" />)

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()

    rerender(<CodeEditor code={STARTER} onSave={jest.fn()} onChange={jest.fn()} saveState="saving" />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('keeps the manual Save button when no autosave handler is given', () => {
    render(<CodeEditor code={STARTER} onSave={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('saves immediately on ctrl+s without waiting for the debounce', () => {
    const onSave = jest.fn()
    render(<CodeEditor code={STARTER} onSave={onSave} onChange={jest.fn()} saveState="dirty" />)

    type('<h1>Done early</h1>')
    fireEvent.keyDown(screen.getByTestId('code-input'), { key: 's', ctrlKey: true })

    expect(onSave).toHaveBeenCalledWith('<h1>Done early</h1>')
  })

  it('adopts an AI generation that arrives while the editor stays mounted', () => {
    const onChange = jest.fn()
    const { rerender } = render(<CodeEditor code={STARTER} onSave={jest.fn()} onChange={onChange} saveState="saved" />)

    rerender(<CodeEditor code="<h1>AI wrote this</h1>" onSave={jest.fn()} onChange={onChange} saveState="saved" />)

    expect(screen.getByTestId('code-input')).toHaveValue('<h1>AI wrote this</h1>')
  })

  it('does not fight the student while they are typing', () => {
    const onChange = jest.fn()
    const { rerender } = render(<CodeEditor code={STARTER} onSave={jest.fn()} onChange={onChange} saveState="saved" />)

    type('<h1>Half typed')
    act(() => { jest.advanceTimersByTime(300) })

    // The parent echoes our own value back as the new `code` prop.
    rerender(<CodeEditor code="<h1>Half typed" onSave={jest.fn()} onChange={onChange} saveState="saved" />)
    type('<h1>Half typed and more</h1>')

    expect(screen.getByTestId('code-input')).toHaveValue('<h1>Half typed and more</h1>')
  })
})
