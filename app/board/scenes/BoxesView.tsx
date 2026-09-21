import type { BoxesConfig, BoxesState } from '@/lib/board/scenes/boxes'

// A shelf of labelled boxes. A box that changes pops so the eye finds it.
export default function BoxesView({ state, config }: { state: BoxesState; config: BoxesConfig }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 rounded-xl bg-[#2b2118] p-4">
      {config.boxes.map((b) => {
        const v = state[b.name]
        return (
          <div key={b.name} className="w-28 text-center" role="img" aria-label={`Box ${b.name} holds ${v === undefined ? 'nothing' : String(v)}`}>
            <div className="mb-1 font-mono text-sm font-bold text-amber-300">{b.name}</div>
            <div className="flex min-h-14 items-center justify-center rounded-lg border-4 border-[#b98a4d] bg-[#3b2a1c] px-2 py-2 font-mono text-lg text-[#faf6ee]">
              <span key={String(v)} className="board-rise break-all">{v === undefined ? <span className="text-[#faf6ee]/30">empty</span> : typeof v === 'string' ? `"${v}"` : v}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
