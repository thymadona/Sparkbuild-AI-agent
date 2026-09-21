/** @jest-environment jsdom */
// A stand-in worker: boots after `bootMs`, then answers each run instantly.
let bootMs = 0
let bootFails = false
class FakeWorker {
  listeners: ((e: MessageEvent) => void)[] = []
  terminated = false
  addEventListener(_: string, fn: (e: MessageEvent) => void) {
    this.listeners.push(fn)
  }
  removeEventListener(_: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn)
  }
  emit(data: unknown) {
    for (const l of [...this.listeners]) l({ data } as MessageEvent)
  }
  terminate() {
    this.terminated = true
  }
  postMessage(msg: { type: string; id?: number }) {
    if (msg.type === 'init')
      setTimeout(
        () => this.emit(bootFails ? { type: 'fatal', text: 'no network' } : { type: 'ready' }),
        bootMs
      )
    else
      setTimeout(() => {
        this.emit({ type: 'out', text: 'hi\n' })
        this.emit({ type: 'done', id: msg.id, ok: true })
      }, 0)
  }
}

beforeEach(() => {
  jest.resetModules()
  jest.useFakeTimers()
  ;(global as unknown as { Worker: unknown }).Worker = FakeWorker
})
afterEach(() => jest.useRealTimers())

const load = () =>
  require('@/lib/python-check-client') as typeof import('@/lib/python-check-client')

describe('workerExec', () => {
  it('does not count a slow Pyodide download against the run timeout', async () => {
    bootMs = 12_000 // far beyond the 5s per-check limit
    bootFails = false
    const pending = load().workerExec.run({ 'main.py': 'print("hi")' }, 'main.py', [])
    await jest.advanceTimersByTimeAsync(12_100)
    expect(await pending).toEqual({ ok: true, stdout: 'hi\n', events: [] })
  })

  it('reports PyUnavailable when Python cannot boot, so checks fail open', async () => {
    bootMs = 10
    bootFails = true
    const pending = load().workerExec.run({}, 'main.py', [])
    const caught = pending.catch((e) => e)
    await jest.advanceTimersByTimeAsync(50)
    // Same module registry as the client (resetModules gave it a fresh class).
    const { PyUnavailable } = require('@/lib/python-checks') as typeof import('@/lib/python-checks')
    expect(await caught).toBeInstanceOf(PyUnavailable)
  })
})
