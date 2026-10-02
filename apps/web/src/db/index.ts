import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // Thrown at request time, never at module-evaluation/build time, so that
    // `next build` can collect page data without production secrets present.
    throw new Error(
      "DATABASE_URL is not set. Configure it in the environment (Vercel project " +
        "env vars or apps/web/.env.local) before using the database.",
    );
  }

  return drizzle(neon(url), { schema });
}

let instance: Database | undefined;

function getDb(): Database {
  if (!instance) {
    instance = createDb();
  }
  return instance;
}

/**
 * Lazily-initialised Drizzle client.
 *
 * The underlying `neon()` client is only constructed on first property access
 * (i.e. the first real query), not when this module is imported. Eager
 * construction broke `next build`, because `neon()` throws when
 * DATABASE_URL is absent and Next.js imports every route module during the
 * "Collecting page data" phase.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb() as object, prop, receiver);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb() as object, prop);
  },
});

export * from "./schema";
