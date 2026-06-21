import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

async function requireOwnedPage(pageId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, sitePages } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [page] = await db.select().from(sitePages).where(eq(sitePages.id, pageId)).limit(1);
  if (!page) throw new Error("Not found");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, page.siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site, page };
}

// Path validation: "/", "/about", "/services/pricing"; lowercase, dashes.
const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/,
    'Path must start with "/" and use lowercase letters, numbers and dashes',
  );

// One-time migration: if a site has no pages, seed a home page from legacy
// sites.data / sites.published_data so existing sites keep working.
async function backfillHomePage(siteRow: {
  id: string;
  name: string;
  data: unknown;
  publishedData: unknown;
  publishedAt: Date | null;
}) {
  const { db } = await import("@/db/client.server");
  const { sitePages } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const existing = await db
    .select({ id: sitePages.id })
    .from(sitePages)
    .where(eq(sitePages.siteId, siteRow.id))
    .limit(1);
  if (existing.length) return;
  const legacyData =
    (siteRow.data as { content?: unknown } | null)?.content !== undefined
      ? (siteRow.data as object)
      : { content: [], root: { props: {} } };
  await db.insert(sitePages).values({
    siteId: siteRow.id,
    title: "Home",
    path: "/",
    isHome: true,
    navLabel: "Home",
    navOrder: 0,
    showInNav: true,
    puckData: legacyData as never,
    publishedData: (siteRow.publishedData as never) ?? null,
    publishedAt: siteRow.publishedAt ?? null,
  });
}

export const listPages = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ siteId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sitePages } = await import("@/db/schema");
    const { eq, asc } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    await backfillHomePage(site);
    return db
      .select()
      .from(sitePages)
      .where(eq(sitePages.siteId, site.id))
      .orderBy(asc(sitePages.navOrder), asc(sitePages.createdAt));
  });

export const getPage = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    await ensureSchema();
    const { page, site } = await requireOwnedPage(data.id);
    return { page, site };
  });

export const createPage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        siteId: z.string().uuid(),
        title: z.string().trim().min(1).max(120),
        path: pathSchema,
        navLabel: z.string().trim().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sitePages } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    await backfillHomePage(site);
    if (data.path === "/") {
      throw new Error("A home page already exists");
    }
    const [{ next }] = await db
      .select({ next: sql<number>`COALESCE(MAX(${sitePages.navOrder}), 0) + 10` })
      .from(sitePages)
      .where(eq(sitePages.siteId, site.id));
    const [row] = await db
      .insert(sitePages)
      .values({
        siteId: site.id,
        title: data.title,
        path: data.path,
        isHome: false,
        navLabel: data.navLabel ?? data.title,
        navOrder: next ?? 10,
        showInNav: true,
        puckData: { content: [], root: { props: {} } } as never,
      })
      .returning();
    return row;
  });

export const savePage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        data: z.any().optional(),
        title: z.string().trim().min(1).max(120).optional(),
        path: pathSchema.optional(),
        navLabel: z.string().trim().max(60).nullable().optional(),
        navOrder: z.number().int().optional(),
        showInNav: z.boolean().optional(),
        seoTitle: z.string().trim().max(200).nullable().optional(),
        seoDescription: z.string().trim().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sitePages } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    const { page } = await requireOwnedPage(data.id);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.data !== undefined) update.puckData = data.data;
    if (data.title !== undefined) update.title = data.title;
    if (data.path !== undefined && !page.isHome && data.path !== "/") update.path = data.path;
    if (data.navLabel !== undefined) update.navLabel = data.navLabel;
    if (data.navOrder !== undefined) update.navOrder = data.navOrder;
    if (data.showInNav !== undefined) update.showInNav = data.showInNav;
    if (data.seoTitle !== undefined) update.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) update.seoDescription = data.seoDescription;
    const [row] = await db.update(sitePages).set(update).where(eq(sitePages.id, data.id)).returning();
    return row;
  });

export const publishPage = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sitePages, pageVersions } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    await ensureSchema();
    const { user, page } = await requireOwnedPage(data.id);
    const [row] = await db
      .update(sitePages)
      .set({
        publishedData: sql`puck_data`,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sitePages.id, data.id))
      .returning();
    // Snapshot a version
    const [{ next }] = await db
      .select({ next: sql<number>`COALESCE(MAX(${pageVersions.versionNumber}), 0) + 1` })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, data.id));
    await db.insert(pageVersions).values({
      pageId: row.id,
      siteId: row.siteId,
      versionNumber: next ?? 1,
      source: "publish",
      title: row.title,
      path: row.path,
      puckData: row.puckData as never,
      createdBy: user.id,
    });
    return row;
  });

