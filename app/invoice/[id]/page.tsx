import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { invoices, studentProfiles } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import PrintButton from './PrintButton'

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default async function InvoicePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isUuid(params.id)) redirect('/staff/finance')

  // The invoice and the name it is billed to, in one left join: a student with
  // no profile row still renders, falling back to "Student" below.
  const [row] = await db
    .select({
      id: invoices.id,
      amount_cents: invoices.amountCents,
      description: invoices.description,
      due_date: invoices.dueDate,
      status: invoices.status,
      created_at: invoices.createdAt,
      full_name: studentProfiles.fullName,
      parent_email: studentProfiles.parentEmail,
    })
    .from(invoices)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, invoices.userId))
    .where(eq(invoices.id, params.id))
    .limit(1)

  if (!row) redirect('/staff/finance')

  const invoice = row
  const profile = row.full_name === null ? null : row

  const dueDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print flex justify-end gap-3 p-6 print:hidden">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-2xl bg-white px-12 py-10 text-gray-900 shadow-lg print:shadow-none">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice</h1>
            <p className="mt-1 text-sm text-gray-500">#{invoice.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Issued: {invoiceDate}</p>
            <p className="mt-0.5">Due: {dueDate}</p>
          </div>
        </div>

        <hr className="mb-8 border-gray-200" />

        {/* Status */}
        <div className="mb-6">
          <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            invoice.status === 'paid'
              ? 'bg-green-100 text-green-700'
              : invoice.status === 'void'
              ? 'bg-gray-100 text-gray-500'
              : 'bg-red-100 text-red-700'
          }`}>
            {invoice.status}
          </span>
        </div>

        {/* Billed to */}
        <div className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Billed to</p>
          <p className="font-medium">{profile?.full_name ?? 'Student'}</p>
          {profile?.parent_email && (
            <p className="text-sm text-gray-500">{profile.parent_email}</p>
          )}
        </div>

        {/* Line item */}
        <table className="mb-8 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left font-semibold text-gray-500">Description</th>
              <th className="pb-2 text-right font-semibold text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3">{invoice.description}</td>
              <td className="py-3 text-right tabular-nums">{formatAmount(invoice.amount_cents)}</td>
            </tr>
          </tbody>
        </table>

        <hr className="mb-4 border-gray-200" />

        {/* Total */}
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total due</p>
            <p className="text-2xl font-bold">{formatAmount(invoice.amount_cents)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400">
          <p>Please pay by {dueDate}.</p>
          <p className="mt-1">Invoice ID: {invoice.id}</p>
        </div>
      </div>
    </>
  )
}
