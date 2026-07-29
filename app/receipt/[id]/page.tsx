import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import PrintButton from './PrintButton'

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default async function ReceiptPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { data: receipt, error } = await supabaseAdmin
    .from('receipts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !receipt) redirect('/admin?tab=finance')

  const { data: profile } = await supabaseAdmin
    .from('student_profiles')
    .select('full_name, parent_email')
    .eq('user_id', receipt.user_id)
    .maybeSingle()

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
