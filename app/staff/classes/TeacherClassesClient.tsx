'use client'

import { GraduationCapIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'

type ClassRow = {
  id: string
  name: string
  description: string | null
  studentCount: number
}

export default function TeacherClassesClient({ classes }: { classes: ClassRow[] }) {
  return (
    <DataTable
      rows={classes}
      getRowId={(c) => c.id}
      rowHref={(c) => `/staff/classes/${c.id}`}
      noun="classes"
      emptyText="No classes assigned yet."
      search={{ placeholder: 'Search classes', text: (c) => `${c.name} ${c.description ?? ''}` }}
      columns={[
        {
          id: 'name',
          header: 'Class',
          sortValue: (c) => c.name.toLowerCase(),
          cell: (c) => (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <GraduationCapIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{c.name}</div>
                {c.description && (
                  <div className="max-w-xs truncate text-xs text-muted-foreground">
                    {c.description}
                  </div>
                )}
              </div>
            </div>
          ),
        },
        {
          id: 'students',
          header: 'Students',
          className: 'text-right',
          sortValue: (c) => c.studentCount,
          cell: (c) => <span className="font-medium tabular-nums">{c.studentCount}</span>,
        },
      ]}
    />
  )
}
