// Memory boxes: each variable is a labelled box holding a value.
// ops: `set:name=Ada`, `set:age=10`, `add:age:1`
export interface BoxesConfig { boxes: { name: string; value?: string | number }[] }
export interface BoxesGoal { values: Record<string, string | number> }
export type BoxesState = Record<string, string | number | undefined>

export const initial = (c: BoxesConfig): BoxesState => Object.fromEntries(c.boxes.map((b) => [b.name, b.value]))

export function apply(s: BoxesState, op: string): BoxesState {
  const [kind, a, b] = op.split(':')
  if (kind === 'set') {
    const [name, ...v] = a.split('=')
    const raw = v.join('=')
    return { ...s, [name]: raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw }
  }
  if (kind === 'add') return { ...s, [a]: (typeof s[a] === 'number' ? (s[a] as number) : 0) + Number(b) }
  return s
}

export const won = (s: BoxesState, g: BoxesGoal) => Object.entries(g.values).every(([k, v]) => String(s[k]) === String(v))

export const describe = (c: BoxesConfig, g: BoxesGoal) =>
  `Memory boxes ${c.boxes.map((b) => `${b.name}${b.value !== undefined ? `=${b.value}` : ' (empty)'}`).join(', ')}. Goal: ${Object.entries(g.values).map(([k, v]) => `${k} holds ${JSON.stringify(v)}`).join(', ')}.`
