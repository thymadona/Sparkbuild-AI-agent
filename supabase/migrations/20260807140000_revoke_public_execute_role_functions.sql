-- Supabase's project-level default privileges grant EXECUTE on new
-- public-schema functions to anon/authenticated/service_role explicitly
-- (not just via the PUBLIC pseudo-role) — confirmed via
-- pg_proc.proacl showing an explicit anon=X entry immediately after the
-- earlier migrations in this series, despite those only adding a grant
-- to `authenticated`. So has_permission(), is_admin(),
-- is_teacher_of_class(), and can_access_teacher_dashboard() were all
-- callable by the unauthenticated `anon` role too, leaking whether an
-- arbitrary user_id holds a given role/permission. Only signed-in
-- callers (via the `authenticated` role) should ever call these.
--
-- `revoke ... from public` does NOT remove this — anon has its own
-- explicit ACL entry, not an inherited one — so anon must be named
-- directly.

revoke execute on function public.has_permission(uuid, text) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_teacher_of_class(uuid, uuid) from public, anon;
revoke execute on function public.can_access_teacher_dashboard(uuid) from public, anon;

-- Explicit re-grant, in case a REVOKE FROM PUBLIC/anon ever strips an
-- unrelated inherited grant — keeps this migration idempotent and
-- self-contained either way.
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_teacher_of_class(uuid, uuid) to authenticated;
grant execute on function public.can_access_teacher_dashboard(uuid) to authenticated;
