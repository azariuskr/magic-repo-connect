import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSite } from "@/lib/sites.functions";
import { listAuditLogs } from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/audit/")({
  component: AuditIndex,
});

function AuditIndex() {
  const { siteId } = Route.useParams();
  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listAuditLogs);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const logsQuery = useQuery({
    queryKey: ["audit", siteId],
    queryFn: () => listFn({ data: { siteId } }),
    refetchInterval: 15_000,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {siteQuery.data?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Audit log</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Recent privileged actions on this site — publishes, deletions, AI patches, integration changes.
        </p>
      </div>

      {logsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : logsQuery.error ? (
        <p className="text-sm text-destructive">{(logsQuery.error as Error).message}</p>
      ) : !logsQuery.data || logsQuery.data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No activity yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Resource</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.data.map((row) => (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-muted-foreground">{row.resourceType}</span>
                    {row.resourceId ? (
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground/70">
                        {row.resourceId.slice(0, 8)}…
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">{row.userEmail ?? row.userId ?? "system"}</td>
                  <td className="px-4 py-3">
                    <pre className="max-w-md overflow-x-auto rounded bg-muted/40 p-2 text-[10px] leading-tight">
                      {row.metadataJson === "{}" ? "" : row.metadataJson}
                    </pre>
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
