ALTER TABLE `audit_log` ADD `transport` text DEFAULT 'api' NOT NULL;--> statement-breakpoint
CREATE INDEX `audit_log_transport_idx` ON `audit_log` (`transport`);