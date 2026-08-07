import { redirect } from 'next/navigation'

// Moved to /staff/classes — kept as a redirect for old bookmarks/links.
// app/teacher/layout.tsx still gates on isAdmin-or-teaches-a-class first.
export default function TeacherDashboardPage() {
  redirect('/staff/classes')
}
