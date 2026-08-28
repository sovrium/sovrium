CREATE TABLE `system_design_system_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`app_name` text DEFAULT 'default' NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `design_system_shares_token_hash_unique` ON `system_design_system_shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `design_system_shares_app_revoked_idx` ON `system_design_system_shares` (`app_name`,`revoked_at`);