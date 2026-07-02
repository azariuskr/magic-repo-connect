import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getPublishedProduct, placeOrder } from "@/lib/commerce.functions";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";
import type { PublishedMenuItem } from "@/lib/menus.functions";
import type { PublishedNavItem } from "@/lib/pages.functions";

export const Route = createFileRoute("/s/$siteSlug/shop/$slug")({
  loader: async ({ params }) => {
    const result = await getPublishedProduct({
      data: { siteSlug: params.siteSlug, slug: params.slug },
    });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const name = loaderData?.site?.name ?? "Site";
    const title = p ? `${p.name} — ${name}` : name;
    const description = p?.descriptionHtml
      ? p.descriptionHtml.replace(/<[^>]+>/g, "").slice(0, 160)
      : `Buy ${p?.name ?? "products"} from ${name}.`;
    return {
      links: [{ rel: "stylesheet", href: "https://rsms.me/inter/inter.css" }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        ...(p?.images[0] ? [{ property: "og:image", content: p.images[0] }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Product not found.</p>
    </div>
  ),
  component: ProductPage,
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

function ProductPage() {
  const { site, nav, primaryMenu, footerMenu, product } = Route.useLoaderData();
  const { siteSlug } = Route.useParams();
  const placeOrderFn = useServerFn(placeOrder);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      placeOrderFn({
        data: {
          siteSlug,
          productSlug: product.slug,
          quantity,
          customerName: name,
          customerEmail: email,
          notes: notes || undefined,
        },
      }),
  });

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
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <div
            className="aspect-square w-full overflow-hidden rounded-lg"
            style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 6%, transparent)" }}
          >
            {product.images[0] ? (
              <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div>
            <Link
              to="/s/$siteSlug/shop"
              params={{ siteSlug }}
              className="mb-3 inline-block text-xs uppercase tracking-wider hover:underline"
              style={{ color: "var(--site-muted)" }}
            >
              ← Back to shop
            </Link>
            <h1
              className="text-4xl font-semibold tracking-tight"
              style={{ color: "var(--site-fg)" }}
            >
              {product.name}
            </h1>
            <p className="mt-2 text-2xl" style={{ color: "var(--site-brand)" }}>
              {money(product.priceCents, product.currency)}
            </p>

            {product.descriptionHtml ? (
              <div
                className="prose prose-invert mt-6 max-w-none text-sm"
                style={{ color: "var(--site-muted)" }}
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            ) : null}

            <div
              className="mt-8 rounded-lg p-6"
              style={{
                border: "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--site-fg) 3%, transparent)",
              }}
            >
              {mutation.isSuccess ? (
                <div>
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: "var(--site-fg)" }}
                  >
                    Order placed
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--site-muted)" }}>
                    Thanks — we'll be in touch by email to confirm and arrange payment.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutation.mutate();
                  }}
                  className="grid gap-3"
                >
                  <h3
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: "var(--site-fg)" }}
                  >
                    Place an order
                  </h3>
                  <input
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--site-bg)",
                      color: "var(--site-fg)",
                      borderColor: "color-mix(in srgb, var(--site-fg) 15%, transparent)",
                    }}
                  />
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--site-bg)",
                      color: "var(--site-fg)",
                      borderColor: "color-mix(in srgb, var(--site-fg) 15%, transparent)",
                    }}
                  />
                  <input
                    required
                    type="number"
                    min={1}
                    max={999}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--site-bg)",
                      color: "var(--site-fg)",
                      borderColor: "color-mix(in srgb, var(--site-fg) 15%, transparent)",
                    }}
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--site-bg)",
                      color: "var(--site-fg)",
                      borderColor: "color-mix(in srgb, var(--site-fg) 15%, transparent)",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                    style={{ backgroundColor: "var(--site-brand)", color: "var(--site-bg)" }}
                  >
                    {mutation.isPending
                      ? "Placing…"
                      : `Order — ${money(product.priceCents * quantity, product.currency)}`}
                  </button>
                  {mutation.error ? (
                    <p className="text-xs" style={{ color: "#ef4444" }}>
                      {(mutation.error as Error).message}
                    </p>
                  ) : null}
                </form>
              )}
            </div>
          </div>
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
