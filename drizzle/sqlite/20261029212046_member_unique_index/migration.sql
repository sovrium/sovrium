DROP INDEX IF EXISTS `member_organizationId_idx`;--> statement-breakpoint
-- Collapse duplicate memberships before the unique index can exist: keep the
-- oldest row per (organization_id, user_id), the lowest id breaking a tie.
DELETE FROM `auth_member` WHERE `id` IN (SELECT `id` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `organization_id`, `user_id` ORDER BY `created_at`, `id`) AS `rank` FROM `auth_member`) AS `ranked` WHERE `rank` > 1);--> statement-breakpoint
CREATE UNIQUE INDEX `member_organizationId_userId_uidx` ON `auth_member` (`organization_id`,`user_id`);