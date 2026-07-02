import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSite } from "@/lib/sites.functions";
import { listOrders, updateOrderStatus } from "@/lib/commerce.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/orders/")({
  component: OrdersIndex,
});

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const STATUSES = ["pending", "confirmed", "fulfilled", "cancelled"] as const;

function OrdersIndex() {
  const { siteId } = Route.useParams();
  const qc = useQueryClient();
  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listOrders);
  const updateFn = useServerFn(updateOrderStatus);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const ordersQuery = useQuery({
    queryKey: ["orders", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const updateMut = useMutation({
    mutationFn: (input: { id: string; status: (typeof STATUSES)[number] }) =>
      updateFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", siteId] }),
  });

  const site = siteQuery.data;
  const orders = ordersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Orders</span>
      </div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Every order placed on your storefront.</p>
        </div>
        <Link
          to="/sites/$siteId/products"
          params={{ siteId }}
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          Products
        </Link>
      </div>

      {ordersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{money(o.totalCents, o.currency)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) =>
                        updateMut.mutate({
                          id: o.id,
                          status: e.target.value as (typeof STATUSES)[number],
                        })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
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
