-- Backfills a student_profiles row for every existing auth.users row that
-- predates auto-creation on login (app/auth/callback/route.ts) and isn't an
-- admin or teacher. Without this, anyone who signed in before that change
-- shipped stays invisible to the admin's "add student to class" UI, which
-- only lists student_profiles rows.
insert into public.student_profiles (user_id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
from auth.users u
where not exists (select 1 from public.student_profiles sp where sp.user_id = u.id)
  and not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
on conflict (user_id) do nothing;
