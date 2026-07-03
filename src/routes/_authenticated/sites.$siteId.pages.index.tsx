import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSite } from "@/lib/sites.functions";
import { createPage, deletePage, listPages } from "@/lib/pages.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/pages/")({
  component: PagesIndex,
});

function PagesIndex() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listPages);
  const createFn = useServerFn(createPage);
  const deleteFn = useServerFn(deletePage);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const pagesQuery = useQuery({
    queryKey: ["pages", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const createMut = useMutation({
    mutationFn: (input: { title: string; path: string }) =>
      createFn({ data: { siteId, ...input } }),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: ["pages", siteId] });
      navigate({ to: "/sites/$siteId/pages/$pageId/edit", params: { siteId, pageId: page.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", siteId] }),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");

  const site = siteQuery.data;
  const pages = pagesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <span className="text-foreground">{site?.name ?? "…"}</span>
      </div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Each page is a separate URL with its own editor and publish state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/sites/$siteId/menus"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Menus
          </Link>
          <Link
            to="/sites/$siteId/blog"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Blog
          </Link>
          <Link
            to="/sites/$siteId/forms"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Forms
          </Link>
          <Link
            to="/sites/$siteId/products"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Products
          </Link>
          <Link
            to="/sites/$siteId/orders"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Orders
          </Link>
          <Link
            to="/sites/$siteId/workflows"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Workflows
          </Link>
          {site ? (
            <a
              href={`/s/${site.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              View live ↗
            </a>
          ) : null}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New page
          </button>
        </div>
      </div>

      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ title, path });
          }}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="Page title (e.g. About)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="/about"
            pattern="^/[a-z0-9/-]*$"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
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
      ) : null}

      {pagesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pagesQuery.error ? (
        <p className="text-sm text-destructive">{(pagesQuery.error as Error).message}</p>
      ) : pages.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No pages yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Path</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium">
                    {p.title}
                    {p.isHome ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        HOME
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.path}</td>
                  <td className="px-4 py-3">
                    {p.publishedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to="/sites/$siteId/pages/$pageId/edit"
                        params={{ siteId, pageId: p.id }}
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        Edit
                      </Link>
                      {!p.isHome ? (
                        <button
                          onClick={() => {
                            if (confirm(`Delete page "${p.title}"?`)) deleteMut.mutate(p.id);
                          }}
                          className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
