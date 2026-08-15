-- Covers `.eq('user_id', user.id)` filters on the dashboard, GET /api/projects,
-- lessons list, and editor ownership queries. projects_user_id_fkey was
-- previously unindexed (confirmed via Supabase performance advisors).
create index projects_user_id_idx on projects (user_id);

-- class_members' only index is the composite PK (class_id, user_id), which
-- doesn't cover a lookup filtered on user_id alone — the editor page's
-- homework-due-date query does exactly that (app/editor/[id]/page.tsx).
create index class_members_user_id_idx on class_members (user_id);
