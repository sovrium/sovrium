CREATE SCHEMA IF NOT EXISTS "auth";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "system";
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
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviter_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
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
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true
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
CREATE TABLE "system"."activity_logs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"session_id" text,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"table_id" text,
	"record_id" text NOT NULL,
	"changes" jsonb,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "system"."ai_conversations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text,
	"session_id" text,
	"agent_name" text,
	"title" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."ai_embeddings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"agent_name" text,
	"source_ref" text,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."ai_field_cache" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"field_name" text NOT NULL,
	"input_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"model" text,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system"."ai_knowledge_sources" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."ai_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"token_count" integer,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."analytics_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" text DEFAULT 'default' NOT NULL,
	"event_type" text NOT NULL,
	"event_name" text,
	"org_id" text,
	"visitor_hash" text NOT NULL,
	"session_hash" text DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_approval_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"requested_by_id" text,
	"approved_by_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"expires_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_definitions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"label" text,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"retry" jsonb,
	"timeout" integer,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_delayed_steps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"resume_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_run_steps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"action_name" text NOT NULL,
	"step_index" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "system"."automation_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_data" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_scheduled_jobs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" text NOT NULL,
	"cron_expression" text NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "automation_scheduled_jobs_automation_id_unique" UNIQUE("automation_id")
);
--> statement-breakpoint
CREATE TABLE "system"."automation_digest_buckets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" text NOT NULL,
	"digest_key" text NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_digest_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_id" text NOT NULL,
	"item" jsonb NOT NULL,
	"dedupe_key" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."automation_state" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"ttl" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."connection_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."connections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"credentials" jsonb NOT NULL,
	"metadata" jsonb,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."user_favorites" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"table_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system"."user_recent_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"table_id" text,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."form_submissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_name" text,
	"share_token" text,
	"table_name" text,
	"submitted_data" jsonb,
	"form_name" text,
	"form_id" integer,
	"status" text,
	"status_reason" text,
	"data" jsonb,
	"submitter_user_id" text,
	"submitter_ip_hash" text,
	"user_agent" text,
	"linked_record_table" text,
	"linked_record_id" text,
	"guest_email" text,
	"ip_address" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
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
CREATE TABLE "system"."notification_preferences" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"channels" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."notification_subscriptions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text,
	"fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."record_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"table_id" text NOT NULL,
	"user_id" text,
	"guest_name" text,
	"guest_email" text,
	"content" text NOT NULL,
	"parent_id" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"moderated_at" timestamp with time zone,
	"moderated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system"."search_indexes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"field_name" text NOT NULL,
	"index_type" text NOT NULL,
	"index_name" text NOT NULL,
	"last_reindexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."share_links" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_name" text NOT NULL,
	"token" text NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"embed_allowed" boolean DEFAULT true NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system"."file_storage_bytea" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata_id" text NOT NULL,
	"content" "bytea" NOT NULL,
	CONSTRAINT "file_storage_bytea_metadata_id_unique" UNIQUE("metadata_id")
);
--> statement-breakpoint
CREATE TABLE "system"."file_storage_metadata" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_path" text,
	"uploaded_by_id" text,
	"table_name" text,
	"record_id" text,
	"field_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_storage_metadata_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "system"."user_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"table_slug" text NOT NULL,
	"record_ids" text[] NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "system"."webhook_configs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"table_name" text,
	"headers" jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."webhook_deliveries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"response_body" text,
	"error" text,
	"delivered_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "system"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_approval_requests" ADD CONSTRAINT "automation_approval_requests_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "system"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_approval_requests" ADD CONSTRAINT "automation_approval_requests_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_approval_requests" ADD CONSTRAINT "automation_approval_requests_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_delayed_steps" ADD CONSTRAINT "automation_delayed_steps_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "system"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_run_steps" ADD CONSTRAINT "automation_run_steps_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "system"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automation_definitions_id_fk" FOREIGN KEY ("automation_id") REFERENCES "system"."automation_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_scheduled_jobs" ADD CONSTRAINT "automation_scheduled_jobs_automation_id_automation_definitions_id_fk" FOREIGN KEY ("automation_id") REFERENCES "system"."automation_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_digest_buckets" ADD CONSTRAINT "automation_digest_buckets_automation_id_automation_definitions_id_fk" FOREIGN KEY ("automation_id") REFERENCES "system"."automation_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_digest_items" ADD CONSTRAINT "automation_digest_items_bucket_id_automation_digest_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "system"."automation_digest_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."automation_state" ADD CONSTRAINT "automation_state_automation_id_automation_definitions_id_fk" FOREIGN KEY ("automation_id") REFERENCES "system"."automation_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."connection_tokens" ADD CONSTRAINT "connection_tokens_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "system"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."connection_tokens" ADD CONSTRAINT "connection_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."connections" ADD CONSTRAINT "connections_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."user_favorites" ADD CONSTRAINT "user_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."user_recent_items" ADD CONSTRAINT "user_recent_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."record_comments" ADD CONSTRAINT "record_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."record_comments" ADD CONSTRAINT "record_comments_moderated_by_user_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."share_links" ADD CONSTRAINT "share_links_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."file_storage_bytea" ADD CONSTRAINT "file_storage_bytea_metadata_id_file_storage_metadata_id_fk" FOREIGN KEY ("metadata_id") REFERENCES "system"."file_storage_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."file_storage_metadata" ADD CONSTRAINT "file_storage_metadata_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "system"."webhook_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "auth"."invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "auth"."member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "auth"."member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teamMember_teamId_idx" ON "auth"."team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teamMember_userId_idx" ON "auth"."team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_organizationId_idx" ON "auth"."team" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "auth"."two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "auth"."two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "system"."activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_created_at_idx" ON "system"."activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_table_record_idx" ON "system"."activity_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "system"."activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ai_conversations_userId_idx" ON "system"."ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_createdAt_idx" ON "system"."ai_conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_conversations_sessionId_idx" ON "system"."ai_conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_agentName_idx" ON "system"."ai_conversations" USING btree ("agent_name");--> statement-breakpoint
