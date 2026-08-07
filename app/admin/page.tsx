import { redirect } from 'next/navigation'

// This route moved to /staff — kept as a redirect so old bookmarks and
// links still resolve. app/admin/layout.tsx still gates on isAdmin before
// this ever runs.
export default function AdminPage() {
  redirect('/staff')
}
