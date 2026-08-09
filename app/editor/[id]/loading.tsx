export default function EditorLoading() {
  return (
    <div className="flex h-screen flex-col bg-surface-900 font-body animate-pulse">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-surface-600 bg-surface-800 px-4">
        <div className="h-3 w-32 rounded bg-surface-700" />
        <div className="flex items-center gap-3">
          <div className="h-3 w-16 rounded bg-surface-700" />
          <div className="h-3 w-16 rounded bg-surface-700" />
          <div className="h-6 w-6 rounded-full bg-surface-700" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[420px] shrink-0 border-r-2 border-surface-600 bg-surface-800 p-3 space-y-2">
          <div className="h-4 w-24 rounded bg-surface-700" />
          <div className="h-20 rounded bg-surface-700" />
          <div className="h-20 rounded bg-surface-700" />
        </div>
        <div className="flex-1 bg-surface-900" />
      </div>
    </div>
  )
}
