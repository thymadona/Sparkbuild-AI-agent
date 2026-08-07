import { redirect } from 'next/navigation'

// Moved to /staff/classes/[id] — kept as a redirect for old bookmarks/links.
export default async function AdminClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  redirect(`/staff/classes/${id}`)
}
