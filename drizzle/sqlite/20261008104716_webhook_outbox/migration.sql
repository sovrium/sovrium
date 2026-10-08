CREATE TABLE `system_webhook_outbox` (
	`id` text PRIMARY KEY,
	`table_name` text NOT NULL,
	`webhook_name` text NOT NULL,
	`event` text NOT NULL,
	`record_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`locked_until` integer,
	`last_http_status` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`settled_at` integer
);
--> statement-breakpoint
CREATE TABLE `system_webhook_outbox_subjects` (
	`outbox_id` text NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_system_webhook_outbox_subjects_outbox_id_system_webhook_outbox_id_fk` FOREIGN KEY (`outbox_id`) REFERENCES `system_webhook_outbox`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `webhook_outbox_status_nextAttemptAt_idx` ON `system_webhook_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `webhook_outbox_tableName_recordId_idx` ON `system_webhook_outbox` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `webhook_outbox_subjects_userId_idx` ON `system_webhook_outbox_subjects` (`user_id`);--> statement-breakpoint
CREATE INDEX `webhook_outbox_subjects_outboxId_idx` ON `system_webhook_outbox_subjects` (`outbox_id`);