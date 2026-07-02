import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublishedShop } from "@/lib/commerce.functions";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";
import type { PublishedMenuItem } from "@/lib/menus.functions";
import type { PublishedNavItem } from "@/lib/pages.functions";

export const Route = createFileRoute("/s/$siteSlug/shop/")({
  loader: async ({ params }) => {
    const result = await getPublishedShop({ data: { siteSlug: params.siteSlug } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.site?.name ?? "Site";
    const title = `Shop — ${name}`;
    const description = `Browse products from ${name}.`;
    return {
      links: [{ rel: "stylesheet", href: "https://rsms.me/inter/inter.css" }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Shop not found.</p>
    </div>
  ),
  component: ShopIndexPage,
});

function pageHref(siteSlug: string, path: string) {
  return path === "/" ? `/s/${siteSlug}` : `/s/${siteSlug}${path}`;
}

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function ShopIndexPage() {
  const { site, nav, primaryMenu, footerMenu, products } = Route.useLoaderData();
  const { siteSlug } = Route.useParams();
  const headerItems =
    primaryMenu && primaryMenu.length > 0
      ? (primaryMenu as PublishedMenuItem[]).map((it) => ({
          id: it.id,
          label: it.label,
          href: it.type === "page" ? pageHref(siteSlug, it.href) : it.href,
          openInNewTab: it.openInNewTab,
        }))
      : (nav as PublishedNavItem[]).map((it) => ({
          id: it.id,
          label: it.label,
          href: pageHref(siteSlug, it.path),
          openInNewTab: false,
        }));

  return (
    <ThemeRoot theme={site.theme as SiteTheme}>
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
            {site.name}
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {headerItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                target={item.openInNewTab ? "_blank" : undefined}
                rel={item.openInNewTab ? "noreferrer" : undefined}
                className="rounded-md px-3 py-1.5"
                style={{ color: "var(--site-muted)" }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main
        className="px-6 py-16 sm:px-10 lg:px-16"
        style={{ backgroundColor: "var(--site-bg)", minHeight: "60vh" }}
      >
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-10 text-4xl font-semibold tracking-tight" style={{ color: "var(--site-fg)" }}>
            Shop
          </h1>
          {products.length === 0 ? (
            <p style={{ color: "var(--site-muted)" }}>No products available yet.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Link
                  key={p.id}
                  to="/s/$siteSlug/shop/$slug"
                  params={{ siteSlug, slug: p.slug }}
                  className="group block"
                >
                  <div
                    className="aspect-square w-full overflow-hidden rounded-lg"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--site-fg) 6%, transparent)",
                    }}
                  >
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <h2
                    className="mt-4 text-base font-medium tracking-tight"
                    style={{ color: "var(--site-fg)" }}
                  >
                    {p.name}
                  </h2>
                  <p className="text-sm" style={{ color: "var(--site-brand)" }}>
                    {money(p.priceCents, p.currency)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {footerMenu && footerMenu.length > 0 ? (
        <footer
          className="mt-8"
          style={{
            borderTop: "1px solid color-mix(in srgb, var(--site-fg) 8%, transparent)",
            color: "var(--site-muted)",
          }}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 sm:px-10 lg:px-16">
            <span className="text-xs">© {new Date().getFullYear()} {site.name}</span>
            <nav className="flex flex-wrap gap-4 text-xs">
              {(footerMenu as PublishedMenuItem[]).map((it) => (
                <a
                  key={it.id}
                  href={it.type === "page" ? pageHref(siteSlug, it.href) : it.href}
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
