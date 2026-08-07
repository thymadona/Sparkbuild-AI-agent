import { redirect } from 'next/navigation'

// Moved to /staff/classes — kept as a redirect for old bookmarks/links.
export default function AdminClassesPage() {
  redirect('/staff/classes')
}
