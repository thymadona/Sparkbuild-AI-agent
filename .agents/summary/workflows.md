# Workflows

End-to-end processes, each traced through the actual files that implement it.

## Sign-In and Access Gating

```mermaid
sequenceDiagram
    participant U as Student
    participant LF as LoginForm (client)
    participant G as Google
    participant CB as /auth/callback
    participant MW as middleware.ts
    participant DB as Supabase

    U->>LF: Continue with Google
    LF->>G: signInWithOAuth(redirectTo /auth/callback)
    G-->>CB: redirect with ?code
    CB->>DB: exchangeCodeForSession(code)
    CB-->>U: redirect to ?next (default /dashboard)
    U->>MW: GET /dashboard
    MW->>DB: auth.getUser()
    MW->>DB: select student_profiles.is_active
    alt is_active === false
        MW-->>U: redirect /login?reason=deactivated
    else no profile row or active
        MW-->>U: continue
    end
```

`app/LoginForm.tsx` only offers Google OAuth. Admin-created students are provisioned server-side with `email_confirm: true` and no password, so they sign in through the same OAuth flow using the email the admin registered.

Deactivation is a soft block: `student_profiles.is_active = false` (set by `DeactivateToggle` through `PATCH /api/admin/students/[id]`) causes middleware to bounce the user out of `/dashboard`, `/editor`, and `/profile` on the next navigation. The auth user and all their data remain intact.

## Free-Form Project Lifecycle

```mermaid
flowchart LR
    NEW["Dashboard: New project<br/>POST /api/projects"] --> ED["/editor/{id}"]
    ED --> EDIT["Edit code<br/>PATCH /api/projects (files)"]
    ED --> GEN["Prompt the AI<br/>POST /api/generate"]
    GEN --> ED
    ED --> RENAME["Rename<br/>PATCH /api/projects (title)"]
    ED --> PUB["Toggle public<br/>PATCH /api/projects (is_public)"]
    PUB --> SHARE["/share/{id} public view"]
    SHARE --> FORK["Fork<br/>POST /api/projects/duplicate"]
    FORK --> ED
    ED --> DUP["Duplicate own project<br/>POST /api/projects/duplicate"]
    ED --> DEL["Delete<br/>DELETE /api/projects?id="]
```

Creating without a template inserts a built-in animated starter document as `index.html`. Duplicating always produces a private copy titled `Copy of <original>`. Deleting removes the project's `messages` and `prompts` rows first, then the project.

Saving is explicit rather than autosaved: `CodeEditor` changes flow up to `EditorLayout.handleCodeSave`, which writes the entire `files` map back with `PATCH /api/projects`. Adding a file does the same immediately with an empty string as contents.

## AI Generation (Ask vs Build)

```mermaid
flowchart TD
    START(["Student submits a prompt"]) --> AUTH{"Signed in?"}
    AUTH -- no --> R401["401"]
    AUTH -- yes --> ADM{"Email in ADMIN_EMAILS?"}
    ADM -- yes --> OWN
    ADM -- no --> RL{"Fewer than 20 prompts<br/>in the last hour?"}
    RL -- no --> R429["429 with hoursUntilReset"]
    RL -- "query failed" --> OWN
    RL -- yes --> OWN{"Project owned by caller?"}
    OWN -- no --> R404["404"]
    OWN -- yes --> MODE{"mode = build<br/>AND user_build_mode.enabled?"}
    MODE -- yes --> BUILD["BUILD_SYSTEM_PROMPT"]
    MODE -- no --> ASK["ASK_SYSTEM_PROMPT"]
    BUILD --> LOG["Insert prompts row"]
    ASK --> LOG
    LOG --> STREAM["Stream DeepSeek to client"]
    STREAM --> CLASS{"Output starts with<br/>--- FILE: ?"}
    CLASS -- yes --> PARSE["parseMultiFileResponse<br/>replace projects.files"]
    PARSE --> SUM["Store parseSummary() text<br/>as assistant message"]
    CLASS -- no --> RAW["Store raw text<br/>as assistant message"]
    SUM --> PERSIST["Insert user + assistant messages"]
    RAW --> PERSIST
```

The two modes are behaviorally very different and both are enforced by prompt, not by code:

- **Ask mode** (default) — the tutor persona never writes code, replies in at most three sentences, cites a specific line in bold, and ends with a question under ten words.
- **Build mode** (per-user permission) — returns a complete single HTML file in the delimiter format, preserves any `<!-- TASK N -->` comments already in the student's code, and edits only what was asked.

Because ask mode is the default and build mode requires a database flag an admin sets, a student cannot escalate to code generation by editing the request payload.

## Lesson Journey

