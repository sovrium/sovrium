CREATE TABLE "auth"."device_code" (
	"id" text PRIMARY KEY,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"last_polled_at" timestamp with time zone,
	"polling_interval" integer,
	"client_id" text,
	"scope" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "deviceCode_deviceCode_uidx" ON "auth"."device_code" ("device_code");--> statement-breakpoint
CREATE UNIQUE INDEX "deviceCode_userCode_uidx" ON "auth"."device_code" ("user_code");--> statement-breakpoint
CREATE INDEX "deviceCode_userId_idx" ON "auth"."device_code" ("user_id");--> statement-breakpoint
ALTER TABLE "auth"."device_code" ADD CONSTRAINT "device_code_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;