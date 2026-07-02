import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSite } from "@/lib/sites.functions";
import { createProduct, deleteProduct, listProducts } from "@/lib/commerce.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/products/")({
  component: ProductsIndex,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function ProductsIndex() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listProducts);
  const createFn = useServerFn(createProduct);
  const deleteFn = useServerFn(deleteProduct);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const createMut = useMutation({
    mutationFn: (input: { name: string; slug: string }) =>
      createFn({ data: { siteId, ...input } }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["products", siteId] });
      navigate({
        to: "/sites/$siteId/products/$productId/edit",
        params: { siteId, productId: p.id },
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", siteId] }),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const site = siteQuery.data;
  const products = productsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Products</span>
      </div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Everything for sale on your site. Published products appear in your shop.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/sites/$siteId/orders"
            params={{ siteId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Orders
          </Link>
          {site ? (
            <a
              href={`/s/${site.slug}/shop`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              View shop ↗
            </a>
          ) : null}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New product
          </button>
        </div>
      </div>

      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ name, slug: slug || slugify(name) });
          }}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="Product name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugify(e.target.value));
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="url-slug"
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
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

      {productsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No products yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Price</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">{money(p.priceCents, p.currency)}</td>
                  <td className="px-4 py-3">
                    {p.status === "published" ? (
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
                        to="/sites/$siteId/products/$productId/edit"
                        params={{ siteId, productId: p.id }}
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id);
                        }}
                        className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
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
