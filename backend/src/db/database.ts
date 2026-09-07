import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

export function requirePool(): Pool {
  if (!pool) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return pool;
}

export default pool;
