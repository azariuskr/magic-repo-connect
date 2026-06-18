import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { listSites, createSite } from "@/lib/sites.functions";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listSites);
  const create = useServerFn(createSite);
  const navigate = useNavigate();

  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: (input: { name: string; slug: string }) => create({ data: input }),
    onSuccess: (site) => {
      navigate({ to: "/sites/$siteId/pages", params: { siteId: site.id } });
    },
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your sites</h1>
          <p className="text-sm text-muted-foreground">Build, preview, and publish.</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New site
        </button>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ name, slug });
          }}
          className="mb-8 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="Site name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="slug (lowercase, dashes)"
            pattern="[a-z0-9-]{2,64}"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createMut.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
          {createMut.error ? (
            <p className="col-span-full text-xs text-destructive">
              {(createMut.error as Error).message}
            </p>
          ) : null}
        </form>
      )}

      {sitesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sitesQuery.error ? (
        <p className="text-sm text-destructive">{(sitesQuery.error as Error).message}</p>
      ) : sitesQuery.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sitesQuery.data.map((site) => (
            <Link
              key={site.id}
              to="/sites/$siteId/edit"
              params={{ siteId: site.id }}
              className="block rounded-lg border bg-card p-5 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{site.name}</h3>
                {site.publishedAt ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    Published
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">/s/{site.slug}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Updated {new Date(site.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No sites yet. Create your first one.</p>
        </div>
      )}
    </div>
  );
}
