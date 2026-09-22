CREATE TABLE `system_boot_ledger` (
	`id` text PRIMARY KEY,
	`app_name` text DEFAULT 'default' NOT NULL,
	`app_version` text,
	`engine_version` text NOT NULL,
	`prev_engine_version` text,
	`config_hash` text NOT NULL,
	`prev_config_hash` text,
	`booted_at` integer NOT NULL,
	`booted_by` text,
	`summary` text NOT NULL,
	`stats` text NOT NULL,
	`engine_migrations` text NOT NULL,
	`derived_ddl` text NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `boot_ledger_app_booted_at_idx` ON `system_boot_ledger` (`app_name`,`booted_at`);