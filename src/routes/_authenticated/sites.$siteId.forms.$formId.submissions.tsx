import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getForm, listSubmissions, markSubmissionRead, deleteSubmission } from "@/lib/forms.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/forms/$formId/submissions")({
  component: SubmissionsInbox,
});

function SubmissionsInbox() {
  const { siteId, formId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getForm);
  const listFn = useServerFn(listSubmissions);
  const markFn = useServerFn(markSubmissionRead);
  const delFn = useServerFn(deleteSubmission);

  const formQuery = useQuery({
    queryKey: ["form", formId],
    queryFn: () => getFn({ data: { id: formId } }),
  });
  const subsQuery = useQuery({
    queryKey: ["submissions", formId],
    queryFn: () => listFn({ data: { formId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["submissions", formId] });
    qc.invalidateQueries({ queryKey: ["forms", siteId] });
  };
  const markMut = useMutation({
    mutationFn: (v: { submissionId: string; read: boolean }) => markFn({ data: v }),
    onSuccess: invalidate,
  });
  const delMut = useMutation({
    mutationFn: (submissionId: string) => delFn({ data: { submissionId } }),
    onSuccess: invalidate,
  });

  const form = formQuery.data?.form;
  const subs = subsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/forms" params={{ siteId }} className="hover:underline">
          Forms
        </Link>
        <span>/</span>
        <Link
          to="/sites/$siteId/forms/$formId/edit"
          params={{ siteId, formId }}
          className="hover:underline"
        >
          {form?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Inbox</span>
      </div>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Submissions</h1>

      {subsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : subs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {subs.map((s) => {
            const data = (s.data ?? {}) as Record<string, string>;
            const isUnread = !s.readAt;
            return (
              <li
                key={s.id}
                className={`rounded-lg border bg-card p-4 ${isUnread ? "border-primary/40" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {isUnread ? (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                    <time>{new Date(s.createdAt).toLocaleString()}</time>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        markMut.mutate({ submissionId: s.id, read: isUnread })
                      }
                      className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      Mark as {isUnread ? "read" : "unread"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this submission?")) delMut.mutate(s.id);
                      }}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <dl className="grid gap-1.5 text-sm sm:grid-cols-[160px_1fr]">
                  {Object.entries(data).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                      <dd className="whitespace-pre-wrap break-words">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
