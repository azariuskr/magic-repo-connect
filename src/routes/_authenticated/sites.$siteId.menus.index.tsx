import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { getSite } from "@/lib/sites.functions";
import { listPages } from "@/lib/pages.functions";
import {
  createMenu,
  deleteMenu,
  listMenus,
  replaceMenuItems,
  setMenuPublished,
  setMenuSlot,
} from "@/lib/menus.functions";
import { PRESETS, themeToVars, type SiteTheme, type ThemeTokens } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/sites/$siteId/menus/")({
  component: MenusPage,
});

type DraftItem = {
  label: string;
  type: "page" | "url" | "anchor";
  pageId: string | null;
  url: string | null;
  anchor: string | null;
  openInNewTab: boolean;
};

function MenusPage() {
  const { siteId } = Route.useParams();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listMenusFn = useServerFn(listMenus);
  const listPagesFn = useServerFn(listPages);
  const createMenuFn = useServerFn(createMenu);
  const deleteMenuFn = useServerFn(deleteMenu);
  const replaceFn = useServerFn(replaceMenuItems);
  const setMenuSlotFn = useServerFn(setMenuSlot);
  const setPublishedFn = useServerFn(setMenuPublished);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const menusQuery = useQuery({
    queryKey: ["menus", siteId],
    queryFn: () => listMenusFn({ data: { siteId } }),
  });
  const pagesQuery = useQuery({
    queryKey: ["pages", siteId],
    queryFn: () => listPagesFn({ data: { siteId } }),
  });

  const createMut = useMutation({
    mutationFn: (input: { key: string; label: string }) =>
      createMenuFn({ data: { siteId, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus", siteId] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMenuFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus", siteId] }),
  });

  const [newOpen, setNewOpen] = useState(false);
  const [newKey, setNewKey] = useState("primary");
  const [newLabel, setNewLabel] = useState("Primary navigation");

  const site = siteQuery.data;
  const menus = menusQuery.data ?? [];
  const pages = pagesQuery.data ?? [];

  // Live drafts per menu — feeds the preview panel without requiring Save.
  const [drafts, setDrafts] = useState<Record<string, DraftItem[]>>({});
  // Stable per-menu callback factory so child editors don't re-render on parent state changes.
  const itemsChangeHandlers = useMemo(() => new Map<string, (items: DraftItem[]) => void>(), []);
  const getItemsChangeHandler = useCallback(
    (menuId: string) => {
      let h = itemsChangeHandlers.get(menuId);
      if (!h) {
        h = (items: DraftItem[]) => setDrafts((d) => ({ ...d, [menuId]: items }));
        itemsChangeHandlers.set(menuId, h);
      }
      return h;
    },
    [itemsChangeHandlers],
  );

  const primaryMenu = menus.find((m) => m.key === "primary" && m.isPublished);
  const footerMenu = menus.find((m) => m.key === "footer" && m.isPublished);
  const pagesById = useMemo(
    () => Object.fromEntries(pages.map((p) => [p.id, p])),
    [pages],
  );

  const primaryDraft = useMemo(
    () => resolveDraft(primaryMenu, drafts),
    [primaryMenu, drafts],
  );
  const footerDraft = useMemo(
    () => resolveDraft(footerMenu, drafts),
    [footerMenu, drafts],
  );

  // Preview theme override — defaults to the site's own theme.
  const siteTheme = (site?.theme as SiteTheme | undefined) ?? undefined;
  const [previewPreset, setPreviewPreset] = useState<string>("__site");
  const previewTheme: SiteTheme | undefined = useMemo(() => {
    if (previewPreset === "__site") return siteTheme;
    const tokens = PRESETS[previewPreset];
    return tokens ? { preset: previewPreset, tokens } : siteTheme;
  }, [previewPreset, siteTheme]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link
          to="/sites/$siteId/pages"
          params={{ siteId }}
          className="hover:underline"
        >
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Menus</span>
      </div>

      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menus</h1>
          <p className="text-sm text-muted-foreground">
            The menu with key <code className="font-mono">primary</code> renders in the site header.
            Use <code className="font-mono">footer</code> for the footer.
          </p>
        </div>
        <button
          onClick={() => setNewOpen((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New menu
        </button>
      </div>

      {newOpen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate(
              { key: newKey, label: newLabel },
              {
                onSuccess: () => {
                  setNewOpen(false);
                  setNewKey("primary");
                  setNewLabel("Primary navigation");
                },
              },
            );
          }}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="key (primary / footer / legal)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <input
            required
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
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
      ) : null}

      {menusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : menus.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No menus yet. Create a menu with key <code>primary</code> to customize the site header.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {menus.map((menu) => (
            <MenuEditor
              key={menu.id}
              menu={menu}
              pages={pages}
              onItemsChange={getItemsChangeHandler(menu.id)}
              onSave={(items) =>
                replaceFn({ data: { menuId: menu.id, items } }).then(() =>
                  qc.invalidateQueries({ queryKey: ["menus", siteId] }),
                )
              }
              onSetSlot={(slot) =>
                setMenuSlotFn({ data: { id: menu.id, slot } }).then(() =>
                  qc.invalidateQueries({ queryKey: ["menus", siteId] }),
                )
              }
              onTogglePublished={(isPublished) =>
                setPublishedFn({ data: { id: menu.id, isPublished } }).then(() =>
                  qc.invalidateQueries({ queryKey: ["menus", siteId] }),
                )
              }
              onDelete={() => {
                if (confirm(`Delete menu "${menu.label}"?`)) deleteMut.mutate(menu.id);
              }}
            />
          ))}
        </div>
      )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start space-y-3">
          <ThemePicker
            value={previewPreset}
            onChange={setPreviewPreset}
            sitePresetName={siteTheme?.preset}
          />
          <MenuPreview
            siteName={site?.name ?? "Your site"}
            siteSlug={site?.slug ?? ""}
            theme={previewTheme}
            primaryItems={primaryDraft}
            footerItems={footerDraft}
            primaryAssigned={!!primaryMenu}
            footerAssigned={!!footerMenu}
            pagesById={pagesById}
          />
        </aside>
      </div>
    </div>
  );
}

