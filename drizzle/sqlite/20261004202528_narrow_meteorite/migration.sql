CREATE TABLE `system_automation_run_refs` (
	`run_id` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	CONSTRAINT `system_automation_run_refs_pk` PRIMARY KEY(`run_id`, `table_name`, `record_id`),
	CONSTRAINT `fk_system_automation_run_refs_run_id_system_automation_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `system_automation_runs`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `system_automation_runs` ADD `values_erased_at` integer;--> statement-breakpoint
CREATE INDEX `automation_run_refs_record_idx` ON `system_automation_run_refs` (`table_name`,`record_id`);--> statement-breakpoint
INSERT INTO `system_automation_run_refs` (`run_id`, `table_name`, `record_id`) SELECT `id`, '', '' FROM `system_automation_runs`;