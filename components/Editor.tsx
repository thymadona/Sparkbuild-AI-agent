'use client'

import { useState, useRef, useEffect } from 'react'
import type { Message } from '@/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface EditorProps {
  projectId: string
  currentCode: string
  onCodeUpdate: (code: string) => void
  initialMessages?: Message[]
  selectedCode?: { text: string; startLine: number; endLine: number } | null
  onClearSelection?: () => void
}

function toChat(m: Message): ChatMessage {
  return { role: m.role, content: m.content, timestamp: new Date(m.created_at) }
}

export default function Editor({ projectId, currentCode, onCodeUpdate, initialMessages = [], selectedCode, onClearSelection }: EditorProps) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages.map(toChat))
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    const userMessage = prompt.trim()
    const contextCode = selectedCode ?? null
    setPrompt('')
    setError('')
    setIsGenerating(true)
    onClearSelection?.()

    const userChatMsg: ChatMessage = { role: 'user', content: userMessage, timestamp: new Date() }
    setMessages((prev) => [...prev, userChatMsg])

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          projectId,
          currentCode: currentCode || undefined,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          selectedCode: contextCode?.text,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          setError(data.error || 'Hourly limit reached.')
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        setIsGenerating(false)
        return
      }

      // Read streaming response
      const reader = res.body?.getReader()
      if (!reader) {
        setError('Failed to read response stream.')
        setIsGenerating(false)
        return
      }

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        // Live-update preview only for code responses
        if (accumulated.trimStart().toLowerCase().startsWith('<!doctype html>')) {
          onCodeUpdate(accumulated)
        }
      }

      const isCode = accumulated.trimStart().toLowerCase().startsWith('<!doctype html>')
      const assistantContent = isCode ? 'Code updated.' : accumulated

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistantContent, timestamp: new Date() },
      ])
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <p>Describe what you want to build.</p>
            <p className="mt-1">e.g. &ldquo;Build a colorful to-do list app&rdquo;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`mt-0.5 text-xs ${msg.role === 'user' ? 'text-indigo-300' : 'text-gray-500'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Selected code context */}
      {selectedCode && (
        <div className="mx-3 mb-2 rounded-md border border-indigo-800 bg-gray-900">
          <div className="flex items-center justify-between px-2 py-1 border-b border-indigo-800/60">
            <span className="text-xs text-indigo-400 font-mono">
              index.html:{selectedCode.startLine === selectedCode.endLine
                ? `${selectedCode.startLine}`
                : `${selectedCode.startLine}–${selectedCode.endLine}`}
            </span>
            <button
              onClick={onClearSelection}
              className="text-gray-500 hover:text-gray-300 transition-colors leading-none text-base"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
          <pre className="px-2 py-1.5 text-xs text-gray-300 font-mono overflow-x-auto max-h-28 overflow-y-auto whitespace-pre-wrap break-all">
            {selectedCode.text.length > 300
              ? selectedCode.text.slice(0, 300) + '…'
              : selectedCode.text}
          </pre>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-3 flex gap-2">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or describe what to build... (Enter to send)"
          rows={2}
          disabled={isGenerating}
          className="flex-1 resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isGenerating || !prompt.trim()}
          className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
