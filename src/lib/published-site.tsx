import { Link } from "@tanstack/react-router";
import { Render, type Data } from "@measured/puck";
import { buildPuckConfig } from "@/lib/blocks";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";
import type { PublishedNavItem } from "@/lib/pages.functions";
import type { PublishedMenuItem } from "@/lib/menus.functions";

type PublishedSiteProps = {
  siteName: string;
  siteSlug: string;
  theme: SiteTheme;
  currentPath: string;
  nav: PublishedNavItem[];
  primaryMenu?: PublishedMenuItem[] | null;
  footerMenu?: PublishedMenuItem[] | null;
  pageData: Data;
};

function pageHref(siteSlug: string, path: string) {
  return path === "/" ? `/s/${siteSlug}` : `/s/${siteSlug}${path}`;
}

function resolveHref(siteSlug: string, item: PublishedMenuItem) {
  if (item.type === "page") return pageHref(siteSlug, item.href);
  return item.href;
}

export function PublishedSite({
  siteName,
  siteSlug,
  theme,
  currentPath,
  nav,
  primaryMenu,
  footerMenu,
  pageData,
}: PublishedSiteProps) {
  const config = buildPuckConfig();

  // Prefer the user-defined "primary" menu; fall back to auto-generated nav.
  const headerItems =
    primaryMenu && primaryMenu.length > 0
      ? primaryMenu.map((it) => ({
          id: it.id,
          label: it.label,
          href: resolveHref(siteSlug, it),
          isActive: it.type === "page" && it.href === currentPath,
          openInNewTab: it.openInNewTab,
        }))
      : nav.map((it) => ({
          id: it.id,
          label: it.label,
          href: pageHref(siteSlug, it.path),
          isActive: it.path === currentPath,
          openInNewTab: false,
        }));

  return (
    <ThemeRoot theme={theme}>
      {headerItems.length > 0 ? (
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
              {headerItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noreferrer" : undefined}
                  className="rounded-md px-3 py-1.5 transition-colors"
                  style={{
                    color: item.isActive ? "var(--site-brand)" : "var(--site-muted)",
                    backgroundColor: item.isActive
                      ? "color-mix(in srgb, var(--site-brand) 12%, transparent)"
                      : "transparent",
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
      ) : null}

      <Render config={config} data={pageData} />

      {footerMenu && footerMenu.length > 0 ? (
        <footer
          className="mt-16"
          style={{
            borderTop: "1px solid color-mix(in srgb, var(--site-fg) 8%, transparent)",
            color: "var(--site-muted)",
          }}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 sm:px-10 lg:px-16">
            <span className="text-xs">© {new Date().getFullYear()} {siteName}</span>
            <nav className="flex flex-wrap gap-4 text-xs">
              {footerMenu.map((it) => (
                <a
                  key={it.id}
                  href={resolveHref(siteSlug, it)}
                  target={it.openInNewTab ? "_blank" : undefined}
                  rel={it.openInNewTab ? "noreferrer" : undefined}
                  className="hover:underline"
                >
                  {it.label}
                </a>
              ))}
            </nav>
          </div>
        </footer>
      ) : null}
    </ThemeRoot>
  );
}
