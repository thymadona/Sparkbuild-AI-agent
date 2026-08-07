import { redirect } from 'next/navigation'

// Moved to /staff/users — kept as a redirect for old bookmarks/links.
export default function AdminUsersPage() {
  redirect('/staff/users')
}
