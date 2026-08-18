"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types";
import { isCodeResponse, parseMultiFileResponse, parseSummary } from "@/lib/parse-multi-file";
import SpeakButton from "@/components/SpeakButton";

interface ChatMessage {
  role: "user" | "assistant" | "teacher";
  content: string;
  timestamp: Date;
}

interface EditorProps {
  projectId: string;
  files: Record<string, string>;
  onFilesUpdate: (files: Record<string, string>) => void;
  activeFile?: string;
  messages: Message[];
  onMessagesChange: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  selectedCode?: {
    text: string;
    startLine: number;
    endLine: number;
    label?: string;
    subtitle?: string;
    kind?: "element" | "text";
  } | null;
  onClearSelection?: () => void;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
}

function toChat(m: Message): ChatMessage {
  return {
    role: m.role,
    content: m.content,
    timestamp: new Date(m.created_at),
  };
}

export default function Editor({
  projectId,
  files,
  onFilesUpdate,
  activeFile,
  messages: messagesProp,
  onMessagesChange,
  selectedCode,
  onClearSelection,
  pendingPrompt,
  onPromptConsumed,
}: EditorProps) {
  const [prompt, setPrompt] = useState("");
  const messages = messagesProp.map(toChat);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<'ask' | 'build'>('ask');
  const [buildModeAvailable, setBuildModeAvailable] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'high' | 'max'>('low');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesProp]);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setBuildModeAvailable(d.buildModeEnabled === true))
      .catch(() => {})
  }, []);

  useEffect(() => {
    if (!pendingPrompt || isGenerating) return
    onPromptConsumed?.()
    submitPrompt(pendingPrompt)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  async function submitPrompt(text: string) {
    if (!text.trim() || isGenerating) return;

    const userMessage = text.trim();
    const contextCode = selectedCode ?? null;
    setError("");
    setIsGenerating(true);
    onClearSelection?.();

    const userMsg: Message = {
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: '',
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    onMessagesChange((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          projectId,
          files: Object.keys(files).length > 0 ? files : undefined,
          history: messages.map((m) =>
            m.role === "teacher"
              ? { role: "user" as const, content: `My teacher said: ${m.content}` }
              : { role: m.role, content: m.content },
          ),
          selectedCode: contextCode?.text,
          mode,
          reasoningEffort: mode === 'build' ? reasoningEffort : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(data.error || "Hourly limit reached.");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Failed to read response stream.");
        setIsGenerating(false);
        return;
      }

      // The server withholds build mode while a lesson task is open. Say so,
      // rather than letting a build request look like it silently failed.
      if (mode === "build" && res.headers.get("X-Effective-Mode") === "ask" && res.headers.get("X-Open-Task")) {
        setNotice("This part is yours to type. Your tutor will show you where.");
      } else {
        setNotice(null);
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      // Streaming a chunk straight into `onFilesUpdate` reloads the sandboxed
      // preview iframe's srcDoc on every network chunk — often 100+ times for
      // one generation. Re-navigating that iframe that rapidly leaves Chromium's
      // renderer stuck on a blank paint that never recovers until the page is
      // reloaded. Throttle how often the stream pushes an update; the final
      // push below (after the loop) always carries the complete file.
      let lastEmitAt = 0;
      const MIN_EMIT_INTERVAL_MS = 400;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (isCodeResponse(accumulated) && Date.now() - lastEmitAt >= MIN_EMIT_INTERVAL_MS) {
          const parsed = parseMultiFileResponse(accumulated);
          if (parsed) {
            onFilesUpdate(parsed);
            lastEmitAt = Date.now();
          }
        }
      }

      if (isCodeResponse(accumulated)) {
        const parsed = parseMultiFileResponse(accumulated);
        if (parsed) onFilesUpdate(parsed);
      }

      const isCode = isCodeResponse(accumulated);
      const assistantContent = isCode
        ? parseSummary(accumulated) ?? "I've built that for you! Check the preview."
        : accumulated;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        project_id: projectId,
        user_id: '',
        role: 'assistant',
        content: assistantContent,
        created_at: new Date().toISOString(),
      };
      onMessagesChange((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    const text = prompt;
    setPrompt("");
    await submitPrompt(text);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Mode toggle */}
      {buildModeAvailable && (
        <div className="shrink-0 px-3 pt-3 pb-2 border-b-2 border-surface-600 flex items-center justify-between gap-2">
          <div className="flex rounded-lg border-2 border-surface-600 bg-surface-700 p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setMode('ask')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === 'ask' ? 'bg-surface-800 text-fg-primary' : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Ask
            </button>
            <button
              type="button"
              onClick={() => setMode('build')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === 'build' ? 'bg-brand-600 text-white' : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Build
            </button>
          </div>
          {mode === 'build' && (
            <select
              value={reasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'high' | 'max')}
              title="How carefully the AI thinks before building — Low is faster, High/Max is slower but more careful on bigger builds"
              className="rounded-md border-2 border-surface-600 bg-surface-700 px-2 py-1 text-xs font-medium text-fg-secondary hover:text-fg-primary transition-colors"
            >
              <option value="low">Low effort</option>
              <option value="high">High effort</option>
              <option value="max">Max effort</option>
            </select>
          )}
        </div>
      )}

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] px-4 text-center select-none">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-teal-500/20 ring-1 ring-brand-400/40 animate-pop-in">
              <span className="text-3xl" role="img" aria-label="wave">👋</span>
            </div>
            <h2 className="font-display text-base font-semibold text-fg-primary mb-1">Hi! I&apos;m your AI Tutor.</h2>
            <p className="text-xs text-fg-muted mb-6 leading-relaxed max-w-[220px]">
              Ask me anything about coding — no question is too small!
            </p>
            <div className="flex flex-col gap-2 w-full">
              {(mode === 'build' ? [
                { emoji: '🚀', text: 'Build a to-do app' },
                { emoji: '🎮', text: 'Make a simple game' },
                { emoji: '🌈', text: 'Create a personal page' },
              ] : [
                { emoji: '🤔', text: 'What is a variable?' },
                { emoji: '🐛', text: 'Help me fix a bug' },
                { emoji: '✨', text: 'What does this code do?' },
              ]).map(({ emoji, text }) => (
                <button
                  key={text}
                  onClick={() => setPrompt(text)}
                  className="flex items-center gap-2.5 rounded-full bg-brand-500/10 px-4 py-2.5 text-sm text-brand-700 dark:text-brand-200 hover:bg-brand-500/20 transition-all text-left"
                >
                  <span className="text-base leading-none">{emoji}</span>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`group flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "teacher" ? (
              <div className="flex items-end gap-2 max-w-[90%]">
                <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-600 bg-teal-400 text-[10px] font-bold text-slate-900 mb-1">
                  T
                </div>
                <div className="w-fit rounded-xl rounded-bl-sm border-2 border-surface-600 bg-teal-50 px-4 py-2.5 text-sm text-teal-900 shadow-hard-sm dark:bg-teal-900/20 dark:text-teal-100">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Your teacher</p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div className="mt-1">
                    <SpeakButton text={msg.content} label="Read your teacher's note out loud" />
                  </div>
                </div>
              </div>
            ) : msg.role === "user" ? (
              <div className="max-w-[85%] w-fit rounded-xl rounded-tr-sm border-2 border-surface-600 px-4 py-2.5 text-sm bg-brand-100 shadow-hard-sm dark:bg-brand-500/20 text-fg-primary">
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="mt-1 text-xs text-brand-700 dark:text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ) : (
              <div className="flex items-end gap-2 max-w-[90%]">
                <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-600 bg-brand-500 text-[10px] font-bold text-white mb-1">
                  AI
                </div>
                <div className="w-fit rounded-xl rounded-bl-sm border-2 border-surface-600 px-4 py-2.5 text-sm bg-pink-100 dark:bg-[#ff689a] text-fg-secondary dark:text-white shadow-hard-sm">
                  <div className="prose-chat">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        h1: ({ children }) => <p className="font-bold text-fg-primary mb-1 text-sm">{children}</p>,
                        h2: ({ children }) => <p className="font-semibold text-fg-primary mb-1 text-sm">{children}</p>,
                        h3: ({ children }) => <p className="font-semibold text-fg-secondary mb-1 text-xs uppercase tracking-wide">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 space-y-0.5 list-disc list-outside">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 space-y-0.5 list-decimal list-outside">{children}</ol>,
                        li: ({ children }) => <li className="text-fg-secondary pl-0.5">{children}</li>,
                        code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => {
                          const text = String(children).replace(/\n$/, '')
                          const isInline = inline || !text.includes('\n')
                          return isInline ? (
                            <code className="rounded bg-surface-800 px-1 py-0.5 font-mono text-xs text-brand-700 dark:text-brand-300">{children}</code>
                          ) : (
                            <pre className="my-2 w-fit min-w-[6rem] max-w-full overflow-x-auto rounded bg-surface-800 p-2.5 font-mono text-xs text-fg-secondary leading-relaxed">
                              <code>{children}</code>
                            </pre>
                          )
                        },
                        strong: ({ children }) => <strong className="font-semibold text-fg-primary">{children}</strong>,
                        em: ({ children }) => <em className="italic text-fg-muted">{children}</em>,
                        blockquote: ({ children }) => (
                          <blockquote className="my-2 border-l-2 border-brand-500 pl-3 text-fg-muted italic">{children}</blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300">{children}</a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <SpeakButton text={msg.content} label="Read this answer out loud" />
                    <p className="text-xs text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {isGenerating && (
          <div className="flex items-end gap-2 justify-start">
            <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-600 bg-brand-500 text-[10px] font-bold text-white mb-0.5">
              AI
            </div>
            <div className="rounded-xl rounded-bl-sm border-2 border-surface-600 bg-pink-100 dark:bg-[#ff689a] px-4 py-3 shadow-hard-sm flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-fg-muted animate-bounce-dot" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-fg-muted animate-bounce-dot" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-fg-muted animate-bounce-dot" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Build mode withheld while a lesson task is open */}
      {notice && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <span aria-hidden="true">✋</span>
          <span>{notice}</span>
        </div>
      )}

      {/* Selected code context — a compact pill, not the raw snippet: the
          full text still rides along in selectedCode.text for the prompt,
          it's just not shown here anymore. */}
      {selectedCode && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-surface-800 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-700 text-brand-500 dark:text-brand-400">
            {selectedCode.kind === "element" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg-primary font-mono leading-tight">
              {selectedCode.label ?? (activeFile ?? "index.html")}
            </p>
            <p className="truncate text-xs text-fg-muted leading-tight">
              {selectedCode.subtitle ??
                (selectedCode.startLine === selectedCode.endLine
                  ? `Line ${selectedCode.startLine}`
                  : `Lines ${selectedCode.startLine}–${selectedCode.endLine}`)}
            </p>
          </div>
          <button
            onClick={onClearSelection}
            className="shrink-0 text-fg-muted hover:text-fg-secondary transition-colors leading-none text-base"
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="shrink-0 px-3 pb-3 pt-2">
        <div className={`flex items-end gap-2 rounded-lg border-2 bg-surface-800 px-3 py-2 transition-colors ${
          prompt.length > 0 ? 'border-brand-500' : 'border-surface-600'
        }`}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (prompt.trim() && !isGenerating) handleSubmit(e as unknown as React.FormEvent)
              }
            }}
            placeholder="Ask me anything..."
            rows={1}
            disabled={isGenerating}
            className="flex-1 resize-none bg-transparent text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none disabled:opacity-50 leading-relaxed min-h-[24px]"
            style={{ height: '24px' }}
          />
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
              prompt.trim() && !isGenerating
                ? 'border-surface-600 bg-brand-500 text-white shadow-hard-sm hover:bg-brand-400'
                : 'border-surface-600 bg-surface-700 text-fg-muted cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3l9 9H3l9-9z" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-fg-muted">Enter to send · Shift+Enter for new line</p>
      </form>
    </div>
  );
}
