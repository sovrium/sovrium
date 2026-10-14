CREATE TABLE `system_ai_chat_attachments` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`session_id` text,
	`bucket` text NOT NULL,
	`storage_key` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_system_ai_chat_attachments_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `ai_chat_attachments_userId_idx` ON `system_ai_chat_attachments` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_chat_attachments_sessionId_idx` ON `system_ai_chat_attachments` (`user_id`,`session_id`);