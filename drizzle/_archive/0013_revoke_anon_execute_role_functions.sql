-- Supabase's project-level default privileges grant EXECUTE on new
-- public-schema functions to anon/authenticated/service_role explicitly
-- (not just via the PUBLIC pseudo-role), so `revoke ... from public`
-- alone doesn't remove the anon grant — confirmed via pg_proc.proacl
-- still showing anon=X after that migration. Revoke from anon by name.

revoke execute on function public.has_permission(uuid, text) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.is_teacher_of_class(uuid, uuid) from anon;
revoke execute on function public.can_access_teacher_dashboard(uuid) from anon;
