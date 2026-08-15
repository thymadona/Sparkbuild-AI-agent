-- Roles/permissions: replaces the ADMIN_EMAILS env var + per-file isAdmin(email)
-- checks with a real role/permission model, enforceable both from route handlers
-- (via rpc) and from RLS policies. See has_permission()/is_admin() below.

begin;

-- ============================================================
-- 1. Core tables
-- ============================================================

create table public.roles (
  id uuid not null default gen_random_uuid(),
  name text not null unique,               -- 'admin', 'teacher', ...
  description text,
  created_at timestamptz not null default now(),
  constraint roles_pkey primary key (id)
);

create table public.permissions (
  id uuid not null default gen_random_uuid(),
  key text not null unique,                -- 'invoices:manage', 'homework:review', ...
  description text,
  created_at timestamptz not null default now(),
  constraint permissions_pkey primary key (id)
);

create table public.role_permissions (
  role_id uuid not null,
  permission_id uuid not null,
  constraint role_permissions_pkey primary key (role_id, permission_id),
  constraint role_permissions_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete cascade,
  constraint role_permissions_permission_id_fkey
    foreign key (permission_id) references public.permissions(id) on delete cascade
);

create table public.user_roles (
  user_id uuid not null,
  role_id uuid not null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  -- composite PK: one person can hold more than one role (e.g. admin + teacher)
  constraint user_roles_pkey primary key (user_id, role_id),
  constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id),
  constraint user_roles_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete cascade,
  constraint user_roles_granted_by_fkey foreign key (granted_by) references auth.users(id)
);

-- Every request that checks a permission hits these two lookups
create index user_roles_user_id_idx on public.user_roles (user_id);
create index role_permissions_role_id_idx on public.role_permissions (role_id);

-- ============================================================
-- 2. Seed roles + permissions
--    (mapped to the actual admin back-office surface: students, classes,
--    finance, telegram, and role administration itself)
-- ============================================================

insert into public.roles (name, description) values
  ('admin', 'Full platform access'),
  ('teacher', 'Reviews homework and messages students in their own classes');

insert into public.permissions (key, description) values
  ('invoices:manage', 'Create, edit, send, and mark invoices paid'),
  ('classes:manage', 'Create/edit classes, class schedules, and class membership'),
  ('students:manage', 'Create or deactivate student profiles; toggle per-student app settings'),
  ('homework:review', 'View and grade homework submissions'),
  ('students:message', 'Send messages to students'),
  ('telegram:manage', 'Look up Telegram chat IDs / send invoices'),
  ('roles:manage', 'Grant or revoke platform roles (admin/teacher) for a user');

-- admin: everything — no need to enumerate, and new permissions added later
-- automatically belong to admin too
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'admin';

-- teacher: scoped to what a teacher actually does today. Widen this list as
-- the role grows (e.g. add 'classes:manage' if teachers start scheduling
-- their own sessions).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('homework:review', 'students:message')
where r.name = 'teacher';

-- ============================================================
-- 3. has_permission() / is_admin()
--    security definer: these run as the function owner (postgres, via
--    migrations), which owns user_roles/roles/permissions and is therefore
--    exempt from their own RLS policies. So the "manage roles"/"manage
--    user_roles" policies below, which call is_admin(), do not recurse
--    through RLS — the nested read inside is_admin() bypasses RLS
--    entirely. This is standard Postgres owner behavior, not a bug.
-- ============================================================

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

-- Both are called via supabase.rpc(...) — from the ANON-key client in
-- middleware.ts and from supabaseAdmin in lib/auth/permissions.ts. This
-- project does not grant EXECUTE on new functions to authenticated/anon
-- by default, so without this grant the RPC call fails with a
-- permission-denied error rather than returning a boolean.
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

-- ============================================================
-- 4. Backfill bootstrap admin
--
-- DEPLOY GATE: code changes in this same effort remove ADMIN_EMAILS as an
-- enforcement mechanism everywhere. Before deploying that code, verify
-- this backfill landed:
--   select public.is_admin(id) from auth.users where email = 'thymadonakh@gmail.com';
-- must return true. If false, run the break-glass snippet at the bottom
-- of this file first.
-- ============================================================

do $$
declare
  admin_role_id uuid;
  target_user_id uuid;
begin
  select id into admin_role_id from public.roles where name = 'admin';
  select id into target_user_id from auth.users where email = 'thymadonakh@gmail.com';

  if target_user_id is null then
    raise warning 'roles_permissions migration: thymadonakh@gmail.com not found in auth.users — no bootstrap admin seeded. Grant manually (see break-glass snippet at the bottom of this file) before removing ADMIN_EMAILS enforcement.';
  else
    insert into public.user_roles (user_id, role_id)
    values (target_user_id, admin_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;
end $$;

-- ============================================================
-- 5. RLS on the new tables themselves
-- ============================================================

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- roles/permissions/role_permissions contain no PII — safe to let any signed-in
-- user read (useful for building admin UI dropdowns); writes stay admin-only.
create policy "read roles" on public.roles
  for select using (true);
create policy "manage roles" on public.roles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "read permissions" on public.permissions
  for select using (true);
create policy "manage permissions" on public.permissions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "read role_permissions" on public.role_permissions
  for select using (true);
create policy "manage role_permissions" on public.role_permissions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- user_roles: a user may read their own role assignments (e.g. "am I a
-- teacher" in the UI); only admins read/write everyone's.
create policy "read own roles" on public.user_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "manage user_roles" on public.user_roles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

commit;

-- ============================================================
-- BREAK-GLASS (comment only — do not run automatically)
-- If the bootstrap backfill above no-opped because the target user signed
-- up AFTER this migration ran, grant admin manually once by email:
--
-- insert into public.user_roles (user_id, role_id)
-- select u.id, r.id from auth.users u, public.roles r
-- where u.email = 'thymadonakh@gmail.com' and r.name = 'admin'
-- on conflict do nothing;
-- ============================================================
