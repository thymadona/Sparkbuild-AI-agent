import { redirect } from 'next/navigation'

// Moved to /staff/homework — kept as a redirect for old bookmarks/links.
export default function AdminHomeworkPage() {
  redirect('/staff/homework')
}
