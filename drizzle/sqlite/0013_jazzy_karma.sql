ALTER TABLE `system_file_storage_metadata` ADD `bucket` text;--> statement-breakpoint
CREATE INDEX `file_storage_metadata_bucket_idx` ON `system_file_storage_metadata` (`bucket`);