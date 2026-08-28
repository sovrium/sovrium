CREATE TABLE "system"."_admin_search_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"content_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_search_type_entity_unique" UNIQUE("type","entity_id")
);
--> statement-breakpoint
CREATE INDEX "idx_admin_search_tsv" ON "system"."_admin_search_index" USING gin ("content_tsv");--> statement-breakpoint
CREATE INDEX "idx_admin_search_type" ON "system"."_admin_search_index" USING btree ("type");