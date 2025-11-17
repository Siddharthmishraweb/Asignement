#!/usr/bin/env node
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://sentinel:password@localhost:5432/sentinel_db";
const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
const migrationFiles = ["init.sql", "add_evaluations.sql"];
async function runMigration() {
  console.log("🚀 Starting database migration...");
  try {
    const client = await pool.connect();
    console.log("✅ Database connection successful");
    client.release();
    const existingTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('customers', 'transactions', 'alerts')
    `);
    if (existingTables.rows.length > 0) {
      console.log("📋 Database schema already exists, skipping init.sql");
      console.log(
        "✅ Found existing tables:",
        existingTables.rows.map((r) => r.table_name).join(", "),
      );
    } else {
      console.log("📄 Running migration: init.sql");
      const initPath = path.join(__dirname, "../../migrations/init.sql");
      const sql = fs.readFileSync(initPath, "utf8");
      await pool.query(sql);
      console.log("✅ Migration completed: init.sql");
    }
    const additionalMigrations = ["add_evaluations.sql"];
    for (const filename of additionalMigrations) {
      const migrationPath = path.join(__dirname, "../../migrations", filename);
      if (!fs.existsSync(migrationPath)) {
        console.warn(`⚠️  Migration file not found: ${filename}`);
        continue;
      }
      console.log(`📄 Running migration: ${filename}`);
      const sql = fs.readFileSync(migrationPath, "utf8");
      try {
        await pool.query(sql);
        console.log(`✅ Migration completed: ${filename}`);
      } catch (error: any) {
        if (error.code === "42P07") {
          // relation already exists
          console.log(`⚠️  Skipping ${filename} - tables already exist`);
        } else {
          throw error;
        }
      }
    }
    console.log("🎉 All migrations completed successfully!");
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log("\n📊 Database tables created:");
    result.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
if (require.main === module) {
  runMigration();
}
export { runMigration };
