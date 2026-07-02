import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------- Auth helpers ----------

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

async function requireOwnedProduct(productId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, products } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw new Error("Not found");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, product.siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site, product };
}

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and dashes");

// jsonb columns (images, metadata) serialize as `unknown`; normalize before returning.
type ProductPublic = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  descriptionHtml: string | null;
  priceCents: number;
  currency: string;
  images: string[];
  status: string;
  inventoryQuantity: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeProduct(row: {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  descriptionHtml: string | null;
  priceCents: number;
  currency: string;
  images: unknown;
  status: string;
  inventoryQuantity: number | null;
  createdAt: Date;
  updatedAt: Date;
}): ProductPublic {
  const images = Array.isArray(row.images)
    ? row.images.filter((x): x is string => typeof x === "string")
    : [];
  return { ...row, images };
}

// ---------- Products (admin) ----------

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const rows = await db
      .select({
        id: products.id,
        siteId: products.siteId,
        name: products.name,
        slug: products.slug,
        descriptionHtml: products.descriptionHtml,
        priceCents: products.priceCents,
        currency: products.currency,
        images: products.images,
        status: products.status,
        inventoryQuantity: products.inventoryQuantity,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(eq(products.siteId, site.id))
      .orderBy(desc(products.updatedAt));
    return rows.map(normalizeProduct);
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    await ensureSchema();
    const { product, site } = await requireOwnedProduct(data.id);
    return { product: normalizeProduct(product), site };
  });

export const createProduct = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        siteId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        slug: slugSchema,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const [row] = await db
      .insert(products)
      .values({ siteId: site.id, name: data.name, slug: data.slug, status: "draft" })
      .returning();
    return normalizeProduct(row);
  });

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200).optional(),
        slug: slugSchema.optional(),
        descriptionHtml: z.string().max(200_000).nullable().optional(),
        priceCents: z.number().int().min(0).max(100_000_000).optional(),
        currency: z.string().trim().length(3).optional(),
        images: z.array(z.string().url().max(1000)).max(12).optional(),
        inventoryQuantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedProduct(data.id);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.descriptionHtml !== undefined) update.descriptionHtml = data.descriptionHtml;
    if (data.priceCents !== undefined) update.priceCents = data.priceCents;
    if (data.currency !== undefined) update.currency = data.currency.toUpperCase();
    if (data.images !== undefined) update.images = data.images;
    if (data.inventoryQuantity !== undefined) update.inventoryQuantity = data.inventoryQuantity;
    const [row] = await db
      .update(products)
      .set(update)
      .where(eq(products.id, data.id))
      .returning();
    return normalizeProduct(row);
  });

export const publishProduct = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedProduct(data.id);
    const [row] = await db
      .update(products)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(products.id, data.id))
      .returning();
    return normalizeProduct(row);
  });

export const unpublishProduct = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedProduct(data.id);
    const [row] = await db
      .update(products)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(products.id, data.id))
      .returning();
    return normalizeProduct(row);
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedProduct(data.id);
    await db.delete(products).where(eq(products.id, data.id));
    return { ok: true };
  });

// ---------- Orders (admin) ----------

export const listOrders = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { orders } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    return db
      .select({
        id: orders.id,
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalCents: orders.totalCents,
        currency: orders.currency,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.siteId, site.id))
      .orderBy(desc(orders.createdAt))
      .limit(200);
  });

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { orders, orderItems, sites } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireSession();
    const orderCols = {
      id: orders.id,
      siteId: orders.siteId,
      customerId: orders.customerId,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalCents: orders.totalCents,
      currency: orders.currency,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    };
    const [order] = await db.select(orderCols).from(orders).where(eq(orders.id, data.id)).limit(1);
    if (!order) throw new Error("Not found");
    const [site] = await db
      .select({ id: sites.id, name: sites.name, slug: sites.slug })
      .from(sites)
      .where(and(eq(sites.id, order.siteId), eq(sites.ownerId, user.id)))
      .limit(1);
    if (!site) throw new Error("Not found");
    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        name: orderItems.name,
        quantity: orderItems.quantity,
        unitPriceCents: orderItems.unitPriceCents,
        totalCents: orderItems.totalCents,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    return { order, items, site };
  });


