import type { MachineConfig, MachineState } from '@/lib/board/scenes/machine'

const slot = 'flex min-h-14 min-w-20 items-center justify-center rounded-lg px-3 py-2 font-mono text-lg font-bold'

// A value goes in on the left, the machine changes it, and the result comes out on the right.
export default function MachineView({ state, config }: { state: MachineState; config: MachineConfig }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl bg-[#1f2a2e] p-4" role="img" aria-label={`Machine. In: ${config.input}. Out: ${state.value}.`}>
      <div className={`${slot} border-2 border-sky-300 text-sky-100`}>{String(config.input)}</div>
      <span aria-hidden="true" className="text-2xl text-sky-300">→</span>
      <div aria-hidden="true" className="grid size-16 place-items-center rounded-xl bg-sky-700 text-3xl">⚙️</div>
      <span aria-hidden="true" className="text-2xl text-emerald-300">→</span>
      <div className={`${slot} border-2 border-emerald-400 bg-emerald-900 text-emerald-100`}>
        <span key={String(state.value)} className="board-rise break-all">{String(state.value)}</span>
      </div>
    </div>
  )
}
