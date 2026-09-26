import type { ComponentType } from 'react'
import {
  BanIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ClockIcon,
  PauseCircleIcon,
  XCircleIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Tone = 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'

const TONES: Record<string, { tone: Tone; icon: ComponentType<{ className?: string }> }> = {
  active: { tone: 'success', icon: CheckCircle2Icon },
  paid: { tone: 'success', icon: CheckCircle2Icon },
  unpaid: { tone: 'destructive', icon: CircleDotIcon },
  overdue: { tone: 'destructive', icon: ClockIcon },
  inactive: { tone: 'secondary', icon: BanIcon },
  void: { tone: 'secondary', icon: XCircleIcon },
  paused: { tone: 'warning', icon: PauseCircleIcon },
  pending: { tone: 'warning', icon: ClockIcon },
}

// One badge per status word, with the same colour and icon everywhere.
export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { tone, icon: Icon } = TONES[status] ?? { tone: 'outline' as Tone, icon: CircleDotIcon }
  return (
    <Badge variant={tone} className="capitalize">
      <Icon className="h-3 w-3" />
      {label ?? status}
    </Badge>
  )
}
