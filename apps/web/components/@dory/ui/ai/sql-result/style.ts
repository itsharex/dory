import type { SqlResultCardMode } from './type';

type SqlResultActionStyles = {
    iconBtn: string;
    icon: string;
    srOnly: string;
    textBtn: string;
    menu: string;
};

const GLOBAL_STYLES: SqlResultActionStyles = {
    iconBtn: 'h-8 w-8 rounded-full p-0 min-w-0 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer',
    icon: 'h-3.5 w-3.5',
    srOnly: 'sr-only',
    textBtn: 'h-8 rounded-full px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground',
    menu: 'w-44',
};

const COPILOT_STYLES: SqlResultActionStyles = {
    iconBtn: 'h-8 w-8 rounded-full p-0 min-w-0 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer',
    icon: 'h-3.5 w-3.5',
    srOnly: GLOBAL_STYLES.srOnly,
    textBtn: GLOBAL_STYLES.textBtn,
    menu: GLOBAL_STYLES.menu,
};

export function getSqlResultActionStyles(mode: SqlResultCardMode = 'global'): SqlResultActionStyles {
    return mode === 'copilot' ? COPILOT_STYLES : GLOBAL_STYLES;
}
