import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getForm, saveForm } from "@/lib/forms.functions";
import type { FormField } from "@/db/schema";

export const Route = createFileRoute("/_authenticated/sites/$siteId/forms/$formId/edit")({
  component: FormEditor,
});

const TYPES: FormField["type"][] = ["text", "email", "textarea", "tel"];

function FormEditor() {
  const { siteId, formId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getForm);
  const saveFn = useServerFn(saveForm);

  const formQuery = useQuery({
    queryKey: ["form", formId],
    queryFn: () => getFn({ data: { id: formId } }),
  });

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [submitLabel, setSubmitLabel] = useState("Send");
  const [successMessage, setSuccessMessage] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  useEffect(() => {
    if (!formQuery.data) return;
    const f = formQuery.data.form;
    setName(f.name);
    setKey(f.key ?? "");
    setFields(f.schema?.fields ?? []);
    setSubmitLabel(f.settings?.submitLabel ?? "Send");
    setSuccessMessage(f.settings?.successMessage ?? "");
    setNotifyEmail(f.settings?.notifyEmail ?? "");
  }, [formQuery.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: formId,
          name,
          key: key || undefined,
          fields,
          settings: {
            submitLabel,
            successMessage,
            notifyEmail: notifyEmail || null,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form", formId] });
      qc.invalidateQueries({ queryKey: ["forms", siteId] });
    },
  });

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const removeField = (idx: number) => setFields((prev) => prev.filter((_, i) => i !== idx));
  const addField = () =>
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length + 1}`, label: "New field", type: "text", required: false },
    ]);
  const move = (idx: number, dir: -1 | 1) =>
    setFields((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  if (formQuery.isLoading) return <p className="p-10 text-sm text-muted-foreground">Loading…</p>;
  if (formQuery.error)
    return <p className="p-10 text-sm text-destructive">{(formQuery.error as Error).message}</p>;

  const site = formQuery.data?.site;
  const shareUrl = site && key ? `/s/${site.slug}/f/${key}` : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/forms" params={{ siteId }} className="hover:underline">
          Forms
        </Link>
        <span>/</span>
        <span className="text-foreground">{name || "Untitled"}</span>
      </div>

      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Edit form</h1>
        <div className="flex items-center gap-2">
          {shareUrl ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              View ↗
            </a>
          ) : null}
          <Link
            to="/sites/$siteId/forms/$formId/submissions"
            params={{ siteId, formId }}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Inbox
          </Link>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveMut.error ? (
        <p className="mb-4 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {(saveMut.error as Error).message}
        </p>
      ) : null}
      {saveMut.isSuccess ? (
        <p className="mb-4 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
          Saved.
        </p>
      ) : null}

      <div className="grid gap-6">
        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">URL key</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Fields</h2>
            <button
              onClick={addField}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              + Add field
            </button>
          </div>
          <div className="space-y-2">
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields yet.</p>
            ) : null}
            {fields.map((f, idx) => (
              <div
                key={idx}
                className="grid items-center gap-2 rounded-md border bg-background p-2 sm:grid-cols-[auto_1fr_1fr_auto_auto_auto]"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => move(idx, -1)}
                    className="px-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    className="px-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>
                <input
                  value={f.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })}
                  placeholder="Label"
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <input
                  value={f.key}
                  onChange={(e) => updateField(idx, { key: e.target.value })}
                  placeholder="field_key"
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
                />
                <select
                  value={f.type}
                  onChange={(e) =>
                    updateField(idx, { type: e.target.value as FormField["type"] })
                  }
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) => updateField(idx, { required: e.target.checked })}
                  />
                  required
                </label>
                <button
                  onClick={() => removeField(idx)}
                  className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Submit button label</span>
            <input
              value={submitLabel}
              onChange={(e) => setSubmitLabel(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Notify email (future email action)</span>
            <input
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Success message</span>
            <textarea
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              rows={2}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
