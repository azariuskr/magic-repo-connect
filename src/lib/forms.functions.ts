import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FormField, FormSchemaJson, FormSettingsJson } from "@/db/schema";

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

async function requireOwnedForm(formId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, forms } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ form: forms, site: sites })
    .from(forms)
    .innerJoin(sites, eq(sites.id, forms.siteId))
    .where(and(eq(forms.id, formId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!row) throw new Error("Not found");
  return row;
}

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Key must be lowercase letters, numbers and dashes");

const fieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field key must be alphanumeric/underscore"),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "email", "textarea", "tel"]),
  required: z.boolean().optional(),
  placeholder: z.string().trim().max(200).optional(),
});

export const listForms = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { forms, formSubmissions } = await import("@/db/schema");
    const { eq, desc, sql: dsql } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const rows = await db
      .select({
        id: forms.id,
        name: forms.name,
        key: forms.key,
        createdAt: forms.createdAt,
        submissionCount: dsql<number>`(select count(*)::int from ${formSubmissions} where ${formSubmissions.formId} = ${forms.id})`,
        unreadCount: dsql<number>`(select count(*)::int from ${formSubmissions} where ${formSubmissions.formId} = ${forms.id} and ${formSubmissions.readAt} is null)`,
      })
      .from(forms)
      .where(eq(forms.siteId, site.id))
      .orderBy(desc(forms.createdAt));
    return rows;
  });

export const getForm = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    await ensureSchema();
    const { form, site } = await requireOwnedForm(data.id);
    return { form, site: { id: site.id, name: site.name, slug: site.slug } };
  });

export const createForm = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ siteId: z.string().uuid(), name: z.string().trim().min(1).max(120), key: keySchema }).parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { forms } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await ensureSchema();
    const { site } = await requireOwnedSite(data.siteId);
    const [dup] = await db
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.siteId, site.id), eq(forms.key, data.key)))
      .limit(1);
    if (dup) throw new Error(`A form with key "${data.key}" already exists`);
    const defaultFields: FormField[] = [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "message", label: "Message", type: "textarea", required: true },
    ];
    const [row] = await db
      .insert(forms)
      .values({
        siteId: site.id,
        name: data.name,
        key: data.key,
        schema: { fields: defaultFields } satisfies FormSchemaJson,
        settings: {
          submitLabel: "Send",
          successMessage: "Thanks! We'll be in touch shortly.",
        } satisfies FormSettingsJson,
      })
      .returning();
    return row;
  });

export const saveForm = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        key: keySchema.optional(),
        fields: z.array(fieldSchema).max(30).optional(),
        settings: z
          .object({
            submitLabel: z.string().trim().max(60).optional(),
            successMessage: z.string().trim().max(500).optional(),
            notifyEmail: z.string().trim().email().max(200).nullable().optional(),
          })
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { forms } = await import("@/db/schema");
    const { and, eq, ne } = await import("drizzle-orm");
    await ensureSchema();
    const { form, site } = await requireOwnedForm(data.id);
    if (data.key && data.key !== form.key) {
      const [dup] = await db
        .select({ id: forms.id })
        .from(forms)
        .where(and(eq(forms.siteId, site.id), eq(forms.key, data.key), ne(forms.id, form.id)))
        .limit(1);
      if (dup) throw new Error(`A form with key "${data.key}" already exists`);
    }
    if (data.fields) {
      const seen = new Set<string>();
      for (const f of data.fields) {
        if (seen.has(f.key)) throw new Error(`Duplicate field key "${f.key}"`);
        seen.add(f.key);
      }
    }
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.key !== undefined) update.key = data.key;
    if (data.fields) update.schema = { fields: data.fields } satisfies FormSchemaJson;
    if (data.settings) {
      update.settings = { ...(form.settings ?? {}), ...data.settings } satisfies FormSettingsJson;
    }
    if (Object.keys(update).length === 0) return form;
    const [row] = await db.update(forms).set(update).where(eq(forms.id, form.id)).returning();
    return row;
  });

