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
