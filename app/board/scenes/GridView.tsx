import type { GridConfig, GridState } from '@/lib/board/scenes/grid'

const CELL = 44
const ANGLE = { N: 0, E: 90, S: 180, W: 270 }

// A small grid. Sparky is the amber arrow; purple gems are what to pick up.
export default function GridView({ state, config }: { state: GridState; config: GridConfig }) {
  const { w, h } = config
  return (
    <div className="flex justify-center rounded-xl bg-[#0b0f2a] p-3">
      <svg
        viewBox={`0 0 ${w * CELL} ${h * CELL}`}
        className="w-full max-w-72"
        role="img"
        aria-label={`Grid. Sparky is at column ${state.x + 1}, row ${state.y + 1}. ${state.gems.length} gems left.`}
      >
        {Array.from({ length: w * h }, (_, i) => (
          <rect
            key={i}
            x={(i % w) * CELL + 2}
            y={Math.floor(i / w) * CELL + 2}
            width={CELL - 4}
            height={CELL - 4}
            rx={6}
            fill="#141a45"
            stroke="#2c3580"
          />
        ))}
        {state.gems.map(([x, y]) => (
          <polygon
            key={`${x}${y}`}
            points="0,-11 10,-5 10,5 0,11 -10,5 -10,-5"
            transform={`translate(${x * CELL + CELL / 2} ${y * CELL + CELL / 2})`}
            fill="#8b5cf6"
            stroke="#c4b5fd"
            strokeWidth={2}
          />
        ))}
        <g
          style={{
            transform: `translate(${state.x * CELL + CELL / 2}px, ${state.y * CELL + CELL / 2}px)`,
          }}
          className="transition-transform duration-500 motion-reduce:transition-none"
        >
          <g
            style={{ transform: `rotate(${ANGLE[state.dir]}deg)` }}
            className="transition-transform duration-300 motion-reduce:transition-none"
          >
            <polygon
              points="0,-15 12,12 0,6 -12,12"
              fill="#fbbf24"
              stroke="#fff7d6"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
