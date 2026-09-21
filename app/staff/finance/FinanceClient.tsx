'use client'

import { useState, useMemo } from 'react'
import MarkPaidButton from '@/components/admin/MarkPaidButton'
import SendInvoiceButton from '@/components/admin/SendInvoiceButton'
import EditInvoiceModal from '@/components/admin/EditInvoiceModal'
import DeleteInvoiceButton from '@/components/admin/DeleteInvoiceButton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type InvoiceRow = {
  id: string
  user_id: string
  amount_cents: number
  description: string
  due_date: string
  status: 'unpaid' | 'paid' | 'void'
  sent_at: string | null
  paid_at: string | null
}

type ProfileRow = {
  user_id: string
  full_name: string
  parent_telegram_chat_id: string | null
}

function formatAmount(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

type Filter = 'all' | 'unpaid' | 'paid' | 'void'

export default function FinanceClient({
  invoices,
  profileMap,
  receiptByInvoice,
}: {
  invoices: InvoiceRow[]
  profileMap: Record<string, ProfileRow>
  receiptByInvoice: Record<string, string>
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter !== 'all' && inv.status !== filter) return false
      if (search) {
        const name = profileMap[inv.user_id]?.full_name?.toLowerCase() ?? ''
        const desc = inv.description.toLowerCase()
        if (!name.includes(search.toLowerCase()) && !desc.includes(search.toLowerCase()))
          return false
      }
      return true
    })
  }, [invoices, filter, search, profileMap])

  const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length
  const paidCount = invoices.filter((i) => i.status === 'paid').length
  const totalOutstanding = invoices
    .filter((i) => i.status === 'unpaid')
    .reduce((s, i) => s + i.amount_cents, 0)
  const totalCollected = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amount_cents, 0)

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: invoices.length },
    { id: 'unpaid', label: 'Unpaid', count: unpaidCount },
    { id: 'paid', label: 'Paid', count: paidCount },
    { id: 'void', label: 'Void', count: invoices.filter((i) => i.status === 'void').length },
  ]

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-destructive/10 ring-destructive/20">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-destructive/80 mb-1">
              Outstanding
            </div>
            <div className="text-2xl font-bold text-destructive">
              {formatAmount(totalOutstanding)}
            </div>
            <div className="text-xs text-destructive/70 mt-1">
              {unpaidCount} unpaid invoice{unpaidCount !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 ring-success/20">
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-success/80 mb-1">
              Collected
            </div>
            <div className="text-2xl font-bold text-success">{formatAmount(totalCollected)}</div>
            <div className="text-xs text-success/70 mt-1">
              {paidCount} paid invoice{paidCount !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Total
            </div>
            <div className="text-2xl font-bold text-foreground">{invoices.length}</div>
            <div className="text-xs text-muted-foreground/70 mt-1">all invoices</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
              <span
                className={`rounded px-1.5 py-0.5 ${filter === f.id ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or description…"
          className="w-60 rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => {
              const profile = profileMap[inv.user_id]
              const receiptId = receiptByInvoice[inv.id] ?? null
              const isOverdue = inv.status === 'unpaid' && inv.due_date < today
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-foreground">
                    {profile?.full_name ?? (
                      <span className="text-muted-foreground/70 italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                    {inv.description}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-foreground">
                    {formatAmount(inv.amount_cents)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                  >
                    {new Date(inv.due_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {isOverdue && <span className="ml-1 text-destructive">overdue</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        inv.status === 'paid'
                          ? 'success'
                          : inv.status === 'void'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      {inv.status === 'unpaid' && <MarkPaidButton invoiceId={inv.id} />}
                      <a
                        href={`/invoice/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                      >
                        Invoice PDF
                      </a>
                      {receiptId && (
                        <a
                          href={`/receipt/${receiptId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                        >
                          Receipt PDF
                        </a>
                      )}
                      <SendInvoiceButton
                        invoiceId={inv.id}
                        receiptId={receiptId}
                        hasTelegramId={!!profile?.parent_telegram_chat_id}
                      />
                      {inv.sent_at && (
                        <span
                          className="text-xs text-muted-foreground/70"
                          title={`Sent ${new Date(inv.sent_at).toLocaleString()}`}
                        >
                          ✓ sent
                        </span>
                      )}
                      {inv.status !== 'paid' && <EditInvoiceModal invoice={inv} />}
                      {inv.status !== 'paid' && <DeleteInvoiceButton invoiceId={inv.id} />}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground/70"
                >
                  {search || filter !== 'all'
                    ? 'No invoices match your filter.'
                    : 'No invoices yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground/70">
        {filtered.length} of {invoices.length} invoices
      </p>
    </div>
  )
}
