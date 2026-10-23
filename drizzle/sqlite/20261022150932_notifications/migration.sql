CREATE TABLE `system_notification_preferences` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`in_app` integer NOT NULL,
	`email` integer NOT NULL,
	`digest` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_system_notification_preferences_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `system_notifications` (
	`id` text PRIMARY KEY,
	`recipient_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`source_table` text,
	`source_record_id` text,
	`in_app` integer DEFAULT true NOT NULL,
	`digest` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	CONSTRAINT `fk_system_notifications_recipient_id_auth_user_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_user_kind_unique` ON `system_notification_preferences` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `system_notifications` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_read_at_idx` ON `system_notifications` (`read_at`);