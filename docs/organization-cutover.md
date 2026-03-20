# Organization Cutover

This repo now treats `better-auth` `activeOrganizationId` as the only runtime source of the current tenant context.

## What Changed

- Current tenant resolution now depends on `session.active_organization_id`.
- Runtime code no longer reads or writes `user.default_team_id`.
- Electron finalize/consume only propagate `activeOrganizationId`.
- The `user.default_team_id` column is removed by:
  - `apps/web/lib/database/postgres/migrations/0005_ambiguous_pride.sql`
  - `apps/web/lib/database/pglite/migrations/0005_wooden_nekra.sql`

## Deployment Order

1. Deploy the application code that writes `session.active_organization_id`.
2. Run the existing backfill migration:
   - `apps/web/lib/database/postgres/migrations/0004_dapper_snowbird.sql`
   This copies `user.default_team_id -> session.active_organization_id` for existing sessions.
3. Verify active sessions have `active_organization_id` populated.
4. Deploy the final strict-only code.
5. Run the drop-column migration:
   - `apps/web/lib/database/postgres/migrations/0005_ambiguous_pride.sql`

For local/pglite environments, apply the matching `0004_*` then `0005_*` migrations and keep `apps/web/lib/database/pglite/migrations.json` in sync.

## Operational Expectation

- Users with very old sessions created before the `0004_*` backfill may lose current workspace context.
- The safe recovery path is re-authentication so a fresh session is created with `activeOrganizationId`.
- Because tenant context is now strict, missing `activeOrganizationId` will surface as unauthorized or missing-workspace behavior instead of silently falling back.

## Verification

- `yarn workspace web run typecheck`
- `npx tsx --test apps/web/scripts/tests/current-organization.test.ts`

## Rollback Note

- Application rollback is only safe before applying `0005_*`.
- After dropping `user.default_team_id`, rolling back to code that still expects that column will fail.
