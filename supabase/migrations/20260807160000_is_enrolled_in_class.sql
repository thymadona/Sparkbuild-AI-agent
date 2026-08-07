-- Returns true if this user does NOT need to be gated to /no-class: either
-- they're a student member of at least one class, or they hold a platform
-- admin/teacher role. The admin/teacher exemption matters because an
-- account can be promoted to teacher (via /admin/users) without its old
-- student_profiles row ever being cleaned up — e.g. donamusik@gmail.com,
-- created as a plain student, later granted the platform teacher role and
-- added to a class with class_members.role = 'teacher'. Without this OR,
-- such an account would still have a student_profiles row and no
-- role='student' class_members row, and would be wrongly locked out.
--
-- Security-definer so middleware (anon key) never reads class_members
-- directly — that table's only RLS policy is `using (true)`, not a real
-- boundary, matching the reasoning behind is_teacher_of_class /
-- can_access_teacher_dashboard in the roles/permissions migration.
--
-- Grants only `authenticated`, never `anon` or `public` — learned from the
-- earlier revoke_public_execute_role_functions migration, where Supabase's
-- default grants had to be revoked from `anon` explicitly after the fact.
-- Doing it right the first time here instead.
create or replace function public.is_enrolled_in_class(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.class_members
      where user_id = p_user_id and role = 'student'
    )
    or public.is_admin(p_user_id)
    or exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user_id and r.name = 'teacher'
    );
$$;

revoke all on function public.is_enrolled_in_class(uuid) from public, anon;
grant execute on function public.is_enrolled_in_class(uuid) to authenticated;
