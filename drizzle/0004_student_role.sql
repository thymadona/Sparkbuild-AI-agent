-- Makes "student" a real platform role instead of an absence.
--
-- Until now a student was modelled as *no* user_roles row at all, and five
-- read sites under app/staff/ used "has any user_roles row" as a synonym for
-- "is staff". lib/auth/student-defaults.ts now grants this role on every
-- non-staff sign-in, so those sites match on r.name instead — see
-- STAFF_ROLES in lib/auth/permissions.ts.
--
-- Deliberately NO role_permissions rows: public.has_permission() joins
-- through role_permissions, so an empty set is what keeps every permission
-- check false for students. The admin cross join in
-- 0001_functions_sequence_seed.sql already ran and does not re-run, so admin
-- is unaffected by a new role appearing here.
--
-- The authorization functions in 0001 need no change either: is_admin,
-- can_access_teacher_dashboard and is_enrolled_in_class all match on r.name
-- explicitly, so a fourth role is inert to them.
--
-- Existing accounts are not backfilled; they pick the role up on their next
-- sign-in through the session.create hook in lib/auth/index.ts.
insert into public.roles (name, description) values
  ('student', 'Default role for every non-staff account')
on conflict (name) do nothing;
