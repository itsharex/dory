ALTER TABLE "query_result_set" ADD COLUMN "stats" jsonb;--> statement-breakpoint
ALTER TABLE "query_result_set" ADD COLUMN "view_state" jsonb;--> statement-breakpoint
ALTER TABLE "query_result_set" ADD COLUMN "ai_profile_version" integer DEFAULT 1 NOT NULL;