CREATE INDEX "ai_embeddings_source_idx" ON "system"."ai_embeddings" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ai_embeddings_agentName_idx" ON "system"."ai_embeddings" USING btree ("agent_name");--> statement-breakpoint
CREATE INDEX "ai_embeddings_sourceRef_idx" ON "system"."ai_embeddings" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "ai_field_cache_table_record_field_idx" ON "system"."ai_field_cache" USING btree ("table_name","record_id","field_name");--> statement-breakpoint
CREATE INDEX "ai_field_cache_inputHash_idx" ON "system"."ai_field_cache" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "ai_knowledge_sources_type_idx" ON "system"."ai_knowledge_sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_messages_conversationId_idx" ON "system"."ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_messages_createdAt_idx" ON "system"."ai_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_app_type_ts_idx" ON "system"."analytics_events" USING btree ("app_name","event_type","timestamp");--> statement-breakpoint
CREATE INDEX "analytics_events_properties_gin_idx" ON "system"."analytics_events" USING gin ("properties");--> statement-breakpoint
CREATE INDEX "analytics_events_app_visitor_idx" ON "system"."analytics_events" USING btree ("app_name","visitor_hash");--> statement-breakpoint
CREATE INDEX "analytics_events_app_session_idx" ON "system"."analytics_events" USING btree ("app_name","session_hash");--> statement-breakpoint
CREATE INDEX "automation_approval_requests_runId_idx" ON "system"."automation_approval_requests" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "automation_approval_requests_status_idx" ON "system"."automation_approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_definitions_name_idx" ON "system"."automation_definitions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "automation_delayed_steps_resumeAt_idx" ON "system"."automation_delayed_steps" USING btree ("resume_at");--> statement-breakpoint
CREATE INDEX "automation_run_steps_runId_idx" ON "system"."automation_run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "automation_runs_automationId_idx" ON "system"."automation_runs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "automation_runs_status_idx" ON "system"."automation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_runs_createdAt_idx" ON "system"."automation_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automation_scheduled_jobs_nextRunAt_idx" ON "system"."automation_scheduled_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "automation_digest_buckets_automation_key_idx" ON "system"."automation_digest_buckets" USING btree ("automation_id","digest_key");--> statement-breakpoint
CREATE INDEX "automation_digest_buckets_status_idx" ON "system"."automation_digest_buckets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_digest_items_bucketId_idx" ON "system"."automation_digest_items" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "automation_digest_items_dedupeKey_idx" ON "system"."automation_digest_items" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_state_automation_key_idx" ON "system"."automation_state" USING btree ("automation_id","key");--> statement-breakpoint
CREATE INDEX "automation_state_ttl_idx" ON "system"."automation_state" USING btree ("ttl");--> statement-breakpoint
CREATE INDEX "connection_tokens_connectionId_idx" ON "system"."connection_tokens" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "connection_tokens_userId_idx" ON "system"."connection_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connection_tokens_connection_user_unique" ON "system"."connection_tokens" USING btree ("connection_id","user_id");--> statement-breakpoint
CREATE INDEX "connections_provider_idx" ON "system"."connections" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_name_unique" ON "system"."connections" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_favorites_user_entity_idx" ON "system"."user_favorites" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "user_favorites_deletedAt_idx" ON "system"."user_favorites" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_recent_items_user_viewedAt_idx" ON "system"."user_recent_items" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "form_submissions_shareToken_idx" ON "system"."form_submissions" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "form_submissions_ip_submitted_idx" ON "system"."form_submissions" USING btree ("ip_address","submitted_at");--> statement-breakpoint
CREATE INDEX "form_submissions_deletedAt_idx" ON "system"."form_submissions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "form_submissions_formName_submitted_idx" ON "system"."form_submissions" USING btree ("form_name","submitted_at");--> statement-breakpoint
CREATE INDEX "notification_preferences_userId_eventType_idx" ON "system"."notification_preferences" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE INDEX "notification_subscriptions_userId_idx" ON "system"."notification_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_subscriptions_table_record_idx" ON "system"."notification_subscriptions" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "notifications_userId_idx" ON "system"."notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_userId_read_idx" ON "system"."notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notifications_createdAt_idx" ON "system"."notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "record_comments_record_created_idx" ON "system"."record_comments" USING btree ("table_id","record_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_user_created_idx" ON "system"."record_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_deleted_at_idx" ON "system"."record_comments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "record_comments_parentId_idx" ON "system"."record_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "record_comments_status_idx" ON "system"."record_comments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_indexes_table_field_idx" ON "system"."search_indexes" USING btree ("table_name","field_name");--> statement-breakpoint
CREATE INDEX "share_links_pageName_idx" ON "system"."share_links" USING btree ("page_name");--> statement-breakpoint
CREATE INDEX "share_links_createdById_idx" ON "system"."share_links" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "file_storage_metadata_key_idx" ON "system"."file_storage_metadata" USING btree ("key");--> statement-breakpoint
CREATE INDEX "file_storage_metadata_table_record_idx" ON "system"."file_storage_metadata" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "file_storage_metadata_uploadedById_idx" ON "system"."file_storage_metadata" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "webhook_configs_tableName_idx" ON "system"."webhook_configs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhookId_idx" ON "system"."webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "system"."webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_createdAt_idx" ON "system"."webhook_deliveries" USING btree ("created_at");