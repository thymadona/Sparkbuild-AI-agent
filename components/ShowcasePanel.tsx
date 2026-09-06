'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ShowcasePanelProps {
  projectId: string
  isPublic: boolean
  onPublicChange: (isPublic: boolean) => void
  onDismiss: () => void
}

/**
 * The "show it off" moment at the end of a lesson. Reuses the same
 * PATCH /api/projects { is_public } and /share/[id] link that the dashboard's
 * Share toggle already uses — this just surfaces that existing flow right
 * when finishing feels worth sharing, instead of only on the dashboard.
 */
export default function ShowcasePanel({ projectId, isPublic, onPublicChange, onDismiss }: ShowcasePanelProps) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function toggleShare() {
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, is_public: !isPublic }),
      })
      if (res.ok) onPublicChange(!isPublic)
    } finally {
      setSaving(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/share/${projectId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 animate-pop-in rounded-xl border-2 border-surface-600 bg-surface-800 p-4 shadow-hard">
      <button
        onClick={onDismiss}
        className="absolute right-2 top-2 text-fg-muted hover:text-fg-secondary transition-colors leading-none text-base"
        title="Dismiss"
      >
        &times;
      </button>
      <p className="text-center text-base font-semibold text-fg-primary">🎉 Show it off!</p>
      <p className="mt-1 text-center text-xs text-fg-muted">Share your finished card with a friend, or the class gallery.</p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={toggleShare}
          disabled={saving}
          className="rounded-lg border-2 border-surface-600 bg-brand-500 px-3 py-1.5 text-sm font-bold text-white shadow-hard-sm transition-all hover:bg-brand-400 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : isPublic ? 'Shared to Explore ✓' : 'Share to Explore'}
        </button>
        {isPublic && (
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex-1 rounded-lg border-2 border-surface-600 bg-surface-700 px-3 py-1.5 text-xs font-semibold text-fg-secondary transition-colors hover:text-fg-primary"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <Link
              href="/explore"
              className="flex-1 rounded-lg border-2 border-surface-600 bg-surface-700 px-3 py-1.5 text-center text-xs font-semibold text-fg-secondary transition-colors hover:text-fg-primary"
            >
              View Explore
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
