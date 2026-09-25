/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { usePythonRunner } from '@/hooks/usePythonRunner'

// A stand-in for /py-worker.js: the test plays the worker's messages.
class FakeWorker {
  static last: FakeWorker
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  sent: { type: string; sab?: unknown }[] = []
  constructor() {
    FakeWorker.last = this
  }
  postMessage(m: { type: string }) {
    this.sent.push(m)
  }
  terminate() {}
  reply(data: unknown) {
    act(() => this.onmessage?.({ data }))
  }
}

beforeAll(() => {
  ;(global as unknown as { Worker: unknown }).Worker = FakeWorker
})

describe('usePythonRunner without cross-origin isolation', () => {
  it('runs without a SharedArrayBuffer and explains an unanswerable input()', () => {
    const { result } = renderHook(() => usePythonRunner())
    expect(result.current.isolated).toBeFalsy()
    const w = FakeWorker.last
    w.reply({ type: 'ready' })

    act(() => result.current.run({ 'main.py': 'input()' }, 'main.py'))
    expect(w.sent.at(-1)).toMatchObject({ type: 'run', sab: null })

    w.reply({ type: 'noinput' })
    w.reply({ type: 'err', text: 'EOFError: EOF when reading a line' })
    w.reply({ type: 'done', ok: false })

    const notes = result.current.output.filter((c) => c.kind === 'note')
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toMatch(/can't answer input\(\)/)
    expect(result.current.output.some((c) => c.kind === 'err')).toBe(true)
    expect(result.current.status).toBe('idle')
  })
})
