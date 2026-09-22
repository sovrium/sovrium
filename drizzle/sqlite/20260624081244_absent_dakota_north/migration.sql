CREATE TABLE `system__admin_search_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`href` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_search_type` ON `system__admin_search_index` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `admin_search_type_entity_unique` ON `system__admin_search_index` (`type`,`entity_id`);