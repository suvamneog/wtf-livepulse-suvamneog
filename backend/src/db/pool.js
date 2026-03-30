import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || "postgres://wtf@localhost:5432/wtf_livepulse";

export const pool = new Pool({ connectionString, max: 20 });

export async function waitForDb(maxAttempts = 60, delayMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const c = await pool.connect();
      c.release();
      return true;
    } catch {
      console.warn(`Database not ready (attempt ${i + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Database unavailable after retries");
}
