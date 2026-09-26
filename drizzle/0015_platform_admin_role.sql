-- D1 group 2: the org-less platform_admin role. It marks the platform owner
-- (the D9 console will use it) and carries no role_permissions rows, so it
-- grants nothing on its own. Seeded with the fixed id lib/db/schemas/roles.ts
-- exports (PLATFORM_ADMIN_ROLE_ID) so the check below can name it.
--
-- Hand-edited from the drizzle-kit output (same final schema as the 0015
-- snapshot): the role seed is added ahead of the constraint. Every existing
-- grant has an org (0014) and none is platform_admin, so the check holds.

INSERT INTO "roles" ("id", "name", "description")
VALUES ('00000000-0000-4000-8000-000000000002', 'platform_admin', 'Platform owner. Org-less; grants no permissions')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- A grant's org_id is NULL if and only if it is the platform_admin grant.
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_org_id_check" CHECK (("user_roles"."role_id" = '00000000-0000-4000-8000-000000000002'::uuid) = ("user_roles"."org_id" IS NULL));
