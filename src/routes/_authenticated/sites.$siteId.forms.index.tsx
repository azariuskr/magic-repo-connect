import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSite } from "@/lib/sites.functions";
import { createForm, deleteForm, listForms } from "@/lib/forms.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/forms/")({
  component: FormsIndex,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function FormsIndex() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listForms);
  const createFn = useServerFn(createForm);
  const deleteFn = useServerFn(deleteForm);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const formsQuery = useQuery({
    queryKey: ["forms", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["forms", siteId] });

  const createMut = useMutation({
    mutationFn: (input: { name: string; key: string }) =>
      createFn({ data: { siteId, ...input } }),
    onSuccess: (form) => {
      invalidate();
      navigate({ to: "/sites/$siteId/forms/$formId/edit", params: { siteId, formId: form.id } });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);

  const site = siteQuery.data;
  const forms = formsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Forms</span>
      </div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Build contact / lead capture forms. Share the URL or embed later.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New form
        </button>
      </div>

      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ name, key: key || slugify(name) });
          }}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="Form name (e.g. Contact)"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched) setKey(slugify(e.target.value));
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="contact"
            value={key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value);
            }}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
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

      {formsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : forms.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No forms yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Key</th>
                <th className="px-4 py-2.5">Submissions</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium">{f.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {f.key ? `/f/${f.key}` : <span className="italic">no key</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {f.submissionCount}
                    {f.unreadCount > 0 ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {f.unreadCount} new
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {site && f.key ? (
                        <a
                          href={`/s/${site.slug}/f/${f.key}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                        >
                          View ↗
                        </a>
                      ) : null}
                      <Link
                        to="/sites/$siteId/forms/$formId/submissions"
                        params={{ siteId, formId: f.id }}
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        Inbox
                      </Link>
                      <Link
                        to="/sites/$siteId/forms/$formId/edit"
                        params={{ siteId, formId: f.id }}
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Delete form "${f.name}"?`)) deleteMut.mutate(f.id);
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
