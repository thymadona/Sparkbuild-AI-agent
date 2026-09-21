export type MascotState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'celebrating' | 'puzzled'

type Rect = [x: number, y: number, w: number, h: number]

const BODY = '#d97757'
const INK = '#1b1410'

// 16x16 pixel grid, drawn as rects so it stays crisp at 64px. Motion is CSS (globals.css, .spark-*).
const EYES: Record<MascotState, Rect[]> = {
  idle: [
    [5, 4, 1, 2],
    [10, 4, 1, 2],
  ],
  listening: [
    [5, 4, 1, 3],
    [10, 4, 1, 3],
  ],
  thinking: [
    [6, 3, 1, 2],
    [11, 3, 1, 2],
  ], // looking up and right
  speaking: [
    [5, 4, 1, 2],
    [10, 4, 1, 2],
  ],
  celebrating: [
    [4, 5, 1, 1],
    [5, 4, 1, 1],
    [6, 5, 1, 1],
    [9, 5, 1, 1],
    [10, 4, 1, 1],
    [11, 5, 1, 1],
  ], // ^ ^
  puzzled: [
    [5, 4, 1, 2],
    [10, 5, 1, 1],
  ], // one eye squints
}
const MOUTH: Rect[] = [[7, 7, 2, 1]]
const DOTS: Rect[] = [
  [6, 0, 1, 1],
  [8, 0, 1, 1],
  [10, 0, 1, 1],
]
const QUESTION: Rect[] = [
  [12, 0, 3, 1],
  [14, 1, 1, 1],
  [13, 2, 1, 1],
  [13, 4, 1, 1],
]
const SPARKS: Rect[] = [
  [1, 1, 1, 1],
  [14, 2, 1, 1],
  [2, 4, 1, 1],
  [0, 3, 1, 1],
]

const r = (rects: Rect[], fill: string, key = fill) =>
  rects.map(([x, y, w, h], i) => (
    <rect key={`${key}${i}`} x={x} y={y} width={w} height={h} fill={fill} />
  ))

export default function Mascot({
  state,
  className = 'size-16',
  body = BODY,
}: {
  state: MascotState
  className?: string
  body?: string
}) {
  const armsUp = state === 'celebrating'
  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`${className} shrink-0`}
      role="img"
      aria-label={`Spark is ${state}`}
    >
      <g className={`spark spark-${state}`}>
        {r([armsUp ? [1, 3, 14, 2] : [1, 6, 14, 2]], body, 'arms')}
        {r(
          [
            [3, 3, 10, 6],
            [4, 9, 1, 3],
            [6, 9, 1, 3],
            [9, 9, 1, 3],
            [11, 9, 1, 3],
          ],
          body,
          'body'
        )}
        {r(EYES[state], INK, 'eye')}
        {state === 'speaking' && <g className="spark-mouth">{r(MOUTH, INK, 'mouth')}</g>}
      </g>
      {state === 'thinking' && <g className="spark-dots">{r(DOTS, INK, 'dot')}</g>}
      {state === 'puzzled' && r(QUESTION, INK, 'q')}
      {state === 'celebrating' && <g className="spark-twinkle">{r(SPARKS, '#f59e0b', 'sp')}</g>}
    </svg>
  )
}
