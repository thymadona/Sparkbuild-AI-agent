'use client'

import { Menu } from '@base-ui/react/menu'
import { CheckIcon, ChevronDownIcon, SlidersHorizontalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

// A "Label: Value ▾" pill that opens a single-choice menu. The first option
// is the "all" choice; picking it clears the filter.
export default function FilterMenu({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  const current = options.find((o) => o.value === value) ?? options[0]
  const active = value !== options[0]?.value

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-muted',
          active ? 'border-primary/40 text-foreground' : 'border-input text-muted-foreground'
        )}
      >
        <SlidersHorizontalIcon className="h-3.5 w-3.5" />
        <span>
          {label}: <span className="font-medium text-foreground">{current?.label}</span>
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" align="start" sideOffset={4}>
          <Menu.Popup className="staff-shell max-h-[min(20rem,var(--available-height))] min-w-[10rem] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Menu.RadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
              {options.map((o) => (
                <Menu.RadioItem
                  key={o.value}
                  value={o.value}
                  closeOnClick
                  className="flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
                >
                  <span className="flex-1">{o.label}</span>
                  {o.count !== undefined && (
                    <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>
                  )}
                  <span className="flex w-4 justify-end">
                    <Menu.RadioItemIndicator>
                      <CheckIcon className="h-3.5 w-3.5" />
                    </Menu.RadioItemIndicator>
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
