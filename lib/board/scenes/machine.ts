// A machine: a value goes in, each block changes it, a value comes out.
// ops: `upper`, `lower`, `double`, `add:1`, `exclaim`
export interface MachineConfig { input: string | number }
export interface MachineGoal { out: string | number }
export interface MachineState { value: string | number; trail: (string | number)[] }

export const initial = (c: MachineConfig): MachineState => ({ value: c.input, trail: [c.input] })

export function apply(s: MachineState, op: string): MachineState {
  const [kind, arg] = op.split(':')
  const v = s.value
  const next =
    kind === 'upper' ? String(v).toUpperCase()
    : kind === 'lower' ? String(v).toLowerCase()
    : kind === 'double' ? (typeof v === 'number' ? v * 2 : `${v}${v}`)
    : kind === 'add' ? Number(v) + Number(arg)
    : kind === 'exclaim' ? `${v}!`
    : v
  return { value: next, trail: [...s.trail, next] }
}

export const won = (s: MachineState, g: MachineGoal) => String(s.value) === String(g.out)

export const describe = (c: MachineConfig, g: MachineGoal) => `A machine. Input ${JSON.stringify(c.input)}. Goal: the output is ${JSON.stringify(g.out)}.`
