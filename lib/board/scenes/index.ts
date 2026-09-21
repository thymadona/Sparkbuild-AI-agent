import * as room from './room'
import * as grid from './grid'
import * as boxes from './boxes'
import * as machine from './machine'

export type SceneId = 'room' | 'grid' | 'boxes' | 'machine'
export const SCENE_IDS: SceneId[] = ['room', 'grid', 'boxes', 'machine']

// One tappable block: what the student sees, and the ops it runs in the scene.
export interface Block {
  label: string
  ops: string[]
}

interface Scene {
  initial(config: never): unknown
  apply(state: never, op: string, config?: never): unknown
  won(state: never, goal: never): boolean
  describe(config: never, goal: never): string
}
const SCENES = { room, grid, boxes, machine } as unknown as Record<SceneId, Scene>

type Any = Record<string, unknown>
const call = <T>(fn: unknown, ...args: unknown[]) => (fn as (...a: unknown[]) => T)(...args)

// The state before anything runs.
export const initialState = (scene: SceneId, config: Any): unknown =>
  call(SCENES[scene].initial, config)

// Every state a program passes through: [start, after op 1, after op 2, ...].
export function runProgram(
  scene: SceneId,
  config: Any,
  palette: Block[],
  program: number[]
): unknown[] {
  const s = SCENES[scene]
  const states = [initialState(scene, config)]
  for (const i of program)
    for (const op of palette[i]?.ops ?? [])
      states.push(call(s.apply, states[states.length - 1], op, config))
  return states
}

export const sceneWon = (scene: SceneId, state: unknown, goal: Any) =>
  call<boolean>(SCENES[scene].won, state, goal)
export const describeScene = (scene: SceneId, config: Any, goal: Any) =>
  call<string>(SCENES[scene].describe, config, goal)
export const programWins = (
  scene: SceneId,
  config: Any,
  goal: Any,
  palette: Block[],
  program: number[]
) => sceneWon(scene, runProgram(scene, config, palette, program).at(-1), goal)
