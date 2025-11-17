#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "sentinel_support",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
};
async function ingestTransactions() {
  const client = new Client(DB_CONFIG);
  try {
    console.log("🚀 Starting large dataset ingestion...");
    await client.connect();
    console.log("✅ Database connected");
    const transactionsPath = path.join(
      __dirname,
      "../fixtures/transactions.json",
    );
    console.log("📄 Loading transactions from:", transactionsPath);
    const transactions = JSON.parse(fs.readFileSync(transactionsPath, "utf8"));
    console.log(`📊 Loaded ${transactions.length} transactions`);
    await client.query("DELETE FROM transactions WHERE id LIKE $1", ["txn-%"]);
    console.log("🧹 Cleared existing transactions");
    const batchSize = 1000;
    let inserted = 0;
    console.log("⚡ Starting batch insertion...");
    const startTime = Date.now();
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      for (const tx of batch) {
        placeholders.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
        );
        values.push(
          tx.id,
          tx.customerId,
          tx.cardId,
          tx.accountId,
          tx.mcc,
          tx.merchant,
          tx.amountCents,
          tx.currency,
          new Date(tx.ts),
          tx.deviceId,
          tx.country,
          tx.city,
          tx.authCode,
          tx.status,
        );
      }
      const query = `
        INSERT INTO transactions (
          id, customer_id, card_id, account_id, mcc, merchant,
          amount_cents, currency, ts, device_id, country, city,
          auth_code, status
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id) DO NOTHING
      `;
      await client.query(query, values);
      inserted += batch.length;
      if (inserted % 50000 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(
          `📈 Inserted ${inserted} transactions (${elapsed.toFixed(1)}s)`,
        );
      }
    }
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(
      `🎉 Successfully inserted ${inserted} transactions in ${totalTime.toFixed(1)}s`,
    );
    console.log(
      `⚡ Rate: ${(inserted / totalTime).toFixed(0)} transactions/second`,
    );
    const countResult = await client.query("SELECT COUNT(*) FROM transactions");
    console.log(
      `📊 Total transactions in database: ${countResult.rows[0].count}`,
    );
    const customerResult = await client.query(`
      SELECT customer_id, COUNT(*) as tx_count
      FROM transactions
      GROUP BY customer_id
      ORDER BY tx_count DESC
      LIMIT 5
    `);
    console.log("👥 Top customers by transaction count:");
    customerResult.rows.forEach((row) => {
      console.log(`   ${row.customer_id}: ${row.tx_count} transactions`);
    });
  } catch (error) {
    console.error("❌ Ingestion failed:", error);
    throw error;
  } finally {
    await client.end();
    console.log("✅ Database connection closed");
  }
}
if (require.main === module) {
  ingestTransactions()
    .then(() => {
      console.log("✨ Ingestion completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Ingestion failed:", error);
      process.exit(1);
    });
}
module.exports = { ingestTransactions };
