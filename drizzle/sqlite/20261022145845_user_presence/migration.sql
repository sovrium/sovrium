CREATE TABLE `system_user_presence` (
	`user_id` text PRIMARY KEY,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT `fk_system_user_presence_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
