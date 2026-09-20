/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { useAutoComplete, SETTLE_MS } from '@/hooks/useAutoComplete'
import type { TaskChecks } from '@/hooks/useTaskChecks'

const passing: TaskChecks = { results: [{ label: 'ok', hint: 'h', passed: true }], evaluated: true, satisfied: true }
const failing: TaskChecks = { results: [{ label: 'ok', hint: 'h', passed: false }], evaluated: true, satisfied: false }
// A task with no checks: satisfied by default, never evaluated.
const uncheckable: TaskChecks = { results: [], evaluated: false, satisfied: true }

const base = { enabled: true, taskId: 't1', done: false, saving: false, checks: passing, code: 'x' }

const setup = (over: Partial<Parameters<typeof useAutoComplete>[0]> = {}) => {
  const complete = jest.fn()
  const view = renderHook((props: Parameters<typeof useAutoComplete>[0]) => useAutoComplete(props), {
    initialProps: { ...base, complete, ...over },
  })
  return { complete, view }
}

const settle = () => act(() => { jest.advanceTimersByTime(SETTLE_MS) })

describe('useAutoComplete', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('completes the task once its checks pass', () => {
    const { complete } = setup()
    expect(complete).not.toHaveBeenCalled() // not before the settle window
    settle()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('completes a task only once, however the checks flicker', () => {
    const { complete, view } = setup()
    settle()
    view.rerender({ ...base, complete, checks: failing })
    view.rerender({ ...base, complete, checks: passing })
    settle()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('waits for the student to stop typing', () => {
    const { complete, view } = setup()
    act(() => { jest.advanceTimersByTime(SETTLE_MS - 100) })
    view.rerender({ ...base, complete, code: 'x2' }) // still editing
    act(() => { jest.advanceTimersByTime(SETTLE_MS - 100) })
    expect(complete).not.toHaveBeenCalled()
    settle()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('never completes a task that has no checks', () => {
    // Otherwise a legacy lesson would march itself to the end untouched.
    const { complete } = setup({ checks: uncheckable })
    settle()
    expect(complete).not.toHaveBeenCalled()
  })

  it('does nothing while the checks are unmet, saving, already done, or off-lesson', () => {
    for (const over of [{ checks: failing }, { saving: true }, { done: true }, { enabled: false }, { taskId: undefined }]) {
      const { complete } = setup(over)
      settle()
      expect(complete).not.toHaveBeenCalled()
    }
  })

  it('completes the next task after the first', () => {
    const { complete, view } = setup()
    settle()
    view.rerender({ ...base, complete, taskId: 't2' })
    settle()
    expect(complete).toHaveBeenCalledTimes(2)
  })
})
