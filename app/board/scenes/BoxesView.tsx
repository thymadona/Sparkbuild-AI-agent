import type { BoxesConfig, BoxesState } from '@/lib/board/scenes/boxes'

// A shelf of labelled boxes. A box that changes pops so the eye finds it.
// Keys added at run time (`set:imp=2`) get a box after the configured ones, like a new dict key.
export default function BoxesView({ state, config }: { state: BoxesState; config: BoxesConfig }) {
  const names = [...new Set([...config.boxes.map((b) => b.name), ...Object.keys(state)])]
  return (
    <div className="flex flex-wrap justify-center gap-4 rounded-xl bg-[#2b2118] p-4">
      {names.map((name) => {
        const v = state[name]
        return (
          <div
            key={name}
            className="w-28 text-center"
            role="img"
            aria-label={`Box ${name} holds ${v === undefined ? 'nothing' : String(v)}`}
          >
            <div className="mb-1 font-mono text-sm font-bold text-amber-300">{name}</div>
            <div className="flex min-h-14 items-center justify-center rounded-lg border-4 border-[#b98a4d] bg-[#3b2a1c] px-2 py-2 font-mono text-lg text-[#faf6ee]">
              <span key={String(v)} className="board-rise break-all">
                {v === undefined ? (
                  <span className="text-[#faf6ee]/30">empty</span>
                ) : typeof v === 'string' ? (
                  `"${v}"`
                ) : (
                  v
                )}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
