// Runs student Python in a Web Worker so an infinite loop can be killed by
// terminate() without freezing the page. The main thread owns the timeout.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js')

const HOME = '/home/pyodide'
let py
let written = []

// One shared promise: concurrent messages must not see a half-loaded Pyodide.
let booting
function boot() {
  booting ??= (async () => {
    py = await loadPyodide()
    py.runPython(await (await fetch('/py-runtime.py')).text())
    return py
  })()
  return booting
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try { await boot(); self.postMessage({ type: 'ready' }) } catch (e) { self.postMessage({ type: 'fatal', text: String(e) }) }
    return
  }
  if (data.type !== 'run' && data.type !== 'check' && data.type !== 'trace') return
  try {
    await boot()
  } catch (e) {
    self.postMessage({ type: 'fatal', text: String(e) })
    return
  }
  const { files, entry, sab, inputs } = data
  const queue = [...(inputs ?? [])]
  for (const f of written) { try { py.FS.unlink(`${HOME}/${f}`) } catch {} }
  written = Object.keys(files).filter((f) => f.endsWith('.py') || f.endsWith('.txt') || f.endsWith('.json'))
  for (const f of written) py.FS.writeFile(`${HOME}/${f}`, files[f])
  const dec = new TextDecoder()
  const send = (type) => ({ write: (buf) => { self.postMessage({ type, text: dec.decode(buf) }); return buf.length } })
  py.setStdout(send('out'))
  py.setStderr(send('err'))
  py.setStdin({
    stdin: () => {
      if (!sab) {
        if (queue.length) return queue.shift()
        // A run on a page without cross-origin isolation: input() can't wait for an answer.
        if (data.type === 'run') self.postMessage({ type: 'noinput' })
        return undefined
      }
      const flag = new Int32Array(sab, 0, 1)
      Atomics.store(flag, 0, 0)
      self.postMessage({ type: 'input' })
      Atomics.wait(flag, 0, 0)
      const len = new Int32Array(sab, 4, 1)[0]
      return dec.decode(new Uint8Array(sab, 8, len).slice())
    },
  })
  if (data.type === 'trace') {
    try { self.postMessage({ type: 'traced', id: data.id, steps: JSON.parse(py.globals.get('_trace')(entry)) }) }
    catch { self.postMessage({ type: 'traced', id: data.id, steps: [] }) }
    return
  }
  try {
    // 'check' = evaluate an expression for a lesson check; 'run' = run the script.
    const result = data.type === 'check' ? py.globals.get('_call')(entry, data.expr) : py.globals.get('_run')(entry)
    const events = data.type === 'check' ? undefined : JSON.parse(py.globals.get('_events_json')())
    self.postMessage({ type: 'done', id: data.id, ok: data.type === 'check' ? true : result, value: data.type === 'check' ? result : undefined, events })
  } catch (e) {
    if (data.type === 'check') self.postMessage({ type: 'done', id: data.id, ok: false })
    else { self.postMessage({ type: 'err', text: String(e.message || e) }); self.postMessage({ type: 'done', id: data.id, ok: false }) }
  }
}
