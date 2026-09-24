import type { MachineConfig, MachineState } from '@/lib/board/scenes/machine'

const slot =
  'flex min-h-14 min-w-14 items-center justify-center rounded-lg px-2 py-2 font-mono text-base font-bold sm:min-w-20 sm:px-3 sm:text-lg'

// A value goes in on the left, the machine changes it, and the result comes out on the right.
export default function MachineView({
  state,
  config,
}: {
  state: MachineState
  config: MachineConfig
}) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl bg-[#1f2a2e] p-3 sm:gap-3 sm:p-4"
      role="img"
      aria-label={`Machine. In: ${config.input}. Out: ${state.value}.`}
    >
      <div className={`${slot} border-2 border-sky-300 text-sky-100`}>{String(config.input)}</div>
      <span aria-hidden="true" className="text-lg text-sky-300 sm:text-2xl">
        →
      </span>
      <div
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-700 text-2xl sm:size-16 sm:text-3xl"
      >
        ⚙️
      </div>
      <span aria-hidden="true" className="text-lg text-emerald-300 sm:text-2xl">
        →
      </span>
      <div className={`${slot} border-2 border-emerald-400 bg-emerald-900 text-emerald-100`}>
        <span key={String(state.value)} className="board-rise break-all">
          {String(state.value)}
        </span>
      </div>
    </div>
  )
}
