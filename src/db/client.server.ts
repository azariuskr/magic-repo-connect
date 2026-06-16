import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `prepare: false` is required for pooled connections (Neon pooler, Supabase pgbouncer).
export const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

export const db = drizzle(sql, { schema });
