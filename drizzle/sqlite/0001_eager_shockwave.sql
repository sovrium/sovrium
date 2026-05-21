ALTER TABLE `system_sovrium_app_versions` ADD `source` text DEFAULT 'config-file' NOT NULL;--> statement-breakpoint
ALTER TABLE `system_sovrium_app_versions` ADD `file_checksum` text;