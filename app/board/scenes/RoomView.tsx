import { view, type RoomState } from '@/lib/board/scenes/room'
import { SparkySpeaker } from '../StepNodes'

// Sparky's room: he says, changes color, and the door opens, as the blocks run.
export default function RoomView({ state, frame }: { state: RoomState; frame: number }) {
  const v = view(state)
  return (
    <div className="flex items-end justify-around gap-4 rounded-xl bg-[#2b2f4a] p-4">
      <SparkySpeaker speak={v.say ?? ''} run={frame} waiting="idle" body={v.color ?? undefined} />
      <div
        aria-label={v.door === 'open' ? 'The door is open' : 'The door is closed'}
        role="img"
        className="relative h-28 w-20 rounded-t-lg border-4 border-[#6b7390] bg-[#0d1020]"
      >
        <div
          className={`absolute inset-0 origin-left bg-[#aab2c5] transition-transform duration-500 motion-reduce:transition-none ${v.door === 'open' ? '[transform:scaleX(0.15)]' : ''}`}
        />
        {v.door === 'open' && (
          <div className="absolute inset-x-3 bottom-2 h-6 rounded bg-[#ffd65a]" />
        )}
      </div>
    </div>
  )
}
