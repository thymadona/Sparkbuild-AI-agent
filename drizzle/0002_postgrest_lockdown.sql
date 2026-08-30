-- Deny-by-default for PostgREST.
--
-- The squash to 0000_baseline dropped the RLS that the archived history had
-- enabled on sixteen tables, on the reasoning that "Supabase is gone, and the
-- owner bypasses RLS anyway". That reasoning is wrong for how this app is
-- actually deployed: forty-one files still read and write through PostgREST
-- (`lib/supabase-server.ts`), so the hosted Supabase project — and with it the
-- publicly-shipped anon key — stays live.
--
-- Supabase ships `alter default privileges in schema public grant all on
-- tables to anon, authenticated, service_role`, so every table 0000_baseline
-- creates is reachable by that public key. Without the statements below,
-- `sessions.token` is readable by anyone (session forgery) and `user_roles` is
-- writable by anyone (privilege escalation).
--
-- Two independent layers, deliberately:
--   1. RLS on with *zero* policies — `service_role` and the owner hold
--      BYPASSRLS, so `supabaseAdmin` and Drizzle are unaffected while `anon`
--      and `authenticated` get a blanket deny.
--   2. The grants revoked outright, so those roles cannot even see the tables
--      in PostgREST's schema cache.
--
-- Row security is *not* paired with policies here on purpose. There is no
-- policy that could be written honestly: `auth.uid()` is only populated by
-- Supabase Auth, which this app no longer uses. The boundary is the blanket
-- deny plus the authorization checks in the route handlers — not a policy set
-- that reads like enforcement but is predicated on a value that is always null.
--
-- Re-runnable: `enable row level security` is idempotent, and the revokes are
-- guarded on the role existing so this also applies cleanly to a plain
-- Postgres (local development, the CI service container) where `anon`,
-- `authenticated` and `service_role` are not defined.

alter table "accounts" enable row level security;--> statement-breakpoint
alter table "app_settings" enable row level security;--> statement-breakpoint
alter table "class_enabled_lessons" enable row level security;--> statement-breakpoint
alter table "class_members" enable row level security;--> statement-breakpoint
alter table "class_schedules" enable row level security;--> statement-breakpoint
alter table "classes" enable row level security;--> statement-breakpoint
alter table "invoices" enable row level security;--> statement-breakpoint
alter table "lesson_progress" enable row level security;--> statement-breakpoint
alter table "messages" enable row level security;--> statement-breakpoint
alter table "permissions" enable row level security;--> statement-breakpoint
alter table "projects" enable row level security;--> statement-breakpoint
alter table "prompts" enable row level security;--> statement-breakpoint
alter table "receipts" enable row level security;--> statement-breakpoint
alter table "role_permissions" enable row level security;--> statement-breakpoint
alter table "roles" enable row level security;--> statement-breakpoint
alter table "sessions" enable row level security;--> statement-breakpoint
alter table "student_profiles" enable row level security;--> statement-breakpoint
alter table "user_build_mode" enable row level security;--> statement-breakpoint
alter table "user_roles" enable row level security;--> statement-breakpoint
alter table "users" enable row level security;--> statement-breakpoint
alter table "verifications" enable row level security;--> statement-breakpoint

-- The anon/authenticated grants Supabase's default privileges hand out. Guarded
-- on the role existing: these are PostgREST constructs and do not exist on a
-- plain Postgres server, where an unguarded REVOKE would abort the migration.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('revoke all on schema public from %I', r);
      -- Stops the next `bun run db:migrate` from re-granting on new tables.
      execute format(
        'alter default privileges in schema public revoke all on tables from %I', r
      );
      execute format(
        'alter default privileges in schema public revoke all on sequences from %I', r
      );
      execute format(
        'alter default privileges in schema public revoke all on functions from %I', r
      );
    end if;
  end loop;
end
$$;
