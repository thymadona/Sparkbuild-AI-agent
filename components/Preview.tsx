'use client'

interface PreviewProps {
  code: string
  isDragging?: boolean
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

export default function Preview({ code, isDragging }: PreviewProps) {
  const injected = code ? code.replace(/<head>/i, '<head>' + CONSOLE_INTERCEPTOR) : code
  if (!code) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        Your preview will appear here after generation.
      </div>
    )
  }

  if (!code.trimStart().startsWith('<!DOCTYPE html>') && !code.trimStart().startsWith('<!doctype html>')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-red-800 bg-red-950 p-6 max-w-sm text-center">
          <p className="text-red-300 font-medium">Invalid output</p>
          <p className="mt-1 text-sm text-red-400">
            The generated content does not appear to be a valid HTML document.
          </p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      srcDoc={injected}
      sandbox="allow-scripts allow-forms"
      className={`h-full w-full border-0 bg-white ${isDragging ? 'pointer-events-none' : ''}`}
      title="Live preview"
    />
  )
}
