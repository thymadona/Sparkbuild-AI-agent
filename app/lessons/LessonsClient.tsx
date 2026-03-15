'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Lesson } from '@/lib/lessons'

interface Props {
  lessons: Lesson[]
}

export default function LessonsClient({ lessons }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)

  async function startLesson(lesson: Lesson) {
    setLoadingId(lesson.id)
    try {
      const templateRes = await fetch(`/templates/${lesson.templateFile}`)
      const templateHtml = await templateRes.text()

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lesson.title,
          templateHtml,
          lessonId: lesson.id,
        }),
      })

      if (!res.ok) throw new Error('Failed to create project')
      const project = await res.json()
      router.push(`/editor/${project.id}`)
    } catch {
      setLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">Lessons</h1>
          <p className="text-gray-400 text-sm">Pick a lesson to start learning with guided tasks.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="flex flex-col rounded-lg border border-gray-800 bg-gray-900 p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white mb-1">{lesson.title}</h2>
                <p className="text-sm text-gray-400 mb-3">{lesson.description}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {lesson.tasks.length} tasks
                </div>
              </div>
              <button
                onClick={() => startLesson(lesson)}
                disabled={loadingId !== null}
                className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingId === lesson.id ? 'Starting...' : 'Start Lesson'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
