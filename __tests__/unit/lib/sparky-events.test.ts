import { worldState, worldTranscript, type SparkyEvent } from '@/lib/sparky-events'

const events: SparkyEvent[] = [['say', 'a\nb'], ['color', 'pink'], ['door', 'open'], ['alarm', '']]

describe('sparky events', () => {
  it('builds one line per event for checks', () => {
    expect(worldTranscript(events)).toBe('say:a b\ncolor:pink\ndoor:open\nalarm')
  })

  it('replays to the scene at any point', () => {
    expect(worldState([])).toEqual({ say: null, color: null, door: 'closed', alarm: false })
    expect(worldState(events.slice(0, 2))).toMatchObject({ say: 'a\nb', color: 'pink', door: 'closed', alarm: false })
    expect(worldState(events)).toMatchObject({ door: 'open', alarm: true })
    expect(worldState([...events, ['door', 'closed']]).door).toBe('closed')
  })
})
