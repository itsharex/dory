CREATE TABLE "sync_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"entity_type" text DEFAULT 'connection' NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text NOT NULL,
	"payload" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP INDEX "uniq_conn_identity_default_per_connection";--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "source" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "cloud_id" text;--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "sync_status" text DEFAULT 'local_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "remote_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connection_identities" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "connection_identity_secrets" ADD COLUMN "secret_ref" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "source" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "cloud_id" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "sync_status" text DEFAULT 'local_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "remote_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "sync_error" text;--> statement-breakpoint
CREATE INDEX "idx_sync_operations_team_status" ON "sync_operations" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "idx_sync_operations_entity" ON "sync_operations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_sync_operations_created_at" ON "sync_operations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_conn_identity_cloud_id" ON "connection_identities" USING btree ("cloud_id") WHERE "connection_identities"."cloud_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_conn_identity_created_by_user_id" ON "connection_identities" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_conn_identity_sync_status" ON "connection_identities" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "idx_conn_identity_team_cloud_id" ON "connection_identities" USING btree ("team_id","cloud_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_connections_cloud_id" ON "connections" USING btree ("cloud_id") WHERE "connections"."cloud_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_connections_sync_status" ON "connections" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "idx_connections_team_cloud_id" ON "connections" USING btree ("team_id","cloud_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_conn_identity_default_per_connection" ON "connection_identities" USING btree ("connection_id") WHERE "connection_identities"."is_default" = true AND "connection_identities"."deleted_at" IS NULL;