function resolveDraftHref(
  it: DraftItem,
  pagesById: Record<string, { path: string }>,
): string | null {
  if (it.type === "page") {
    if (!it.pageId) return null;
    const page = pagesById[it.pageId];
    return page ? page.path : null;
  }
  if (it.type === "url") return it.url || null;
  if (it.type === "anchor") {
    if (!it.anchor) return null;
    return it.anchor.startsWith("#") ? it.anchor : `#${it.anchor}`;
  }
  return null;
}

function MenuPreview({
  siteName,
  siteSlug,
  theme,
  primaryItems,
  footerItems,
  primaryAssigned,
  footerAssigned,
  pagesById,
}: {
  siteName: string;
  siteSlug: string;
  theme: SiteTheme | undefined;
  primaryItems: DraftItem[];
  footerItems: DraftItem[];
  primaryAssigned: boolean;
  footerAssigned: boolean;
  pagesById: Record<string, { path: string; title: string }>;
}) {
  const themeStyle = themeToVars(theme);
  const publicHref = siteSlug ? `/s/${siteSlug}` : "#";

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </span>
        </div>
        {siteSlug ? (
          <a
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Open site ↗
          </a>
        ) : null}
      </div>

      <div className="space-y-0">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Header (primary)
            </span>
            {!primaryAssigned ? (
              <span className="text-[10px] text-muted-foreground">No published menu</span>
            ) : null}
          </div>
          <div style={themeStyle} className="border-y">
            <div
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{
                borderBottom: "1px solid color-mix(in srgb, var(--site-fg) 8%, transparent)",
              }}
            >
              <span className="truncate text-[13px] font-semibold" style={{ color: "var(--site-fg)" }}>
                {siteName}
              </span>
              <nav className="flex flex-wrap items-center justify-end gap-1">
                {primaryItems.length === 0 ? (
                  <span className="text-[11px]" style={{ color: "var(--site-muted)" }}>
                    {primaryAssigned ? "Empty menu" : "—"}
                  </span>
                ) : (
                  primaryItems.map((it, i) => (
                    <PreviewLink key={i} it={it} pagesById={pagesById} />
                  ))
                )}
              </nav>
            </div>
            <div
              className="px-4 py-6 text-[11px]"
              style={{ color: "var(--site-muted)" }}
            >
              Page content…
            </div>
          </div>
        </div>

        {/* Footer */}
        <div>
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Footer
            </span>
            {!footerAssigned ? (
              <span className="text-[10px] text-muted-foreground">No published menu</span>
            ) : null}
          </div>
          <div style={themeStyle} className="border-t">
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px]"
              style={{
                borderTop: "1px solid color-mix(in srgb, var(--site-fg) 8%, transparent)",
                color: "var(--site-muted)",
              }}
            >
              <span>© {new Date().getFullYear()} {siteName}</span>
              <nav className="flex flex-wrap gap-3">
                {footerItems.length === 0 ? (
                  <span>{footerAssigned ? "Empty menu" : "—"}</span>
                ) : (
                  footerItems.map((it, i) => (
                    <PreviewLink key={i} it={it} pagesById={pagesById} subtle />
                  ))
                )}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewLink({
  it,
  pagesById,
  subtle = false,
}: {
  it: DraftItem;
  pagesById: Record<string, { path: string; title: string }>;
  subtle?: boolean;
}) {
  const href = resolveDraftHref(it, pagesById);
  const unresolved = !href;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] " +
        (subtle ? "" : "")
      }
      style={{
        color: unresolved ? "var(--site-muted)" : "var(--site-fg)",
        backgroundColor: subtle
          ? "transparent"
          : "color-mix(in srgb, var(--site-fg) 6%, transparent)",
        opacity: unresolved ? 0.6 : 1,
      }}
      title={href ?? "Unresolved link"}
    >
      <span className="truncate max-w-[10rem]">{it.label || "(no label)"}</span>
      {unresolved ? <span aria-hidden>⚠</span> : null}
    </span>
  );
}

