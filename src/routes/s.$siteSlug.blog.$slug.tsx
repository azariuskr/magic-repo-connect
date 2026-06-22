import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublishedBlogPost } from "@/lib/blog.functions";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";
import { RichTextView } from "@/lib/blocks";
import type { PublishedMenuItem } from "@/lib/menus.functions";
import type { PublishedNavItem } from "@/lib/pages.functions";

export const Route = createFileRoute("/s/$siteSlug/blog/$slug")({
  loader: async ({ params }) => {
    const result = await getPublishedBlogPost({
      data: { siteSlug: params.siteSlug, slug: params.slug },
    });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.site?.name ?? "Site";
    const post = loaderData?.post;
    const title = post?.seoTitle?.trim() || (post ? `${post.title} — ${name}` : name);
    const description =
      post?.seoDescription?.trim() || post?.excerpt?.trim() || `${name} blog post.`;
    return {
      links: [{ rel: "stylesheet", href: "https://rsms.me/inter/inter.css" }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Post not found.</p>
    </div>
  ),
  component: BlogPostPage,
});

function pageHref(siteSlug: string, path: string) {
  return path === "/" ? `/s/${siteSlug}` : `/s/${siteSlug}${path}`;
}

function BlogPostPage() {
  const { site, nav, primaryMenu, footerMenu, post } = Route.useLoaderData();
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
                className="rounded-md px-3 py-1.5"
                style={{ color: "var(--site-muted)" }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <article
        className="px-6 py-16 sm:px-10 lg:px-16"
        style={{ backgroundColor: "var(--site-bg)", minHeight: "60vh" }}
      >
        <div className="mx-auto max-w-3xl">
          <Link
            to="/s/$siteSlug/blog"
            params={{ siteSlug }}
            className="mb-6 inline-block text-xs"
            style={{ color: "var(--site-muted)" }}
          >
            ← All posts
          </Link>
          <h1
            className="text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ color: "var(--site-fg)" }}
          >
            {post.title}
          </h1>
          {post.publishedAt ? (
            <p className="mt-3 text-sm" style={{ color: "var(--site-muted)" }}>
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          ) : null}
          <div
            className="prose-site mt-10 text-base leading-relaxed"
            style={{ color: "var(--site-fg)" }}
          >
            <RichTextView html={post.contentHtml ?? ""} />
          </div>
        </div>
      </article>

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
