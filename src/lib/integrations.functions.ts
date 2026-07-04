import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Providers supported in v1.
export const PROVIDER_KEYS = ["webhook", "email_resend", "http_generic"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export const PROVIDER_META: Record<
  ProviderKey,
  {
    label: string;
    description: string;
    settingsFields: { key: string; label: string; placeholder?: string; required?: boolean }[];
    credentialsFields: { key: string; label: string; placeholder?: string; required?: boolean }[];
  }
> = {
  webhook: {
    label: "Webhook",
    description: "POST event payloads to any URL. Optionally sign requests with a shared secret.",
    settingsFields: [
      { key: "url", label: "Webhook URL", placeholder: "https://example.com/webhook", required: true },
    ],
    credentialsFields: [
      { key: "secret", label: "Signing secret (optional)", placeholder: "shared secret" },
    ],
  },
  email_resend: {
    label: "Email (Resend)",
    description: "Send transactional emails via Resend.",
    settingsFields: [
      { key: "fromEmail", label: "From email", placeholder: "hello@yoursite.com", required: true },
      { key: "fromName", label: "From name", placeholder: "Your Site" },
    ],
    credentialsFields: [
      { key: "apiKey", label: "Resend API key", placeholder: "re_...", required: true },
    ],
  },
  http_generic: {
    label: "Generic HTTP",
    description: "Call any HTTP JSON API with a base URL and an auth header.",
    settingsFields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://api.example.com", required: true },
    ],
    credentialsFields: [
      { key: "authHeader", label: "Authorization header (optional)", placeholder: "Bearer sk_..." },
    ],
  },
};

async function requireSession() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { auth } = await import("@/lib/auth.server");
  const req = getRequest();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

async function requireOwnedSite(siteId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site };
}

async function requireOwnedAccount(id: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { integrationAccounts, sites } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [acc] = await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, id)).limit(1);
  if (!acc) throw new Error("Not found");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, acc.siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { account: acc, site, user };
}

export type IntegrationAccountSummary = {
  id: string;
  name: string;
  providerKey: ProviderKey;
  status: string;
  settings: Record<string, string>;
  hasCredentials: boolean;
  updatedAt: string;
};

export const listAccounts = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<IntegrationAccountSummary[]> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { integrationAccounts } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedSite(data.siteId);
    const rows = await db
      .select()
      .from(integrationAccounts)
      .where(eq(integrationAccounts.siteId, data.siteId))
      .orderBy(desc(integrationAccounts.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      providerKey: r.providerKey as ProviderKey,
      status: r.status,
      settings: Object.fromEntries(
        Object.entries((r.settings ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
      ),
      hasCredentials: !!r.encryptedCredentials,
      updatedAt: r.updatedAt.toISOString(),
    }));
  });

const credSchema = z.record(z.string(), z.string().max(4000)).optional();
const settingsSchema = z.record(z.string(), z.string().max(4000));

export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        siteId: z.string().uuid(),
        providerKey: z.enum(PROVIDER_KEYS),
        name: z.string().trim().min(1).max(120),
        settings: settingsSchema,
        credentials: credSchema,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { integrationAccounts } = await import("@/db/schema");
    const { encryptJson } = await import("@/lib/crypto.server");
    await ensureSchema();
    await requireOwnedSite(data.siteId);
    const encrypted =
      data.credentials && Object.keys(data.credentials).length > 0
        ? encryptJson(data.credentials)
        : null;
    const [row] = await db
      .insert(integrationAccounts)
      .values({
        siteId: data.siteId,
        providerKey: data.providerKey,
        name: data.name,
        settings: data.settings,
        encryptedCredentials: encrypted,
      })
      .returning({ id: integrationAccounts.id });
    return { id: row.id };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        settings: settingsSchema.optional(),
        credentials: credSchema, // if provided and non-empty, re-encrypts
        status: z.enum(["active", "paused"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { integrationAccounts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { encryptJson } = await import("@/lib/crypto.server");
    await ensureSchema();
    await requireOwnedAccount(data.id);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.settings !== undefined) update.settings = data.settings;
    if (data.status !== undefined) update.status = data.status;
    if (data.credentials && Object.keys(data.credentials).length > 0) {
      update.encryptedCredentials = encryptJson(data.credentials);
    }
    await db.update(integrationAccounts).set(update).where(eq(integrationAccounts.id, data.id));
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { integrationAccounts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedAccount(data.id);
    await db.delete(integrationAccounts).where(eq(integrationAccounts.id, data.id));
    return { ok: true };
  });

export const testAccount = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    await ensureSchema();
    const { account } = await requireOwnedAccount(data.id);
    const { runIntegrationCall } = await import("@/lib/integrations.server");
    try {
      const result = await runIntegrationCall(account.id, {
        payload: { test: true, at: new Date().toISOString() },
      });
      return { ok: true, detail: JSON.stringify(result).slice(0, 500) };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  });
