# Review Notes

Consistency and completeness findings from generating this documentation set. Each item was verified against the source or by running a command; the evidence is stated so the finding can be re-checked.

## Consistency Findings

### 1. `AGENTS.md` and `CLAUDE.md` disagree on the package manager

`CLAUDE.md` documents every command as `bun run ...` / `bunx ...`. The hand-written `AGENTS.md` states "Use `npm` for reproducible installs because the repository includes `package-lock.json`." Both `package-lock.json` and `bun.lock` are committed at the root, so neither claim is self-evidently wrong.

Impact: an agent following the wrong file may update a lockfile the team does not track, producing spurious diffs.

Recommendation: pick one package manager, delete the other lockfile, and state the decision in exactly one place. The generated `AGENTS.md` follows the `npm` decision because it is the more recent of the two documents and is stated with a reason.

### 2. `CLAUDE.md` describes an MVP scope the code has outgrown

`CLAUDE.md` lists as a constraint: "MVP: single HTML file only, no multi-file, no version history, no payments." The code contradicts all three:

- Multi-file: `ProjectFiles` is a `Record<string, string>`, `components/FileTree.tsx` adds files, `lib/parse-multi-file.ts` parses multiple `--- FILE:` headers, and `lib/combine.ts` inlines `style.css` and `script.js`.
- Payments: `invoices`, `receipts`, and `receipt_number_seq` exist with a full admin lifecycle and Telegram delivery.
- `CLAUDE.md` also omits the lesson system, the admin back office, `TELEGRAM_BOT_TOKEN`, and `NEXT_PUBLIC_SITE_URL` entirely.

Recommendation: reduce `CLAUDE.md` to a pointer at `AGENTS.md` plus its genuinely personal preferences, or delete the stale constraint list. Two overlapping context files will keep drifting.

### 3. `test:unit` and `test:integration` scripts cannot work as written

`package.json` defines `jest --selectProjects unit` and `jest --selectProjects integration`, but `jest.config.ts` defines no `projects` array. Verified by running `npm run test:unit`:

```
You provided values for --selectProjects but a project does not have a name.
You provided values for --selectProjects but no projects were found matching the selection.
No tests found, exiting with code 1
```

Recommendation: either add a `projects` array with `displayName: 'unit'` and `displayName: 'integration'` (which would also let the unit project use `testEnvironment: 'jsdom'` and drop the per-file docblocks), or replace the scripts with path filters such as `jest __tests__/unit`.

### 4. Tests encode stale constants and parameter names

`npm test` currently reports 3 failed suites, 7 failed tests out of 54. The failures are pre-existing and describe documentation-relevant drift, not flaky infrastructure:

| Failing test | Test expects | Code does |
| --- | --- | --- |
| `unit/lib/ratelimit.test.ts` — "blocks when prompt count reaches 10" | limit of 10 | `HOURLY_LIMIT = 20` |
| `integration/api/projects.test.ts` — default title | `"Untitled"` | random adjective + noun pair |
| `integration/api/generate.test.ts` — `currentCode` in the user message | field named `currentCode` | field is named `selectedCode` |

Recommendation: update the tests to the current behavior. Until then, a red suite hides real regressions, and the rate-limit number in particular appears in three places (code, tests, and prose documentation).

### 5. `types/index.ts` is behind the migrations

| Schema element | Migration | TypeScript |
| --- | --- | --- |
| `projects.submission_status` (`submitted` / `approved` / `needs_work`) | `20260403_teacher_feedback.sql` | missing from `Project` |
| `messages.role` allows `'teacher'` | `20260403_teacher_feedback.sql` | `Message.role` is `'user' \| 'assistant'` |
| `app_settings` | `20260308_app_settings.sql` | no interface |
| `user_build_mode` | `20260309_user_build_mode.sql` | no interface |

Impact: the teacher-feedback feature is half-landed — the schema supports it but no typed code path can produce a `teacher` message or set a submission status. An agent reading only `types/index.ts` would conclude the feature does not exist.

Recommendation: either finish the feature or note it as a planned migration; add the two missing interfaces regardless, since untyped tables are invisible to type checking.

### 6. `lib/gemini.ts` does not contain Gemini code

The file exports a DeepSeek client. The filename is a leftover from an earlier provider. Also inside it, `/api/generate` logs stream failures as `'OpenRouter stream error:'`, referencing a third provider that is not used.

Recommendation: rename the module to `lib/llm.ts` (or `lib/deepseek.ts`) and fix the log string. Both are one-line changes with no behavioral risk, and they remove a durable source of confusion.

### 7. Duplicated logic with no shared home

