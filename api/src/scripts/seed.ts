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
async function runSeed() {
  console.log("🌱 Starting database seeding...");
  try {
    const client = await pool.connect();
    console.log("✅ Database connection successful");
    client.release();
    const seedPath = path.join(__dirname, "../../migrations/seed.sql");
    if (fs.existsSync(seedPath)) {
      console.log("📄 Running seed script: seed.sql");
      const sql = fs.readFileSync(seedPath, "utf8");
      await pool.query(sql);
      console.log("✅ Seed script completed");
    } else {
      console.log("⚠️  No seed.sql file found, seeding with fixtures...");
      await seedFromFixtures();
    }
    console.log("🎉 Database seeding completed successfully!");
    await showRecordCounts();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
async function seedFromFixtures() {
  const fixturesPath = path.join(__dirname, "../../../fixtures");
  if (fs.existsSync(path.join(fixturesPath, "customers.json"))) {
    console.log("📄 Seeding customers...");
    const customers = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, "customers.json"), "utf8"),
    );
    for (const customer of customers) {
      await pool.query(
        `INSERT INTO customers (id, name, email_masked, kyc_level, created_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          customer.id,
          customer.name,
          customer.email_masked,
          customer.kyc_level,
          customer.created_at,
          customer.metadata || {},
        ],
      );
    }
    console.log(`✅ Seeded ${customers.length} customers`);
  }
  if (fs.existsSync(path.join(fixturesPath, "cards.json"))) {
    console.log("📄 Seeding cards...");
    const cards = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, "cards.json"), "utf8"),
    );
    for (const card of cards) {
      await pool.query(
        `INSERT INTO cards (id, customer_id, last4, network, status, created_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          card.id,
          card.customer_id,
          card.last4,
          card.network,
          card.status,
          card.created_at,
          card.metadata || {},
        ],
      );
    }
    console.log(`✅ Seeded ${cards.length} cards`);
  }
  if (fs.existsSync(path.join(fixturesPath, "accounts.json"))) {
    console.log("📄 Seeding accounts...");
    const accounts = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, "accounts.json"), "utf8"),
    );
    for (const account of accounts) {
      await pool.query(
        `INSERT INTO accounts (id, customer_id, balance_cents, currency, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          account.id,
          account.customer_id,
          account.balance_cents,
          account.currency,
          account.created_at,
        ],
      );
    }
    console.log(`✅ Seeded ${accounts.length} accounts`);
  }
  if (fs.existsSync(path.join(fixturesPath, "kb_docs.json"))) {
    console.log("📄 Seeding knowledge base...");
    const kbDocs = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, "kb_docs.json"), "utf8"),
    );
    for (const doc of kbDocs) {
      await pool.query(
        `INSERT INTO kb_docs (id, title, anchor, content_text, category, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          doc.id,
          doc.title,
          doc.anchor,
          doc.content_text,
          doc.category,
          doc.created_at,
        ],
      );
    }
    console.log(`✅ Seeded ${kbDocs.length} KB documents`);
  }
  if (fs.existsSync(path.join(fixturesPath, "policies.json"))) {
    console.log("📄 Seeding policies...");
    const policies = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, "policies.json"), "utf8"),
    );
    for (const policy of policies) {
      await pool.query(
        `INSERT INTO policies (id, code, title, content_text, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING`,
        [
          policy.id,
          policy.code,
          policy.title,
          policy.content_text,
          policy.created_at,
        ],
      );
    }
    console.log(`✅ Seeded ${policies.length} policies`);
  }
  console.log("💡 To load transactions, use: POST /api/ingest/transactions");
}
async function showRecordCounts() {
  console.log("\n📊 Database record counts:");
  const tables = [
    "customers",
    "cards",
    "accounts",
    "transactions",
    "alerts",
    "cases",
    "kb_docs",
    "policies",
  ];
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0].count);
      console.log(`  - ${table}: ${count.toLocaleString()} records`);
    } catch (error) {
      console.log(`  - ${table}: table not found`);
    }
  }
}
if (require.main === module) {
  runSeed();
}
export { runSeed };
