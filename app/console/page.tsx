import { redirect } from 'next/navigation'

// The console's only section today is its org list.
export default function ConsolePage() {
  redirect('/console/orgs')
}
