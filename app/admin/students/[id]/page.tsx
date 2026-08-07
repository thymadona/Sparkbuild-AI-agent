import { redirect } from 'next/navigation'

// Moved to /staff/students/[id] — kept as a redirect for old bookmarks/links.
export default async function AdminStudentDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  redirect(`/staff/students/${id}`)
}