export const deleteForm = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { forms } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedForm(data.id);
    await db.delete(forms).where(eq(forms.id, data.id));
    return { ok: true };
  });

export const listSubmissions = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ formId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { formSubmissions } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedForm(data.formId);
    const rows = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, data.formId))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(200);
    return rows.map((r) => ({
      id: r.id,
      formId: r.formId,
      siteId: r.siteId,
      createdAt: r.createdAt,
      readAt: r.readAt,
      data: Object.fromEntries(
        Object.entries((r.data ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
      ) as Record<string, string>,
    }));
  });

export const markSubmissionRead = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ submissionId: z.string().uuid(), read: z.boolean() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { formSubmissions, forms, sites } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireSession();
    const [row] = await db
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .innerJoin(forms, eq(forms.id, formSubmissions.formId))
      .innerJoin(sites, eq(sites.id, forms.siteId))
      .where(and(eq(formSubmissions.id, data.submissionId), eq(sites.ownerId, user.id)))
      .limit(1);
    if (!row) throw new Error("Not found");
    await db
      .update(formSubmissions)
      .set({ readAt: data.read ? new Date() : null })
      .where(eq(formSubmissions.id, data.submissionId));
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ submissionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { formSubmissions, forms, sites } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const user = await requireSession();
    const [row] = await db
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .innerJoin(forms, eq(forms.id, formSubmissions.formId))
      .innerJoin(sites, eq(sites.id, forms.siteId))
      .where(and(eq(formSubmissions.id, data.submissionId), eq(sites.ownerId, user.id)))
      .limit(1);
    if (!row) throw new Error("Not found");
    await db.delete(formSubmissions).where(eq(formSubmissions.id, data.submissionId));
    return { ok: true };
  });

// ---------- Public ----------

export const getPublishedForm = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({ siteSlug: z.string().trim().min(1).max(64), key: keySchema }).parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { sites, forms } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    await ensureSchema();
    const [site] = await db
      .select({ id: sites.id, name: sites.name, slug: sites.slug, theme: sites.theme })
      .from(sites)
      .where(eq(sites.slug, data.siteSlug))
      .limit(1);
    if (!site) return null;
    const [form] = await db
      .select({ id: forms.id, name: forms.name, key: forms.key, schema: forms.schema, settings: forms.settings })
      .from(forms)
      .where(and(eq(forms.siteId, site.id), eq(forms.key, data.key)))
      .limit(1);
    if (!form) return null;
    return { site, form };
  });

export const submitForm = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        formId: z.string().uuid(),
        data: z.record(z.string(), z.union([z.string(), z.null()])),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { forms, formSubmissions } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    const [form] = await db.select().from(forms).where(eq(forms.id, data.formId)).limit(1);
    if (!form) throw new Error("Form not found");
    const allowed = new Set((form.schema?.fields ?? []).map((f) => f.key));
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.data)) {
      if (!allowed.has(k)) continue;
      if (v == null) continue;
      const s = String(v).slice(0, 5000);
      if (s.trim().length === 0) continue;
      clean[k] = s;
    }
    for (const f of form.schema?.fields ?? []) {
      if (f.required && !clean[f.key]) throw new Error(`"${f.label}" is required`);
    }
    const [submission] = await db
      .insert(formSubmissions)
      .values({ siteId: form.siteId, formId: form.id, data: clean })
      .returning({ id: formSubmissions.id });
    const { emitEvent } = await import("@/lib/events.server");
    await emitEvent(
      form.siteId,
      "form.submitted",
      {
        submissionId: submission.id,
        formId: form.id,
        formName: form.name,
        formKey: form.key,
        data: clean,
      },
      "forms",
      submission.id,
    );
    return { ok: true, message: form.settings?.successMessage ?? "Thanks!" };
  });
