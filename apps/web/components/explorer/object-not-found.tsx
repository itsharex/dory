'use client';

import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';

type ObjectNotFoundProps = {
    title?: string;
    description?: string;
};

export function ObjectNotFound({
    title = 'Explorer route not found',
    description = 'The requested explorer location is invalid for the current connection.',
}: ObjectNotFoundProps) {
    return (
        <div className="p-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <AlertCircle className="h-4 w-4" />
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
            </Card>
        </div>
    );
}
