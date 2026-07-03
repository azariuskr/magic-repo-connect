import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getSite } from "@/lib/sites.functions";
import {
  KNOWN_EVENT_TYPES,
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  listWorkflowRuns,
  saveWorkflow,
  type KnownEventType,
} from "@/lib/workflows.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/workflows/")({
  component: WorkflowsIndex,
});

type Step =
  | { id: string; type: "webhook"; url: string; method?: "POST" | "GET" }
  | { id: string; type: "log"; message: string };

const EVENT_LABELS: Record<KnownEventType, string> = {
  "order.created": "Order placed",
  "form.submitted": "Form submitted",
  "blog.post.published": "Blog post published",
};

function newStepId() {
  return `s_${Math.random().toString(36).slice(2, 9)}`;
}

function WorkflowsIndex() {
  const { siteId } = Route.useParams();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listWorkflows);
  const createFn = useServerFn(createWorkflow);
  const deleteFn = useServerFn(deleteWorkflow);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const listQuery = useQuery({
    queryKey: ["workflows", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEvent, setNewEvent] = useState<KnownEventType>("order.created");

  const createMut = useMutation({
    mutationFn: (input: { name: string; eventType: KnownEventType }) =>
      createFn({ data: { siteId, ...input } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["workflows", siteId] });
      setCreating(false);
      setNewName("");
      setSelectedId(r.id);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows", siteId] });
      setSelectedId(null);
    },
  });

  const site = siteQuery.data;
  const list = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Workflows</span>
      </div>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Run steps automatically when something happens on your site.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New workflow
        </button>
      </div>

      {creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            createMut.mutate({ name: newName.trim(), eventType: newEvent });
          }}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="Workflow name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={newEvent}
            onChange={(e) => setNewEvent(e.target.value as KnownEventType)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {KNOWN_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                When {EVENT_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
        </form>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border bg-card">
          {listQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No workflows yet.</p>
          ) : (
            <ul>
              {list.map((w) => (
                <li key={w.id} className="border-b last:border-0">
                  <button
                    onClick={() => setSelectedId(w.id)}
                    className={`flex w-full flex-col items-start gap-1 px-3 py-3 text-left text-sm hover:bg-accent/40 ${
                      selectedId === w.id ? "bg-accent/60" : ""
                    }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium">{w.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          w.status === "active"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {w.status}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {w.eventType ? EVENT_LABELS[w.eventType as KnownEventType] ?? w.eventType : "—"} · {w.stepCount} step{w.stepCount === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="rounded-lg border bg-card p-6">
          {selectedId ? (
            <WorkflowEditor
              key={selectedId}
              workflowId={selectedId}
              onDeleted={() => deleteMut.mutate(selectedId)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a workflow on the left, or create a new one to begin.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function WorkflowEditor({
  workflowId,
  onDeleted,
}: {
  workflowId: string;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getWorkflow);
  const saveFn = useServerFn(saveWorkflow);
  const runsFn = useServerFn(listWorkflowRuns);

  const q = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => getFn({ data: { id: workflowId } }),
  });
  const runsQuery = useQuery({
    queryKey: ["workflow-runs", workflowId],
    queryFn: () => runsFn({ data: { workflowId } }),
    refetchInterval: 5000,
  });

  const [name, setName] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [eventType, setEventType] = useState<KnownEventType>("order.created");
  const [steps, setSteps] = useState<Step[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name);
    setStatus(q.data.status as "draft" | "active" | "paused");
    setEventType(q.data.eventType as KnownEventType);
    setSteps(q.data.steps as Step[]);
    setDirty(false);
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: workflowId,
          name,
          status,
          eventType,
          graph: { nodes: steps, edges: [] },
        },
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      qc.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });

  const mark = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  };

  const addStep = (type: Step["type"]) => {
    const next: Step =
      type === "webhook"
        ? { id: newStepId(), type: "webhook", url: "", method: "POST" }
        : { id: newStepId(), type: "log", message: "" };
    setSteps((s) => [...s, next]);
    setDirty(true);
  };

  const updateStep = (id: string, patch: Partial<Step>) => {
    setSteps((s) => s.map((st) => (st.id === id ? ({ ...st, ...patch } as Step) : st)));
    setDirty(true);
  };

  const removeStep = (id: string) => {
    setSteps((s) => s.filter((st) => st.id !== id));
    setDirty(true);
  };

  const runs = runsQuery.data ?? [];
  const canPublish = useMemo(() => steps.length > 0, [steps]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <input
            value={name}
            onChange={(e) => mark(setName)(e.target.value)}
            className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-xl font-semibold focus:border-input focus:px-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => mark(setStatus)(e.target.value as typeof status)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          >
            <option value="draft">Draft</option>
            <option value="active" disabled={!canPublish}>Active</option>
            <option value="paused">Paused</option>
          </select>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!dirty || saveMut.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this workflow?")) onDeleted();
            }}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="rounded-md border bg-background p-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trigger
        </label>
        <select
          value={eventType}
          onChange={(e) => mark(setEventType)(e.target.value as KnownEventType)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {KNOWN_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              When {EVENT_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Steps
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => addStep("webhook")}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              + Webhook
            </button>
            <button
              onClick={() => addStep("log")}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              + Log
            </button>
          </div>
        </div>
        {steps.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No steps yet. Add a webhook to POST the event payload to a URL, or a log to record it.
          </p>
        ) : (
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={step.id} className="rounded-md border bg-background p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Step {i + 1} · {step.type}</span>
                  <button
                    onClick={() => removeStep(step.id)}
                    className="text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
                {step.type === "webhook" ? (
                  <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
                    <select
                      value={step.method ?? "POST"}
                      onChange={(e) =>
                        updateStep(step.id, { method: e.target.value as "POST" | "GET" })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                    <input
                      value={step.url}
                      onChange={(e) => updateStep(step.id, { url: e.target.value })}
                      placeholder="https://example.com/webhook"
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                ) : (
                  <input
                    value={step.message}
                    onChange={(e) => updateStep(step.id, { message: e.target.value })}
                    placeholder="Message to log server-side"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent runs
        </label>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      r.status === "success"
                        ? "bg-emerald-500"
                        : r.status === "error"
                          ? "bg-destructive"
                          : "bg-amber-500"
                    }`}
                  />
                  <span className="capitalize">{r.status}</span>
                  <span className="text-muted-foreground">
                    · {r.stepCount} step{r.stepCount === 1 ? "" : "s"}
                  </span>
                  {r.error ? (
                    <span className="text-destructive">· {r.error}</span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.startedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
