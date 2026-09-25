'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TraceStep } from '@/lib/board/schema'

export interface OutputChunk {
  kind: 'out' | 'err' | 'in' | 'note'
  text: string
}

export type RunStatus = 'loading' | 'idle' | 'running' | 'waiting' | 'failed'

// A run that goes this long without finishing or asking for input is killed.
const RUN_TIMEOUT_MS = 10_000
const INPUT_BYTES = 1024

// Runs Python in /py-worker.js. input() blocks the worker on a
// SharedArrayBuffer, which needs cross-origin isolation (see next.config.js).
// Without it input() only reads the `inputs` passed to run(), then gets EOF,
// and the student sees a note saying their browser can't answer input().
export function usePythonRunner() {
  const [output, setOutput] = useState<OutputChunk[]>([])
  const [status, setStatus] = useState<RunStatus>('loading')
  const workerRef = useRef<Worker | null>(null)
  const sabRef = useRef<SharedArrayBuffer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const bootedRef = useRef(false)
  const tracesRef = useRef(new Map<number, (steps: TraceStep[]) => void>())
  const traceId = useRef(0)
  const isolated = typeof window !== 'undefined' && window.crossOriginIsolated

  const append = useCallback((chunk: OutputChunk) => setOutput((o) => [...o, chunk]), [])

  const spawn = useCallback(() => {
    const w = new Worker('/py-worker.js')
    workerRef.current = w
    bootedRef.current = false
    setStatus('loading')
    w.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        bootedRef.current = true
        setStatus('idle')
      } else if (data.type === 'out' || data.type === 'err')
        append({ kind: data.type, text: data.text })
      else if (data.type === 'input') {
        clearTimeout(timerRef.current)
        setStatus('waiting')
      } else if (data.type === 'noinput') {
        append({
          kind: 'note',
          text: "This browser can't answer input(). Try another browser, like Chrome or Safari.",
        })
      } else if (data.type === 'done') {
        clearTimeout(timerRef.current)
        setStatus('idle')
      } else if (data.type === 'traced') {
        tracesRef.current.get(data.id)?.(data.steps)
        tracesRef.current.delete(data.id)
      } else if (data.type === 'fatal') {
        append({ kind: 'note', text: 'Python could not load. Check your internet and refresh.' })
        setStatus('idle')
      }
    }
    // The browser refused to start the worker at all (e.g. blocked by a policy header).
    w.onerror = () => {
      append({
        kind: 'note',
        text: 'Python could not start. Refresh the page, or ask your teacher.',
      })
      setStatus('failed')
    }
    w.postMessage({ type: 'init' })
    return w
  }, [append])

  useEffect(() => {
    spawn()
    return () => {
      clearTimeout(timerRef.current)
      workerRef.current?.terminate()
    }
  }, [spawn])

  const armTimeout = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      workerRef.current?.terminate()
      append({
        kind: 'note',
        text: 'Sparky overheated! Your code ran too long, so we stopped it. Is a loop never ending?',
      })
      spawn()
    }, RUN_TIMEOUT_MS)
  }, [append, spawn])

  const run = useCallback(
    (files: Record<string, string>, entry: string, inputs: string[] = []) => {
      const w = workerRef.current
      if (!w) return
      setOutput([])
      setStatus('running')
      sabRef.current = isolated ? new SharedArrayBuffer(8 + INPUT_BYTES) : null
      armTimeout()
      w.postMessage({ type: 'run', files, entry, sab: sabRef.current, inputs })
    },
    [armTimeout, isolated]
  )

  const stop = useCallback(() => {
    clearTimeout(timerRef.current)
    workerRef.current?.terminate()
    append({ kind: 'note', text: 'Stopped.' })
    spawn()
  }, [append, spawn])

  // Steps through the program without asking for input. Resolves [] if it takes too long.
  const trace = useCallback(
    (source: string) =>
      new Promise<TraceStep[]>((resolve) => {
        const w = workerRef.current
        if (!w) return resolve([])
        const id = ++traceId.current
        const timer = setTimeout(() => {
          tracesRef.current.delete(id)
          resolve([])
        }, RUN_TIMEOUT_MS)
        tracesRef.current.set(id, (steps) => {
          clearTimeout(timer)
          resolve(steps)
        })
        w.postMessage({ type: 'trace', id, files: { 'main.py': source }, entry: 'main.py' })
      }),
    []
  )

  const sendInput = useCallback(
    (text: string) => {
      const sab = sabRef.current
      if (!sab) return
      const bytes = new TextEncoder().encode(text).slice(0, INPUT_BYTES)
      new Uint8Array(sab, 8).set(bytes)
      new Int32Array(sab, 4, 1)[0] = bytes.length
      append({ kind: 'in', text: text + '\n' })
      setStatus('running')
      armTimeout()
      const flag = new Int32Array(sab, 0, 1)
      Atomics.store(flag, 0, 1)
      Atomics.notify(flag, 0)
    },
    [append, armTimeout]
  )

  return { output, status, run, trace, stop, sendInput, isolated }
}
