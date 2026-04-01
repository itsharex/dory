import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { createProvisionedOrganization } from '@/lib/auth/organization-provisioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createOrganizationSchema = z.object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
});

export async function POST(req: Request) {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);

    if (!session?.user?.id) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    const parsed = createOrganizationSchema.safeParse(payload);

    if (!parsed.success) {
        return NextResponse.json({ message: 'Invalid organization payload' }, { status: 400 });
    }

    const organization = await createProvisionedOrganization({
        auth,
        headers: req.headers,
        userId: session.user.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        provisioningKind: 'manual',
    });

    return NextResponse.json(organization);
}
