CREATE TABLE "system"."read_state" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "read_state_user_record_unique" ON "system"."read_state" ("user_id","table_name","record_id");--> statement-breakpoint
ALTER TABLE "system"."read_state" ADD CONSTRAINT "read_state_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;