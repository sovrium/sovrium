ALTER TABLE "system"."activity_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "system"."activity_logs" ALTER COLUMN "table_id" DROP NOT NULL;