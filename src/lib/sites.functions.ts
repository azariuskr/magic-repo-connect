import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireUser() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { auth } = await import("@/lib/auth.server");
  const req = getRequest();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only");

export const listSites = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureSchema } = await import("@/db/bootstrap.server");
  const { db } = await import("@/db/client.server");
  const { sites } = await import("@/db/schema");
  const { eq, desc } = await import("drizzle-orm");
  await ensureSchema();
  const user = await requireUser();
  return db
    .select()
    .from(sites)
    .where(eq(sites.ownerId, user.id))
    .orderBy(desc(sites.updatedAt));
});

export const createSite = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ name: z.string().trim().min(1).max(120), slug: slugSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites } = await import("@/db/schema");
    await ensureSchema();
    const user = await requireUser();
    const defaultTheme = {
      preset: "barber-dark",
      tokens: {
        bg: "#0a0a0a",
        surface: "#1a1a1a",
        brand: "#d4af37",
        fg: "#f5f5f5",
        muted: "#9ca3af",
        radius: "0.5rem",
        font: "Inter, system-ui, sans-serif",
      },
    };
    const defaultData = { content: [], root: { props: {} }, zones: {} };
    const [row] = await db
      .insert(sites)
      .values({
        ownerId: user.id,
        name: data.name,
        slug: data.slug,
        theme: defaultTheme,
        data: defaultData,
      })
      .returning();
    return row;
  });

export const getSite = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireUser();
    const [row] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, data.id), eq(sites.ownerId, user.id)))
      .limit(1);
    if (!row) throw new Error("Not found");
    return row;
  });

export const saveSite = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        data: z.any().optional(),
        theme: z.any().optional(),
        name: z.string().trim().min(1).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireUser();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.data !== undefined) update.data = data.data;
    if (data.theme !== undefined) update.theme = data.theme;
    if (data.name !== undefined) update.name = data.name;
    const [row] = await db
      .update(sites)
      .set(update)
      .where(and(eq(sites.id, data.id), eq(sites.ownerId, user.id)))
      .returning();
    if (!row) throw new Error("Not found");
    return row;
  });

export const publishSite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites } = await import("@/db/schema");
    const { and, eq, sql } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireUser();
    const [row] = await db
      .update(sites)
      .set({
        publishedData: sql`data`,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(sites.id, data.id), eq(sites.ownerId, user.id)))
      .returning();
    if (!row) throw new Error("Not found");
    return row;
  });

// Public: read a published site by slug. No auth.
export const getPublishedSite = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites } = await import("@/db/schema");
    const { and, eq, isNotNull } = await import("drizzle-orm");
    await ensureSchema();
    const [row] = await db
      .select({
        name: sites.name,
        slug: sites.slug,
        theme: sites.theme,
        publishedData: sites.publishedData,
        publishedAt: sites.publishedAt,
      })
      .from(sites)
      .where(and(eq(sites.slug, data.slug), isNotNull(sites.publishedData)))
      .limit(1);
    return row ?? null;
  });

// Public: submit contact form
export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        siteId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { siteSubmissions } = await import("@/db/schema");
    await ensureSchema();
    await db.insert(siteSubmissions).values({
      siteId: data.siteId,
      data: { name: data.name, email: data.email, message: data.message },
    });
    return { ok: true };
  });
