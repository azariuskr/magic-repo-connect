import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSite } from "@/lib/sites.functions";
import {
  PROVIDER_KEYS,
  PROVIDER_META,
  type IntegrationAccountSummary,
  type ProviderKey,
  createAccount,
  deleteAccount,
  listAccounts,
  testAccount,
  updateAccount,
} from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/integrations/")({
  component: IntegrationsIndex,
});

function IntegrationsIndex() {
  const { siteId } = Route.useParams();
  const qc = useQueryClient();
  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listAccounts);
  const createFn = useServerFn(createAccount);
  const deleteFn = useServerFn(deleteAccount);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const accountsQuery = useQuery({
    queryKey: ["integrations", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const [creating, setCreating] = useState<ProviderKey | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", siteId] }),
  });

  const site = siteQuery.data;
  const accounts = accountsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Integrations</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external services. Credentials are encrypted at rest and never returned to the browser.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {PROVIDER_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setCreating(k)}
            className="rounded-lg border bg-card p-4 text-left hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="text-sm font-medium">{PROVIDER_META[k].label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{PROVIDER_META[k].description}</div>
            <div className="mt-3 text-xs text-primary">+ Add</div>
          </button>
        ))}
      </div>

      {creating ? (
        <NewAccountForm
          siteId={siteId}
          providerKey={creating}
          onCancel={() => setCreating(null)}
          onCreated={() => {
            setCreating(null);
            qc.invalidateQueries({ queryKey: ["integrations", siteId] });
          }}
          createFn={(input) => createFn({ data: input })}
        />
      ) : null}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Connected accounts
      </h2>
      {accountsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No integrations yet. Pick a provider above to add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {accounts.map((acc) => (
            <AccountRow key={acc.id} acc={acc} onDelete={() => deleteMut.mutate(acc.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewAccountForm({
  siteId,
  providerKey,
  onCancel,
  onCreated,
  createFn,
}: {
  siteId: string;
  providerKey: ProviderKey;
  onCancel: () => void;
  onCreated: () => void;
  createFn: (input: {
    siteId: string;
    providerKey: ProviderKey;
    name: string;
    settings: Record<string, string>;
    credentials: Record<string, string>;
  }) => Promise<{ id: string }>;
}) {
  const meta = PROVIDER_META[providerKey];
  const [name, setName] = useState(meta.label);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [creds, setCreds] = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: () =>
      createFn({ siteId, providerKey, name: name.trim(), settings, credentials: creds }),
    onSuccess: () => onCreated(),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createMut.mutate();
      }}
      className="mb-6 space-y-3 rounded-lg border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New {meta.label}</h3>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {meta.settingsFields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
          <input
            required={f.required}
            placeholder={f.placeholder}
            value={settings[f.key] ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
        </label>
      ))}
      {meta.credentialsFields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
          <input
            required={f.required}
            type="password"
            placeholder={f.placeholder}
            value={creds[f.key] ?? ""}
            onChange={(e) => setCreds((s) => ({ ...s, [f.key]: e.target.value }))}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
        </label>
      ))}
      {createMut.error ? (
        <p className="text-xs text-destructive">{(createMut.error as Error).message}</p>
      ) : null}
      <button
        type="submit"
        disabled={createMut.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {createMut.isPending ? "Saving…" : "Save integration"}
      </button>
    </form>
  );
}

function AccountRow({
  acc,
  onDelete,
}: {
  acc: IntegrationAccountSummary;
  onDelete: () => void;
}) {
  const meta = PROVIDER_META[acc.providerKey];
  const qc = useQueryClient();
  const testFn = useServerFn(testAccount);
  const updateFn = useServerFn(updateAccount);
  const [editingCred, setEditingCred] = useState(false);
  const [creds, setCreds] = useState<Record<string, string>>({});

  const testMut = useMutation({
    mutationFn: () => testFn({ data: { id: acc.id } }),
  });
  const updateMut = useMutation({
    mutationFn: () => updateFn({ data: { id: acc.id, credentials: creds } }),
    onSuccess: () => {
      setEditingCred(false);
      setCreds({});
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            {acc.name}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {meta.label}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                acc.status === "active"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {acc.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {Object.entries(acc.settings)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Credentials: {acc.hasCredentials ? "stored (encrypted)" : "none"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            {testMut.isPending ? "Testing…" : "Test"}
          </button>
          <button
            onClick={() => setEditingCred((v) => !v)}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
          >
            {editingCred ? "Close" : "Update credentials"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete integration "${acc.name}"?`)) onDelete();
            }}
            className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>
      {testMut.data ? (
        <p
          className={`mt-3 rounded-md border px-3 py-2 text-xs ${
            testMut.data.ok ? "border-emerald-500/40 text-emerald-500" : "border-destructive/40 text-destructive"
          }`}
        >
          {testMut.data.ok ? "OK · " : "Failed · "}
          {testMut.data.detail}
        </p>
      ) : null}
      {editingCred ? (
        <div className="mt-3 space-y-2 rounded-md border p-3">
          {meta.credentialsFields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
              <input
                type="password"
                placeholder={f.placeholder}
                value={creds[f.key] ?? ""}
                onChange={(e) => setCreds((s) => ({ ...s, [f.key]: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </label>
          ))}
          <button
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending || Object.keys(creds).length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {updateMut.isPending ? "Saving…" : "Save credentials"}
          </button>
        </div>
      ) : null}
    </li>
  );
}
