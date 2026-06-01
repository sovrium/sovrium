CREATE TABLE "system"."user_saved_views" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"table_name" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."user_table_preferences" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"table_name" text NOT NULL,
	"column_widths" jsonb,
	"column_order" jsonb,
	"row_density" text,
	"default_view_id" text,
	"frozen_columns" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system"."user_saved_views" ADD CONSTRAINT "user_saved_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system"."user_table_preferences" ADD CONSTRAINT "user_table_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_saved_views_user_table_name_idx" ON "system"."user_saved_views" USING btree ("user_id","table_name","name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_table_preferences_user_table_idx" ON "system"."user_table_preferences" USING btree ("user_id","table_name");