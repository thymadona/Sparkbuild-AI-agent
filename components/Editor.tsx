"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types";
import { parseMultiFileResponse, parseSummary } from "@/lib/parse-multi-file";

interface ChatMessage {
  role: "user" | "assistant";
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
  selectedCode?: { text: string; startLine: number; endLine: number } | null;
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
  const [mode, setMode] = useState<'ask' | 'build'>('ask');
  const [buildModeAvailable, setBuildModeAvailable] = useState(false);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
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
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          selectedCode: contextCode?.text,
          mode,
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

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (accumulated.trimStart().startsWith("--- FILE:")) {
          const parsed = parseMultiFileResponse(accumulated);
          if (parsed) onFilesUpdate(parsed);
        }
      }

      const isCode = accumulated.trimStart().startsWith("--- FILE:");
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Mode dropdown */}
      {buildModeAvailable && (
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-gray-800">
          <div className="relative inline-block">
            <button
              onClick={() => setModeDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-gray-600 transition-colors"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${mode === 'build' ? 'bg-indigo-400' : 'bg-green-400'}`} />
              {mode === 'ask' ? 'Ask' : 'Build'}
              <svg className="h-3 w-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {modeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModeDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-md border border-gray-700 bg-gray-900 shadow-lg overflow-hidden">
                  <button
                    onClick={() => { setMode('ask'); setModeDropdownOpen(false); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                      mode === 'ask' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">Ask</div>
                      <div className="text-gray-500">Hints &amp; guidance only</div>
                    </div>
                    {mode === 'ask' && <svg className="ml-auto h-3 w-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <button
                    onClick={() => { setMode('build'); setModeDropdownOpen(false); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                      mode === 'build' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">Build</div>
                      <div className="text-gray-500">Generate code for me</div>
                    </div>
                    {mode === 'build' && <svg className="ml-auto h-3 w-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] px-4 text-center select-none">
            {/* Icon */}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 ring-1 ring-indigo-500/30">
              <svg
                className="h-6 w-6 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>

            <h2 className="text-base font-semibold text-white mb-1">
              {mode === 'build' ? 'What do you want to build?' : 'Need a hint?'}
            </h2>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-[200px]">
              {mode === 'build'
                ? 'Describe your idea and the AI will generate HTML, CSS, and JS for you instantly.'
                : 'Ask your tutor for a nudge in the right direction.'}
            </p>

            {/* How it works */}
            <div className="w-full space-y-2 mb-5">
              {(mode === 'build' ? [
                { icon: "✦", label: "Describe", detail: "Type what you want to build" },
                { icon: "⟳", label: "Generate", detail: "AI writes all three files" },
                { icon: "◈", label: "Edit & refine", detail: "Iterate with follow-up prompts" },
              ] : [
                { icon: "✦", label: "Share your code", detail: "Paste what you're working on" },
                { icon: "?", label: "Ask a question", detail: "What's confusing or stuck?" },
                { icon: "◈", label: "Learn step by step", detail: "Your tutor guides you forward" },
              ]).map(({ icon, label, detail }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-md bg-gray-800/50 px-3 py-2 text-left"
                >
                  <span className="text-indigo-400 text-xs w-4 shrink-0">
                    {icon}
                  </span>
                  <div>
                    <span className="text-xs font-medium text-gray-300">
                      {label}
                    </span>
                    <span className="text-xs text-gray-500"> — {detail}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Prompt starters */}
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">
              Try one of these
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {(mode === 'build' ? [
                "Build a to-do list app",
                "Make a countdown timer",
                "Create a personal portfolio page",
              ] : [
                "Why isn't my if statement working?",
                "What does a for loop do?",
                "How do I change the colour of text in CSS?",
              ]).map((suggestion) => (
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
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] w-fit rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-indigo-700 text-white"
                  : "bg-gray-800 text-gray-300"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose-chat">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <p className="font-bold text-white mb-1 text-sm">{children}</p>,
                      h2: ({ children }) => <p className="font-semibold text-white mb-1 text-sm">{children}</p>,
                      h3: ({ children }) => <p className="font-semibold text-gray-200 mb-1 text-xs uppercase tracking-wide">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 ml-4 space-y-0.5 list-disc list-outside">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 ml-4 space-y-0.5 list-decimal list-outside">{children}</ol>,
                      li: ({ children }) => <li className="text-gray-300 pl-0.5">{children}</li>,
                      code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => {
                        const text = String(children).replace(/\n$/, '')
                        const isInline = inline || !text.includes('\n')
                        return isInline ? (
                          <code className="rounded bg-gray-900 px-1 py-0.5 font-mono text-xs text-indigo-300">{children}</code>
                        ) : (
                          <pre className="my-2 w-fit min-w-[6rem] max-w-full overflow-x-auto rounded bg-gray-900 p-2.5 font-mono text-xs text-gray-200 leading-relaxed">
                            <code>{children}</code>
                          </pre>
                        )
                      },
                      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                      em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
                      blockquote: ({ children }) => (
                        <blockquote className="my-2 border-l-2 border-indigo-500 pl-3 text-gray-400 italic">{children}</blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300">{children}</a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
              <p
                className={`mt-1 text-xs ${msg.role === "user" ? "text-indigo-300" : "text-gray-500"}`}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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
              {activeFile ?? "index.html"}:
              {selectedCode.startLine === selectedCode.endLine
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
              ? selectedCode.text.slice(0, 300) + "…"
              : selectedCode.text}
          </pre>
        </div>
      )}

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-800 p-3 flex gap-2"
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'build' ? 'Describe what you want to build...' : 'Ask for a hint or help...'}
          rows={1}
          disabled={isGenerating}
          className="flex-1 resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isGenerating || !prompt.trim()}
          className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