```mermaid
sequenceDiagram
    participant S as Student
    participant LC as LessonsClient
    participant LD as LessonDetailClient
    participant PUB as /templates/*.html
    participant API as /api/projects
    participant NAV as Navigator
    participant LP as /api/projects/[id]/lesson-progress

    S->>LC: open /lessons
    LC-->>S: catalog with start/resume state
    S->>LD: open /lessons/{id}
    alt project already exists
        LD-->>S: navigate to /editor/{existingId}
    else first time
        LD->>PUB: fetch template HTML as text
        LD->>API: POST templateHtml + lessonId + lessonVersion
        API-->>LD: created project
        LD-->>S: navigate to /editor/{newId}
    end
    S->>NAV: click a task
    NAV->>NAV: find line containing task.commentAnchor
    NAV-->>S: highlight that line + prefill the tutor prompt
    S->>NAV: Mark done
    NAV->>LP: PUT completedTaskIds (full array)
    LP-->>NAV: persisted ids
    NAV->>NAV: advance to next unfinished core task
```

Details that shape the experience:

- Opening a lesson project puts the editor sidebar in `navigator` mode automatically.
- Task ordering is not strictly sequential: `firstUnfinishedTaskIndex` prioritizes incomplete `core` tasks, then falls back to `choice` and `bonus`.
- `PUT` sends the complete id array, not a delta, and the server revalidates every id against the lesson.
- Progress is optimistic with rollback: a failed save restores the previous set and shows "Your task was not saved."
- Highlighting depends on the template's anchor comment text still matching `task.commentAnchor`.

## Admin: Student, Class, and Schedule Management

```mermaid
flowchart TD
    subgraph Students
        CS["CreateStudentModal<br/>POST /api/admin/students"] --> AU["auth.admin.createUser<br/>(email_confirm, no password)"]
        AU --> SP["insert student_profiles<br/>(created_by = admin)"]
        ES["EditStudentModal / DeactivateToggle<br/>PATCH /api/admin/students/[id]"] --> SPU["update student_profiles"]
    end

    subgraph Classes
        CC["CreateClassInline<br/>POST /api/admin/classes"] --> CL["insert classes"]
        AM["AddToClassModal<br/>POST /classes/[id]/members"] --> CM["insert class_members<br/>(duplicate enrollment ignored)"]
        CSE["ClassScheduleEditor<br/>/api/admin/schedules"] --> SCH["insert / update / delete<br/>class_schedules slots"]
    end

    subgraph BuildMode
        BM["BuildModeToggle (OverviewTab)<br/>POST /api/admin/settings"] --> UBM["upsert user_build_mode"]
    end
```

Telegram chat ids are discovered rather than typed from memory: a parent messages the bot, then the admin opens `/admin/telegram`, which calls `GET /api/admin/telegram/updates` to list recent `chat_id` values with names, and the admin copies the right one into the student's profile.

## Invoice Lifecycle

```mermaid
stateDiagram-v2
    [*] --> unpaid : CreateInvoiceModal<br/>POST /api/admin/invoices
    unpaid --> unpaid : PATCH (edit) / POST send<br/>stamps sent_at
    unpaid --> paid : POST pay<br/>insert receipt + set paid_at
    unpaid --> [*] : DELETE
    paid --> paid : POST send<br/>(now includes receipt link)
    note right of paid
        Terminal for editing:
        PATCH and DELETE both
        return 400 once paid
    end note
```

Full sequence:

1. An admin creates the invoice with `user_id`, `amount_cents`, `description`, and `due_date`. It starts `unpaid` with `sent_at` and `paid_at` null.
2. Sending pushes a Markdown message to the parent's Telegram chat containing the amount, description, status, and a link to `/invoice/{id}` built from `NEXT_PUBLIC_SITE_URL`, then stamps `sent_at`. Sending requires a `parent_telegram_chat_id` on the student's profile.
3. Marking paid allocates a receipt number from `receipt_number_seq`, inserts the immutable `receipts` snapshot, then flips the invoice to `paid` with a `paid_at` timestamp.
4. A later send on a paid invoice includes an additional link to `/receipt/{id}`.
5. `/invoice/[id]` and `/receipt/[id]` are print-oriented pages with a `PrintButton`; the receipt page is the parent-facing proof of payment.

Both `/invoice/[id]` and `/receipt/[id]` sit outside the middleware's protected prefixes, so anyone holding the id can view them. Treat those ids as the only access control on those pages.

## Adding a Schema Change

The repeatable procedure this repo implies:

1. Edit `lib/db/schema.ts` first, run `bun run db:generate` to derive DDL into `drizzle/`, hand-add whatever the DSL can't express (RLS, grants, functions, backfills), then `bun run db:migrate` to apply it — see `drizzle/README.md`. (`supabase/migrations/` no longer exists; `drizzle/` is the applied migration history.)
2. Update the matching interface in `types/index.ts` by hand — nothing generates it.
3. Update the route handlers that read or write the column; remember that `supabaseAdmin` bypasses RLS, so any new access rule must be written into the query or an explicit check.
4. Add or extend tests under `__tests__/integration/api/` for new endpoint behavior.

## Related Documents

- `interfaces.md` — exact request and response shapes for every call above.
- `data_models.md` — the constraints these workflows depend on.
- `components.md` — the components that initiate each step.
