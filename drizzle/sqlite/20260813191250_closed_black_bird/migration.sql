CREATE TABLE `system_automation_pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_name` text NOT NULL,
	`paused_by_user_id` text,
	`paused_at` integer NOT NULL,
	FOREIGN KEY (`paused_by_user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_automation_pauses_automation_name_unique` ON `system_automation_pauses` (`automation_name`);--> statement-breakpoint
CREATE INDEX `automation_pauses_automationName_idx` ON `system_automation_pauses` (`automation_name`);