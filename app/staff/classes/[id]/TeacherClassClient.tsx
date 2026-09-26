'use client'

import type { LessonProgressEntry } from './page'
import LessonsPanel from './LessonsPanel'
import RosterPanel, { type RosterPerson } from './RosterPanel'

interface Props {
  classId: string
  className: string
  lessonsProgress: LessonProgressEntry[]
  students: RosterPerson[]
  candidates: RosterPerson[]
}

export default function TeacherClassClient({
  classId,
  className,
  lessonsProgress,
  students,
  candidates,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{className}</h1>
      </div>

      <RosterPanel classId={classId} students={students} candidates={candidates} />
      <LessonsPanel classId={classId} lessons={lessonsProgress} />
    </div>
  )
}
