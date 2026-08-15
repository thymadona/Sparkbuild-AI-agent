'use client'

import { useEffect, useRef } from 'react'

export interface PickedElement {
  tag: string
  id: string | null
  classes: string[]
  outerHTML: string
}

interface PreviewProps {
  code: string
  isDragging?: boolean
  // When true, hovering highlights elements in the preview and a click posts
  // the element back instead of running the page's own handler.
  inspectMode?: boolean
  onInspectPick?: (element: PickedElement) => void
}

const CONSOLE_INTERCEPTOR = `<script>
;(function(){
  function makeStorage() {
    var store = {}
    return {
      getItem: function(k) { return store[k] !== undefined ? store[k] : null },
      setItem: function(k, v) { store[k] = String(v) },
      removeItem: function(k) { delete store[k] },
      clear: function() { store = {} },
      key: function(i) { return Object.keys(store)[i] || null },
      get length() { return Object.keys(store).length }
    }
  }
  try { localStorage } catch(e) { Object.defineProperty(window, 'localStorage', { value: makeStorage() }) }
  try { sessionStorage } catch(e) { Object.defineProperty(window, 'sessionStorage', { value: makeStorage() }) }
  var _send = function(level, args) {
    try {
      window.parent.postMessage({
        type: '__console__',
        level: level,
        args: Array.prototype.slice.call(args).map(function(a) {
          try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a) } catch(e) { return String(a) }
        })
      }, '*')
    } catch(e){}
  }
  ;['log','warn','error','info','debug'].forEach(function(l){
    var orig = console[l].bind(console)
    console[l] = function() { orig.apply(console, arguments); _send(l, arguments) }
  })
  window.addEventListener('error', function(e){
    _send('error', [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')])
  })
})()
</script>`

// Dormant until armed via postMessage — see the arm effect below. Announces
// readiness on load so the parent can re-arm after every srcDoc reload
// (combinedHtml, and therefore the iframe, is recreated on every keystroke).
const INSPECTOR = `<script>
;(function(){
  var armed = false
  var overlay = null
  function ensureOverlay() {
    if (overlay) return overlay
    overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;' +
      'background:rgba(99,102,241,0.25);border:2px solid rgb(99,102,241);border-radius:2px;display:none;'
    document.documentElement.appendChild(overlay)
    return overlay
  }
  function highlight(el) {
    var o = ensureOverlay()
    var r = el.getBoundingClientRect()
    o.style.display = 'block'
    o.style.left = r.left + 'px'
    o.style.top = r.top + 'px'
    o.style.width = r.width + 'px'
    o.style.height = r.height + 'px'
  }
  function clearHighlight() {
    if (overlay) overlay.style.display = 'none'
  }
  function pickable(el) {
    return el && el.nodeType === 1 && el !== document.documentElement && el !== document.body
  }
  document.addEventListener('mousemove', function(e) {
    if (!armed) return
    if (!pickable(e.target)) { clearHighlight(); return }
    highlight(e.target)
  }, true)
  document.addEventListener('click', function(e) {
    if (!armed) return
    e.preventDefault()
    e.stopPropagation()
    if (!pickable(e.target)) return
    var el = e.target
    var classes = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(Boolean) : []
    window.parent.postMessage({
      type: '__inspect__',
      element: { tag: el.tagName.toLowerCase(), id: el.id || null, classes: classes, outerHTML: el.outerHTML }
    }, '*')
    armed = false
    clearHighlight()
  }, true)
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== '__inspect_arm__') return
    armed = !!e.data.on
    if (!armed) clearHighlight()
  })
  window.parent.postMessage({ type: '__inspect_ready__' }, '*')
})()
</script>`

export default function Preview({ code, isDragging, inspectMode = false, onInspectPick }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const injected = code ? code.replace(/<head>/i, '<head>' + CONSOLE_INTERCEPTOR + INSPECTOR) : code

  // Owns the inspect protocol end to end: re-arms on every reload (the iframe
  // reloads on every keystroke since srcDoc is recomputed) and forwards picks
  // outward. Scoped to this iframe via e.source so it doesn't react to
  // messages from some other preview instance (e.g. split view).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === '__inspect_ready__') {
        iframeRef.current?.contentWindow?.postMessage({ type: '__inspect_arm__', on: inspectMode }, '*')
      } else if (e.data?.type === '__inspect__') {
        onInspectPick?.(e.data.element)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [inspectMode, onInspectPick])

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: '__inspect_arm__', on: inspectMode }, '*')
  }, [inspectMode])

  if (!code) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-900 text-fg-muted text-sm">
        Your preview will appear here after generation.
      </div>
    )
  }

  if (!code.trimStart().startsWith('<!DOCTYPE html>') && !code.trimStart().startsWith('<!doctype html>')) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-900">
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-6 max-w-sm text-center">
          <p className="text-red-700 dark:text-red-300 font-medium">Invalid output</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            The generated content does not appear to be a valid HTML document.
          </p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={injected}
      sandbox="allow-scripts allow-forms"
      className={`h-full w-full border-0 bg-white ${isDragging ? 'pointer-events-none' : ''} ${inspectMode ? 'cursor-crosshair' : ''}`}
      title="Live preview"
    />
  )
}
