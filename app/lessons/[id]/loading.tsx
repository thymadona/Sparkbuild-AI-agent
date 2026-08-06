export default function LessonDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-900 font-body animate-pulse">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8 h-4 w-20 rounded bg-surface-700" />
        <div className="mb-2 h-7 w-2/3 rounded bg-surface-700" />
        <div className="mb-8 h-4 w-full rounded bg-surface-700" />

        <div className="mb-8 space-y-3">
          <div className="h-3 w-16 rounded bg-surface-700" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="h-6 w-6 shrink-0 rounded-full bg-surface-700" />
              <div className="h-4 w-3/4 rounded bg-surface-700" />
            </div>
          ))}
        </div>

        <div className="h-10 w-full rounded-lg bg-surface-700" />
      </div>
    </div>
  )
}
