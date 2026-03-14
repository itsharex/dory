/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { ResponseUtil } from '@/lib/result';
import { resolveCatalogContext } from '../../_utils';
import type { ClickhouseMetadataAPI } from '@/lib/connection/drivers/clickhouse/capabilities/metadata';
import { withUserAndTeamHandler } from '@/app/api/utils/with-team-handler';

export async function GET(req: NextRequest, context: { params: Promise<{ database: string }> }) {
    return withUserAndTeamHandler(async ({ userId, teamId }) => {
        const resolved = await resolveCatalogContext(req, context, { userId, teamId });
        if (resolved.response) return resolved.response;

        const { entry, database } = resolved.resolved!;
        const metadata = entry.instance.capabilities.metadata as ClickhouseMetadataAPI | undefined;
        const views = metadata ? await metadata.getMaterializedViews(database) : [];

        return NextResponse.json(ResponseUtil.success(views));
    })(req);
}
