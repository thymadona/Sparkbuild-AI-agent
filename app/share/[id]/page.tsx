import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { Project } from '@/types'
import Preview from '@/components/Preview'

interface Props {
  params: { id: string }
}

export default async function SharePage({ params }: Props) {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('is_public', true)
    .single()

  if (!project) {
    notFound()
  }

  const typedProject = project as Project
  const code = typedProject.files['index.html'] ?? ''

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{typedProject.title}</span>
          <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">
            Public
          </span>
        </div>
        <a
          href="/"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Build your own →
        </a>
      </header>
      <div className="flex-1 overflow-hidden">
        <Preview code={code} />
      </div>
    </div>
  )
}
