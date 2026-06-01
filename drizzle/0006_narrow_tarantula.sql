CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"actor_type" text NOT NULL,
	"actor_role" text NOT NULL,
	"actor_email" text,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_name" text,
	"severity" text NOT NULL,
	"result" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_severity_idx" ON "audit_log" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "audit_log_result_idx" ON "audit_log" USING btree ("result");--> statement-breakpoint
CREATE INDEX "audit_log_resource_type_idx" ON "audit_log" USING btree ("resource_type");