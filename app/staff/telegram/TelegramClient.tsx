'use client'

import { useState } from 'react'

type Chat = { chat_id: string; name: string; username: string | null }

export default function TelegramClient() {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function fetchUpdates() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/telegram/updates')
    const data = await res.json() as Chat[] | { error: string }
    if (!res.ok) {
      setError((data as { error: string }).error ?? 'Failed to fetch')
    } else {
      setChats(data as Chat[])
    }
    setLoading(false)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
        <h2 className="font-semibold text-gray-100">How to get a parent&apos;s chat ID</h2>
        <ol className="space-y-1.5 text-sm text-gray-400 list-decimal list-inside">
          <li>Create your bot via <span className="text-gray-200">@BotFather</span> and set <code className="rounded bg-gray-800 px-1 text-violet-300">TELEGRAM_BOT_TOKEN</code></li>
          <li>Share the bot link with the parent</li>
          <li>Parent opens Telegram and sends <span className="text-gray-200">/start</span> to the bot</li>
          <li>Click <span className="text-gray-200">Fetch Recent Chats</span> below to see their chat ID</li>
          <li>Copy the chat ID and paste it into the student profile</li>
        </ol>
      </div>

      <button
        onClick={fetchUpdates}
        disabled={loading}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Fetching…' : 'Fetch Recent Chats'}
      </button>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {chats.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Username</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Chat ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {chats.map((c) => (
                <tr key={c.chat_id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200">{c.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{c.username ? `@${c.username}` : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copy(c.chat_id)}
                      className="flex items-center gap-2 font-mono text-violet-300 hover:text-violet-200 transition-colors"
                      title="Click to copy"
                    >
                      {c.chat_id}
                      {copied === c.chat_id ? (
                        <span className="text-green-400 text-xs">Copied!</span>
                      ) : (
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {chats.length === 0 && !loading && !error && (
        <p className="text-sm text-gray-600">No chats yet. Fetch after a parent sends /start to your bot.</p>
      )}
    </div>
  )
}
