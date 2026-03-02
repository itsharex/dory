"use client";

import * as React from "react";
import { useTheme } from "next-themes";

const THEME_VALUES = new Set(["light", "dark", "system"]);

type ThemeMode = "light" | "dark" | "system";

declare global {
  interface Window {
    themeBridge?: {
      getTheme: () => Promise<ThemeMode>;
      setTheme: (theme: ThemeMode) => Promise<ThemeMode>;
      onThemeChanged: (callback: (theme: ThemeMode) => void) => () => void;
    };
  }
}

export function ElectronThemeSync() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const latestThemeRef = React.useRef(theme);
  const lastSentRef = React.useRef<ThemeMode | null>(null);
  const suppressNextSendRef = React.useRef(false);
  const mountedRef = React.useRef(false);
  const hasLocalChangeRef = React.useRef(false);
  const didInitRef = React.useRef(false);
  const didLogInitRef = React.useRef(false);
  const syncReadyRef = React.useRef(false);

  React.useEffect(() => {
    latestThemeRef.current = theme;
    if (mountedRef.current && THEME_VALUES.has(theme as string)) {
      hasLocalChangeRef.current = true;
    }
    try {
      window.logBridge?.log('info', '[theme-sync] theme state', {
        theme,
        resolvedTheme,
        localStorageTheme: window.localStorage?.getItem('theme') ?? null,
      });
    } catch {
      // ignore log errors
    }
  }, [theme]);

  React.useEffect(() => {
    mountedRef.current = true;
    if (!window.themeBridge) {
      if (!didLogInitRef.current) {
        didLogInitRef.current = true;
        window.logBridge?.log('warn', '[theme-sync] themeBridge missing');
      }
      return;
    }
    let disposed = false;

    if (!didInitRef.current) {
      didInitRef.current = true;
      const initialTheme = latestThemeRef.current;
      if (!didLogInitRef.current) {
        didLogInitRef.current = true;
        window.logBridge?.log('info', '[theme-sync] init', { initialTheme });
      }
      window.themeBridge
        .getTheme()
        .then(storedTheme => {
          if (disposed) return;
          window.logBridge?.log('info', '[theme-sync] getTheme ->', storedTheme);
          if (THEME_VALUES.has(storedTheme)) {
            if (storedTheme !== latestThemeRef.current) {
              suppressNextSendRef.current = true;
              lastSentRef.current = storedTheme;
              setTheme(storedTheme);
            } else {
              lastSentRef.current = storedTheme;
            }
            syncReadyRef.current = true;
            return;
          }

          if (THEME_VALUES.has(initialTheme as string)) {
            lastSentRef.current = initialTheme as ThemeMode;
            window.themeBridge?.setTheme(initialTheme as ThemeMode).catch(() => undefined);
          }
          syncReadyRef.current = true;
        })
        .catch(() => {
          if (THEME_VALUES.has(initialTheme as string)) {
            lastSentRef.current = initialTheme as ThemeMode;
            window.themeBridge?.setTheme(initialTheme as ThemeMode).catch(() => undefined);
          }
          syncReadyRef.current = true;
        });
    }

    const unsubscribe = window.themeBridge.onThemeChanged(storedTheme => {
      if (!THEME_VALUES.has(storedTheme)) return;
      if (storedTheme !== latestThemeRef.current && storedTheme !== lastSentRef.current) {
        suppressNextSendRef.current = true;
        setTheme(storedTheme);
      }
    });

    return () => {
      disposed = true;
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, [setTheme]);

  React.useEffect(() => {
    if (!window.themeBridge) return;
    if (!THEME_VALUES.has(theme as string)) return;
    if (!syncReadyRef.current) return;
    if (suppressNextSendRef.current) {
      suppressNextSendRef.current = false;
      lastSentRef.current = theme as ThemeMode;
      return;
    }
    if (lastSentRef.current === theme) return;

    lastSentRef.current = theme as ThemeMode;
    window.logBridge?.log('info', '[theme-sync] setTheme ->', theme);
    window.themeBridge?.setTheme(theme as ThemeMode).catch(() => undefined);
  }, [theme]);

  return null;
}
