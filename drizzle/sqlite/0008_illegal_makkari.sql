CREATE TABLE `system_connection_app_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `system_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connection_app_tokens_connection_unique` ON `system_connection_app_tokens` (`connection_id`);