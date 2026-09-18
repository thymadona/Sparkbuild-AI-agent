'use client'

import type { TeacherSubmissionRow, LessonProgressEntry } from './page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import HomeworkReviewTable from '@/components/dashboard/HomeworkReviewTable'
import LessonsPanel from './LessonsPanel'

interface Props {
  classId: string
  className: string
  homeworkRows: TeacherSubmissionRow[]
  lessonsProgress: LessonProgressEntry[]
}

export default function TeacherClassClient({ classId, className, homeworkRows, lessonsProgress }: Props) {
  const waiting = homeworkRows.filter((row) => row.status === 'submitted')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{className}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {waiting.length === 0
            ? 'Nothing waiting for review.'
            : `${waiting.length} ${waiting.length === 1 ? 'submission' : 'submissions'} waiting for review.`}
        </p>
      </div>

      <Tabs defaultValue="lessons">
        <TabsList>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="homework">Homework{waiting.length > 0 ? ` (${waiting.length})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="lessons" className="mt-4">
          <LessonsPanel classId={classId} lessons={lessonsProgress} />
        </TabsContent>
        <TabsContent value="homework" className="mt-4">
          <HomeworkReviewTable rows={homeworkRows} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
