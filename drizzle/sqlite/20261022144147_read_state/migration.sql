CREATE TABLE `system_read_state` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`last_read_at` integer NOT NULL,
	CONSTRAINT `fk_system_read_state_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `read_state_user_record_unique` ON `system_read_state` (`user_id`,`table_name`,`record_id`);