-- class_members.role distinguishes teacher-of-a-class from student
-- membership, enabling a class-scoped teacher role (public.roles / see
-- 20260807120000_roles_permissions.sql). Must run after that migration —
-- the functions below depend on public.is_admin().
--
-- Because the primary key is (class_id, user_id), nobody can be both
-- teacher and student of the same class — accepted tradeoff.

begin;

alter table public.class_members
  add column role text not null default 'student'
  check (role in ('student', 'teacher'));
-- Constant DEFAULT + NOT NULL: PG11+ backfills this as a metadata-only
-- operation (no table rewrite), so every existing row becomes 'student'
-- without a separate UPDATE.

-- ============================================================
-- Teacher-access functions
--
-- Used by middleware.ts's /teacher guard via supabase.rpc(...) on the
-- ANON-key client, and by lib/auth/permissions.ts's isTeacherOfClass().
-- Deliberately NOT a raw class_members select from middleware: that
-- table's only RLS policy is "Admin full access" using (true)
-- (20260328_admin_schema.sql), which is not a real boundary when read via
-- the anon key — see CLAUDE.md's Security Constraints. These functions
-- are the boundary instead.
-- ============================================================

create or replace function public.is_teacher_of_class(p_user_id uuid, p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.class_members
    where user_id = p_user_id and class_id = p_class_id and role = 'teacher'
  ) or public.is_admin(p_user_id);
$$;

create or replace function public.can_access_teacher_dashboard(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin(p_user_id) or exists (
    select 1 from public.class_members where user_id = p_user_id and role = 'teacher'
  );
$$;

grant execute on function public.is_teacher_of_class(uuid, uuid) to authenticated;
grant execute on function public.can_access_teacher_dashboard(uuid) to authenticated;

commit;
