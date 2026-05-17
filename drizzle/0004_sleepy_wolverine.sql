ALTER TABLE "auth"."oauth_access_token" DROP CONSTRAINT "oauth_access_token_client_id_oauth_client_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" DROP CONSTRAINT "oauth_refresh_token_client_id_oauth_client_id_fk";
