ALTER TABLE `system_form_submissions` ADD `access_token_hash` text;--> statement-breakpoint
CREATE INDEX `form_submissions_accessTokenHash_idx` ON `system_form_submissions` (`access_token_hash`);