export const listPageVersions = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ pageId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { pageVersions } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedPage(data.pageId);
    return db
      .select({
        id: pageVersions.id,
        versionNumber: pageVersions.versionNumber,
        label: pageVersions.label,
        source: pageVersions.source,
        title: pageVersions.title,
        createdAt: pageVersions.createdAt,
        createdBy: pageVersions.createdBy,
      })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, data.pageId))
      .orderBy(desc(pageVersions.versionNumber))
      .limit(50);
  });

export const revertPageVersion = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ pageId: z.string().uuid(), versionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sitePages, pageVersions } = await import("@/db/schema");
    const { eq, and, sql } = await import("drizzle-orm");
    await ensureSchema();
    const { user, page } = await requireOwnedPage(data.pageId);
    const [version] = await db
      .select()
      .from(pageVersions)
      .where(and(eq(pageVersions.id, data.versionId), eq(pageVersions.pageId, data.pageId)))
      .limit(1);
    if (!version) throw new Error("Version not found");
    const [row] = await db
      .update(sitePages)
      .set({
        puckData: version.puckData as never,
        publishedData: version.puckData as never,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sitePages.id, data.pageId))
      .returning();
    // Snapshot the revert as a new version for traceability
    const [{ next }] = await db
      .select({ next: sql<number>`COALESCE(MAX(${pageVersions.versionNumber}), 0) + 1` })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, data.pageId));
    await db.insert(pageVersions).values({
      pageId: data.pageId,
      siteId: page.siteId,
      versionNumber: next ?? 1,
      source: "revert",
      label: `Reverted to v${version.versionNumber}`,
      title: row.title,
      path: row.path,
      puckData: row.puckData as never,
      createdBy: user.id,
    });
    return row;
  });

export const deletePage = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sitePages } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    const { page } = await requireOwnedPage(data.id);
    if (page.isHome) throw new Error("Cannot delete the home page");
    await db.delete(sitePages).where(eq(sitePages.id, data.id));
    return { ok: true };
  });

// ---------- Public ----------

export type PublishedNavItem = {
  id: string;
  path: string;
  label: string;
};

export const getPublishedPage = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        siteSlug: z.string().trim().min(1).max(64),
        path: z.string().trim().min(1).max(200).default("/"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites, sitePages } = await import("@/db/schema");
    const { eq, and, isNotNull, asc } = await import("drizzle-orm");
    await ensureSchema();

    const normalized = data.path.startsWith("/") ? data.path : "/" + data.path;

    const [site] = await db.select().from(sites).where(eq(sites.slug, data.siteSlug)).limit(1);
    if (!site) return null;

    let [page] = await db
      .select()
      .from(sitePages)
      .where(
        and(
          eq(sitePages.siteId, site.id),
          eq(sitePages.path, normalized),
          isNotNull(sitePages.publishedData),
        ),
      )
      .limit(1);

    // Legacy fallback: site has no pages yet but has published_data on sites table.
    if (!page && normalized === "/" && site.publishedData) {
      page = {
        id: "__legacy__",
        siteId: site.id,
        title: site.name,
        path: "/",
        isHome: true,
        navLabel: "Home",
        navOrder: 0,
        showInNav: true,
        seoTitle: null,
        seoDescription: null,
        puckData: site.publishedData,
        publishedData: site.publishedData,
        publishedAt: site.publishedAt,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      } as never;
    }

    if (!page) return null;

    const navRows = await db
      .select({
        id: sitePages.id,
        path: sitePages.path,
        title: sitePages.title,
        navLabel: sitePages.navLabel,
      })
      .from(sitePages)
      .where(
        and(
          eq(sitePages.siteId, site.id),
          eq(sitePages.showInNav, true),
          isNotNull(sitePages.publishedData),
        ),
      )
      .orderBy(asc(sitePages.navOrder));

    const nav: PublishedNavItem[] = navRows.map((r) => ({
      id: r.id,
      path: r.path,
      label: r.navLabel?.trim() || r.title,
    }));

    const { loadPublishedMenu } = await import("@/lib/menus.functions");
    const [primaryMenu, footerMenu] = await Promise.all([
      loadPublishedMenu(site.id, "primary"),
      loadPublishedMenu(site.id, "footer"),
    ]);

    return {
      site: { name: site.name, slug: site.slug, theme: site.theme },
      page,
      nav,
      primaryMenu,
      footerMenu,
    };
  });
