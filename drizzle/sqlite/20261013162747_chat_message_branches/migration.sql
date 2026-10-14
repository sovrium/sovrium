ALTER TABLE `system_ai_messages` ADD `parent_id` text;--> statement-breakpoint
-- Backfill: every message written before branches existed follows the one
-- before it in its conversation, so each existing thread becomes one branch.
-- One window pass over the table: a correlated "latest earlier message"
-- subquery per row is quadratic in a thread's length.
-- Releases before 0.22 stamped a turn's question and answer with the SAME
-- instant, so within one instant the question comes first; the id only breaks
-- what is left.
UPDATE `system_ai_messages` SET `parent_id` = o.`previous_id`
FROM (
	SELECT `id`, LAG(`id`) OVER (
		PARTITION BY `conversation_id`
		ORDER BY `created_at`, CASE WHEN `role` = 'user' THEN 0 ELSE 1 END, `id`
	) AS `previous_id`
	FROM `system_ai_messages`
) AS o
WHERE `system_ai_messages`.`id` = o.`id` AND o.`previous_id` IS NOT NULL;
