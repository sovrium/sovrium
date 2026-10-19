CREATE TABLE "system"."calendar_feed_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"table_name" text NOT NULL,
	"token_digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_tokens_user_table_unique" ON "system"."calendar_feed_tokens" ("user_id","table_name");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_tokens_digest_unique" ON "system"."calendar_feed_tokens" ("token_digest");--> statement-breakpoint
ALTER TABLE "system"."calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;