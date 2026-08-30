'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import { LogOut, User } from 'lucide-react'

export default function ProfileDropdown({ email }: { email: string }) {
  const router = useRouter()
  const initials = email[0].toUpperCase()
  const username = email.split('@')[0]

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-600 bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-hard-sm transition-all hover:opacity-90 focus:outline-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        {/* User info header */}
        <div className="flex items-center gap-3 px-2 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{username}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { window.location.href = '/profile' }}
          className="flex items-center gap-2.5 px-2 py-2 cursor-pointer"
        >
          <User className="size-3.5 text-muted-foreground" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          variant="destructive"
          className="flex items-center gap-2.5 px-2 py-2 cursor-pointer"
        >
          <LogOut className="size-3.5" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
