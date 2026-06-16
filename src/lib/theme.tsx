import type { CSSProperties, ReactNode } from "react";

export interface ThemeTokens {
  bg: string;
  surface: string;
  brand: string;
  fg: string;
  muted: string;
  radius: string;
  font: string;
}

export interface SiteTheme {
  preset?: string;
  tokens: ThemeTokens;
}

export const DEFAULT_THEME: SiteTheme = {
  preset: "barber-dark",
  tokens: {
    bg: "#0a0a0a",
    surface: "#1a1a1a",
    brand: "#d4af37",
    fg: "#f5f5f5",
    muted: "#9ca3af",
    radius: "0.5rem",
    font: "Inter, system-ui, sans-serif",
  },
};

export const PRESETS: Record<string, ThemeTokens> = {
  "barber-dark": DEFAULT_THEME.tokens,
  "clean-medical": {
    bg: "#ffffff",
    surface: "#f1f5f9",
    brand: "#0ea5e9",
    fg: "#0f172a",
    muted: "#64748b",
    radius: "0.75rem",
    font: "Inter, system-ui, sans-serif",
  },
  "cafe-warm": {
    bg: "#fdf6ec",
    surface: "#f3e5cc",
    brand: "#8b4513",
    fg: "#3e2723",
    muted: "#8a6b4b",
    radius: "1rem",
    font: "Georgia, serif",
  },
};

export function themeToVars(theme: SiteTheme | undefined): CSSProperties {
  const t = theme?.tokens ?? DEFAULT_THEME.tokens;
  return {
    // CSS custom properties consumed by site blocks
    ["--site-bg" as string]: t.bg,
    ["--site-surface" as string]: t.surface,
    ["--site-brand" as string]: t.brand,
    ["--site-fg" as string]: t.fg,
    ["--site-muted" as string]: t.muted,
    ["--site-radius" as string]: t.radius,
    ["--site-font" as string]: t.font,
    backgroundColor: t.bg,
    color: t.fg,
    fontFamily: t.font,
  };
}

export function ThemeRoot({
  theme,
  children,
}: {
  theme: SiteTheme | undefined;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen" style={themeToVars(theme)}>
      {children}
    </div>
  );
}
