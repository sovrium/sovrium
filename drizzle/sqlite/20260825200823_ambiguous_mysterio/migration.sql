CREATE TABLE `system_links` (
	`id` text PRIMARY KEY NOT NULL,
	`app_name` text DEFAULT 'default' NOT NULL,
	`slug` text NOT NULL,
	`source` text DEFAULT 'db' NOT NULL,
	`destination` text,
	`targets` text,
	`title` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`enabled` integer DEFAULT true NOT NULL,
	`valid_from` integer,
	`valid_until` integer,
	`max_clicks` integer,
	`expired_to` text,
	`utm` text,
	`password_hash` text,
	`disabled_at` integer,
	`shadowed_at` integer,
	`archived_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_app_slug_unique` ON `system_links` (`app_name`,`slug`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `links_app_archived_idx` ON `system_links` (`app_name`,`archived_at`);--> statement-breakpoint
CREATE INDEX `links_deleted_at_idx` ON `system_links` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_app_type_name_idx` ON `system_analytics_events` (`app_name`,`event_type`,`event_name`);