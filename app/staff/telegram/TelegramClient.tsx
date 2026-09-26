'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CopyIcon, RefreshCwIcon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import PageHeader from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/button'

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
      <PageHeader
        title="Telegram"
        description="Look up parent chat IDs for invoice notifications"
        actions={
          <Button onClick={fetchUpdates} disabled={loading}>
            <RefreshCwIcon className={loading ? 'animate-spin' : undefined} />
            {loading ? 'Fetching…' : 'Fetch recent chats'}
          </Button>
        }
      />

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
              Click <span className="text-foreground">Fetch recent chats</span> to see their chat ID
            </li>
            <li>Copy the chat ID and paste it into the student profile</li>
          </ol>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <DataTable
        rows={chats}
        getRowId={(c) => c.chat_id}
        noun="chats"
        emptyText="No chats yet. Fetch after a parent sends /start to your bot."
        search={{
          placeholder: 'Search name or username',
          text: (c) => `${c.name} ${c.username ?? ''}`,
        }}
        columns={[
          {
            id: 'name',
            header: 'Name',
            sortValue: (c) => c.name.toLowerCase(),
            cell: (c) => <span className="text-foreground">{c.name || '—'}</span>,
          },
          {
            id: 'username',
            header: 'Username',
            cell: (c) => (
              <span className="text-muted-foreground">{c.username ? `@${c.username}` : '—'}</span>
            ),
          },
          {
            id: 'chat',
            header: 'Chat ID',
            cell: (c) => (
              <button
                onClick={() => copy(c.chat_id)}
                className="flex items-center gap-2 font-mono text-primary transition-colors hover:text-primary/80"
                title="Click to copy"
              >
                {c.chat_id}
                {copied === c.chat_id ? (
                  <span className="text-xs text-success">Copied!</span>
                ) : (
                  <CopyIcon className="h-3 w-3 text-muted-foreground/70" />
                )}
              </button>
            ),
          },
        ]}
      />
    </div>
  )
}
