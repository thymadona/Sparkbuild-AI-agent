// What a run of the student's program did in Sparky's world, as recorded by
// public/py-runtime.py: ['say', line], ['color', name], ['door', 'open' | 'closed'], ['alarm', ''].
export type SparkyEvent = [kind: string, arg: string]

// One line per event, for lesson checks: "say:Hi Ada", "door:open", "alarm".
export const worldTranscript = (events: SparkyEvent[]) =>
  events.map(([kind, arg]) => (arg ? `${kind}:${arg.replace(/\n/g, ' ')}` : kind)).join('\n')

export interface WorldState {
  say: string | null
  color: string | null
  door: 'closed' | 'open'
  alarm: boolean
}

// The scene after the given events have played.
export function worldState(events: SparkyEvent[]): WorldState {
  const state: WorldState = { say: null, color: null, door: 'closed', alarm: false }
  for (const [kind, arg] of events) {
    if (kind === 'say') state.say = arg
    else if (kind === 'color') state.color = arg
    else if (kind === 'door') state.door = arg === 'open' ? 'open' : 'closed'
    else if (kind === 'alarm') state.alarm = true
  }
  return state
}
