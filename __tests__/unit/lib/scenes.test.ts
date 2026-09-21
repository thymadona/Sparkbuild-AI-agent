import { PY_LESSONS } from '@/lib/py-lessons'
import { programWins, runProgram, type Block } from '@/lib/board/scenes'
import type { GridState } from '@/lib/board/scenes/grid'

const stages = PY_LESSONS.flatMap((l) => l.tasks.flatMap((t) => (t.steps ?? []).flatMap((s) => (s.kind === 'stage' ? [{ where: `${l.id}/${t.id}`, step: s }] : []))))

describe('stage steps in the catalog', () => {
  it('has at least one stage of each scene', () => {
    expect(new Set(stages.map((s) => s.step.scene))).toEqual(new Set(['room', 'grid', 'boxes', 'machine']))
  })

  it.each(stages.map((s) => [s.where + ' ' + s.step.scene, s.step] as const))('%s: the solution wins and an empty program does not', (_name, step) => {
    const cfg = step.config ?? {}
    expect(programWins(step.scene, cfg, step.goal, step.palette, step.solution)).toBe(true)
    expect(programWins(step.scene, cfg, step.goal, step.palette, [])).toBe(false)
    expect(step.solution.length).toBeLessThanOrEqual(8)
    expect(step.palette.length).toBeLessThanOrEqual(8)
  })
})

describe('scenes', () => {
  const grid = { w: 3, h: 1, start: { x: 0, y: 0, dir: 'E' as const }, gems: [[2, 0]] as [number, number][] }
  const blocks: Block[] = [{ label: 'move', ops: ['move'] }, { label: 'left', ops: ['left'] }]

  it('grid: a wrong turn misses the gem, and walking off the edge just stops', () => {
    expect(programWins('grid', grid, {}, blocks, [0, 0])).toBe(true)
    expect(programWins('grid', grid, {}, blocks, [0])).toBe(false)
    const end = runProgram('grid', grid, blocks, [1, 0, 0]).at(-1) as GridState // facing north, off the board
    expect(end).toMatchObject({ x: 0, y: 0, bumped: true })
  })

  it('room: order matters, and the last say is what Sparky says', () => {
    const palette: Block[] = [{ label: 'hi', ops: ['say:Hi'] }, { label: 'bye', ops: ['say:Bye'] }]
    expect(programWins('room', {}, { says: ['Hi', 'Bye'] }, palette, [0, 1])).toBe(true)
    expect(programWins('room', {}, { says: ['Hi', 'Bye'] }, palette, [1, 0])).toBe(false)
  })

  it('boxes: add starts an empty box at 0; machine: blocks chain', () => {
    expect(programWins('boxes', { boxes: [{ name: 'n' }] }, { values: { n: 2 } }, [{ label: '+2', ops: ['add:n:2'] }], [0])).toBe(true)
    expect(programWins('machine', { input: 'ada' }, { out: 'ADA!' }, [{ label: 'up', ops: ['upper'] }, { label: '!', ops: ['exclaim'] }], [0, 1])).toBe(true)
  })
})