- `isAdmin(email)` is copy-pasted into every admin route file. `/api/admin/settings` inlines the same check without even naming it, and `/api/generate` inlines it again for the rate-limit bypass.
- `formatAmount(cents)` is redefined locally in several admin components, in `app/receipt/[id]/page.tsx`, in `app/invoice/[id]/page.tsx`, and in the invoice send route.

Recommendation: extract `isAdmin` to `lib/auth.ts` and `formatAmount` to `lib/format.ts`. The `isAdmin` duplication is the higher priority: an authorization predicate that exists in a dozen copies will eventually be updated in eleven of them.

## Completeness Findings

### Areas documented with high confidence

Route handlers, the middleware pipeline, the generation pipeline, the Supabase client boundaries, the schema and its constraints, the lesson versioning scheme, and the invoice lifecycle were all read directly from source.

### Gaps and thin areas

| Area | Why it is thin | Suggested fix |
| --- | --- | --- |
| `public/templates/*.html` | Student-facing content, not application code; not symbol-analyzed. Their `<!-- TASK: ... -->` and `CHANGE THIS:` comments are load-bearing because `Navigator` locates tasks by string match against `task.commentAnchor` | Add a short comment at the top of each template warning that anchor text is referenced from `lib/lessons.ts` |
| `app/globals.css` and `tailwind.config.ts` tokens | The `surface-*`, `fg-*`, and `brand-*` scales are used in every component but their intended semantics are undocumented | A brief token legend would prevent ad-hoc color choices |
| `components/Editor.tsx` streaming internals | Documented at the level of what it calls, not how it incrementally renders and reconciles the streamed text | Read the file directly before modifying chat rendering |
| Admin overview cost estimation | `OverviewTab.estimateCost` implements a pricing assumption whose source is not recorded anywhere | Add a comment citing the per-token rate and date it was taken |
| `PLAN.md` | A root planning document not cross-checked during this pass; likely predates the admin and lesson systems | Verify or archive it |
| Deployment and CI | No CI workflow, no git hooks, and no deployment config are present in the repository. `CLAUDE.md` mentions Vercel, but nothing in-repo confirms or configures it | If Vercel is used, note the project settings and required environment variables somewhere in-repo |
| Error and empty-state behavior | Documented per endpoint, but there is no consistent client-side error surface to describe; components handle failures individually | Consider a shared pattern before the next feature |

### Language support limitations

Nothing was skipped for lack of language support. All application code is TypeScript/TSX and was analyzed. The two non-analyzed categories are intentional: SQL migrations were read manually rather than symbol-extracted, and the HTML templates plus `globals.css` are content and styling assets with no exported symbols.

## Security Observations

Noted while reading, not caused by this documentation pass:

1. **`DELETE /api/projects` deletes child rows unscoped.** The `messages` and `prompts` deletes filter only on `project_id`; only the final project delete is scoped by `user_id`. Passing another user's project id clears that project's chat history and prompt log — and because `prompts` is the rate-limit ledger, it also resets that user's quota. Scope both deletes by `user_id`, or rely on the existing `on delete cascade`.
2. **`/invoice/[id]` and `/receipt/[id]` have no authorization.** They are outside the middleware's protected prefixes and their page components only redirect when the row is missing. Anyone with the id sees the amount, description, and student name. This may be intentional so parents can open Telegram links without an account, but it should be a recorded decision rather than an accident.
3. **`PATCH /api/admin/students/[id]` passes the parsed body straight to `update()`.** Any column an admin names can be written, including `created_by` and `user_id`. Whitelist the fields.
4. **`"Admin full access"` RLS policies are unconditional `using (true)`.** They do not verify that the caller is an admin; they simply permit whatever RLS evaluates. Real enforcement depends entirely on requests being funneled through server routes that check `ADMIN_EMAILS`. Do not expose these tables to the anon key.
5. **Receipt creation and invoice status update are not transactional.** A failure between the two statements leaves a receipt attached to an invoice still marked unpaid.
6. **The preview `postMessage` listener does not verify `event.origin`** and the injected script posts to `'*'`. Currently safe because the frame renders the user's own code; revisit if the iframe ever loads anything else.

## Recommendations by Priority

1. Fix the failing tests and the broken `test:unit` / `test:integration` scripts so the suite is trustworthy again.
2. Scope the child-row deletes in `DELETE /api/projects` by `user_id`.
3. Extract `isAdmin` into one shared module.
4. Resolve the `CLAUDE.md` / `AGENTS.md` conflicts and settle on one package manager.
5. Add the missing types for `app_settings`, `user_build_mode`, `submission_status`, and the `teacher` role, or explicitly mark the feature as pending.
6. Rename `lib/gemini.ts` and correct the `OpenRouter` log string.
7. Whitelist the updatable fields in the student PATCH handler.
8. Decide and record whether invoice and receipt pages are intentionally public.
