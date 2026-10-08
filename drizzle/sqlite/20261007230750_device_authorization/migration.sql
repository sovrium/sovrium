CREATE TABLE `auth_device_code` (
	`id` text PRIMARY KEY,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text,
	CONSTRAINT `fk_auth_device_code_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deviceCode_deviceCode_uidx` ON `auth_device_code` (`device_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `deviceCode_userCode_uidx` ON `auth_device_code` (`user_code`);--> statement-breakpoint
CREATE INDEX `deviceCode_userId_idx` ON `auth_device_code` (`user_id`);