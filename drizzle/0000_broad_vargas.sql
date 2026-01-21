CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "system";
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."migration_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"checksum" text NOT NULL,
	"schema" jsonb,
	"applied_at" timestamp DEFAULT now(),
	"rolled_back_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system"."migration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"from_version" integer,
	"to_version" integer,
	"reason" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system"."schema_checksum" (
	"id" text PRIMARY KEY NOT NULL,
	"checksum" text NOT NULL,
	"schema" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system"."activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"session_id" text,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"table_id" text NOT NULL,
	"record_id" text NOT NULL,
	"changes" jsonb,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "system"."record_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"table_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."record_comments" ADD CONSTRAINT "record_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "auth"."two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "auth"."two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "system"."activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_created_at_idx" ON "system"."activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_table_record_idx" ON "system"."activity_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "system"."activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "record_comments_record_created_idx" ON "system"."record_comments" USING btree ("table_id","record_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_user_created_idx" ON "system"."record_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_deleted_at_idx" ON "system"."record_comments" USING btree ("deleted_at");