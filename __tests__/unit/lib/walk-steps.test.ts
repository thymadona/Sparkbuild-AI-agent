import { PY_LESSONS } from '@/lib/py-lessons'
import { nodeTrace } from '@/__tests__/helpers/pyodide'

jest.setTimeout(120_000)

// Every walk step's authored frames must equal a real traced run of its code.
const walks = PY_LESSONS.flatMap((l) =>
  l.tasks.flatMap((t) =>
    (t.steps ?? []).flatMap((s, i) =>
      s.kind === 'walk' ? [{ name: `${l.id}/${t.id}#${i}`, s }] : []
    )
  )
)

it('has walk steps to check', () => expect(walks.length).toBeGreaterThan(0))

describe.each(walks)('walk $name', ({ s }) => {
  it('matches a real run', async () => {
    const real = await nodeTrace(s.code)
    expect(s.frames.length).toBeLessThanOrEqual(12)
    expect(
      s.frames.map((f) => ({
        line: f.line,
        out: f.out ?? '',
        stack: f.stack ?? ['<module>'],
        vars: f.vars,
      }))
    ).toEqual(
      real.map((r) => ({
        line: r.line,
        out: r.stdout.replace(/\n$/, ''),
        stack: r.callStack,
        vars: Object.fromEntries(r.vars.map((v) => [v.name, v.items ?? v.repr])),
      }))
    )
  })
})
