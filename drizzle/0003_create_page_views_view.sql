CREATE VIEW "system"."page_views" AS
SELECT
	"id",
	"timestamp" AS "created_at",
	"app_name",
	"page_path",
	"page_title",
	"visitor_hash",
	"session_hash",
	"is_entrance",
	"referrer_url",
	"referrer_domain",
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_content",
	"utm_term",
	"device_type",
	"browser_name",
	"os_name",
	"language",
	"screen_width",
	"screen_height"
FROM "system"."analytics_page_views";
