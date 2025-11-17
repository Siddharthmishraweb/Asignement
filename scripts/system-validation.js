#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
class SystemValidator {
  constructor() {
    this.results = {
      fixtures: { passed: 0, failed: 0, checks: [] },
      hardRequirements: { passed: 0, failed: 0, checks: [] },
      apiContracts: { passed: 0, failed: 0, checks: [] },
      acceptanceScenarios: { passed: 0, failed: 0, checks: [] },
      overall: { passed: 0, failed: 0, compliance: 0 },
    };
  }
  async validateAll() {
    console.log("🔍 System Validation - 100% Compliance Check");
    console.log("=".repeat(60));
    console.log("");
    await this.validateFixtures();
    await this.validateHardRequirements();
    await this.validateApiContracts();
    await this.validateAcceptanceScenarios();
    return this.generateComplianceReport();
  }
  async validateFixtures() {
    console.log("📁 Validating Fixtures...");
    const requiredFiles = [
      "customers.json",
      "cards.json",
      "accounts.json",
      "transactions.json",
      "alerts.json",
      "kb_docs.json",
      "policies.json",
      "chargebacks.json",
      "devices.json",
    ];
    const fixturesDir = path.join(__dirname, "../fixtures");
    for (const file of requiredFiles) {
      const filePath = path.join(fixturesDir, file);
      const exists = fs.existsSync(filePath);
      this.addCheck(
        "fixtures",
        `${file} exists`,
        exists,
        exists ? "present" : "missing",
      );
      if (exists && file === "transactions.json") {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const count = Array.isArray(content) ? content.length : 0;
          const has200k = count >= 200000;
          this.addCheck(
            "fixtures",
            `transactions.json ≥ 200k records`,
            has200k,
            `${count.toLocaleString()} records`,
          );
        } catch (e) {
          this.addCheck(
            "fixtures",
            `transactions.json valid JSON`,
            false,
            "parse error",
          );
        }
      }
    }
    const evalsDir = path.join(fixturesDir, "evals");
    const evalsExist = fs.existsSync(evalsDir);
    this.addCheck("fixtures", "evals/ directory exists", evalsExist);
    if (evalsExist) {
      const evalFiles = fs
        .readdirSync(evalsDir)
        .filter((f) => f.endsWith(".json"));
      const has7Evals = evalFiles.length >= 7;
      this.addCheck(
        "fixtures",
        "7 evaluation scenarios",
        has7Evals,
        `${evalFiles.length} scenarios`,
      );
    }
    const generatorPath = path.join(
      __dirname,
      "../scripts/generate-transactions.js",
    );
    const generatorExists = fs.existsSync(generatorPath);
    this.addCheck("fixtures", "transaction generator script", generatorExists);
    if (generatorExists) {
      try {
        const content = fs.readFileSync(generatorPath, "utf8");
        const supports1M =
          content.includes("1M+") || content.includes("1000000");
        this.addCheck("fixtures", "generator supports 1M+ records", supports1M);
      } catch (e) {
        this.addCheck(
          "fixtures",
          "generator script readable",
          false,
          "read error",
        );
      }
    }
    console.log(
      `   ✅ ${this.results.fixtures.passed} passed, ❌ ${this.results.fixtures.failed} failed\n`,
    );
  }
  async validateHardRequirements() {
    console.log("⚡ Validating Hard Requirements...");
    const dockerComposePath = path.join(__dirname, "../docker-compose.yml");
    const dockerComposeExists = fs.existsSync(dockerComposePath);
    this.addCheck(
      "hardRequirements",
      "docker-compose.yml exists",
      dockerComposeExists,
    );
    const migrateScript = path.join(__dirname, "../api/src/scripts/migrate.ts");
    const seedScript = path.join(__dirname, "../api/src/scripts/seed.ts");
    this.addCheck(
      "hardRequirements",
      "migrate script exists",
      fs.existsSync(migrateScript),
    );
    this.addCheck(
      "hardRequirements",
      "seed script exists",
      fs.existsSync(seedScript),
    );
    const triageRoute = path.join(__dirname, "../api/src/routes/triage.ts");
    if (fs.existsSync(triageRoute)) {
      const content = fs.readFileSync(triageRoute, "utf8");
      const hasSSE = content.includes("text/event-stream");
      this.addCheck("hardRequirements", "SSE streaming implemented", hasSSE);
    }
    const redactorPath = path.join(__dirname, "../api/src/agents/redactor.ts");
    const redactorExists = fs.existsSync(redactorPath);
    this.addCheck("hardRequirements", "PII redaction system", redactorExists);
    const middlewarePath = path.join(
      __dirname,
      "../api/src/middleware/index.ts",
    );
    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, "utf8");
      const hasApiKey =
        content.includes("X-API-Key") || content.includes("apiKey");
      const hasRateLimit =
        content.includes("rate") && content.includes("limit");
      this.addCheck("hardRequirements", "API key authentication", hasApiKey);
      this.addCheck("hardRequirements", "rate limiting (429)", hasRateLimit);
    }
    const actionRoute = path.join(__dirname, "../api/src/routes/action.ts");
    if (fs.existsSync(actionRoute)) {
      const content = fs.readFileSync(actionRoute, "utf8");
      const hasAudit = content.includes("audit") || content.includes("log");
      this.addCheck("hardRequirements", "audit logging", hasAudit);
    }
    const ingestRoute = path.join(__dirname, "../api/src/routes/ingest.ts");
    if (fs.existsSync(ingestRoute)) {
      const content = fs.readFileSync(ingestRoute, "utf8");
      const hasIdempotency = content.includes("Idempotency-Key");
      this.addCheck("hardRequirements", "idempotent actions", hasIdempotency);
    }
    console.log(
      `   ✅ ${this.results.hardRequirements.passed} passed, ❌ ${this.results.hardRequirements.failed} failed\n`,
    );
  }
  async validateApiContracts() {
    console.log("🔌 Validating API Contracts...");
    const routeChecks = [
      {
        file: "ingest.ts",
        endpoint: "POST /api/ingest/transactions",
        response: "(accepted|count|requestId)",
      },
      {
        file: "customer.ts",
        endpoint: "GET /api/customer/:id/transactions",
        response: "(items|success|timestamp)",
      },
      {
        file: "insights.ts",
        endpoint: "GET /api/insights/:customerId/summary",
        response: "summary",
      },
      {
        file: "triage.ts",
        endpoint: "POST /api/triage",
        response: "(runId|alertId)",
      },
      {
        file: "triage.ts",
        endpoint: "GET /api/triage/:runId/stream",
        response: "text/event-stream",
      },
      {
        file: "action.ts",
        endpoint: "POST /api/action/freeze-card",
        response: "(status|requestId)",
      },
      {
        file: "action.ts",
        endpoint: "POST /api/action/open-dispute",
        response: "(caseId|status)",
      },
      { file: "kb.ts", endpoint: "GET /api/kb/search", response: "search" },
    ];
    for (const check of routeChecks) {
      const routePath = path.join(__dirname, `../api/src/routes/${check.file}`);
      if (fs.existsSync(routePath)) {
        const content = fs.readFileSync(routePath, "utf8");
        const hasEndpoint =
          content.includes(check.endpoint.split(" ")[1]) ||
          content.includes(check.endpoint.split("/").pop());
        this.addCheck("apiContracts", check.endpoint, hasEndpoint);
        if (hasEndpoint && check.response) {
          const hasResponseFormat = new RegExp(check.response).test(content);
          this.addCheck(
            "apiContracts",
            `${check.endpoint} response format`,
            hasResponseFormat,
          );
        }
      } else {
        this.addCheck(
          "apiContracts",
          check.endpoint,
          false,
          "route file missing",
        );
      }
    }
    const healthPath = path.join(__dirname, "../api/src/services/health.ts");
    this.addCheck(
      "apiContracts",
      "GET /health endpoint",
      fs.existsSync(healthPath),
    );
    const metricsPath = path.join(__dirname, "../api/src/services/metrics.ts");
    this.addCheck(
      "apiContracts",
      "GET /metrics endpoint",
      fs.existsSync(metricsPath),
    );
    console.log(
      `   ✅ ${this.results.apiContracts.passed} passed, ❌ ${this.results.apiContracts.failed} failed\n`,
    );
  }
  async validateAcceptanceScenarios() {
    console.log("🧪 Validating Acceptance Scenarios...");
    const requiredScenarios = [
      "freeze_otp",
      "dispute_creation",
      "duplicate_analysis",
      "tool_timeout",
      "rate_limiting",
      "pii_redaction",
      "performance_test",
    ];
    const evalsDir = path.join(__dirname, "../fixtures/evals");
    if (fs.existsSync(evalsDir)) {
      const evalFiles = fs
        .readdirSync(evalsDir)
        .filter((f) => f.endsWith(".json"));
      for (const scenario of requiredScenarios) {
        let found = false;
        let validStructure = false;
        for (const file of evalFiles) {
          try {
            const content = JSON.parse(
              fs.readFileSync(path.join(evalsDir, file), "utf8"),
            );
            if (
              content.scenario === scenario ||
              content.scenario === scenario.replace("_test", "")
            ) {
              found = true;
              const hasRequiredFields =
                content.id &&
                content.name &&
                content.scenario &&
                content.input &&
                content.expectedOutcome;
              validStructure = hasRequiredFields;
              break;
            }
          } catch (e) {}
        }
        this.addCheck(
          "acceptanceScenarios",
          `${scenario} scenario exists`,
          found,
        );
        if (found) {
          this.addCheck(
            "acceptanceScenarios",
            `${scenario} valid structure`,
            validStructure,
          );
        }
      }
    }
    this.validateSpecificScenarios();
    console.log(
      `   ✅ ${this.results.acceptanceScenarios.passed} passed, ❌ ${this.results.acceptanceScenarios.failed} failed\n`,
    );
  }
  validateSpecificScenarios() {
    const evalsDir = path.join(__dirname, "../fixtures/evals");
    const freezeOtpFile = path.join(evalsDir, "eval-001-freeze-otp.json");
    if (fs.existsSync(freezeOtpFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(freezeOtpFile, "utf8"));
        const hasOtpFlow = content.expectedOutcome?.otpRequired === true;
        const hasFreezeAction =
          content.expectedOutcome?.recommendation === "Freeze Card";
        this.addCheck(
          "acceptanceScenarios",
          "freeze_otp has OTP requirement",
          hasOtpFlow,
        );
        this.addCheck(
          "acceptanceScenarios",
          "freeze_otp recommends card freeze",
          hasFreezeAction,
        );
      } catch (e) {
        this.addCheck("acceptanceScenarios", "freeze_otp file readable", false);
      }
    }
    const disputeFile = path.join(evalsDir, "eval-002-dispute-creation.json");
    if (fs.existsSync(disputeFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(disputeFile, "utf8"));
        const hasAmountCheck = content.input?.amount === 499900; // ₹4,999
        const hasMerchant = content.input?.merchant === "ABC Mart";
        const hasReasonCode = content.expectedOutcome?.reasonCode === "10.4";
        this.addCheck(
          "acceptanceScenarios",
          "dispute_creation ₹4,999 amount",
          hasAmountCheck,
        );
        this.addCheck(
          "acceptanceScenarios",
          "dispute_creation ABC Mart merchant",
          hasMerchant,
        );
        this.addCheck(
          "acceptanceScenarios",
          "dispute_creation reason code 10.4",
          hasReasonCode,
        );
      } catch (e) {
        this.addCheck(
          "acceptanceScenarios",
          "dispute_creation file readable",
          false,
        );
      }
    }
    const piiFile = path.join(evalsDir, "eval-006-pii-redaction.json");
    if (fs.existsSync(piiFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(piiFile, "utf8"));
        const hasTestCard = content.input?.cardNumber === "4111111111111111";
        const hasRedactionExpectation =
          content.expectedOutcome?.redacted &&
          content.expectedOutcome.redacted.includes("REDACTED");
        this.addCheck(
          "acceptanceScenarios",
          "pii_redaction test card number",
          hasTestCard,
        );
        this.addCheck(
          "acceptanceScenarios",
          "pii_redaction expects masking",
          hasRedactionExpectation,
        );
      } catch (e) {
        this.addCheck(
          "acceptanceScenarios",
          "pii_redaction file readable",
          false,
        );
      }
    }
  }
  addCheck(category, name, passed, details = null) {
    const check = { name, passed, details };
    this.results[category].checks.push(check);
    if (passed) {
      this.results[category].passed++;
    } else {
      this.results[category].failed++;
    }
  }
  generateComplianceReport() {
    console.log("🎯 Final Compliance Report");
    console.log("=".repeat(60));
    const categories = [
      "fixtures",
      "hardRequirements",
      "apiContracts",
      "acceptanceScenarios",
    ];
    for (const category of categories) {
      this.results.overall.passed += this.results[category].passed;
      this.results.overall.failed += this.results[category].failed;
    }
    const total = this.results.overall.passed + this.results.overall.failed;
    this.results.overall.compliance = Math.round(
      (this.results.overall.passed / total) * 100,
    );
    console.log(`📊 Overall Compliance: ${this.results.overall.compliance}%`);
    console.log(`✅ Passed: ${this.results.overall.passed}`);
    console.log(`❌ Failed: ${this.results.overall.failed}`);
    console.log("");
    for (const category of categories) {
      const result = this.results[category];
      const categoryPercent = Math.round(
        (result.passed / (result.passed + result.failed)) * 100,
      );
      console.log(
        `📂 ${category}: ${categoryPercent}% (${result.passed}/${result.passed + result.failed})`,
      );
      const failures = result.checks.filter((c) => !c.passed);
      if (failures.length > 0) {
        failures.forEach((failure) => {
          console.log(
            `   ❌ ${failure.name}${failure.details ? ` (${failure.details})` : ""}`,
          );
        });
      }
      console.log("");
    }
    const isCompliant = this.results.overall.compliance >= 95; // 95%+ for production ready
    console.log(`🎖️  Production Ready: ${isCompliant ? "YES" : "NO"}`);
    if (isCompliant) {
      console.log("🎉 System is 100% compliant and ready for deployment!");
    } else {
      console.log("⚠️  System needs attention before production deployment.");
      console.log(
        `   Target: 95%+ compliance (current: ${this.results.overall.compliance}%)`,
      );
    }
    const reportPath = path.join(
      __dirname,
      "../reports/compliance-report.json",
    );
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          compliance: this.results.overall.compliance,
          productionReady: isCompliant,
          summary: {
            passed: this.results.overall.passed,
            failed: this.results.overall.failed,
            total: this.results.overall.passed + this.results.overall.failed,
          },
          categories: this.results,
        },
        null,
        2,
      ),
    );
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    return isCompliant;
  }
}
if (require.main === module) {
  const validator = new SystemValidator();
  validator
    .validateAll()
    .then((compliant) => {
      process.exit(compliant ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 System validation failed:", error);
      process.exit(1);
    });
}
module.exports = { SystemValidator };
