/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'util'
import { usePythonRunner } from '@/hooks/usePythonRunner'

// jsdom has no TextEncoder; sendInput needs one.
Object.assign(global, { TextEncoder, TextDecoder })

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

describe('usePythonRunner with cross-origin isolation', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true })
  })
  afterAll(() => {
    Object.defineProperty(window, 'crossOriginIsolated', { value: false, configurable: true })
  })

  it('waits for input(), hands the answer to the worker and finishes', () => {
    const { result } = renderHook(() => usePythonRunner())
    const w = FakeWorker.last
    w.reply({ type: 'ready' })

    act(() => result.current.run({ 'main.py': 'print(input())' }, 'main.py'))
    const sab = (w.sent.at(-1) as { sab: SharedArrayBuffer }).sab
    expect(sab).toBeInstanceOf(SharedArrayBuffer)

    w.reply({ type: 'input' })
    expect(result.current.status).toBe('waiting')

    act(() => result.current.sendInput('7'))
    expect(result.current.status).toBe('running')
    expect(new Int32Array(sab, 0, 1)[0]).toBe(1)
    expect(new TextDecoder().decode(new Uint8Array(sab, 8, new Int32Array(sab, 4, 1)[0]))).toBe('7')

    w.reply({ type: 'out', text: '7\n' })
    w.reply({ type: 'done', ok: true })
    expect(result.current.status).toBe('idle')
    expect(result.current.output).toEqual([
      { kind: 'in', text: '7\n' },
      { kind: 'out', text: '7\n' },
    ])
  })
})
