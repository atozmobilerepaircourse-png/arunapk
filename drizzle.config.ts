import { defineConfig } from "drizzle-kit";

const url =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error("No database URL configured. Set SUPABASE_DATABASE_URL, NEON_DATABASE_URL, or DATABASE_URL.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
