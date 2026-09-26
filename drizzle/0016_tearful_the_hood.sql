CREATE TABLE "org_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"invited_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "org_invites_role_check" CHECK ("org_invites"."role" = ANY (ARRAY['admin', 'teacher', 'student'])),
	CONSTRAINT "org_invites_status_check" CHECK ("org_invites"."status" = ANY (ARRAY['pending', 'accepted', 'declined', 'revoked']))
);
--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_invites_org_id_idx" ON "org_invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_invites_email_idx" ON "org_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invites_pending_key" ON "org_invites" USING btree ("org_id","email") WHERE "org_invites"."status" = 'pending';--> statement-breakpoint
-- Like every table: RLS on with no policies (see 0002_postgrest_lockdown.sql).
ALTER TABLE "org_invites" ENABLE ROW LEVEL SECURITY;
