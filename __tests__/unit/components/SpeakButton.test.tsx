/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import SpeakButton from '@/components/SpeakButton'

type Utterance = { text: string; lang: string; rate: number; onend?: () => void; onerror?: () => void }

function installSpeechSynthesis() {
  const spoken: Utterance[] = []
  const cancel = jest.fn()
  class FakeUtterance {
    text: string
    lang = ''
    rate = 1
    constructor(text: string) { this.text = text }
  }
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: (u: Utterance) => spoken.push(u), cancel },
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance })
  return { spoken, cancel }
}

function removeSpeechSynthesis() {
  // @ts-expect-error deleting an optional browser API for the unsupported case
  delete window.speechSynthesis
}

describe('SpeakButton', () => {
  afterEach(() => { removeSpeechSynthesis() })

  it('reads the text aloud, slowly, in English', () => {
    const { spoken } = installSpeechSynthesis()
    render(<SpeakButton text="Change the big title to your goal." />)

    fireEvent.click(screen.getByRole('button', { name: 'Read this out loud' }))

    expect(spoken).toHaveLength(1)
    expect(spoken[0].text).toBe('Change the big title to your goal.')
    expect(spoken[0].lang).toBe('en-US')
    expect(spoken[0].rate).toBeLessThan(1)
  })

  it('stops when clicked a second time', () => {
    const { spoken, cancel } = installSpeechSynthesis()
    render(<SpeakButton text="Read me" />)

    fireEvent.click(screen.getByRole('button', { name: 'Read this out loud' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }))

    expect(cancel).toHaveBeenCalled()
    expect(spoken).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Read this out loud' })).toBeInTheDocument()
  })

  it('renders nothing when the browser cannot speak', () => {
    render(<SpeakButton text="Change the big title to your goal." />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing for empty text', () => {
    installSpeechSynthesis()
    render(<SpeakButton text="   " />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
