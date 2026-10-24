CREATE TABLE "system"."email_messages" (
	"id" text PRIMARY KEY,
	"message_id" text,
	"category" text,
	"campaign" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"complained_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system"."email_suppressions" (
	"id" text PRIMARY KEY,
	"address" text NOT NULL,
	"category" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_messages_campaign_idx" ON "system"."email_messages" ("campaign");--> statement-breakpoint
CREATE INDEX "email_messages_message_id_idx" ON "system"."email_messages" ("message_id");--> statement-breakpoint
CREATE INDEX "email_suppressions_address_idx" ON "system"."email_suppressions" ("address");