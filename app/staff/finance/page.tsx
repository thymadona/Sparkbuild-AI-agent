import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/auth/permissions'
import FinanceClient from './FinanceClient'
import { loadFinance } from './finance-data'
import { getSessionUser } from '@/lib/auth/session'

export default async function FinancePage() {
  const user = await getSessionUser()
  if (!user || !(await hasPermission(user.id, 'invoices:manage'))) redirect('/staff')

  const { invoices, profileMap, receiptByInvoice } = await loadFinance(user.orgId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Finance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Invoices, payments, and receipts</p>
      </div>
      <FinanceClient
        invoices={invoices as Parameters<typeof FinanceClient>[0]['invoices']}
        profileMap={profileMap as Parameters<typeof FinanceClient>[0]['profileMap']}
        receiptByInvoice={receiptByInvoice}
      />
    </div>
  )
}