function MenuEditor({
  menu,
  pages,
  onSave,
  onSetSlot,
  onTogglePublished,
  onItemsChange,
  onDelete,
}: {
  menu: {
    id: string;
    key: string;
    label: string;
    isPublished: boolean;
    items: Array<{
      id: string;
      label: string;
      type: string;
      pageId: string | null;
      url: string | null;
      anchor: string | null;
      openInNewTab: boolean;
    }>;
  };
  pages: Array<{ id: string; title: string; path: string }>;
  onSave: (items: DraftItem[]) => Promise<unknown>;
  onSetSlot: (slot: "primary" | "footer" | "none") => Promise<unknown>;
  onTogglePublished: (isPublished: boolean) => Promise<unknown>;
  onItemsChange?: (items: DraftItem[]) => void;
  onDelete: () => void;
}) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    menu.items.map((it) => ({
      label: it.label,
      type: (it.type as DraftItem["type"]) ?? "page",
      pageId: it.pageId,
      url: it.url,
      anchor: it.anchor,
      openInNewTab: it.openInNewTab,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    if (!savedTick) return;
    const t = setTimeout(() => setSavedTick(0), 1500);
    return () => clearTimeout(t);
  }, [savedTick]);

  useEffect(() => {
    onItemsChange?.(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function update(idx: number, patch: Partial<DraftItem>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function remove(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }
  function reorder(from: number, to: number) {
    setItems((arr) => {
      if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
      const next = [...arr];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const slot: "primary" | "footer" | "none" =
    menu.key === "primary" ? "primary" : menu.key === "footer" ? "footer" : "none";
  function addItem(type: DraftItem["type"]) {
    setItems((arr) => [
      ...arr,
      {
        label: type === "page" ? (pages[0]?.title ?? "Link") : "Link",
        type,
        pageId: type === "page" ? pages[0]?.id ?? null : null,
        url: type === "url" ? "https://" : null,
        anchor: type === "anchor" ? "#section" : null,
        openInNewTab: false,
      },
    ]);
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{menu.label}</h2>
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] font-medium " +
              (slot === "primary"
                ? "bg-primary/15 text-primary"
                : slot === "footer"
                  ? "bg-amber-500/15 text-amber-600"
                  : "bg-muted text-muted-foreground")
            }
          >
            {slot === "none" ? "unassigned" : slot}
          </span>
          {!menu.isPublished ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              draft
            </span>
          ) : null}
          <span className="font-mono text-xs text-muted-foreground">· {menu.key}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={slot}
            onChange={(e) => onSetSlot(e.target.value as "primary" | "footer" | "none")}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            aria-label="Assign slot"
          >
            <option value="none">Unassigned</option>
            <option value="primary">Primary (header)</option>
            <option value="footer">Footer</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={menu.isPublished}
              onChange={(e) => onTogglePublished(e.target.checked)}
            />
            Published
          </label>
          {savedTick ? <span className="text-xs text-emerald-600">Saved</span> : null}
          <button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(items);
                setSavedTick(Date.now());
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onDelete}
            className="rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            Delete menu
          </button>
        </div>
      </header>

      <div className="divide-y">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No items yet.
          </p>
        ) : (
          items.map((it, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={(e) => {
                setDragIdx(idx);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== idx) setDragOver(idx);
              }}
              onDragLeave={() => setDragOver((v) => (v === idx ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIdx ?? Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(from)) reorder(from, idx);
                setDragIdx(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOver(null);
              }}
              className={
                "grid items-center gap-2 px-4 py-3 transition-colors sm:grid-cols-[auto_auto_1fr_1fr_2fr_auto] " +
                (dragOver === idx && dragIdx !== idx ? "bg-primary/5 ring-1 ring-primary/40" : "") +
                (dragIdx === idx ? " opacity-50" : "")
              }
            >
              <button
                type="button"
                aria-label="Drag to reorder"
                title="Drag to reorder"
                className="cursor-grab select-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="3" r="1.3" /><circle cx="5" cy="8" r="1.3" /><circle cx="5" cy="13" r="1.3" />
                  <circle cx="11" cy="3" r="1.3" /><circle cx="11" cy="8" r="1.3" /><circle cx="11" cy="13" r="1.3" />
                </svg>
              </button>
              <div className="flex flex-col">
                <button
                  onClick={() => reorder(idx, idx - 1)}
                  disabled={idx === 0}
                  className="text-xs disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => reorder(idx, idx + 1)}
                  disabled={idx === items.length - 1}
                  className="text-xs disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <input
                value={it.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Label"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
              <select
                value={it.type}
                onChange={(e) => update(idx, { type: e.target.value as DraftItem["type"] })}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="page">Page</option>
                <option value="url">External URL</option>
                <option value="anchor">Anchor</option>
              </select>
              {it.type === "page" ? (
                <select
                  value={it.pageId ?? ""}
                  onChange={(e) => update(idx, { pageId: e.target.value || null })}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">— select page —</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.path})
                    </option>
                  ))}
                </select>
              ) : it.type === "url" ? (
                <input
                  value={it.url ?? ""}
                  onChange={(e) => update(idx, { url: e.target.value })}
                  placeholder="https://example.com"
                  className="rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs"
                />
              ) : (
                <input
                  value={it.anchor ?? ""}
                  onChange={(e) => update(idx, { anchor: e.target.value })}
                  placeholder="#section"
                  className="rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs"
                />
              )}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={it.openInNewTab}
                    onChange={(e) => update(idx, { openInNewTab: e.target.checked })}
                  />
                  New tab
                </label>
                <button
                  onClick={() => remove(idx)}
                  className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="flex flex-wrap gap-2 border-t bg-muted/20 px-4 py-3">
        <button
          onClick={() => addItem("page")}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
        >
          + Page link
        </button>
        <button
          onClick={() => addItem("url")}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
        >
          + External URL
        </button>
        <button
          onClick={() => addItem("anchor")}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
        >
          + Anchor
        </button>
      </footer>
    </section>
  );
}
