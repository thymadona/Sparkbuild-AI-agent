-- D1: organizations. Every tenant is an org — SparkBuild Direct (B2C) and,
-- later, each school. This creates the table, seeds Direct with the fixed id
-- lib/db/schemas/organizations.ts exports (DIRECT_ORG_ID), and files every
-- existing user, class, invoice, receipt and role grant under it.
--
-- Hand-edited from the drizzle-kit output (same final schema as the 0014
-- snapshot): the seed and backfills are added, and the (id, org_id) unique key
-- on users moves ahead of the composite FKs that reference it. The migrator
-- runs this in one transaction, so a failure leaves nothing half-applied.

CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_status_check" CHECK ("organizations"."status" = ANY (ARRAY['active', 'suspended'])),
	CONSTRAINT "organizations_slug_check" CHECK ("organizations"."slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "organizations" ("id", "name", "slug")
VALUES ('00000000-0000-4000-8000-000000000001', 'SparkBuild Direct', 'app')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- users keeps its default: new sign-ins land in Direct until D2 picks the org
-- from the host. Adding the column with a default fills every existing row.
ALTER TABLE "users" ADD COLUMN "org_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint

-- The other tables get a temporary default only to backfill existing rows;
-- from now on every insert names its org.
ALTER TABLE "classes" ADD COLUMN "org_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "org_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "org_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "org_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "org_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "org_id" DROP DEFAULT;--> statement-breakpoint

-- Nullable: NULL is reserved for the org-less platform role (D1 group 2).
-- Every existing grant — admin, teacher, student — becomes a Direct grant.
ALTER TABLE "user_roles" ADD COLUMN "org_id" uuid;--> statement-breakpoint
UPDATE "user_roles" SET "org_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_id_org_id_key" UNIQUE("id","org_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_org_id_fk" FOREIGN KEY ("user_id","org_id") REFERENCES "public"."users"("id","org_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_org_id_fk" FOREIGN KEY ("user_id","org_id") REFERENCES "public"."users"("id","org_id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_org_id_fk" FOREIGN KEY ("user_id","org_id") REFERENCES "public"."users"("id","org_id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "users_org_id_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "classes_org_id_idx" ON "classes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invoices_org_id_idx" ON "invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "receipts_org_id_idx" ON "receipts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "user_roles_org_id_idx" ON "user_roles" USING btree ("org_id");
