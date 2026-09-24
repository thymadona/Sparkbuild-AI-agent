/** @jest-environment jsdom */
import { useReducer, useRef } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import BoardView from '@/app/board/BoardView'
import { useBolt } from '@/app/board/useBolt'
import { apply, boardReducer, emptyBoard, type BoardState } from '@/lib/board/reducer'

// ESM-only; captions are not under test.
jest.mock(
  'react-markdown',
  () =>
    ({ children }: { children: string }) =>
      children
)
jest.mock('remark-gfm', () => () => null)

const board: BoardState = apply(emptyBoard(), { op: 'new_page', pageId: 't_dir-1', title: 'One' })

const view = (props: Partial<Parameters<typeof BoardView>[0]> = {}) =>
  render(
    <BoardView board={board} captions={[]} live="" mascot="idle" onSend={jest.fn()} {...props} />
  )

const type = (text: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
  fireEvent.submit(screen.getByRole('textbox').closest('form')!)
}

describe('the Sparky / Bolt switch', () => {
  beforeAll(() => {
    // jsdom lacks these; BoardView uses them to scroll the page.
    window.matchMedia = (() => ({ matches: false })) as never
    Element.prototype.scrollTo = () => {}
  })

  it('is not there in a tutor lesson', () => {
    view()
    expect(screen.queryByRole('button', { name: /Bolt/ })).toBeNull()
    expect(screen.getByLabelText('Message Sparky')).toBeTruthy()
  })

  it('starts on Sparky, and in Bolt mode sends the text to Bolt instead', () => {
    const onSend = jest.fn()
    const onAskBolt = jest.fn()
    view({ onSend, onAskBolt })
    expect(screen.getByRole('button', { name: 'Sparky' }).getAttribute('aria-pressed')).toBe('true')
    type('hi')
    expect(onSend).toHaveBeenCalledWith('hi')

    fireEvent.click(screen.getByRole('button', { name: /Bolt/ }))
    type('make a game')
    expect(onAskBolt).toHaveBeenCalledWith('make a game')
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})

describe('useBolt', () => {
  const block = {
    op: 'add',
    pageId: 't_dir-1',
    node: {
      id: 'bolt_1',
      parentId: null,
      createdBy: 'system',
      type: 'helper',
      request: 'make a game',
      source: 'print("game")',
    },
  }
  const reply = (status: number, body: object = {}) =>
    (global.fetch = jest.fn(async () => ({
      ok: status === 200,
      status,
      json: async () => body,
    })) as never)

  function setup() {
    const saveBoard = jest.fn(async (_b: BoardState) => {})
    const send = jest.fn()
    const say = jest.fn()
    const hook = renderHook(() => {
      const [state, dispatch] = useReducer(boardReducer, board)
      const boardRef = useRef(state)
      boardRef.current = state
      return {
        state,
        ...useBolt({ projectId: 'p', dispatch, boardRef, saveBoard, send, say }),
      }
    })
    return { hook, saveBoard, send, say }
  }

  it('saves first, posts to the helper route, adds the block, then sends helper_result', async () => {
    reply(200, { op: block, caption: 'It prints game.' })
    const { hook, saveBoard, send, say } = setup()
    await act(() => hook.result.current.ask('make a game', 't_dir-1'))

    expect(saveBoard).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/p/helper',
      expect.objectContaining({
        body: JSON.stringify({ request: 'make a game', pageId: 't_dir-1' }),
      })
    )
    expect(hook.result.current.state.nodes.bolt_1).toMatchObject({ type: 'helper' })
    expect(say).toHaveBeenCalledWith('Bolt: It prints game.')
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ type: 'helper_result', nodeId: 'bolt_1' })
    )
    // The board Sparky reads already holds the block.
    expect(saveBoard.mock.calls.at(-1)?.[0].nodes.bolt_1).toBeDefined()
    expect(hook.result.current.building).toBe(false)
  })

  it('with no block (too big) shows the caption and does not wake Sparky', async () => {
    reply(200, { op: null, caption: 'That is too big for me. Ask me for a smaller piece.' })
    const { hook, send, say } = setup()
    await act(() => hook.result.current.ask('make a huge game', 't_dir-1'))
    await new Promise((r) => setTimeout(r, 10))
    expect(say).toHaveBeenCalledWith(expect.stringMatching(/smaller piece/))
    expect(send).not.toHaveBeenCalled()
  })

  it('shows the slow-down caption on a 429', async () => {
    reply(429)
    const { hook, send, say } = setup()
    await act(() => hook.result.current.ask('make a game', 't_dir-1'))
    expect(say).toHaveBeenCalledWith('Whoa, too fast! Wait a moment and try again.')
    expect(send).not.toHaveBeenCalled()
  })
})
