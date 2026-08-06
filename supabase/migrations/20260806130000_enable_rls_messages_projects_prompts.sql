-- messages, projects, and prompts are readable/writable by the anon key
-- today because RLS was never (re-)enabled on them — the "Users can read
-- own messages" policy from 20260307_messages.sql has been inert this
-- whole time. All app reads/writes already go through supabaseAdmin
-- (service role, bypasses RLS) or check ownership server-side, so this is
-- pure hardening: it closes the anon-key hole without changing app
-- behavior, except for /explore's use of the RLS-respecting client, which
-- the public-projects policy below preserves.

-- ─── MESSAGES ────────────────────────────────────────────────────────
-- "Users can read own messages" already exists from 20260307_messages.sql.
alter table messages enable row level security;

-- ─── PROJECTS ────────────────────────────────────────────────────────
-- Required: app/explore/page.tsx queries `.eq('is_public', true)` through
-- the RLS-respecting client, not supabaseAdmin.
create policy "Anyone can view public projects" on projects
  for select using (is_public = true);

-- Not required by any current code path (all owner-scoped project access
-- goes through supabaseAdmin) — added for consistency with the
-- ownership-policy pattern used on student_profiles/messages.
create policy "Users can manage own projects" on projects
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table projects enable row level security;

-- ─── PROMPTS ─────────────────────────────────────────────────────────
-- Not required by any current code path — added for the same reason as
-- projects' owner policy above.
create policy "Users can view own prompts" on prompts
  for select using (auth.uid() = user_id);

alter table prompts enable row level security;
