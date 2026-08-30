import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { receipts, studentProfiles } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import PrintButton from './PrintButton'

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default async function ReceiptPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isUuid(params.id)) redirect('/staff/finance')

  const [row] = await db
    .select({
      id: receipts.id,
      amount_cents: receipts.amountCents,
      description: receipts.description,
      paid_at: receipts.paidAt,
      receipt_number: receipts.receiptNumber,
      full_name: studentProfiles.fullName,
      parent_email: studentProfiles.parentEmail,
    })
    .from(receipts)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, receipts.userId))
    .where(eq(receipts.id, params.id))
    .limit(1)

  if (!row) redirect('/staff/finance')

  const receipt = row
  const profile = row.full_name === null ? null : row

  const paidDate = new Date(receipt.paid_at).toLocaleDateString('en-US', {
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

      {/* Print button — hidden when printing */}
      <div className="no-print flex justify-end gap-3 p-6 print:hidden">
        <PrintButton />
      </div>

      {/* Receipt content */}
      <div className="mx-auto max-w-2xl bg-white px-12 py-10 text-gray-900 shadow-lg print:shadow-none">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Receipt</h1>
            <p className="mt-1 text-sm text-gray-500">{receipt.receipt_number}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{paidDate}</p>
          </div>
        </div>

        <hr className="mb-8 border-gray-200" />

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
              <td className="py-3">{receipt.description}</td>
              <td className="py-3 text-right tabular-nums">{formatAmount(receipt.amount_cents)}</td>
            </tr>
          </tbody>
        </table>

        <hr className="mb-4 border-gray-200" />

        {/* Total */}
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total paid</p>
            <p className="text-2xl font-bold">{formatAmount(receipt.amount_cents)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400">
          <p>Thank you for your payment.</p>
          <p className="mt-1">Receipt ID: {receipt.id}</p>
        </div>
      </div>
    </>
  )
}
