'use client'

import type { LessonProgressEntry } from './page'
import LessonsPanel from './LessonsPanel'

interface Props {
  classId: string
  className: string
  lessonsProgress: LessonProgressEntry[]
}

export default function TeacherClassClient({ classId, className, lessonsProgress }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{className}</h1>
      </div>

      <LessonsPanel classId={classId} lessons={lessonsProgress} />
    </div>
  )
}
