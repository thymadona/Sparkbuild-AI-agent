import { redirect } from 'next/navigation'

// Moved to /staff/finance — kept as a redirect for old bookmarks/links.
export default function AdminFinancePage() {
  redirect('/staff/finance')
}
