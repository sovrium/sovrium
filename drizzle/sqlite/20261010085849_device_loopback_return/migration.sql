ALTER TABLE `auth_device_code` ADD `redirect_uri` text;--> statement-breakpoint
ALTER TABLE `auth_device_code` ADD `device_name` text;--> statement-breakpoint
ALTER TABLE `auth_device_code` ADD `return_code_hash` text;--> statement-breakpoint
ALTER TABLE `auth_device_code` ADD `requested_at` integer;