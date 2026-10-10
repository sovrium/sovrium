CREATE TABLE "system"."browser_sessions" (
	"name" text PRIMARY KEY,
	"jar" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
