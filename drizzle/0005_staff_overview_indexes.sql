-- Indexes for the /staff overview dashboard: submitted homework, lessons
-- started and homework submitted this week (projects), AI requests in the last
-- 24h (prompts — the existing composite leads on user_id and cannot serve a
-- bare created_at range), unpaid invoices, active profiles, teacher count.
--
-- Plain CREATE INDEX, not CONCURRENTLY: drizzle-kit runs each migration inside
-- a transaction and CONCURRENTLY cannot run in one. These take a lock that
-- blocks writes to each table for the duration of the build. At this app's
-- scale that is milliseconds, but if `prompts` has grown large on a deployed
-- database, build them by hand with CREATE INDEX CONCURRENTLY outside this
-- migration first — the statements below are IF NOT EXISTS-safe to re-run in
-- that case.
CREATE INDEX IF NOT EXISTS "class_members_role_idx" ON "class_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_submission_status_idx" ON "projects" USING btree ("submission_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_updated_at_idx" ON "projects" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompts_created_at_idx" ON "prompts" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_profiles_is_active_idx" ON "student_profiles" USING btree ("is_active");