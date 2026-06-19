import { createFileRoute, notFound } from "@tanstack/react-router";
import { type Data } from "@measured/puck";
import { getPublishedPage } from "@/lib/pages.functions";
import { PublishedSite } from "@/lib/published-site";
import type { SiteTheme } from "@/lib/theme";

export const Route = createFileRoute("/s/$siteSlug/")({
  loader: async ({ params }) => {
    const result = await getPublishedPage({
      data: { siteSlug: params.siteSlug, path: "/" },
    });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.site?.name ?? "Site";
    const title = loaderData?.page?.seoTitle?.trim() || name;
    const description =
      loaderData?.page?.seoDescription?.trim() || `${name} — built with Sitebuilder.`;
    return {
      links: [{ rel: "stylesheet", href: "https://rsms.me/inter/inter.css" }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `/s/${params.siteSlug}` },
      ],
    };
  },
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
  component: PublicHome,
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This site doesn't exist or hasn't been published yet.
        </p>
      </div>
    </div>
  );
}

function PublicHome() {
  const { site, page, nav, primaryMenu, footerMenu } = Route.useLoaderData();
  const { siteSlug } = Route.useParams();
  const data = (page.publishedData as Data) ?? ({ content: [], root: { props: {} } } as Data);
  return (
    <PublishedSite
      siteName={site.name}
      siteSlug={siteSlug}
      theme={site.theme as SiteTheme}
      currentPath="/"
      nav={nav}
      primaryMenu={primaryMenu}
      footerMenu={footerMenu}
      pageData={data}
    />
  );
}
