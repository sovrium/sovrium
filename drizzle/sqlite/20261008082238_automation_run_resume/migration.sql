ALTER TABLE `system_automation_runs` ADD `resume_at` integer;--> statement-breakpoint
ALTER TABLE `system_automation_runs` ADD `resume_cursor` text;--> statement-breakpoint
CREATE INDEX `automation_runs_status_resumeAt_idx` ON `system_automation_runs` (`status`,`resume_at`);