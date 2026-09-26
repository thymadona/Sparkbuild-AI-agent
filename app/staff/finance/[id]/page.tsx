import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FileTextIcon, ReceiptIcon } from 'lucide-react'
import DeleteInvoiceButton from '@/components/admin/DeleteInvoiceButton'
import EditInvoiceModal from '@/components/admin/EditInvoiceModal'
import MarkPaidButton from '@/components/admin/MarkPaidButton'
import SendInvoiceButton from '@/components/admin/SendInvoiceButton'
import PageHeader from '@/components/dashboard/PageHeader'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent } from '@/components/ui/card'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { formatAmount, formatDate } from '@/lib/format'
import { loadInvoice } from '../finance-data'

export default async function InvoicePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'invoices:manage'))) redirect('/staff')

  const inv = await loadInvoice(user.orgId, id)
  if (!inv) notFound()

  const today = new Date().toISOString().split('T')[0]
  const overdue = inv.status === 'unpaid' && inv.due_date < today
  const student = inv.full_name || inv.email

  const facts: [string, React.ReactNode][] = [
    [
      'Student',
      <Link
        key="s"
        href={`/staff/students/${inv.user_id}`}
        className="text-primary hover:underline"
      >
        {student}
      </Link>,
    ],
    [
      'Amount',
      <span key="a" className="font-semibold">
        {formatAmount(inv.amount_cents)}
      </span>,
    ],
    [
      'Due',
      <span key="d" className={overdue ? 'font-medium text-destructive' : undefined}>
        {formatDate(inv.due_date)}
        {overdue && ' · overdue'}
      </span>,
    ],
    ['Created', formatDate(inv.created_at)],
    ['Paid', inv.paid_at ? formatDate(inv.paid_at) : '—'],
    ['Sent on Telegram', inv.sent_at ? new Date(inv.sent_at).toLocaleString() : 'Not yet'],
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/staff/finance"
        title={inv.description}
        badge={<StatusBadge status={overdue ? 'overdue' : inv.status} />}
        description={`Invoice for ${student}`}
        actions={
          <>
            {inv.status === 'unpaid' && <MarkPaidButton invoiceId={inv.id} />}
            <SendInvoiceButton
              invoiceId={inv.id}
              receiptId={inv.receipt_id}
              hasTelegramId={!!inv.parent_telegram_chat_id}
            />
            {inv.status !== 'paid' && <EditInvoiceModal invoice={inv} />}
            {inv.status !== 'paid' && (
              <DeleteInvoiceButton invoiceId={inv.id} redirectTo="/staff/finance" />
            )}
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <span className="text-muted-foreground">{label}</span>
              <p className="mt-0.5 text-foreground">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/invoice/${inv.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          <FileTextIcon />
          Invoice PDF
        </a>
        {inv.receipt_id && (
          <a
            href={`/receipt/${inv.receipt_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            <ReceiptIcon />
            Receipt PDF
          </a>
        )}
      </div>
    </div>
  )
}
