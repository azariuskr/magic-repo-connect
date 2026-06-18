import { Link } from "@tanstack/react-router";
import { Render, type Data } from "@measured/puck";
import { buildPuckConfig } from "@/lib/blocks";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";
import type { PublishedNavItem } from "@/lib/pages.functions";

type PublishedSiteProps = {
  siteName: string;
  siteSlug: string;
  theme: SiteTheme;
  currentPath: string;
  nav: PublishedNavItem[];
  pageData: Data;
};

function navHref(siteSlug: string, path: string) {
  return path === "/" ? `/s/${siteSlug}` : `/s/${siteSlug}${path}`;
}

export function PublishedSite({
  siteName,
  siteSlug,
  theme,
  currentPath,
  nav,
  pageData,
}: PublishedSiteProps) {
  const config = buildPuckConfig();
  return (
    <ThemeRoot theme={theme}>
      {nav.length > 1 ? (
        <header
          className="sticky top-0 z-40 backdrop-blur-md"
          style={{
            backgroundColor: "color-mix(in srgb, var(--site-bg) 85%, transparent)",
            borderBottom: "1px solid color-mix(in srgb, var(--site-fg) 8%, transparent)",
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-10 lg:px-16">
            <Link
              to="/s/$siteSlug"
              params={{ siteSlug }}
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--site-fg)" }}
            >
              {siteName}
            </Link>
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {nav.map((item) => {
                const isActive = item.path === currentPath;
                return (
                  <a
                    key={item.id}
                    href={navHref(siteSlug, item.path)}
                    className="rounded-md px-3 py-1.5 transition-colors"
                    style={{
                      color: isActive ? "var(--site-brand)" : "var(--site-muted)",
                      backgroundColor: isActive
                        ? "color-mix(in srgb, var(--site-brand) 12%, transparent)"
                        : "transparent",
                    }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </header>
      ) : null}
      <Render config={config} data={pageData} />
    </ThemeRoot>
  );
}
