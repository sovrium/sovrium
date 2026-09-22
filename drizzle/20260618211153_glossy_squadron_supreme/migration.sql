ALTER TABLE "audit_log" ADD COLUMN "transport" text DEFAULT 'api' NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_transport_idx" ON "audit_log" USING btree ("transport");