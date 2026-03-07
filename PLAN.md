# Plan: 7 Features for Student Code Generation App

## Context

The app is a Lovable-style tool for 200-500 students. Students type prompts, an LLM generates a single HTML file, and it previews in an iframe. The current MVP has a 20/day rate limit, no chat persistence, a fixed 3-panel layout, and the LLM only generates code (no teaching mode). These 7 features upgrade the app from a simple code generator to a full interactive learning environment.

---

## Implementation Order

1. Rate limit (isolated, run tests first)
2. Supabase `messages` table migration
3. LLM dual-mode system prompt + code-context improvements
4. Chat history persistence (depends on #2 and #3)
5. CodeEditor component + FileTree click handler
6. Resizable/collapsible panels (restructures EditorLayout, ties everything together)

---

## Feature 1: Rate Limit → 10/hour

**Files:**
- `lib/ratelimit.ts` — change `DAILY_LIMIT = 20` → `HOURLY_LIMIT = 10`, `WINDOW_HOURS = 24` → `WINDOW_HOURS = 1`
- `app/api/generate/route.ts` — update error message: `"Daily limit reached"` → `"Hourly limit reached"`
- `components/Editor.tsx` — update fallback error string
- `__tests__/unit/lib/ratelimit.test.ts` — update test values (limit 10, window 1hr)

---

## Feature 2 + 7: Code Tab (View/Edit index.html)

Features 2 and 7 are the same thing — one implementation covers both.

**New file:** `components/CodeEditor.tsx`
- Controlled `<textarea>` with monospace font, full height
- Save button → calls `onSave(draft)` callback
- Resets draft when `code` prop changes (from LLM updates)

**Modified files:**
- `components/FileTree.tsx` — add `onFileClick?: (filename: string) => void` prop; make file rows `<button>` elements
- `app/editor/[id]/EditorLayout.tsx` — add `activeTab: 'chat' | 'code'` state; clicking index.html sets `activeTab = 'code'`; tab bar (Chat | Code) above center panel; `onSave` calls `setCode()` + `PATCH /api/projects` with `files`
- `app/api/projects/route.ts` — add `files` to allowed PATCH fields

---

## Feature 3: Persist Chat History

**Database migration (Supabase):**
```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index messages_project_id_created_at_idx on messages (project_id, created_at asc);
alter table messages enable row level security;
create policy "Users can read own messages" on messages for select using (auth.uid() = user_id);
```

**`types/index.ts`** — add `Message` interface

**`app/editor/[id]/page.tsx`** — fetch messages via `supabaseAdmin` on SSR (`.limit(100)`, ordered by `created_at asc`), pass as `initialMessages` to `EditorLayout`

**`app/editor/[id]/EditorLayout.tsx`** — accept and forward `initialMessages: Message[]` to `Editor`

**`components/Editor.tsx`:**
- Accept `initialMessages` prop, initialize state from it
- On submit, include `history: messages.map(m => ({ role, content }))` in fetch body
- After stream, detect response type and save to appropriate message type

**`app/api/generate/route.ts`:**
- Accept `history` in body (last 10 turns used for LLM context)
- After stream completes, insert user + assistant messages into `messages` table
- Only update `projects.files` if response is code (starts with `<!DOCTYPE`)
- Keep existing `prompts` table insert (still needed for rate limiting)

---

## Feature 4 + 5: LLM Dual Mode + Code Context

**`lib/gemini.ts`** — replace system prompt:
```
You are an expert web development tutor for students.

You have two modes:
1. CODE MODE: When student asks to build/create/add/change/fix/modify — respond with a SINGLE complete HTML file starting with <!DOCTYPE html>. All CSS in <style>, all JS in <script>. No markdown, no explanation, no code fences.
2. TEACH MODE: When student asks a question or wants an explanation — respond with plain text. Do NOT output HTML tags or code fences. Be concise and educational.

The student's current index.html is provided as context when available.

CRITICAL: In CODE MODE the entire response must be <!DOCTYPE html>... In TEACH MODE never start with <!DOCTYPE html>.
```

**`app/api/generate/route.ts`** — build messages array:
```ts
const systemContent = currentCode
  ? `${SYSTEM_PROMPT}\n\n--- CURRENT FILE: index.html ---\n${currentCode}\n--- END FILE ---`
  : SYSTEM_PROMPT

const recentHistory = (history ?? []).slice(-10)

const messages = [
  { role: 'system', content: systemContent },
  ...recentHistory,
  { role: 'user', content: prompt },
]
```

Remove old `userMessage` concatenation. Add optional `selectedCode` in body — if present, prepend to user content: `` `Selected code:\n\`\`\`\n${selectedCode}\n\`\`\`\n\n${prompt}` ``

**`components/Editor.tsx`** — detect response type during/after stream:
```ts
// After accumulating stream:
const isCode = accumulated.trimStart().toLowerCase().startsWith('<!doctype html>')
if (isCode) {
  onCodeUpdate(accumulated)
  // show "Code updated." in chat
} else {
  // show accumulated text as assistant chat message
}
```

---

## Feature 6: Resizable + Collapsible Panels

**Install:** `bun add react-resizable-panels`

**`app/editor/[id]/EditorLayout.tsx`** — replace fixed-width flex layout with `PanelGroup`:
```tsx
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels'

<PanelGroup direction="horizontal" autoSaveId="editor-layout">
  <Panel id="files" defaultSize={15} minSize={5} collapsible collapsedSize={0} ref={filesPanelRef}>
    {/* file tree */}
  </Panel>
  <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-indigo-500 cursor-col-resize" />
  <Panel id="editor" defaultSize={25} minSize={15} collapsible collapsedSize={0} ref={editorPanelRef}>
    {/* Chat/Code tab panel */}
  </Panel>
  <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-indigo-500 cursor-col-resize" />
  <Panel id="preview" defaultSize={60} minSize={20} collapsible collapsedSize={0} ref={previewPanelRef}>
    {/* preview */}
  </Panel>
</PanelGroup>
```

- `autoSaveId` persists sizes to localStorage automatically
- `ImperativePanelHandle` refs for collapse/expand buttons in each panel header
- Each panel header gets a toggle button: `panelRef.current?.collapse()` / `.expand()`
- Track `isCollapsed` via `onCollapse`/`onExpand` callbacks for button icon toggling

---

## Critical Files

| File | Change |
|------|--------|
| `lib/ratelimit.ts` | Hourly limit constants |
| `lib/gemini.ts` | Dual-mode system prompt |
| `app/api/generate/route.ts` | History, dual-mode save, context in system |
| `app/api/projects/route.ts` | Allow `files` in PATCH |
| `app/editor/[id]/page.tsx` | Fetch messages SSR |
| `app/editor/[id]/EditorLayout.tsx` | Tabs, resize panels, CodeEditor, state orchestration |
| `components/Editor.tsx` | initialMessages, history, response type detection |
| `components/FileTree.tsx` | onFileClick callback |
| `components/CodeEditor.tsx` | NEW — direct HTML editing |
| `types/index.ts` | Message type |
| `__tests__/unit/lib/ratelimit.test.ts` | Update test values |

---

## Verification

1. **Rate limit**: Send 10 prompts in 1 hour → 11th is blocked with "Hourly limit reached"; wait 1 hour → resets
2. **Code editor**: Click `index.html` in file tree → Code tab opens; edit HTML → Save → iframe preview updates
3. **Chat history**: Refresh editor page → previous messages still visible; multi-turn: "add a button" → "make it red" → LLM uses context
4. **Dual mode**: Ask "what is CSS?" → plain text answer in chat, no preview change; ask "add a button" → preview updates
5. **Code context**: LLM references current HTML when answering questions or modifying code
6. **Resize panels**: Drag handles resize panels; collapse button hides panel; sizes persist on refresh
7. **Tests**: `bun run test:unit` passes (ratelimit tests updated)
