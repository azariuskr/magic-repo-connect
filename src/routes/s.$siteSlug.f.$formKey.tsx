import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getPublishedForm, submitForm } from "@/lib/forms.functions";
import { ThemeRoot, type SiteTheme } from "@/lib/theme";
import type { FormField } from "@/db/schema";

export const Route = createFileRoute("/s/$siteSlug/f/$formKey")({
  loader: async ({ params }) => {
    const result = await getPublishedForm({
      data: { siteSlug: params.siteSlug, key: params.formKey },
    });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const title = `${loaderData?.form?.name ?? "Form"} — ${loaderData?.site?.name ?? ""}`;
    return {
      links: [{ rel: "stylesheet", href: "https://rsms.me/inter/inter.css" }],
      meta: [{ title }, { name: "robots", content: "noindex" }],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Form not found.</p>
    </div>
  ),
  component: PublicFormPage,
});

function PublicFormPage() {
  const { site, form } = Route.useLoaderData();
  const submitFn = useServerFn(submitForm);
  const [values, setValues] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => submitFn({ data: { formId: form.id, data: values } }),
    onSuccess: (r) => {
      setSuccessMsg(r.message);
      setValues({});
    },
  });

  const fields = (form.schema?.fields ?? []) as FormField[];
  const submitLabel = form.settings?.submitLabel ?? "Send";

  return (
    <ThemeRoot theme={site.theme as SiteTheme}>
      <main
        className="flex min-h-screen items-center justify-center px-6 py-16"
        style={{ backgroundColor: "var(--site-bg)" }}
      >
        <div
          className="w-full max-w-md rounded-lg p-8"
          style={{
            backgroundColor: "var(--site-surface)",
            border: "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)",
          }}
        >
          <h1
            className="mb-2 text-2xl font-semibold tracking-tight"
            style={{ color: "var(--site-fg)" }}
          >
            {form.name}
          </h1>
          <p className="mb-6 text-sm" style={{ color: "var(--site-muted)" }}>
            {site.name}
          </p>

          {successMsg ? (
            <div
              className="rounded-md p-4 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--site-brand) 15%, transparent)",
                color: "var(--site-fg)",
              }}
            >
              {successMsg}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mut.mutate();
              }}
              className="space-y-4"
            >
              {fields.map((f) => (
                <label key={f.key} className="block text-sm">
                  <span className="mb-1 block" style={{ color: "var(--site-fg)" }}>
                    {f.label}
                    {f.required ? <span style={{ color: "var(--site-brand)" }}> *</span> : null}
                  </span>
                  {f.type === "textarea" ? (
                    <textarea
                      required={f.required}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      rows={4}
                      className="w-full rounded-md px-3 py-2 text-sm"
                      style={{
                        backgroundColor: "var(--site-bg)",
                        color: "var(--site-fg)",
                        border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)",
                      }}
                    />
                  ) : (
                    <input
                      type={f.type}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full rounded-md px-3 py-2 text-sm"
                      style={{
                        backgroundColor: "var(--site-bg)",
                        color: "var(--site-fg)",
                        border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)",
                      }}
                    />
                  )}
                </label>
              ))}
              {mut.error ? (
                <p className="text-xs" style={{ color: "#f87171" }}>
                  {(mut.error as Error).message}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={mut.isPending}
                className="w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{
                  backgroundColor: "var(--site-brand)",
                  color: "var(--site-bg)",
                }}
              >
                {mut.isPending ? "Sending…" : submitLabel}
              </button>
            </form>
          )}
        </div>
      </main>
    </ThemeRoot>
  );
}
