CREATE TABLE "system"."ai_tool_calls" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" text NOT NULL,
	"caller_type" text NOT NULL,
	"caller_id" text NOT NULL,
	"caller_role" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"error_code" integer,
	"latency_ms" integer NOT NULL,
	"transport" text NOT NULL,
	"session_id" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_tool_calls_toolName_idx" ON "system"."ai_tool_calls" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "ai_tool_calls_callerId_idx" ON "system"."ai_tool_calls" USING btree ("caller_id");--> statement-breakpoint
CREATE INDEX "ai_tool_calls_callerRole_idx" ON "system"."ai_tool_calls" USING btree ("caller_role");--> statement-breakpoint
CREATE INDEX "ai_tool_calls_createdAt_idx" ON "system"."ai_tool_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_tool_calls_sessionId_idx" ON "system"."ai_tool_calls" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_tool_calls_errorCode_idx" ON "system"."ai_tool_calls" USING btree ("error_code");