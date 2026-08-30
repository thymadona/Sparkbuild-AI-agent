-- projects.is_public / created_at / updated_at and prompts.created_at are all
-- declared non-null by `Project` in types/index.ts and read that way
-- everywhere, but the columns allowed NULL. Under the PostgREST client the
-- rows arrived loosely typed and the mismatch was invisible; Drizzle types the
-- select from the schema, so it surfaced as a compile error.
--
-- Backfill first: SET NOT NULL fails outright on an existing NULL, and while a
-- fresh database has none, a development database predating this migration
-- might. Each column takes the value its DEFAULT would have given it.
UPDATE "projects" SET "is_public" = false WHERE "is_public" IS NULL;--> statement-breakpoint
UPDATE "projects" SET "created_at" = now() WHERE "created_at" IS NULL;--> statement-breakpoint
UPDATE "projects" SET "updated_at" = COALESCE("created_at", now()) WHERE "updated_at" IS NULL;--> statement-breakpoint
UPDATE "prompts" SET "created_at" = now() WHERE "created_at" IS NULL;--> statement-breakpoint

ALTER TABLE "projects" ALTER COLUMN "is_public" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prompts" ALTER COLUMN "created_at" SET NOT NULL;
