import pg from "pg";
import { hashPassword } from "../services/password.js";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (!email || !password || password.length < 12) {
  throw new Error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (minimum 12 characters) are required.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const role = await pool.query("SELECT id FROM admin_roles WHERE name = 'super_admin'");
  if (!role.rowCount) throw new Error("Run phase-6h-migration.sql before bootstrapping an admin.");
  const hash = await hashPassword(password);
  await pool.query(
    "INSERT INTO admin_users (email, password_hash, role_id) VALUES ($1, $2, $3) ON CONFLICT ((lower(btrim(email)))) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, is_active = true, failed_login_count = 0, locked_until = NULL, updated_at = now()",
    [email, hash, role.rows[0].id],
  );
  console.log("Admin bootstrap completed.");
} finally {
  await pool.end();
}
