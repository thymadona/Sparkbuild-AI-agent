/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react'
import DataTable, { pageItems } from '@/components/dashboard/DataTable'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

type Row = { id: string; name: string; paid: boolean }

const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
  id: `r${i + 1}`,
  name: `Student ${String(i + 1).padStart(2, '0')}`,
  paid: i % 2 === 0,
}))

function table(extra: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <DataTable<Row>
      rows={rows}
      getRowId={(r) => r.id}
      rowHref={(r) => `/staff/students/${r.id}`}
      noun="students"
      emptyText="No students yet."
      search={{ placeholder: 'Search', text: (r) => r.name }}
      columns={[
        { id: 'name', header: 'Name', sortValue: (r) => r.name, cell: (r) => r.name },
        {
          id: 'action',
          header: '',
          cell: (r) => <button onClick={() => undefined}>act {r.id}</button>,
        },
      ]}
      {...extra}
    />
  )
}

const bodyRows = () => screen.getAllByRole('row').slice(1)

beforeEach(() => mockPush.mockReset())

describe('pageItems', () => {
  it('keeps the ends and the neighbours, with gaps between', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(1, 3)).toEqual([1, 2, 3])
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(pageItems(1, 10)).toEqual([1, 2, 'gap', 10])
  })
})

describe('DataTable', () => {
  it('shows ten rows a page and moves between pages', () => {
    table()
    expect(bodyRows()).toHaveLength(10)
    expect(screen.getByText('Showing 1 to 10 of 23 students')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(bodyRows()).toHaveLength(3)
    expect(screen.getByText('Showing 21 to 23 of 23 students')).toBeTruthy()
  })

  it('searches and goes back to page one', () => {
    table()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Student 2' } })
    expect(bodyRows().map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      'Student 20',
      'Student 21',
      'Student 22',
      'Student 23',
    ])
  })

  it('sorts by a column, then reverses', () => {
    table()
    const header = screen.getByRole('button', { name: /Name/ })
    fireEvent.click(header)
    fireEvent.click(header)
    expect(within(bodyRows()[0]).getAllByRole('cell')[0].textContent).toBe('Student 23')
  })

  it('opens a row, but not when a button in it is clicked', () => {
    table()
    fireEvent.click(screen.getByText('act r1'))
    expect(mockPush).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Student 01'))
    expect(mockPush).toHaveBeenCalledWith('/staff/students/r1')
  })

  it('says so when a filter matches nothing', () => {
    table({ search: { placeholder: 'Search', text: (r) => r.name } })
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })
    expect(screen.getByText('No students match your filters.')).toBeTruthy()
  })

  it('shows the empty text with no rows', () => {
    table({ rows: [] })
    expect(screen.getByText('No students yet.')).toBeTruthy()
  })
})
