import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  deleteProduct,
  getProduct,
  publishProduct,
  saveProduct,
  unpublishProduct,
} from "@/lib/commerce.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/products/$productId/edit")({
  component: ProductEditor,
});

function ProductEditor() {
  const { siteId, productId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getProduct);
  const saveFn = useServerFn(saveProduct);
  const publishFn = useServerFn(publishProduct);
  const unpublishFn = useServerFn(unpublishProduct);
  const deleteFn = useServerFn(deleteProduct);

  const query = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getFn({ data: { id: productId } }),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [inventory, setInventory] = useState<string>("");
  const [descriptionHtml, setDescription] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [status, setStatus] = useState("draft");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!query.data) return;
    const { product } = query.data;
    setName(product.name);
    setSlug(product.slug);
    setPriceCents(product.priceCents);
    setCurrency(product.currency);
    setInventory(product.inventoryQuantity == null ? "" : String(product.inventoryQuantity));
    setDescription(product.descriptionHtml ?? "");
    setImagesText(product.images.join("\n"));
    setStatus(product.status);
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: () => {
      setSaved("saving");
      const images = imagesText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const invNum = inventory.trim() === "" ? null : Number(inventory);
      return saveFn({
        data: {
          id: productId,
          name,
          slug,
          priceCents: Math.max(0, Math.round(priceCents)),
          currency: currency.toUpperCase(),
          inventoryQuantity: invNum,
          descriptionHtml: descriptionHtml || null,
          images,
        },
      });
    },
    onSuccess: () => {
      setSaved("saved");
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["products", siteId] });
      setTimeout(() => setSaved("idle"), 1500);
    },
    onError: () => setSaved("idle"),
  });

  const publishMut = useMutation({
    mutationFn: () =>
      status === "published"
        ? unpublishFn({ data: { id: productId } })
        : publishFn({ data: { id: productId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product", productId] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: productId } }),
    onSuccess: () => navigate({ to: "/sites/$siteId/products", params: { siteId } }),
  });

  if (query.isLoading) return <p className="p-10 text-sm text-muted-foreground">Loading…</p>;
  if (query.error)
    return <p className="p-10 text-sm text-destructive">{(query.error as Error).message}</p>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/products" params={{ siteId }} className="hover:underline">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground">{name || "Untitled"}</span>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
        <div className="flex items-center gap-2">
          {saved === "saving" ? (
            <span className="text-xs text-muted-foreground">Saving…</span>
          ) : saved === "saved" ? (
            <span className="text-xs text-emerald-600">Saved</span>
          ) : null}
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Save
          </button>
          <button
            onClick={() => publishMut.mutate()}
            disabled={publishMut.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-5">
        <div className="grid gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Currency</label>
            <input
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Price ({currency})
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={(priceCents / 100).toString()}
              onChange={(e) => setPriceCents(Math.round((Number(e.target.value) || 0) * 100))}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Inventory (blank = unlimited)
            </label>
            <input
              type="number"
              min={0}
              value={inventory}
              onChange={(e) => setInventory(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Image URLs (one per line)
          </label>
          <textarea
            value={imagesText}
            onChange={(e) => setImagesText(e.target.value)}
            rows={3}
            placeholder="https://…"
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Description (HTML)
          </label>
          <textarea
            value={descriptionHtml}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => {
            if (confirm(`Delete "${name}"? This cannot be undone.`)) deleteMut.mutate();
          }}
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
        >
          Delete product
        </button>
      </div>
    </div>
  );
}
