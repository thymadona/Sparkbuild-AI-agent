-- Everything the Drizzle DSL can't express, carried forward from the
-- pre-Drizzle migration history now archived under drizzle/_archive/.
--
-- Deliberately NOT carried forward:
--   * the RLS *policies* (archive 0000/0003/0008/0010/0017/0018). Every one
--     predicated on auth.uid(), which only Supabase Auth populates and which
--     is now always null. A policy set predicated on a null value reads as a
--     boundary but enforces nothing, so it is not worth carrying forward.
--
--     Row security itself is a different question and is NOT dropped:
--     0002_postgrest_lockdown.sql turns it back on for all 21 tables with
--     zero policies, because PostgREST — and the publicly-shipped anon key
--     with it — is still live for the ~41 files that read through
--     lib/supabase-server.ts. See that file's header.
--   * the `grant execute ... to authenticated` lines (archive
--     0010/0012/0013/0015). Those roles are Supabase/PostgREST constructs
--     that do not exist on plain Postgres, and the application connects as
--     the owner of these functions. The matching *revokes* are handled in
--     0002 instead, guarded on the role existing.
--
-- Re-runnable: every statement is create-or-replace or ON CONFLICT guarded.

-- ---------------------------------------------------------------------
-- Receipt numbering (archive 0003_admin_schema.sql:78)
-- ---------------------------------------------------------------------
create sequence if not exists receipt_number_seq start 1;

-- ---------------------------------------------------------------------
-- Roles and permissions seed (archive 0010_roles_permissions.sql)
-- ---------------------------------------------------------------------
insert into public.roles (name, description) values
  ('admin', 'Full platform access'),
  ('teacher', 'Reviews homework and messages students in their own classes')
on conflict (name) do nothing;

insert into public.permissions (key, description) values
  ('invoices:manage', 'Create, edit, send, and mark invoices paid'),
  ('classes:manage', 'Create/edit classes, class schedules, and class membership'),
  ('students:manage', 'Create or deactivate student profiles; toggle per-student app settings'),
  ('homework:review', 'View and grade homework submissions'),
  ('students:message', 'Send messages to students'),
  ('telegram:manage', 'Look up Telegram chat IDs / send invoices'),
  ('roles:manage', 'Grant or revoke platform roles (admin/teacher) for a user')
on conflict (key) do nothing;
--> statement-breakpoint

-- admin: everything — new permissions added later automatically belong to
-- admin too, because this is a cross join rather than an enumeration.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'admin'
on conflict do nothing;

-- teacher: scoped to what a teacher actually does today.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('homework:review', 'students:message')
where r.name = 'teacher'
on conflict do nothing;
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- Authorization functions (archive 0010, 0011, 0016)
--
-- `security definer` so they run as the owner. They take p_user_id
-- explicitly and never read auth.uid(), which is exactly why they survived
-- the move off Supabase unchanged. Called from lib/auth/permissions.ts and
-- the route guard via db.execute(sql`select ...`).
--
-- Definition order matters: `language sql` bodies are parsed at creation,
-- so is_admin must exist before the functions that call it.
-- ---------------------------------------------------------------------
create or replace function public.has_permission(p_user_id uuid, p_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = p_user_id and p.key = p_key
  );
$$;
--> statement-breakpoint

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.name = 'admin'
  );
$$;
--> statement-breakpoint

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
--> statement-breakpoint

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
--> statement-breakpoint

-- The teacher-exemption fix from archive 0016 is folded in here: a teacher
-- with no student membership still counts as "enrolled", so the /no-class
-- redirect in the route guard doesn't fire for staff.
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
