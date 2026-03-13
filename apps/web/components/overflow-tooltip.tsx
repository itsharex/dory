'use client';

import * as React from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/registry/new-york-v4/ui/tooltip';

type OverflowTooltipProps = {
    text?: string | null;
    className?: string;
    children?: React.ReactNode;
    disableTooltip?: boolean;
};

/**
 * Single-line truncation wrapper.
 * Shows tooltip ONLY when overflowed AND not disabled.
 */
export const OverflowTooltip = React.forwardRef<HTMLSpanElement, OverflowTooltipProps>(
    function OverflowTooltip(
        { text, className, children, disableTooltip = false },
        ref
    ) {
        const innerRef = React.useRef<HTMLSpanElement | null>(null);
        const mergedRef = (node: HTMLSpanElement) => {
            innerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLSpanElement | null>).current = node;
        };

        const [overflowing, setOverflowing] = React.useState(false);

        const checkOverflow = React.useCallback(() => {
            const el = innerRef.current;
            if (!el) return;
            setOverflowing(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
        }, []);

        React.useLayoutEffect(() => {
            const el = innerRef.current;
            if (!el) return;

            checkOverflow();
            const ro = new ResizeObserver(() => checkOverflow());
            ro.observe(el);
            return () => ro.disconnect();
        }, [checkOverflow, text]);

        const baseSpan = (
            <span ref={mergedRef} className={className}>
                {children ?? text}
            </span>
        );

        if (disableTooltip) return baseSpan;

        if (!text || !overflowing) return baseSpan;

        return (
            <Tooltip>
                <TooltipTrigger asChild>{baseSpan}</TooltipTrigger>
                <TooltipContent className="max-w-90 wrap-break-word text-xs">{text}</TooltipContent>
            </Tooltip>
        );
    }
);
