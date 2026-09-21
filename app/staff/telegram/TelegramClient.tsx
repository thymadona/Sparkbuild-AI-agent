'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
    const data = (await res.json()) as Chat[] | { error: string }
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
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-semibold text-foreground">How to get a parent&apos;s chat ID</h2>
          <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              Create your bot via <span className="text-foreground">@BotFather</span> and set{' '}
              <code className="rounded bg-muted px-1 text-primary">TELEGRAM_BOT_TOKEN</code>
            </li>
            <li>Share the bot link with the parent</li>
            <li>
              Parent opens Telegram and sends <span className="text-foreground">/start</span> to the
              bot
            </li>
            <li>
              Click <span className="text-foreground">Fetch Recent Chats</span> below to see their
              chat ID
            </li>
            <li>Copy the chat ID and paste it into the student profile</li>
          </ol>
        </CardContent>
      </Card>

      <button
        onClick={fetchUpdates}
        disabled={loading}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Fetching…' : 'Fetch Recent Chats'}
      </button>

      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {chats.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Chat ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chats.map((c) => (
                <TableRow key={c.chat_id}>
                  <TableCell className="text-foreground">{c.name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.username ? `@${c.username}` : '—'}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => copy(c.chat_id)}
                      className="flex items-center gap-2 font-mono text-primary hover:text-primary/80 transition-colors"
                      title="Click to copy"
                    >
                      {c.chat_id}
                      {copied === c.chat_id ? (
                        <span className="text-success text-xs">Copied!</span>
                      ) : (
                        <svg
                          className="w-3 h-3 text-muted-foreground/70"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {chats.length === 0 && !loading && !error && (
        <p className="text-sm text-muted-foreground/70">
          No chats yet. Fetch after a parent sends /start to your bot.
        </p>
      )}
    </div>
  )
}
