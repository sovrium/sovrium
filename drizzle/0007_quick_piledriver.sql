CREATE TABLE "system"."automation_pauses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_name" text NOT NULL,
	"paused_by_user_id" text,
	"paused_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_pauses_automation_name_unique" UNIQUE("automation_name")
);
--> statement-breakpoint
ALTER TABLE "system"."automation_pauses" ADD CONSTRAINT "automation_pauses_paused_by_user_id_user_id_fk" FOREIGN KEY ("paused_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_pauses_automationName_idx" ON "system"."automation_pauses" USING btree ("automation_name");