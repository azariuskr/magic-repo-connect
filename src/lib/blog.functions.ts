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

async function requireOwnedPost(postId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, blogPosts } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
  if (!post) throw new Error("Not found");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, post.siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site, post };
}

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and dashes");

// Drizzle's jsonb columns serialize as `unknown`, which TanStack server-fn's
// serializer rejects. We never return `contentJson` over the wire — admin uses
// `contentHtml` only — so strip it from any row before returning.
type BlogPostPublic = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string | null;
  status: string;
  coverImageKey: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
function stripPost(row: { contentJson?: unknown } & BlogPostPublic): BlogPostPublic {
  const { contentJson: _omit, ...rest } = row;
  void _omit;
  return rest;
}

export const listBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    return db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        status: blogPosts.status,
        publishedAt: blogPosts.publishedAt,
        updatedAt: blogPosts.updatedAt,
      })
      .from(blogPosts)
      .where(eq(blogPosts.siteId, site.id))
      .orderBy(desc(blogPosts.updatedAt));
  });

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    await ensureSchema();
    const { post, site } = await requireOwnedPost(data.id);
    return { post: stripPost(post), site };
  });

export const createBlogPost = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        siteId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        slug: slugSchema,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const [row] = await db
      .insert(blogPosts)
      .values({
        siteId: site.id,
        title: data.title,
        slug: data.slug,
        status: "draft",
      })
      .returning();
    return stripPost(row);
  });

export const saveBlogPost = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        slug: slugSchema.optional(),
        excerpt: z.string().trim().max(500).nullable().optional(),
        contentHtml: z.string().max(200_000).optional(),
        coverImageKey: z.string().max(500).nullable().optional(),
        seoTitle: z.string().trim().max(200).nullable().optional(),
        seoDescription: z.string().trim().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedPost(data.id);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) update.title = data.title;
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.excerpt !== undefined) update.excerpt = data.excerpt;
    if (data.contentHtml !== undefined) update.contentHtml = data.contentHtml;
    if (data.coverImageKey !== undefined) update.coverImageKey = data.coverImageKey;
    if (data.seoTitle !== undefined) update.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) update.seoDescription = data.seoDescription;
    const [row] = await db.update(blogPosts).set(update).where(eq(blogPosts.id, data.id)).returning();
    return stripPost(row);
  });

export const publishBlogPost = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedPost(data.id);
    const [row] = await db
      .update(blogPosts)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(blogPosts.id, data.id))
      .returning();
    return stripPost(row);
  });

export const unpublishBlogPost = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedPost(data.id);
    const [row] = await db
      .update(blogPosts)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(blogPosts.id, data.id))
      .returning();
    return stripPost(row);
  });

export const deleteBlogPost = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedPost(data.id);
    await db.delete(blogPosts).where(eq(blogPosts.id, data.id));
    return { ok: true };
  });

// ---------- Public ----------

export type PublishedBlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
};

async function loadSiteShell(siteSlug: string) {
  const { db } = await import("@/db/client.server");
  const { sites, sitePages } = await import("@/db/schema");
  const { eq, and, isNotNull, asc } = await import("drizzle-orm");
  const [site] = await db.select().from(sites).where(eq(sites.slug, siteSlug)).limit(1);
  if (!site) return null;
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
  const nav = navRows.map((r) => ({ id: r.id, path: r.path, label: r.navLabel?.trim() || r.title }));
  const { loadPublishedMenu } = await import("@/lib/menus.functions");
  const [primaryMenu, footerMenu] = await Promise.all([
    loadPublishedMenu(site.id, "primary"),
    loadPublishedMenu(site.id, "footer"),
  ]);
  return { site, nav, primaryMenu, footerMenu };
}

export const getPublishedBlogIndex = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteSlug: z.string().trim().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    await ensureSchema();
    const shell = await loadSiteShell(data.siteSlug);
    if (!shell) return null;
    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(and(eq(blogPosts.siteId, shell.site.id), eq(blogPosts.status, "published")))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(50);
    return { ...shell, posts };
  });

export const getPublishedBlogPost = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z
      .object({
        siteSlug: z.string().trim().min(1).max(64),
        slug: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const shell = await loadSiteShell(data.siteSlug);
    if (!shell) return null;
    const [post] = await db
      .select({
        id: blogPosts.id,
        siteId: blogPosts.siteId,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        contentHtml: blogPosts.contentHtml,
        status: blogPosts.status,
        coverImageKey: blogPosts.coverImageKey,
        seoTitle: blogPosts.seoTitle,
        seoDescription: blogPosts.seoDescription,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.siteId, shell.site.id),
          eq(blogPosts.slug, data.slug),
          eq(blogPosts.status, "published"),
        ),
      )
      .limit(1);
    if (!post) return null;
    return { ...shell, post };
  });
