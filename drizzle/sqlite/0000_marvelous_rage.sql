CREATE TABLE `auth_account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `auth_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`inviter_id` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `auth_organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `auth_invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `auth_invitation` (`email`);--> statement-breakpoint
CREATE TABLE `auth_jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `auth_member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `auth_organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `auth_member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `auth_member` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_oauth_access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`refresh_id` text,
	`user_id` text,
	`reference_id` text,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `auth_session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`refresh_id`) REFERENCES `auth_oauth_refresh_token`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `oauthAccessToken_clientId_idx` ON `auth_oauth_access_token` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_sessionId_idx` ON `auth_oauth_access_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_refreshId_idx` ON `auth_oauth_access_token` (`refresh_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_userId_idx` ON `auth_oauth_access_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_token_idx` ON `auth_oauth_access_token` (`token`);--> statement-breakpoint
CREATE TABLE `auth_oauth_client` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`disabled` integer,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`user_id` text,
	`reference_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`token_endpoint_auth_method` text,
	`grant_types` text,
	`response_types` text,
	`public` integer,
	`type` text,
	`require_pkce` integer,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthClient_clientId_idx` ON `auth_oauth_client` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthClient_userId_idx` ON `auth_oauth_client` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_oauth_consent` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`reference_id` text,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthConsent_userId_idx` ON `auth_oauth_consent` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthConsent_clientId_idx` ON `auth_oauth_consent` (`client_id`);--> statement-breakpoint
CREATE TABLE `auth_oauth_refresh_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text NOT NULL,
	`reference_id` text,
	`scopes` text NOT NULL,
	`revoked` integer,
	`auth_time` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `auth_session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_clientId_idx` ON `auth_oauth_refresh_token` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_sessionId_idx` ON `auth_oauth_refresh_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_userId_idx` ON `auth_oauth_refresh_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_token_idx` ON `auth_oauth_refresh_token` (`token`);--> statement-breakpoint
CREATE TABLE `auth_organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_organization_slug_unique` ON `auth_organization` (`slug`);--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_session_token_unique` ON `auth_session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_team_member` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `auth_team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teamMember_teamId_idx` ON `auth_team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `teamMember_userId_idx` ON `auth_team_member` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `auth_organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_organizationId_idx` ON `auth_team` (`organization_id`);--> statement-breakpoint
CREATE TABLE `auth_two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twoFactor_secret_idx` ON `auth_two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `twoFactor_userId_idx` ON `auth_two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`two_factor_enabled` integer DEFAULT false,
	`scheduledErasureAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_user_email_unique` ON `auth_user` (`email`);--> statement-breakpoint
CREATE TABLE `auth_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `auth_verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `system_activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`user_id` text,
	`session_id` text,
	`action` text NOT NULL,
	`table_name` text NOT NULL,
	`table_id` text,
	`record_id` text NOT NULL,
	`changes` text,
	`ip_address` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `system_activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_user_created_at_idx` ON `system_activity_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_table_record_idx` ON `system_activity_logs` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_action_idx` ON `system_activity_logs` (`action`);--> statement-breakpoint
CREATE TABLE `system_sovrium_app_drafts` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`snapshot` text NOT NULL,
	`base_version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by_user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_sovrium_app_versions` (
	`version_number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`restored_from_version` integer
);
--> statement-breakpoint
CREATE TABLE `system_sovrium_bootstrap_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_sovrium_preview_sessions` (
	`preview_id` text PRIMARY KEY NOT NULL,
	`port` integer NOT NULL,
	`draft_snapshot` text NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'starting' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_ai_activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`target_table` text,
	`user_email` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_activity_logs_action_idx` ON `system_ai_activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `ai_activity_logs_actorType_idx` ON `system_ai_activity_logs` (`actor_type`);--> statement-breakpoint
CREATE INDEX `ai_activity_logs_createdAt_idx` ON `system_ai_activity_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_id` text,
	`session_id` text,
	`agent_name` text,
	`title` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_conversations_userId_idx` ON `system_ai_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_conversations_createdAt_idx` ON `system_ai_conversations` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_conversations_sessionId_idx` ON `system_ai_conversations` (`session_id`);--> statement-breakpoint
CREATE INDEX `ai_conversations_agentName_idx` ON `system_ai_conversations` (`agent_name`);--> statement-breakpoint
CREATE TABLE `system_ai_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`agent_name` text,
	`source_ref` text,
	`chunk_index` integer DEFAULT 0 NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_embeddings_source_idx` ON `system_ai_embeddings` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `ai_embeddings_agentName_idx` ON `system_ai_embeddings` (`agent_name`);--> statement-breakpoint
CREATE INDEX `ai_embeddings_sourceRef_idx` ON `system_ai_embeddings` (`source_ref`);--> statement-breakpoint
CREATE TABLE `system_ai_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`agent_name` text NOT NULL,
	`user_id` text NOT NULL,
	`fact` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_facts_namespace_idx` ON `system_ai_facts` (`namespace`);--> statement-breakpoint
CREATE INDEX `ai_facts_agentName_idx` ON `system_ai_facts` (`agent_name`);--> statement-breakpoint
CREATE INDEX `ai_facts_userId_idx` ON `system_ai_facts` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_facts_createdAt_idx` ON `system_ai_facts` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_ai_field_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`field_name` text NOT NULL,
	`input_hash` text NOT NULL,
	`result` text NOT NULL,
	`model` text,
	`token_count` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_field_cache_table_record_field_idx` ON `system_ai_field_cache` (`table_name`,`record_id`,`field_name`);--> statement-breakpoint
CREATE INDEX `ai_field_cache_inputHash_idx` ON `system_ai_field_cache` (`input_hash`);--> statement-breakpoint
CREATE TABLE `system_ai_knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_synced_at` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_knowledge_sources_type_idx` ON `system_ai_knowledge_sources` (`type`);--> statement-breakpoint
CREATE TABLE `system_ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`tool_calls` text,
	`token_count` integer,
	`model` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `system_ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_messages_conversationId_idx` ON `system_ai_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `ai_messages_createdAt_idx` ON `system_ai_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_ai_tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_name` text NOT NULL,
	`caller_type` text NOT NULL,
	`caller_id` text NOT NULL,
	`caller_role` text NOT NULL,
	`input` text,
	`output` text,
	`error_message` text,
	`error_code` integer,
	`latency_ms` integer NOT NULL,
	`transport` text NOT NULL,
	`session_id` text,
	`request_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_tool_calls_toolName_idx` ON `system_ai_tool_calls` (`tool_name`);--> statement-breakpoint
CREATE INDEX `ai_tool_calls_callerId_idx` ON `system_ai_tool_calls` (`caller_id`);--> statement-breakpoint
CREATE INDEX `ai_tool_calls_callerRole_idx` ON `system_ai_tool_calls` (`caller_role`);--> statement-breakpoint
CREATE INDEX `ai_tool_calls_createdAt_idx` ON `system_ai_tool_calls` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_tool_calls_sessionId_idx` ON `system_ai_tool_calls` (`session_id`);--> statement-breakpoint
CREATE INDEX `ai_tool_calls_errorCode_idx` ON `system_ai_tool_calls` (`error_code`);--> statement-breakpoint
CREATE TABLE `system_analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`app_name` text DEFAULT 'default' NOT NULL,
	`event_type` text NOT NULL,
	`event_name` text,
	`org_id` text,
	`visitor_hash` text NOT NULL,
	`session_hash` text NOT NULL,
	`timestamp` integer NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_app_type_ts_idx` ON `system_analytics_events` (`app_name`,`event_type`,`timestamp`);--> statement-breakpoint
CREATE INDEX `analytics_events_app_visitor_idx` ON `system_analytics_events` (`app_name`,`visitor_hash`);--> statement-breakpoint
CREATE INDEX `analytics_events_app_session_idx` ON `system_analytics_events` (`app_name`,`session_hash`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor_id` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_id_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_automation_approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`step_index` integer NOT NULL,
	`requested_by_id` text,
	`approved_by_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text,
	`agent_name` text,
	`action_payload` text,
	`action_executed` integer DEFAULT false NOT NULL,
	`executed_as` text,
	`timeout_seconds` integer,
	`escalated` integer DEFAULT false NOT NULL,
	`escalated_to` text,
	`expires_at` integer,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `system_automation_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approved_by_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `automation_approval_requests_runId_idx` ON `system_automation_approval_requests` (`run_id`);--> statement-breakpoint
CREATE INDEX `automation_approval_requests_status_idx` ON `system_automation_approval_requests` (`status`);--> statement-breakpoint
CREATE INDEX `automation_approval_requests_agentName_idx` ON `system_automation_approval_requests` (`agent_name`);--> statement-breakpoint
CREATE TABLE `system_automation_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`label` text,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`trigger` text NOT NULL,
	`actions` text NOT NULL,
	`retry` text,
	`timeout` integer,
	`tags` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `automation_definitions_name_idx` ON `system_automation_definitions` (`name`);--> statement-breakpoint
CREATE TABLE `system_automation_delayed_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_index` integer NOT NULL,
	`resume_at` integer NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `system_automation_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_delayed_steps_resumeAt_idx` ON `system_automation_delayed_steps` (`resume_at`);--> statement-breakpoint
CREATE TABLE `system_automation_run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`action_name` text NOT NULL,
	`step_index` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text,
	`output` text,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`error` text,
	FOREIGN KEY (`run_id`) REFERENCES `system_automation_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_run_steps_runId_idx` ON `system_automation_run_steps` (`run_id`);--> statement-breakpoint
CREATE TABLE `system_automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`trigger_data` text,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `system_automation_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_runs_automationId_idx` ON `system_automation_runs` (`automation_id`);--> statement-breakpoint
CREATE INDEX `automation_runs_status_idx` ON `system_automation_runs` (`status`);--> statement-breakpoint
CREATE INDEX `automation_runs_createdAt_idx` ON `system_automation_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_automation_scheduled_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`cron_expression` text NOT NULL,
	`next_run_at` integer NOT NULL,
	`last_run_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `system_automation_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_automation_scheduled_jobs_automation_id_unique` ON `system_automation_scheduled_jobs` (`automation_id`);--> statement-breakpoint
CREATE INDEX `automation_scheduled_jobs_nextRunAt_idx` ON `system_automation_scheduled_jobs` (`next_run_at`);--> statement-breakpoint
CREATE TABLE `system_automation_digest_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`digest_key` text NOT NULL,
	`status` text DEFAULT 'collecting' NOT NULL,
	`released_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `system_automation_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_digest_buckets_automation_key_idx` ON `system_automation_digest_buckets` (`automation_id`,`digest_key`);--> statement-breakpoint
CREATE INDEX `automation_digest_buckets_status_idx` ON `system_automation_digest_buckets` (`status`);--> statement-breakpoint
CREATE TABLE `system_automation_digest_items` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` text NOT NULL,
	`item` text NOT NULL,
	`dedupe_key` text,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `system_automation_digest_buckets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_digest_items_bucketId_idx` ON `system_automation_digest_items` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `automation_digest_items_dedupeKey_idx` ON `system_automation_digest_items` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `system_automation_state` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`ttl` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `system_automation_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_state_automation_key_idx` ON `system_automation_state` (`automation_id`,`key`);--> statement-breakpoint
CREATE INDEX `automation_state_ttl_idx` ON `system_automation_state` (`ttl`);--> statement-breakpoint
CREATE TABLE `system_connection_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `system_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connection_tokens_connectionId_idx` ON `system_connection_tokens` (`connection_id`);--> statement-breakpoint
CREATE INDEX `connection_tokens_userId_idx` ON `system_connection_tokens` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connection_tokens_connection_user_unique` ON `system_connection_tokens` (`connection_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `system_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`credentials` text NOT NULL,
	`metadata` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `connections_provider_idx` ON `system_connections` (`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `connections_name_unique` ON `system_connections` (`name`);--> statement-breakpoint
CREATE TABLE `system_user_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`table_id` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_favorites_user_entity_idx` ON `system_user_favorites` (`user_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `user_favorites_deletedAt_idx` ON `system_user_favorites` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `system_user_recent_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`table_id` text,
	`viewed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_recent_items_user_viewedAt_idx` ON `system_user_recent_items` (`user_id`,`viewed_at`);--> statement-breakpoint
CREATE TABLE `system_form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_name` text,
	`share_token` text,
	`table_name` text,
	`submitted_data` text,
	`form_name` text,
	`form_id` integer,
	`status` text,
	`status_reason` text,
	`data` text,
	`submitter_user_id` text,
	`submitter_ip_hash` text,
	`user_agent` text,
	`linked_record_table` text,
	`linked_record_id` text,
	`guest_email` text,
	`ip_address` text,
	`submitted_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `form_submissions_shareToken_idx` ON `system_form_submissions` (`share_token`);--> statement-breakpoint
CREATE INDEX `form_submissions_ip_submitted_idx` ON `system_form_submissions` (`ip_address`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `form_submissions_deletedAt_idx` ON `system_form_submissions` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `form_submissions_formName_submitted_idx` ON `system_form_submissions` (`form_name`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `system_migration_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` integer NOT NULL,
	`checksum` text NOT NULL,
	`schema` text,
	`applied_at` integer,
	`rolled_back_at` integer
);
--> statement-breakpoint
CREATE TABLE `system_migration_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation` text NOT NULL,
	`from_version` integer,
	`to_version` integer,
	`reason` text,
	`status` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `system_schema_checksum` (
	`id` text PRIMARY KEY NOT NULL,
	`checksum` text NOT NULL,
	`schema` text NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `system_notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`channels` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_preferences_userId_eventType_idx` ON `system_notification_preferences` (`user_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `system_notification_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text,
	`fields` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_subscriptions_userId_idx` ON `system_notification_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_subscriptions_table_record_idx` ON `system_notification_subscriptions` (`table_name`,`record_id`);--> statement-breakpoint
CREATE TABLE `system_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`data` text,
	`read` integer DEFAULT false NOT NULL,
	`dismissed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_userId_idx` ON `system_notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_userId_read_idx` ON `system_notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `notifications_createdAt_idx` ON `system_notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `system_record_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`table_id` text NOT NULL,
	`user_id` text,
	`guest_name` text,
	`guest_email` text,
	`content` text NOT NULL,
	`parent_id` text,
	`status` text DEFAULT 'approved' NOT NULL,
	`moderated_at` integer,
	`moderated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moderated_by`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `record_comments_record_created_idx` ON `system_record_comments` (`table_id`,`record_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `record_comments_user_created_idx` ON `system_record_comments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `record_comments_deleted_at_idx` ON `system_record_comments` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `record_comments_parentId_idx` ON `system_record_comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `record_comments_status_idx` ON `system_record_comments` (`status`);--> statement-breakpoint
CREATE TABLE `system_search_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`raw_content` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_index_table` ON `system_search_index` (`table_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_table_record_unique` ON `system_search_index` (`table_name`,`record_id`);--> statement-breakpoint
CREATE TABLE `system_search_indexes` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`field_name` text NOT NULL,
	`index_type` text NOT NULL,
	`index_name` text NOT NULL,
	`last_reindexed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_indexes_table_field_idx` ON `system_search_indexes` (`table_name`,`field_name`);--> statement-breakpoint
CREATE TABLE `system_share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`page_name` text NOT NULL,
	`token` text NOT NULL,
	`password_hash` text,
	`expires_at` integer,
	`embed_allowed` integer DEFAULT true NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`last_accessed_at` integer,
	FOREIGN KEY (`created_by_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_share_links_token_unique` ON `system_share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_pageName_idx` ON `system_share_links` (`page_name`);--> statement-breakpoint
CREATE INDEX `share_links_createdById_idx` ON `system_share_links` (`created_by_id`);--> statement-breakpoint
CREATE TABLE `system_file_storage_bytea` (
	`id` text PRIMARY KEY NOT NULL,
	`metadata_id` text NOT NULL,
	`content` blob NOT NULL,
	FOREIGN KEY (`metadata_id`) REFERENCES `system_file_storage_metadata`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_file_storage_bytea_metadata_id_unique` ON `system_file_storage_bytea` (`metadata_id`);--> statement-breakpoint
CREATE TABLE `system_file_storage_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_provider` text NOT NULL,
	`storage_path` text,
	`uploaded_by_id` text,
	`table_name` text,
	`record_id` text,
	`field_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_file_storage_metadata_key_unique` ON `system_file_storage_metadata` (`key`);--> statement-breakpoint
CREATE INDEX `file_storage_metadata_key_idx` ON `system_file_storage_metadata` (`key`);--> statement-breakpoint
CREATE INDEX `file_storage_metadata_table_record_idx` ON `system_file_storage_metadata` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `file_storage_metadata_uploadedById_idx` ON `system_file_storage_metadata` (`uploaded_by_id`);--> statement-breakpoint
CREATE TABLE `system_user_access` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`table_slug` text NOT NULL,
	`record_ids` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `system_webhook_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`secret` text,
	`events` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`table_name` text,
	`headers` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhook_configs_tableName_idx` ON `system_webhook_configs` (`table_name`);--> statement-breakpoint
CREATE TABLE `system_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`response_status` integer,
	`response_body` text,
	`error` text,
	`delivered_at` integer,
	`next_retry_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `system_webhook_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhookId_idx` ON `system_webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_idx` ON `system_webhook_deliveries` (`status`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_createdAt_idx` ON `system_webhook_deliveries` (`created_at`);