import { worldState, type SparkyEvent } from '@/lib/sparky-events'

// Sparky's room. Blocks are the same events real Python makes (public/py-runtime.py),
// so a block and its code mean the same thing.
// ops: `say:Hi`, `color:pink`, `door:open`
export interface RoomState { events: SparkyEvent[] }
export interface RoomGoal { says?: string[]; color?: string; door?: 'open' }

export const initial = (): RoomState => ({ events: [] })

export function apply(state: RoomState, op: string): RoomState {
  const [kind, ...rest] = op.split(':')
  return { events: [...state.events, [kind, rest.join(':')]] }
}

export const view = (state: RoomState) => ({ ...worldState(state.events), says: state.events.filter(([k]) => k === 'say').map(([, a]) => a) })

export function won(state: RoomState, goal: RoomGoal): boolean {
  const v = view(state)
  if (goal.says && (v.says.length !== goal.says.length || v.says.some((s, i) => s.toLowerCase() !== goal.says![i].toLowerCase()))) return false
  if (goal.color && v.color !== goal.color) return false
  if (goal.door && v.door !== goal.door) return false
  return true
}

export const describe = (_config: unknown, goal: RoomGoal) =>
  `Sparky's room. Goal: ${[goal.says && `Sparky says ${goal.says.map((s) => `"${s}"`).join(' then ')} in that order`, goal.color && `Sparky turns ${goal.color}`, goal.door && 'the door opens'].filter(Boolean).join(', ')}.`
