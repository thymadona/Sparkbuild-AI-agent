-- Drop the authorization functions from 0001. They were security-definer
-- functions so Supabase RLS policies and RPC callers could use them; `db`
-- connects as the owner and no policy calls them, so the rules now live as
-- Drizzle queries in lib/auth/permissions.ts. Dependents first: the last
-- three call is_admin.

drop function if exists public.is_teacher_of_class(uuid, uuid);--> statement-breakpoint
drop function if exists public.can_access_teacher_dashboard(uuid);--> statement-breakpoint
drop function if exists public.is_enrolled_in_class(uuid);--> statement-breakpoint
drop function if exists public.has_permission(uuid, text);--> statement-breakpoint
drop function if exists public.is_admin(uuid);
