/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { NodeView, type CodeActions } from '@/app/board/Nodes'
import type { BoardNode } from '@/lib/board/schema'

// ESM-only; the text node that uses them is not under test.
jest.mock('react-markdown', () => () => null)
jest.mock('remark-gfm', () => () => null)

type Helper = Extract<BoardNode, { type: 'helper' }>

const block: Helper = {
  id: 'b1',
  parentId: null,
  createdBy: 'system',
  type: 'helper',
  request: 'make a game',
  source: 'print("game")',
}

const actions = (over: Partial<CodeActions> = {}): CodeActions => ({
  ready: true,
  runningId: null,
  waiting: false,
  run: jest.fn(),
  runHelper: jest.fn(),
  stop: jest.fn(),
  edit: jest.fn(),
  sendInput: jest.fn(),
  setCursor: jest.fn(),
  patch: jest.fn(),
  ...over,
})

describe("Bolt's block", () => {
  it('shows the request and read-only code, marked as written by Bolt', () => {
    render(<NodeView node={block} code={actions()} />)
    expect(screen.getByText(/Bolt wrote this/)).toBeTruthy()
    expect(screen.getByText('make a game')).toBeTruthy()
    expect(screen.getByLabelText('Code Bolt wrote').textContent).toContain('print("game")')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('runs through runHelper, never the student run', () => {
    const code = actions()
    render(<NodeView node={block} code={code} />)
    fireEvent.click(screen.getByRole('button', { name: /Run Bolt's code/ }))
    expect(code.runHelper).toHaveBeenCalledWith(block)
    expect(code.run).not.toHaveBeenCalled()
  })

  it('shows its last run under the block', () => {
    render(
      <NodeView node={{ ...block, stdout: 'game\n', stderr: '', ok: true }} code={actions()} />
    )
    expect(screen.getByText('game')).toBeTruthy()
  })

  it('offers Stop while it runs, and an answer box when it waits for input()', () => {
    const code = actions({ runningId: 'b1', waiting: true })
    render(<NodeView node={block} code={code} />)
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    expect(code.stop).toHaveBeenCalled()
    expect(screen.getByLabelText('Answer for input()')).toBeTruthy()
  })
})