export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "fulfilled", "cancelled"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { orders, sites } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireSession();
    const [order] = await db.select().from(orders).where(eq(orders.id, data.id)).limit(1);
    if (!order) throw new Error("Not found");
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, order.siteId), eq(sites.ownerId, user.id)))
      .limit(1);
    if (!site) throw new Error("Not found");
    const [row] = await db
      .update(orders)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(orders.id, data.id))
      .returning({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        updatedAt: orders.updatedAt,
      });
    return row;
  });


// ---------- Public storefront ----------

async function loadSiteShell(siteSlug: string) {
  const { db } = await import("@/db/client.server");
  const { sites, sitePages } = await import("@/db/schema");
  const { eq, and, isNotNull, asc } = await import("drizzle-orm");
  const [site] = await db
    .select({ id: sites.id, name: sites.name, slug: sites.slug, theme: sites.theme })
    .from(sites)
    .where(eq(sites.slug, siteSlug))
    .limit(1);
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
  const nav = navRows.map((r) => ({
    id: r.id,
    path: r.path,
    label: r.navLabel?.trim() || r.title,
  }));
  const { loadPublishedMenu } = await import("@/lib/menus.functions");
  const [primaryMenu, footerMenu] = await Promise.all([
    loadPublishedMenu(site.id, "primary"),
    loadPublishedMenu(site.id, "footer"),
  ]);
  return { site, nav, primaryMenu, footerMenu };
}

export const getPublishedShop = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteSlug: z.string().trim().min(1).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    await ensureSchema();
    const shell = await loadSiteShell(data.siteSlug);
    if (!shell) return null;
    const rows = await db
      .select({
        id: products.id,
        siteId: products.siteId,
        name: products.name,
        slug: products.slug,
        descriptionHtml: products.descriptionHtml,
        priceCents: products.priceCents,
        currency: products.currency,
        images: products.images,
        status: products.status,
        inventoryQuantity: products.inventoryQuantity,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(and(eq(products.siteId, shell.site.id), eq(products.status, "published")))
      .orderBy(desc(products.updatedAt))
      .limit(100);
    return { ...shell, products: rows.map(normalizeProduct) };
  });

export const getPublishedProduct = createServerFn({ method: "GET" })
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
    const { products } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const shell = await loadSiteShell(data.siteSlug);
    if (!shell) return null;
    const [row] = await db
      .select({
        id: products.id,
        siteId: products.siteId,
        name: products.name,
        slug: products.slug,
        descriptionHtml: products.descriptionHtml,
        priceCents: products.priceCents,
        currency: products.currency,
        images: products.images,
        status: products.status,
        inventoryQuantity: products.inventoryQuantity,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(
        and(
          eq(products.siteId, shell.site.id),
          eq(products.slug, data.slug),
          eq(products.status, "published"),
        ),
      )
      .limit(1);
    if (!row) return null;
    return { ...shell, product: normalizeProduct(row) };
  });

// Public checkout: creates a pending order for a single product.
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        siteSlug: z.string().trim().min(1).max(64),
        productSlug: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(999),
        customerName: z.string().trim().min(1).max(200),
        customerEmail: z.string().trim().email().max(200),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites, products, orders, orderItems, customers } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();

    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.slug, data.siteSlug))
      .limit(1);
    if (!site) throw new Error("Site not found");

    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.siteId, site.id),
          eq(products.slug, data.productSlug),
          eq(products.status, "published"),
        ),
      )
      .limit(1);
    if (!product) throw new Error("Product not available");

    const email = data.customerEmail.toLowerCase();
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.siteId, site.id), eq(customers.email, email)))
      .limit(1);

    const customerId = existingCustomer
      ? existingCustomer.id
      : (
          await db
            .insert(customers)
            .values({ siteId: site.id, email, name: data.customerName })
            .returning({ id: customers.id })
        )[0].id;

    const unit = product.priceCents;
    const totalCents = unit * data.quantity;

    const [order] = await db
      .insert(orders)
      .values({
        siteId: site.id,
        customerId,
        customerEmail: email,
        customerName: data.customerName,
        status: "pending",
        paymentStatus: "unpaid",
        totalCents,
        currency: product.currency,
        metadata: data.notes ? { notes: data.notes } : {},
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      name: product.name,
      quantity: data.quantity,
      unitPriceCents: unit,
      totalCents,
    });

    return { ok: true, orderId: order.id };
  });
