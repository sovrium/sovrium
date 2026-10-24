CREATE TABLE `system_account_baselines` (
	`user_id` text PRIMARY KEY,
	`email` text NOT NULL,
	`snapshot` text NOT NULL,
	`recorded_at` integer NOT NULL,
	CONSTRAINT `fk_system_account_baselines_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
