CREATE TABLE `system_calendar_feed_tokens` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`table_name` text NOT NULL,
	`token_digest` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_system_calendar_feed_tokens_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_tokens_user_table_unique` ON `system_calendar_feed_tokens` (`user_id`,`table_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_tokens_digest_unique` ON `system_calendar_feed_tokens` (`token_digest`);