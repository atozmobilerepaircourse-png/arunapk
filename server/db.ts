import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

function getValidDbUrl(): string {
  const candidates = [
    process.env.SUPABASE_DATABASE_URL,
    process.env.NEON_DATABASE_URL,
    process.env.DATABASE_URL,
  ];
  for (const url of candidates) {
    if (url && (url.startsWith("postgresql://") || url.startsWith("postgres://"))) {
      return url;
    }
  }
  throw new Error("No valid database URL found. SUPABASE_DATABASE_URL must be a postgresql:// connection string.");
}

const connectionString = getValidDbUrl();
if (!connectionString) {
  throw new Error("No database URL configured. Set SUPABASE_DATABASE_URL, NEON_DATABASE_URL, or DATABASE_URL.");
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
