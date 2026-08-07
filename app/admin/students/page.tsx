import { redirect } from 'next/navigation'

// Moved to /staff/students — kept as a redirect for old bookmarks/links.
export default function AdminStudentsPage() {
  redirect('/staff/students')
}
