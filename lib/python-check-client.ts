import { PyUnavailable, type PyExec } from './python-checks'
import type { SparkyEvent } from './sparky-events'

// A hidden worker dedicated to lesson checks, so a student's own Run (and its
// Stop button) never interferes with them. Created lazily, one per page.
const CHECK_TIMEOUT_MS = 5_000

let worker: Worker | null = null
// Resolves once Pyodide has booted in `worker`; rejects (PyUnavailable) if it cannot.
let ready: Promise<void> | null = null
let seq = 0
// The worker handles one request at a time; overlapping ones would share its
// stdout and file system.
let queue: Promise<unknown> = Promise.resolve()

function ensureWorker() {
  if (!worker) {
    const w = new Worker('/py-worker.js')
    worker = w
    ready = new Promise<void>((resolve, reject) => {
      const onMessage = ({ data }: MessageEvent) => {
        if (data.type === 'ready') { w.removeEventListener('message', onMessage); resolve() }
        else if (data.type === 'fatal') { w.removeEventListener('message', onMessage); reject(new PyUnavailable(data.text)) }
      }
      w.addEventListener('message', onMessage)
      w.addEventListener('error', () => reject(new PyUnavailable('worker failed to start')))
    })
    ready.catch(() => undefined) // reported through send(); avoid an unhandled rejection
    w.postMessage({ type: 'init' })
  }
  return worker
}

type Reply = { ok: boolean; value?: string; stdout: string; events: SparkyEvent[] }

function request(message: Record<string, unknown>): Promise<Reply> {
  const next = queue.then(() => send(message))
  queue = next.catch(() => undefined)
  return next
}

async function send(message: Record<string, unknown>): Promise<Reply> {
  const w = ensureWorker()
  // Boot is not the student's code: a slow download must not eat the run timeout.
  try {
    await ready
  } catch (e) {
    if (worker === w) { w.terminate(); worker = null; ready = null }
    throw e
  }
  const id = ++seq
  let stdout = ''
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // An endless loop in the student's code: kill it and count the check as failed.
      w.terminate()
      if (worker === w) { worker = null; ready = null }
      resolve({ ok: false, stdout, events: [] })
    }, CHECK_TIMEOUT_MS)
    const onMessage = ({ data }: MessageEvent) => {
      if (data.type === 'out') stdout += data.text
      else if (data.type === 'fatal') { clearTimeout(timer); w.removeEventListener('message', onMessage); reject(new PyUnavailable(data.text)) }
      else if (data.type === 'done' && data.id === id) {
        clearTimeout(timer)
        w.removeEventListener('message', onMessage)
        resolve({ ok: data.ok, value: data.value, stdout, events: data.events ?? [] })
      }
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ ...message, id })
  })
}

export const workerExec: PyExec = {
  async run(files, entry, inputs) {
    const { ok, stdout, events } = await request({ type: 'run', files, entry, inputs, sab: null })
    return { ok, stdout, events }
  },
  async call(files, entry, expr) {
    const { ok, value } = await request({ type: 'check', files, entry, expr })
    return ok ? (value ?? null) : null
  },
}
