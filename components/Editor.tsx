'use client'

import { useState, useRef, useEffect } from 'react'
import type { Message } from '@/types'
import { parseMultiFileResponse } from '@/lib/parse-multi-file'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface EditorProps {
  projectId: string
  files: Record<string, string>
  onFilesUpdate: (files: Record<string, string>) => void
  activeFile?: string
  initialMessages?: Message[]
  selectedCode?: { text: string; startLine: number; endLine: number } | null
  onClearSelection?: () => void
}

function toChat(m: Message): ChatMessage {
  return { role: m.role, content: m.content, timestamp: new Date(m.created_at) }
}

export default function Editor({ projectId, files, onFilesUpdate, activeFile, initialMessages = [], selectedCode, onClearSelection }: EditorProps) {
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
          files: Object.keys(files).length > 0 ? files : undefined,
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
        if (accumulated.trimStart().startsWith('--- FILE:')) {
          const parsed = parseMultiFileResponse(accumulated)
          if (parsed) {
            onFilesUpdate(parsed)
          }
        }
      }

      const isCode = accumulated.trimStart().startsWith('--- FILE:')
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
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] px-4 text-center select-none">
            {/* Icon */}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 ring-1 ring-indigo-500/30">
              <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>

            <h2 className="text-base font-semibold text-white mb-1">What do you want to build?</h2>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-[200px]">
              Describe your idea and the AI will generate HTML, CSS, and JS for you instantly.
            </p>

            {/* How it works */}
            <div className="w-full space-y-2 mb-5">
              {[
                { icon: '✦', label: 'Describe', detail: 'Type what you want to build' },
                { icon: '⟳', label: 'Generate', detail: 'AI writes all three files' },
                { icon: '◈', label: 'Edit & refine', detail: 'Iterate with follow-up prompts' },
              ].map(({ icon, label, detail }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-md bg-gray-800/50 px-3 py-2 text-left">
                  <span className="text-indigo-400 text-xs w-4 shrink-0">{icon}</span>
                  <div>
                    <span className="text-xs font-medium text-gray-300">{label}</span>
                    <span className="text-xs text-gray-500"> — {detail}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Prompt starters */}
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Try one of these</p>
            <div className="flex flex-col gap-1.5 w-full">
              {[
                'Build a to-do list app',
                'Make a countdown timer',
                'Create a personal portfolio page',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setPrompt(suggestion)}
                  className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-400 hover:border-indigo-500 hover:text-indigo-300 transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
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
              {activeFile ?? 'index.html'}:{selectedCode.startLine === selectedCode.endLine
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
          placeholder="What do you want to build? (Enter to send)"
          rows={1}
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
