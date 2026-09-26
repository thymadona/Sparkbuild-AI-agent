import { BookOpenIcon, CrownIcon, GraduationCapIcon, ShieldIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const ROLE_STYLE: Record<
  string,
  { variant: 'default' | 'secondary' | 'outline'; icon: typeof ShieldIcon }
> = {
  admin: { variant: 'default', icon: ShieldIcon },
  teacher: { variant: 'secondary', icon: BookOpenIcon },
  student: { variant: 'outline', icon: GraduationCapIcon },
  platform_admin: { variant: 'outline', icon: CrownIcon },
}

export default function RoleBadge({ role }: { role: string }) {
  const { variant, icon: Icon } = ROLE_STYLE[role] ?? { variant: 'outline', icon: ShieldIcon }
  return (
    <Badge variant={variant} className="capitalize">
      <Icon className="h-3 w-3" />
      {role === 'platform_admin' ? 'platform owner' : role}
    </Badge>
  )
}
