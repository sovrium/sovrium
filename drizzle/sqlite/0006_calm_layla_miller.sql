CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`action` text NOT NULL,
	`actor_id` text,
	`actor_type` text NOT NULL,
	`actor_role` text NOT NULL,
	`actor_email` text,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`resource_name` text,
	`severity` text NOT NULL,
	`result` text NOT NULL,
	`metadata` text,
	FOREIGN KEY (`actor_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_id_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_severity_idx` ON `audit_log` (`severity`);--> statement-breakpoint
CREATE INDEX `audit_log_result_idx` ON `audit_log` (`result`);--> statement-breakpoint
CREATE INDEX `audit_log_resource_type_idx` ON `audit_log` (`resource_type`);