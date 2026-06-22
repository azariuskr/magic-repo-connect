import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublishedBlogIndex } from "@/lib/blog.functions";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";

export const Route = createFileRoute("/s/$siteSlug/blog/")({
  loader: async ({ params }) => {
    const result = await getPublishedBlogIndex({ data: { siteSlug: params.siteSlug } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.site?.name ?? "Site";
    const title = `Blog — ${name}`;
    const description = `Latest posts from ${name}.`;
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
      <p className="text-sm text-muted-foreground">Blog not found.</p>
    </div>
  ),
  component: BlogIndexPage,
});

function pageHref(siteSlug: string, path: string) {
  return path === "/" ? `/s/${siteSlug}` : `/s/${siteSlug}${path}`;
}

function BlogIndexPage() {
  const { site, nav, primaryMenu, footerMenu, posts } = Route.useLoaderData();
  const { siteSlug } = Route.useParams();
  const headerItems =
    primaryMenu && primaryMenu.length > 0
      ? primaryMenu.map((it) => ({
          id: it.id,
          label: it.label,
          href: it.type === "page" ? pageHref(siteSlug, it.href) : it.href,
          openInNewTab: it.openInNewTab,
        }))
      : nav.map((it) => ({
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
        <div className="mx-auto max-w-3xl">
          <h1
            className="mb-10 text-4xl font-semibold tracking-tight"
            style={{ color: "var(--site-fg)" }}
          >
            Blog
          </h1>
          {posts.length === 0 ? (
            <p style={{ color: "var(--site-muted)" }}>No posts yet.</p>
          ) : (
            <ul className="space-y-8">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="border-b pb-8 last:border-0"
                  style={{ borderColor: "color-mix(in srgb, var(--site-fg) 10%, transparent)" }}
                >
                  <Link
                    to="/s/$siteSlug/blog/$slug"
                    params={{ siteSlug, slug: p.slug }}
                    className="block group"
                  >
                    <h2
                      className="text-2xl font-semibold tracking-tight group-hover:opacity-80"
                      style={{ color: "var(--site-fg)" }}
                    >
                      {p.title}
                    </h2>
                    {p.publishedAt ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--site-muted)" }}>
                        {new Date(p.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    ) : null}
                    {p.excerpt ? (
                      <p className="mt-3 text-base" style={{ color: "var(--site-muted)" }}>
                        {p.excerpt}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
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
              {footerMenu.map((it) => (
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
