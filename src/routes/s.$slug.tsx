import { createFileRoute, notFound } from "@tanstack/react-router";
import { Render, type Data } from "@measured/puck";
import { getPublishedSite } from "@/lib/sites.functions";
import { buildPuckConfig } from "@/lib/blocks";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const site = await getPublishedSite({ data: { slug: params.slug } });
    if (!site) throw notFound();
    return { site };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.site?.name ?? "Site";
    return {
      meta: [
        { title: name },
        { name: "description", content: `${name} — built with Sitebuilder.` },
        { property: "og:title", content: name },
        { property: "og:description", content: `${name} — built with Sitebuilder.` },
        { property: "og:type", content: "website" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This site doesn't exist or isn't published yet.
        </p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
  component: PublicSite,
});

function PublicSite() {
  const { site } = Route.useLoaderData();
  const config = buildPuckConfig();
  const data = (site.publishedData as Data) ?? ({ content: [], root: { props: {} } } as Data);
  return (
    <ThemeRoot theme={site.theme as SiteTheme}>
      <Render config={config} data={data} />
    </ThemeRoot>
  );
}
