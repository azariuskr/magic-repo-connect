import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client.server";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: (request) => {
    const origin = request.headers.get("origin");
    const allowed = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8080",
    ];
    if (origin && /\.(lovableproject\.com|lovable\.app|lovable\.dev)$/.test(new URL(origin).hostname)) {
      allowed.push(origin);
    }
    return allowed;
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },
});
