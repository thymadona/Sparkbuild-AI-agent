import { redirect } from 'next/navigation'

// Moved to /staff/telegram — kept as a redirect for old bookmarks/links.
export default function AdminTelegramPage() {
  redirect('/staff/telegram')
}
