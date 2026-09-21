CREATE TABLE "task_progress" (
	"project_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"code" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"judged_by" text DEFAULT 'tutor' NOT NULL,
	CONSTRAINT "task_progress_project_id_task_id_pk" PRIMARY KEY("project_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "task_progress" ADD CONSTRAINT "task_progress_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress" ENABLE ROW LEVEL SECURITY;
