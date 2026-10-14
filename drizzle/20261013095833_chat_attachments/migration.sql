CREATE TABLE "system"."ai_chat_attachments" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"session_id" text,
	"bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_chat_attachments_userId_idx" ON "system"."ai_chat_attachments" ("user_id");--> statement-breakpoint
CREATE INDEX "ai_chat_attachments_sessionId_idx" ON "system"."ai_chat_attachments" ("user_id","session_id");--> statement-breakpoint
ALTER TABLE "system"."ai_chat_attachments" ADD CONSTRAINT "ai_chat_attachments_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;