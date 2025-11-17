#!/usr/bin/env node
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const config = {
  baseUrl: process.env.API_BASE_URL || "http://localhost:3002",
  apiKey: process.env.API_KEY || "sentinel-api-key-2024",
  testDuration: parseInt(process.env.TEST_DURATION || "30"), // seconds
  concurrency: parseInt(process.env.CONCURRENCY || "10"),
  sloTarget: parseInt(process.env.SLO_TARGET || "100"), // ms for p95
  customerIds: [
    "c1e7e8a0-4b3f-4c8b-a1e2-f4d5e6789012",
    "d2f8f9b1-5c4g-5d9c-b2f3-g5e6f7890123",
    "e3g9g0c2-6d5h-6e0d-c3g4-h6f7g8901234",
    "f4h0h1d3-7e6i-7f1e-d4h5-i7g8h9012345",
    "g5i1i2e4-8f7j-8g2f-e5i6-j8h9i0123456",
  ],
};
const results = {
  requests: [],
  errors: [],
  startTime: null,
  endTime: null,
};
function makeRequest(customerId) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = `${config.baseUrl}/api/v1/customer/${customerId}/transactions?last=90d&limit=50`;
    const requestModule = config.baseUrl.startsWith("https") ? https : http;
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "X-API-Key": config.apiKey,
        "User-Agent": "Sentinel-Performance-Test/1.0",
      },
    };
    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        const result = {
          customerId,
          startTime,
          endTime,
          latency,
          statusCode: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300,
          responseSize: data.length,
        };
        if (result.success) {
          try {
            const parsed = JSON.parse(data);
            result.recordCount = parsed.items ? parsed.items.length : 0;
          } catch (e) {
            result.parseError = true;
          }
        } else {
          results.errors.push({
            customerId,
            statusCode: res.statusCode,
            latency,
            response: data.substring(0, 200),
          });
        }
        results.requests.push(result);
        resolve(result);
      });
    });
    req.on("error", (error) => {
      const endTime = Date.now();
      const latency = endTime - startTime;
      results.errors.push({
        customerId,
        error: error.message,
        latency,
      });
      results.requests.push({
        customerId,
        startTime,
        endTime,
        latency,
        success: false,
        error: error.message,
      });
      resolve({ customerId, latency, success: false, error: error.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      const endTime = Date.now();
      const latency = endTime - startTime;
      results.errors.push({
        customerId,
        error: "Request timeout",
        latency,
      });
      resolve({ customerId, latency, success: false, error: "timeout" });
    });
    req.end();
  });
}
async function runPerformanceTest() {
  console.log("🚀 Starting Performance Test Suite");
  console.log(`🎯 Target: p95 ≤ ${config.sloTarget}ms`);
  console.log(`⏱️  Duration: ${config.testDuration}s`);
  console.log(`🔄 Concurrency: ${config.concurrency}`);
  console.log(
    `🌐 Endpoint: ${config.baseUrl}/api/v1/customer/:id/transactions?last=90d`,
  );
  console.log("");
  results.startTime = Date.now();
  const endTime = results.startTime + config.testDuration * 1000;
  console.log("🔥 Warming up...");
  await makeRequest(config.customerIds[0]);
  console.log("✅ Warmup complete");
  console.log("");
  console.log("📊 Running load test...");
  const workers = [];
  for (let i = 0; i < config.concurrency; i++) {
    workers.push(runWorker(endTime));
  }
  await Promise.all(workers);
  results.endTime = Date.now();
  analyzeResults();
}
async function runWorker(endTime) {
  let requestCount = 0;
  while (Date.now() < endTime) {
    const customerId =
      config.customerIds[requestCount % config.customerIds.length];
    await makeRequest(customerId);
    requestCount++;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return requestCount;
}
function analyzeResults() {
  console.log("");
  console.log("📈 Performance Test Results");
  console.log("=".repeat(50));
  const successfulRequests = results.requests.filter((r) => r.success);
  const failedRequests = results.requests.filter((r) => !r.success);
  if (successfulRequests.length === 0) {
    console.log("❌ No successful requests completed");
    return;
  }
  const latencies = successfulRequests
    .map((r) => r.latency)
    .sort((a, b) => a - b);
  const totalDuration = (results.endTime - results.startTime) / 1000;
  const stats = {
    totalRequests: results.requests.length,
    successfulRequests: successfulRequests.length,
    failedRequests: failedRequests.length,
    successRate: (
      (successfulRequests.length / results.requests.length) *
      100
    ).toFixed(2),
    duration: totalDuration.toFixed(2),
    requestsPerSecond: (results.requests.length / totalDuration).toFixed(2),
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    mean: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
    median: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
    p99: latencies[Math.floor(latencies.length * 0.99)],
  };
  console.log(`📊 Total Requests: ${stats.totalRequests}`);
  console.log(
    `✅ Successful: ${stats.successfulRequests} (${stats.successRate}%)`,
  );
  console.log(`❌ Failed: ${stats.failedRequests}`);
  console.log(`⏱️  Duration: ${stats.duration}s`);
  console.log(`🔄 Rate: ${stats.requestsPerSecond} req/s`);
  console.log("");
  console.log("⚡ Latency Statistics (ms):");
  console.log(`   Min: ${stats.min}`);
  console.log(`   Mean: ${stats.mean}`);
  console.log(`   Median: ${stats.median}`);
  console.log(`   P95: ${stats.p95}`);
  console.log(`   P99: ${stats.p99}`);
  console.log(`   Max: ${stats.max}`);
  console.log("");
  const sloMet = stats.p95 <= config.sloTarget;
  console.log(`🎯 SLO Validation: P95 ≤ ${config.sloTarget}ms`);
  console.log(`   Result: P95 = ${stats.p95}ms`);
  console.log(`   Status: ${sloMet ? "✅ PASSED" : "❌ FAILED"}`);
  if (!sloMet) {
    console.log(`   ⚠️  Exceeds target by ${stats.p95 - config.sloTarget}ms`);
  }
  console.log("");
  if (results.errors.length > 0) {
    console.log("🚨 Errors:");
    const errorGroups = {};
    results.errors.forEach((error) => {
      const key = error.error || `HTTP ${error.statusCode}`;
      errorGroups[key] = (errorGroups[key] || 0) + 1;
    });
    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`   ${error}: ${count}`);
    });
    console.log("");
  }
  const reportPath = path.join(
    __dirname,
    "../reports/performance-test-results.json",
  );
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        config,
        stats,
        results: results.requests,
        errors: results.errors,
        timestamp: new Date().toISOString(),
        sloMet,
      },
      null,
      2,
    ),
  );
  console.log(`📄 Detailed results saved to: ${reportPath}`);
  process.exit(sloMet ? 0 : 1);
}
if (require.main === module) {
  runPerformanceTest().catch((error) => {
    console.error("💥 Performance test failed:", error);
    process.exit(1);
  });
}
module.exports = { runPerformanceTest, config };
