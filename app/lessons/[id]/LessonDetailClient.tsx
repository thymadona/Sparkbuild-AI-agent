'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Lesson } from '@/lib/lessons'

interface Props {
  lesson: Lesson
}

export default function LessonDetailClient({ lesson }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function startLesson() {
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => router.push('/lessons')}
          className="mb-8 flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All Lessons
        </button>

        <h1 className="text-2xl font-bold text-white mb-2">{lesson.title}</h1>
        <p className="text-gray-400 text-sm mb-8">{lesson.description}</p>

        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tasks</h2>
          <ol className="space-y-3">
            {lesson.tasks.map((task, i) => (
              <li key={task.id} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 text-gray-400 text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-300 pt-0.5">{task.chip.replace(/^Task \d+ — /, '')}</span>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={startLesson}
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Starting...' : 'Start Lesson'}
        </button>
      </div>
    </div>
  )
}
