import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  CircleAlertIcon,
  BookOpenIcon,
  BotIcon,
  CircleCheckIcon,
  GraduationCapIcon,
  MailIcon,
  PresentationIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS = {
  users: UsersIcon,
  classes: GraduationCapIcon,
  admins: ShieldCheckIcon,
  invites: MailIcon,
  outstanding: CircleAlertIcon,
  collected: CircleCheckIcon,
  invoices: ReceiptIcon,
  lessons: BookOpenIcon,
  ai: BotIcon,
  teachers: PresentationIcon,
} satisfies Record<string, LucideIcon>

const TONES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}

// One number with a label and a tinted icon, for the row above a table.
export default function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  icon: keyof typeof ICONS
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: keyof typeof TONES
  // Makes the whole card a link (to the list behind the number).
  href?: string
}) {
  const Icon = ICONS[icon]
  const body = (
    <>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          TONES[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </>
  )
  const box = 'flex items-center gap-3 rounded-lg border border-border bg-card p-4'
  return href ? (
    <Link href={href} className={cn(box, 'transition-colors hover:bg-muted')}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}
