// Server-only executor for integration accounts. Called by the workflow runner
// and the "Test" button in the admin UI. Never imported from .functions.ts
// module scope — only via dynamic import from server handlers.
import { db } from "@/db/client.server";
import { integrationAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptJson } from "@/lib/crypto.server";

export type IntegrationCallInput = {
  payload: Record<string, unknown>;
  // For http_generic: sub-path and body override; for email_resend: recipient override.
  path?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
};

export async function runIntegrationCall(
  accountId: string,
  input: IntegrationCallInput,
): Promise<Record<string, unknown>> {
  const [acc] = await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, accountId)).limit(1);
  if (!acc) throw new Error("Integration account not found");
  if (acc.status !== "active") throw new Error(`Integration ${acc.name} is ${acc.status}`);
  const settings = (acc.settings ?? {}) as Record<string, string>;
  const creds = acc.encryptedCredentials
    ? decryptJson<Record<string, string>>(acc.encryptedCredentials)
    : {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    switch (acc.providerKey) {
      case "webhook": {
        const url = settings.url;
        if (!url) throw new Error("Missing webhook URL");
        const bodyStr = JSON.stringify({ payload: input.payload });
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (creds.secret) {
          const { createHmac } = await import("node:crypto");
          headers["x-signature"] = createHmac("sha256", creds.secret).update(bodyStr).digest("hex");
        }
        const res = await fetch(url, { method: "POST", headers, body: bodyStr, signal: controller.signal });
        const text = await res.text().catch(() => "");
        return { status: res.status, body: text.slice(0, 500) };
      }
      case "email_resend": {
        const apiKey = creds.apiKey;
        if (!apiKey) throw new Error("Missing Resend API key");
        const from = settings.fromName
          ? `${settings.fromName} <${settings.fromEmail}>`
          : settings.fromEmail;
        if (!from) throw new Error("Missing sender email");
        const to = input.to ?? String(input.payload?.email ?? "");
        if (!to) throw new Error("No recipient — set input.to or include payload.email");
        const subject = input.subject ?? "Notification";
        const body = {
          from,
          to,
          subject,
          text: input.text ?? JSON.stringify(input.payload, null, 2),
          html: input.html,
        };
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text().catch(() => "");
        if (!res.ok) throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
        return { status: res.status, body: text.slice(0, 500) };
      }
      case "http_generic": {
        const baseUrl = settings.baseUrl;
        if (!baseUrl) throw new Error("Missing base URL");
        const url = new URL(input.path ?? "/", baseUrl.endsWith("/") ? baseUrl : baseUrl + "/").toString();
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (creds.authHeader) headers.authorization = creds.authHeader;
        const method = input.method ?? "POST";
        const res = await fetch(url, {
          method,
          headers,
          body: method === "GET" ? undefined : JSON.stringify(input.body ?? input.payload),
          signal: controller.signal,
        });
        const text = await res.text().catch(() => "");
        return { status: res.status, body: text.slice(0, 500) };
      }
      default:
        throw new Error(`Unknown provider: ${acc.providerKey}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
