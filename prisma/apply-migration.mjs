import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;
const MIGRATION_DIR = process.argv[2];
if (!MIGRATION_DIR) {
  console.error("Usage: node prisma/apply-migration.mjs <migration-folder-name>");
  process.exit(1);
}

const sql = fs.readFileSync(
  new URL(`./migrations/${MIGRATION_DIR}/migration.sql`, import.meta.url),
  "utf8"
);
const checksum = crypto.createHash("sha256").update(sql).digest("hex");

const client = new Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

try {
  const { rows } = await client.query(
    `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NOT NULL`,
    [MIGRATION_DIR]
  );
  if (rows.length > 0) {
    console.log("Migration already recorded as applied, skipping DDL.");
  } else {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, now(), 1)`,
      [crypto.randomUUID(), checksum, MIGRATION_DIR]
    );
    await client.query("COMMIT");
    console.log(`Applied migration ${MIGRATION_DIR} and recorded checksum ${checksum}`);
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await client.end();
}
