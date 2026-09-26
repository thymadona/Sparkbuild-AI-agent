'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  SearchIcon,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import FilterMenu, { type FilterOption } from './FilterMenu'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  // Applied to both the header and the cells (alignment, width).
  className?: string
  // Makes the header clickable to sort by this value.
  sortValue?: (row: T) => string | number
}

export interface TableFilter<T> {
  id: string
  label: string
  // The first option is "all" and matches every row; the rest are counted.
  options: FilterOption[]
  match: (row: T, value: string) => boolean
}

const PAGE_SIZES = [10, 20, 50, 100]

// Clicks on these never open the row: they do their own thing.
const INTERACTIVE = 'a,button,input,select,textarea,label,[role=menuitem],[data-row-ignore]'

// Every back-office listing: search, dropdown filters, sortable headers,
// pagination, and a whole-row link to the item's detail page. Rows are
// already loaded (and org-scoped) by the page's server component; this only
// slices them.
export default function DataTable<T>({
  rows,
  columns,
  getRowId,
  rowHref,
  search,
  filters = [],
  emptyText,
  noun = 'results',
  toolbar,
  initialFilters,
}: {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  rowHref?: (row: T) => string
  search?: { placeholder: string; text: (row: T) => string }
  filters?: TableFilter<T>[]
  emptyText: string
  noun?: string
  toolbar?: ReactNode
  // Filter id → value to start with (e.g. from a ?org= link); ignored when not an option.
  initialFilters?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      filters.map((f) => {
        const wanted = initialFilters?.[f.id]
        const valid = f.options.some((o) => o.value === wanted)
        return [f.id, valid ? wanted! : (f.options[0]?.value ?? '')]
      })
    )
  )
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = rows.filter((row) => {
      if (q && search && !search.text(row).toLowerCase().includes(q)) return false
      return filters.every((f) => {
        const v = values[f.id]
        return v === f.options[0]?.value || f.match(row, v)
      })
    })
    const col = sort && columns.find((c) => c.id === sort.id)
    if (col?.sortValue) {
      const key = col.sortValue
      const sign = sort!.dir === 'asc' ? 1 : -1
      out.sort((a, b) => {
        const x = key(a)
        const y = key(b)
        return (
          (typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y))) * sign
        )
      })
    }
    return out
  }, [rows, query, search, filters, values, sort, columns])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)
  const narrowed = query.trim() !== '' || filters.some((f) => values[f.id] !== f.options[0]?.value)

  function toggleSort(id: string) {
    setSort((s) =>
      s?.id !== id ? { id, dir: 'asc' } : s.dir === 'asc' ? { id, dir: 'desc' } : null
    )
  }

  function open(row: T, e: React.MouseEvent<HTMLTableRowElement>) {
    if (!rowHref) return
    const target = e.target as HTMLElement
    // A portalled dialog opened from a cell bubbles here through React but
    // isn't inside this <tr> in the DOM.
    if (target.closest('tr') !== e.currentTarget || target.closest(INTERACTIVE)) return
    const href = rowHref(row)
    if (e.metaKey || e.ctrlKey) window.open(href, '_blank')
    else router.push(href)
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {(search || filters.length > 0 || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {search && (
            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
          {filters.map((f) => (
            <FilterMenu
              key={f.id}
              label={f.label}
              value={values[f.id]}
              options={f.options.map((o, i) =>
                i === 0 ? o : { ...o, count: rows.filter((r) => f.match(r, o.value)).length }
              )}
              onChange={(v) => {
                setValues((vs) => ({ ...vs, [f.id]: v }))
                setPage(1)
              }}
            />
          ))}
          {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn('px-4 text-xs font-medium text-muted-foreground', col.className)}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.header}
                    {sort?.id !== col.id ? (
                      <ChevronsUpDownIcon className="h-3 w-3 opacity-50" />
                    ) : sort.dir === 'asc' ? (
                      <ArrowUpIcon className="h-3 w-3" />
                    ) : (
                      <ArrowDownIcon className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => (
            <TableRow
              key={getRowId(row)}
              onClick={rowHref ? (e) => open(row, e) : undefined}
              className={cn(rowHref && 'cursor-pointer')}
            >
              {columns.map((col) => (
                <TableCell key={col.id} className={cn('px-4 py-3', col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="py-12 text-center text-sm text-muted-foreground/70"
              >
                {narrowed ? `No ${noun} match your filters.` : emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-sm">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Rows
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? `0 ${noun}`
            : `Showing ${start + 1} to ${start + visible.length} of ${filtered.length} ${noun}`}
        </span>
        <Pagination page={current} pageCount={pageCount} onPage={setPage} />
      </div>
    </div>
  )
}

// 1 … 4 5 6 … 20: the first, the last, and the current page's neighbours.
export function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1])
  const out: (number | 'gap')[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (!keep.has(p)) continue
    const prev = out[out.length - 1]
    if (typeof prev === 'number' && p - prev > 1) out.push('gap')
    out.push(p)
  }
  return out
}

function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (p: number) => void
}) {
  const btn =
    'flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={cn(btn, 'border border-border hover:bg-muted')}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      {pageItems(page, pageCount).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPage(p)}
            className={cn(
              btn,
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'border border-border hover:bg-muted'
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className={cn(btn, 'border border-border hover:bg-muted')}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </nav>
  )
}
