CREATE TABLE "system"."account_baselines" (
	"user_id" text PRIMARY KEY,
	"email" text NOT NULL,
	"snapshot" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system"."account_baselines" ADD CONSTRAINT "account_baselines_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;