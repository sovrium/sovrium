CREATE TABLE `system_admin_digest_snapshots` (
	`id` text PRIMARY KEY,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`sent_at` integer,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`metrics` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_digest_snapshots_period_end_idx` ON `system_admin_digest_snapshots` (`period_end`);