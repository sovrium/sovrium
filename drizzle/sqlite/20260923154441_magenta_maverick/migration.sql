ALTER TABLE `system_connection_app_tokens` ADD `token_fields` text;--> statement-breakpoint
ALTER TABLE `system_connection_app_tokens` ADD `grant_fingerprint` text;--> statement-breakpoint
ALTER TABLE `system_connection_tokens` ADD `token_fields` text;