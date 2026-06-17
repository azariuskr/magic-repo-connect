import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Puck, type Data } from "@measured/puck";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSite, saveSite, publishSite } from "@/lib/sites.functions";
import { buildPuckConfig } from "@/lib/blocks";
import { DEFAULT_THEME, PRESETS, type SiteTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/sites/$siteId/edit")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: "https://unpkg.com/@measured/puck@0.20.2/dist/index.css" },
      { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
    ],
  }),
  component: EditSite,
});


function EditSite() {
  const { siteId } = Route.useParams();
  const get = useServerFn(getSite);
  const save = useServerFn(saveSite);
  const publish = useServerFn(publishSite);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => get({ data: { id: siteId } }),
  });

  const saveMut = useMutation({
    mutationFn: (input: { data?: Data; theme?: SiteTheme; name?: string }) =>
      save({ data: { id: siteId, ...input } }),
  });

  const publishMut = useMutation({
    mutationFn: () => publish({ data: { id: siteId } }),
    onSuccess: () => siteQuery.refetch(),
  });

  const config = useMemo(() => buildPuckConfig(siteId), [siteId]);
  const [theme, setTheme] = useState<SiteTheme>(DEFAULT_THEME);
  const [showTheme, setShowTheme] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate theme once
  useEffect(() => {
    if (siteQuery.data?.theme) {
      setTheme(siteQuery.data.theme as SiteTheme);
    }
  }, [siteQuery.data?.id]);

  if (siteQuery.isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (siteQuery.error)
    return <p className="p-8 text-sm text-destructive">{(siteQuery.error as Error).message}</p>;
  if (!siteQuery.data) return null;

  const site = siteQuery.data;
  const initialData: Data = (site.data as Data) && (site.data as Data).content
    ? (site.data as Data)
    : ({ content: [], root: { props: {} }, zones: {} } as Data);

  function scheduleSave(next: Partial<{ data: Data; theme: SiteTheme }>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveMut.mutate(next);
    }, 800);
  }

  return (
    <div className="flex h-[calc(100dvh-57px)] flex-col bg-muted/30">
      <style>{`
        .puck-shell { height: 100%; }
        .puck-shell [class*="_Puck"] { --puck-color-azure-04: hsl(var(--primary) / 0.9); }
        .puck-shell [class*="PuckCanvas"] { background: hsl(var(--muted)); }
        .puck-shell [class*="SidebarSection"] { background: hsl(var(--card)); }
        .puck-shell [class*="Puck-portal"] { z-index: 60; }
        .puck-shell button[class*="IconButton"]:hover { background: hsl(var(--accent)); }
        .puck-shell [class*="Drawer-item"] {
          border-radius: 0.5rem;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .puck-shell [class*="Drawer-item"]:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px -6px hsl(var(--primary) / 0.4);
        }
      `}</style>
      <div className="flex items-center justify-between border-b bg-card/80 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ← All sites
          </Link>
          <div className="h-5 w-px bg-border" />
          <span className="truncate text-sm font-semibold">{site.name}</span>
          <span className="hidden truncate rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            /s/{site.slug}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saveMut.isPending ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Saving…
            </span>
          ) : saveMut.isSuccess ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Saved
            </span>
          ) : null}
          <button
            onClick={() => setShowTheme((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              showTheme ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
            }`}
          >
            🎨 Theme
          </button>
          <a
            href={`/s/${site.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Preview ↗
          </a>
          <button
            onClick={() => publishMut.mutate()}
            disabled={publishMut.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow disabled:opacity-50"
          >
            {publishMut.isPending ? "Publishing…" : site.publishedAt ? "Republish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="puck-shell h-full">
          <Puck
            config={config}
            data={initialData}
            onChange={(next) => scheduleSave({ data: next })}
          />
        </div>
        {showTheme && (
          <ThemePanel
            theme={theme}
            onChange={(next) => {
              setTheme(next);
              scheduleSave({ theme: next });
            }}
            onClose={() => setShowTheme(false)}
          />
        )}
      </div>
    </div>
  );
}

function ThemePanel({
  theme,
  onChange,
  onClose,
}: {
  theme: SiteTheme;
  onChange: (t: SiteTheme) => void;
  onClose: () => void;
}) {
  const setToken = (key: keyof SiteTheme["tokens"], value: string) =>
    onChange({ ...theme, tokens: { ...theme.tokens, [key]: value } });

  return (
    <div className="absolute right-4 top-4 z-50 w-80 rounded-lg border bg-card p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Theme</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground">
          Close
        </button>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium">Preset</label>
        <select
          value={theme.preset || "barber-dark"}
          onChange={(e) => {
            const preset = e.target.value;
            onChange({ preset, tokens: PRESETS[preset] || theme.tokens });
          }}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {Object.keys(PRESETS).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Background" value={theme.tokens.bg} onChange={(v) => setToken("bg", v)} />
        <ColorField label="Surface" value={theme.tokens.surface} onChange={(v) => setToken("surface", v)} />
        <ColorField label="Brand" value={theme.tokens.brand} onChange={(v) => setToken("brand", v)} />
        <ColorField label="Text" value={theme.tokens.fg} onChange={(v) => setToken("fg", v)} />
        <ColorField label="Muted" value={theme.tokens.muted} onChange={(v) => setToken("muted", v)} />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium">Radius</label>
        <select
          value={theme.tokens.radius}
          onChange={(e) => setToken("radius", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="0">Square</option>
          <option value="0.25rem">Small</option>
          <option value="0.5rem">Medium</option>
          <option value="0.75rem">Large</option>
          <option value="1rem">XL</option>
        </select>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium">Font</label>
        <select
          value={theme.tokens.font}
          onChange={(e) => setToken("font", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="Inter, system-ui, sans-serif">Inter (sans)</option>
          <option value="Georgia, serif">Georgia (serif)</option>
          <option value='ui-monospace, "SFMono-Regular", monospace'>Monospace</option>
        </select>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
    </label>
  );
}
