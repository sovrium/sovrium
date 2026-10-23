CREATE TABLE "system"."notification_preferences" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"in_app" boolean NOT NULL,
	"email" boolean NOT NULL,
	"digest" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"recipient_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"source_table" text,
	"source_record_id" text,
	"in_app" boolean DEFAULT true NOT NULL,
	"digest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_kind_unique" ON "system"."notification_preferences" ("user_id","kind");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "system"."notifications" ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "system"."notifications" ("read_at");--> statement-breakpoint
ALTER TABLE "system"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system"."notifications" ADD CONSTRAINT "notifications_recipient_id_user_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;