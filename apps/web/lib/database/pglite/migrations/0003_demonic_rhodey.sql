CREATE TABLE "saved_query_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_queries" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_saved_query_folders_team_user" ON "saved_query_folders" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_queries_folder_id" ON "saved_queries" USING btree ("folder_id");