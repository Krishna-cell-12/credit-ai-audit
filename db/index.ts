import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// WebSocket polyfill — required for the Neon serverless driver outside of
// edge runtimes that already expose a native WebSocket global.
// ---------------------------------------------------------------------------
neonConfig.webSocketConstructor = ws;

// ---------------------------------------------------------------------------
// Connection pool
// Neon's serverless Pool handles connection acquisition / release per query
// so there is no need to manually open or close connections.
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// ---------------------------------------------------------------------------
// Drizzle instance — export as the single database interface for the app.
// Passing the full schema enables the relational query API (db.query.*).
// ---------------------------------------------------------------------------
export const db = drizzle(pool, { schema });

export type DB = typeof db;
