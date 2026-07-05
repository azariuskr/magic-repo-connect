import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getSite } from "@/lib/sites.functions";
import { listPages } from "@/lib/pages.functions";
import {
  applyGeneration,
  generatePagePatch,
  generateThemePatch,
  listGenerations,
  rejectGeneration,
  rollbackApplication,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/ai/")({
  component: AiIndex,
});

function AiIndex() {
  const { siteId } = Route.useParams();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listPagesFn = useServerFn(listPages);
  const listGenFn = useServerFn(listGenerations);
  const genPageFn = useServerFn(generatePagePatch);
  const genThemeFn = useServerFn(generateThemePatch);
  const applyFn = useServerFn(applyGeneration);
  const rejectFn = useServerFn(rejectGeneration);
  const rollbackFn = useServerFn(rollbackApplication);

  const siteQ = useQuery({ queryKey: ["site", siteId], queryFn: () => getSiteFn({ data: { id: siteId } }) });
  const pagesQ = useQuery({ queryKey: ["pages", siteId], queryFn: () => listPagesFn({ data: { siteId } }) });
  const gensQ = useQuery({
    queryKey: ["ai-generations", siteId],
    queryFn: () => listGenFn({ data: { siteId } }),
    refetchInterval: 4000,
  });

  const pages = pagesQ.data ?? [];
  const [pageId, setPageId] = useState<string>("");
  const currentPageId = pageId || pages[0]?.id || "";

  const [pagePrompt, setPagePrompt] = useState("Rewrite this page to be a modern, welcoming landing page.");
  const [themePrompt, setThemePrompt] = useState("Make a warm cafe theme, cream background, espresso brown text.");

  const invalidateGens = () => qc.invalidateQueries({ queryKey: ["ai-generations", siteId] });

  const genPageMut = useMutation({
    mutationFn: () => genPageFn({ data: { pageId: currentPageId, prompt: pagePrompt } }),
    onSuccess: invalidateGens,
  });
  const genThemeMut = useMutation({
    mutationFn: () => genThemeFn({ data: { siteId, prompt: themePrompt } }),
    onSuccess: invalidateGens,
  });
  const applyMut = useMutation({
    mutationFn: (id: string) => applyFn({ data: { id } }),
    onSuccess: () => { invalidateGens(); qc.invalidateQueries({ queryKey: ["site", siteId] }); },
  });
  const rejectMut = useMutation({ mutationFn: (id: string) => rejectFn({ data: { id } }), onSuccess: invalidateGens });
  const rollbackMut = useMutation({
    mutationFn: (genId: string) => rollbackFn({ data: { generationId: genId } }),
    onSuccess: () => { invalidateGens(); qc.invalidateQueries({ queryKey: ["site", siteId] }); },
  });

  const gens = gensQ.data ?? [];
  const site = siteQ.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">{site?.name ?? "…"}</Link>
        <span>/</span>
        <span className="text-foreground">AI assistant</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">AI assistant</h1>
        <p className="text-sm text-muted-foreground">
          Generate page content and themes. Every change is previewed, needs approval, and can be rolled back.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Generate a page</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AI proposes a full new layout for the selected page using approved blocks.
          </p>
          <div className="mt-3 space-y-2">
            <select
              value={currentPageId}
              onChange={(e) => setPageId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>{p.title} — {p.path}</option>
              ))}
            </select>
            <textarea
              rows={4}
              value={pagePrompt}
              onChange={(e) => setPagePrompt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Describe what you want on this page"
            />
            <button
              disabled={!currentPageId || genPageMut.isPending}
              onClick={() => genPageMut.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {genPageMut.isPending ? "Thinking…" : "Generate page draft"}
            </button>
            {genPageMut.error ? (
              <p className="text-xs text-destructive">{(genPageMut.error as Error).message}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Generate a theme</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AI proposes new color tokens for the whole site.
          </p>
          <div className="mt-3 space-y-2">
            <textarea
              rows={4}
              value={themePrompt}
              onChange={(e) => setThemePrompt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Describe the vibe (e.g. dark barbershop, coastal, minimal…)"
            />
            <button
              disabled={genThemeMut.isPending}
              onClick={() => genThemeMut.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {genThemeMut.isPending ? "Thinking…" : "Generate theme"}
            </button>
            {genThemeMut.error ? (
              <p className="text-xs text-destructive">{(genThemeMut.error as Error).message}</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Generations</h2>
        {gensQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : gens.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            No AI generations yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {gens.map((g) => (
              <GenerationCard
                key={g.id}
                gen={g}
                pages={pages}
                onApply={() => applyMut.mutate(g.id)}
                onReject={() => rejectMut.mutate(g.id)}
                onRollback={() => rollbackMut.mutate(g.id)}
                busy={applyMut.isPending || rejectMut.isPending || rollbackMut.isPending}
              />
            ))}
          </ul>

        )}
      </div>
    </div>
  );
}

type Gen = {
  id: string;
  prompt: string;
  targetType: string;
  targetId: string | null;
  status: string;
  createdAt: Date | string;
  proposedPatchJson: string;
};


function GenerationCard({
  gen,
  pages,
  onApply,
  onReject,
  onRollback,
  busy,
}: {
  gen: Gen;
  pages: Array<{ id: string; title: string; path: string }>;
  onApply: () => void;
  onReject: () => void;
  onRollback: () => void;
  busy: boolean;
}) {
  const [showJson, setShowJson] = useState(false);
  const pageLabel = useMemo(() => {
    if (gen.targetType !== "page") return null;
    return pages.find((p) => p.id === gen.targetId)?.title ?? "(page)";
  }, [gen, pages]);

  const summary = summarizePatch(gen);

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary uppercase tracking-wider">
              {gen.targetType}
            </span>
            {pageLabel ? <span className="text-muted-foreground">→ {pageLabel}</span> : null}
            <StatusBadge status={gen.status} />
            <span className="text-muted-foreground">
              {new Date(gen.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{gen.prompt}</p>
          <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {gen.status === "pending" ? (
            <>
              <button
                disabled={busy}
                onClick={onApply}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Apply
              </button>
              <button
                disabled={busy}
                onClick={onReject}
                className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : gen.status === "applied" ? (
            <button
              disabled={busy}
              onClick={onRollback}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"
            >
              Roll back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="text-xs text-muted-foreground hover:underline"
          >
            {showJson ? "Hide JSON" : "View JSON"}
          </button>
        </div>
      </div>
      {showJson ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-snug">
          {JSON.stringify(gen.proposedPatch, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "pending"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : status === "applied"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : status === "rejected"
          ? "bg-muted text-muted-foreground"
          : "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}>{status}</span>;
}

function summarizePatch(gen: Gen): string {
  if (gen.targetType === "page") {
    const content = (gen.proposedPatch as { content?: Array<{ type: string }> }).content ?? [];
    if (!content.length) return "Empty patch";
    return `${content.length} blocks: ${content.map((b) => b.type).join(" · ")}`;
  }
  if (gen.targetType === "theme") {
    const t = (gen.proposedPatch as { tokens?: Record<string, string> }).tokens ?? {};
    return `bg ${t.bg} · brand ${t.brand} · fg ${t.fg}`;
  }
  return "";
}
