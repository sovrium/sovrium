CREATE TABLE `system_email_messages` (
	`id` text PRIMARY KEY,
	`message_id` text,
	`category` text,
	`campaign` text,
	`sent_at` integer NOT NULL,
	`opened_at` integer,
	`bounced_at` integer,
	`complained_at` integer,
	`unsubscribed_at` integer
);
--> statement-breakpoint
CREATE TABLE `system_email_suppressions` (
	`id` text PRIMARY KEY,
	`address` text NOT NULL,
	`category` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_messages_campaign_idx` ON `system_email_messages` (`campaign`);--> statement-breakpoint
CREATE INDEX `email_messages_message_id_idx` ON `system_email_messages` (`message_id`);--> statement-breakpoint
CREATE INDEX `email_suppressions_address_idx` ON `system_email_suppressions` (`address`);