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

async function requireOwnedMenu(menuId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, siteMenus } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ menu: siteMenus, site: sites })
    .from(siteMenus)
    .innerJoin(sites, eq(sites.id, siteMenus.siteId))
    .where(and(eq(siteMenus.id, menuId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!row) throw new Error("Not found");
  return row;
}

const itemSchema = z.object({
  label: z.string().trim().min(1).max(80),
  type: z.enum(["page", "url", "anchor"]),
  pageId: z.string().uuid().nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
  anchor: z.string().trim().max(120).nullable().optional(),
  sortOrder: z.number().int().default(0),
  openInNewTab: z.boolean().default(false),
});

export const listMenus = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { siteMenus, siteMenuItems } = await import("@/db/schema");
    const { eq, asc, inArray } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const menus = await db
      .select()
      .from(siteMenus)
      .where(eq(siteMenus.siteId, site.id))
      .orderBy(asc(siteMenus.createdAt));
    if (menus.length === 0) return [];
    const items = await db
      .select()
      .from(siteMenuItems)
      .where(inArray(siteMenuItems.menuId, menus.map((m) => m.id)))
      .orderBy(asc(siteMenuItems.sortOrder));
    return menus.map((m) => ({ ...m, items: items.filter((it) => it.menuId === m.id) }));
  });

export const createMenu = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        siteId: z.string().uuid(),
        key: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[a-z0-9_-]+$/, "Lowercase letters, numbers, dashes/underscores"),
        label: z.string().trim().min(1).max(80),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { siteMenus } = await import("@/db/schema");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const [row] = await db
      .insert(siteMenus)
      .values({ siteId: site.id, key: data.key, label: data.label })
      .returning();
    return row;
  });

export const deleteMenu = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { siteMenus } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedMenu(data.id);
    await db.delete(siteMenus).where(eq(siteMenus.id, data.id));
    return { ok: true };
  });

export const replaceMenuItems = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        menuId: z.string().uuid(),
        items: z.array(itemSchema).max(50),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { siteMenuItems } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedMenu(data.menuId);
    await db.delete(siteMenuItems).where(eq(siteMenuItems.menuId, data.menuId));
    if (data.items.length === 0) return { ok: true };
    await db.insert(siteMenuItems).values(
      data.items.map((it, idx) => ({
        menuId: data.menuId,
        label: it.label,
        type: it.type,
        pageId: it.pageId ?? null,
        url: it.url ?? null,
        anchor: it.anchor ?? null,
        sortOrder: idx,
        openInNewTab: it.openInNewTab,
      })),
    );
    return { ok: true };
  });

// Public: resolve menu by site + key, return rendered nav items with paths.
export type PublishedMenuItem = {
  id: string;
  label: string;
  type: "page" | "url" | "anchor";
  href: string;
  openInNewTab: boolean;
};

export async function loadPublishedMenu(siteId: string, key: string): Promise<PublishedMenuItem[] | null> {
  const { db } = await import("@/db/client.server");
  const { siteMenus, siteMenuItems, sitePages } = await import("@/db/schema");
  const { and, eq, asc } = await import("drizzle-orm");
  const [menu] = await db
    .select()
    .from(siteMenus)
    .where(and(eq(siteMenus.siteId, siteId), eq(siteMenus.key, key)))
    .limit(1);
  if (!menu) return null;
  const items = await db
    .select({
      id: siteMenuItems.id,
      label: siteMenuItems.label,
      type: siteMenuItems.type,
      url: siteMenuItems.url,
      anchor: siteMenuItems.anchor,
      openInNewTab: siteMenuItems.openInNewTab,
      pagePath: sitePages.path,
    })
    .from(siteMenuItems)
    .leftJoin(sitePages, eq(sitePages.id, siteMenuItems.pageId))
    .where(eq(siteMenuItems.menuId, menu.id))
    .orderBy(asc(siteMenuItems.sortOrder));
  return items.map((it) => {
    let href = "#";
    if (it.type === "page" && it.pagePath) href = it.pagePath;
    else if (it.type === "url" && it.url) href = it.url;
    else if (it.type === "anchor" && it.anchor) href = it.anchor.startsWith("#") ? it.anchor : `#${it.anchor}`;
    return {
      id: it.id,
      label: it.label,
      type: it.type as "page" | "url" | "anchor",
      href,
      openInNewTab: it.openInNewTab,
    };
  });
}
