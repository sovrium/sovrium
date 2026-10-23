CREATE TABLE "system"."user_presence" (
	"user_id" text PRIMARY KEY,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system"."user_presence" ADD CONSTRAINT "user_presence_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;