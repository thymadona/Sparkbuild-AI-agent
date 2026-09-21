import { readFileSync } from 'fs'
import { join } from 'path'
import { loadPyodide, type PyodideInterface } from 'pyodide'
import type { PyExec } from '@/lib/python-checks'

// Real Pyodide under Node, running the same public/py-runtime.py glue the
// browser worker uses. Loaded once per test file (a couple of seconds).
const HOME = '/home/pyodide'
const RUNTIME = readFileSync(join(process.cwd(), 'public/py-runtime.py'), 'utf8')

let py: Promise<PyodideInterface> | null = null
let written: string[] = []

async function boot() {
  py ??= loadPyodide().then((p) => {
    p.runPython(RUNTIME)
    return p
  })
  return py
}

async function prepare(files: Record<string, string>, inputs: string[]) {
  const p = await boot()
  for (const f of written) {
    try {
      p.FS.unlink(`${HOME}/${f}`)
    } catch {
      /* already gone */
    }
  }
  written = Object.keys(files).filter(
    (f) => f.endsWith('.py') || f.endsWith('.txt') || f.endsWith('.json')
  )
  for (const f of written) p.FS.writeFile(`${HOME}/${f}`, files[f])
  const queue = [...inputs]
  let stdout = ''
  const dec = new TextDecoder()
  p.setStdout({
    write: (buf: Uint8Array) => {
      stdout += dec.decode(buf)
      return buf.length
    },
  })
  p.setStderr({ write: (buf: Uint8Array) => buf.length })
  p.setStdin({ stdin: () => (queue.length ? queue.shift() : undefined) })
  return { p, out: () => stdout }
}

// Same _trace the browser worker calls.
export async function nodeTrace(source: string) {
  const { p } = await prepare({ 'main.py': source }, [])
  return JSON.parse(
    p.globals.get('_trace')('main.py') as string
  ) as import('@/lib/board/schema').TraceStep[]
}

export const nodeExec: PyExec = {
  async run(files, entry, inputs) {
    const { p, out } = await prepare(files, inputs)
    const ok = p.globals.get('_run')(entry) as boolean
    const events = JSON.parse(p.globals.get('_events_json')() as string)
    return { ok, stdout: out(), events }
  },
  async call(files, entry, expr) {
    const { p } = await prepare(files, [])
    try {
      return p.globals.get('_call')(entry, expr) as string
    } catch {
      return null
    }
  },
}
