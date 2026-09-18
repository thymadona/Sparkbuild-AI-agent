'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ClassRow = {
  id: string
  name: string
  description: string | null
  studentCount: number
  pendingReviewCount: number
}

export default function TeacherClassesClient({ classes }: { classes: ClassRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return classes
    return classes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  }, [classes, search])

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search classes…"
        className="w-64 rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Pending review</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{cls.name}</div>
                  {cls.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{cls.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">
                  {cls.studentCount}
                </TableCell>
                <TableCell className="text-right">
                  {cls.pendingReviewCount > 0 ? (
                    <Badge variant="warning">{cls.pendingReviewCount} waiting</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground/70">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/staff/classes/${cls.id}`}
                    className="rounded bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
                  >
                    Open →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground/70">
                  {search ? 'No classes match your search.' : 'No classes assigned yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
