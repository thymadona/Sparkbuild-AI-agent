// A small grid: Sparky walks it and picks up gems.
// ops: `move`, `left`, `right`
export type Dir = 'N' | 'E' | 'S' | 'W'
export interface GridConfig {
  w: number
  h: number
  start: { x: number; y: number; dir: Dir }
  gems: [number, number][]
}
export interface GridState {
  x: number
  y: number
  dir: Dir
  gems: [number, number][]
  bumped: boolean
}

const DIRS: Dir[] = ['N', 'E', 'S', 'W']
const STEP: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }

export const initial = (c: GridConfig): GridState => ({ ...c.start, gems: c.gems, bumped: false })

export function apply(s: GridState, op: string, c?: GridConfig): GridState {
  if (op === 'left') return { ...s, dir: DIRS[(DIRS.indexOf(s.dir) + 3) % 4], bumped: false }
  if (op === 'right') return { ...s, dir: DIRS[(DIRS.indexOf(s.dir) + 1) % 4], bumped: false }
  if (op !== 'move') return s
  const [dx, dy] = STEP[s.dir]
  const x = s.x + dx,
    y = s.y + dy
  // Walking off the board just stops Sparky: never an error for a child.
  if (c && (x < 0 || y < 0 || x >= c.w || y >= c.h)) return { ...s, bumped: true }
  return { ...s, x, y, bumped: false, gems: s.gems.filter(([gx, gy]) => gx !== x || gy !== y) }
}

export const won = (s: GridState) => s.gems.length === 0

export const describe = (c: GridConfig) =>
  `A ${c.w} by ${c.h} grid. Sparky starts at column ${c.start.x + 1}, row ${c.start.y + 1} facing ${c.start.dir}. Gems at ${c.gems.map(([x, y]) => `(${x + 1},${y + 1})`).join(' ')}. Goal: pick up every gem.`
