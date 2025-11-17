import request from "supertest";
import express from "express";
import { actionRoutes } from "../../../src/routes/action";
import { Database } from "../../../src/utils/database";
import { RedisClient } from "../../../src/utils/redis";
import { MetricsService } from "../../../src/services/metrics";
import winston from "winston";
describe("Action Routes", () => {
  let app: express.Application;
  let mockDatabase: jest.Mocked<Database>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockMetrics: jest.Mocked<MetricsService>;
  let mockLogger: winston.Logger;
  const validApiKey = "sentinel-api-key-2024";
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_KEY = validApiKey;
    mockDatabase = {
      query: jest.fn(),
      close: jest.fn(),
    } as any;
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;
    mockMetrics = {
      incrementCounter: jest.fn(),
      recordHttpRequest: jest.fn(),
    } as any;
    mockLogger = winston.createLogger({
      level: "silent",
      transports: [],
    });
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      (req as any).auth = {
        userId: "user-123",
        permissions: ["execute_actions"],
      };
      next();
    });
    app.use(
      "/api/v1/action",
      actionRoutes({
        database: mockDatabase,
        redis: mockRedis,
        metrics: mockMetrics,
        logger: mockLogger,
      }),
    );
  });
  describe("API Key Authentication", () => {
    it("should reject requests without API key", async () => {
      await request(app)
        .post("/api/v1/action/freeze-card")
        .send({ cardId: "card-123" })
        .expect(401)
        .expect((res) => {
          expect(res.body).toEqual({
            error: "Unauthorized",
            message: "Valid X-API-Key required",
          });
        });
    });
    it("should reject requests with invalid API key", async () => {
      await request(app)
        .post("/api/v1/action/freeze-card")
        .set("X-API-Key", "invalid-key")
        .send({ cardId: "card-123" })
        .expect(401);
    });
    it("should accept requests with valid API key", async () => {
      mockRedis.get.mockResolvedValue(null);
      await request(app)
        .post("/api/v1/action/freeze-card")
        .set("X-API-Key", validApiKey)
        .send({ cardId: "card-123", otp: "123456" })
        .expect(200);
    });
  });
  describe("Idempotency", () => {
    it("should return cached result for repeated requests with same idempotency key", async () => {
      const idempotencyKey = "test-key-123";
      const cachedResult = {
        status: "FROZEN",
        requestId: "cached-request-123",
        cardId: "card-123",
        reason: "Fraud prevention",
        timestamp: 1234567890,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));
      const response = await request(app)
        .post("/api/v1/action/freeze-card")
        .set("X-API-Key", validApiKey)
        .set("Idempotency-Key", idempotencyKey)
        .send({ cardId: "card-123" })
        .expect(200);
      expect(response.body).toEqual(cachedResult);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
      );
    });
    it("should store result for new idempotency key", async () => {
      const idempotencyKey = "new-key-456";
      mockRedis.get.mockResolvedValue(null);
      await request(app)
        .post("/api/v1/action/freeze-card")
        .set("X-API-Key", validApiKey)
        .set("Idempotency-Key", idempotencyKey)
        .send({ cardId: "card-123", otp: "123456" })
        .expect(200);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
        expect.stringContaining('"status":"FROZEN"'),
        3600,
      );
    });
  });
  describe("POST /api/v1/action/freeze-card", () => {
    describe("Positive Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null); // No cached result
      });
      it("should freeze card with valid OTP", async () => {
        const response = await request(app)
          .post("/api/v1/action/freeze-card")
          .set("X-API-Key", validApiKey)
          .send({
            cardId: "card-123",
            otp: "123456",
            reason: "Suspicious activity",
          })
          .expect(200);
        expect(response.body).toEqual({
          status: "FROZEN",
          requestId: expect.any(String),
          cardId: "card-123",
          reason: "Suspicious activity",
          timestamp: expect.any(Number),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "tool_call_total",
          { tool: "freeze_card", ok: "true" },
        );
      });

      it("should use default reason when none provided", async () => {
        const response = await request(app)
          .post("/api/v1/action/freeze-card")
          .set("X-API-Key", validApiKey)
          .send({
            cardId: "card-789",
            otp: "123456",
          })
          .expect(200);
        expect(response.body.reason).toBe("Fraud prevention");
      });
    });
    describe("Negative Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });
      it("should return 400 when cardId is missing", async () => {
        const response = await request(app)
          .post("/api/v1/action/freeze-card")
          .set("X-API-Key", validApiKey)
          .send({
            otp: "123456",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required field: cardId",
          requestId: expect.any(String),
        });
      });
      it("should return PENDING_OTP when OTP is required but not provided", async () => {
        const response = await request(app)
          .post("/api/v1/action/freeze-card")
          .set("X-API-Key", validApiKey)
          .send({
            cardId: "card-123",
          })
          .expect(200);
        expect(response.body).toEqual({
          status: "PENDING_OTP",
          requestId: expect.any(String),
          message: "OTP verification required",
          timestamp: expect.any(Number),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "action_blocked_total",
          { policy: "otp_required" },
        );
      });
      it("should return 400 for invalid OTP", async () => {
        const response = await request(app)
          .post("/api/v1/action/freeze-card")
          .set("X-API-Key", validApiKey)
          .send({
            cardId: "card-123",
            otp: "invalid",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Invalid OTP",
          requestId: expect.any(String),
          timestamp: expect.any(Number),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "action_blocked_total",
          { policy: "invalid_otp" },
        );
      });

    });
  });
  describe("POST /api/v1/action/open-dispute", () => {
    describe("Positive Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
        mockDatabase.query.mockResolvedValue([{ id: "case-123" }]);
      });
      it("should open dispute with valid parameters", async () => {
        const response = await request(app)
          .post("/api/v1/action/open-dispute")
          .set("X-API-Key", validApiKey)
          .send({
            txnId: "txn-123",
            reasonCode: "10.4",
            confirm: true,
            customerId: "cust-123",
          })
          .expect(200);
        expect(response.body).toEqual({
          status: "OPEN",
          caseId: "case-123",
          txnId: "txn-123",
          reasonCode: "10.4",
          requestId: expect.any(String),
          timestamp: expect.any(Number),
        });
        expect(mockDatabase.query).toHaveBeenCalledWith(
          expect.stringContaining("INSERT INTO cases"),
          expect.arrayContaining(["cust-123", "txn-123", "10.4"]),
        );
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "tool_call_total",
          { tool: "open_dispute", ok: "true" },
        );
      });
      it("should open dispute without customerId", async () => {
        const response = await request(app)
          .post("/api/v1/action/open-dispute")
          .set("X-API-Key", validApiKey)
          .send({
            txnId: "txn-456",
            reasonCode: "4855",
            confirm: true,
          })
          .expect(200);
        expect(response.body.status).toBe("OPEN");
        expect(response.body.txnId).toBe("txn-456");
        expect(response.body.reasonCode).toBe("4855");
      });
      it("should handle all valid reason codes", async () => {
        const validCodes = ["10.4", "4855", "4837", "4863", "4834"];
        for (const reasonCode of validCodes) {
          mockDatabase.query.mockResolvedValueOnce([
            { id: `case-${reasonCode}` },
          ]);
          await request(app)
            .post("/api/v1/action/open-dispute")
            .set("X-API-Key", validApiKey)
            .send({
              txnId: "txn-test",
              reasonCode,
              confirm: true,
            })
            .expect(200);
        }
      });
    });
    describe("Negative Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });
      it("should return 400 when required fields are missing", async () => {
        const response = await request(app)
          .post("/api/v1/action/open-dispute")
          .set("X-API-Key", validApiKey)
          .send({
            txnId: "txn-123",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required fields: txnId, reasonCode, confirm",
          requestId: expect.any(String),
        });
      });
      it("should return 400 for invalid reason code", async () => {
        const response = await request(app)
          .post("/api/v1/action/open-dispute")
          .set("X-API-Key", validApiKey)
          .send({
            txnId: "txn-123",
            reasonCode: "INVALID",
            confirm: true,
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Invalid reason code",
          validCodes: ["10.4", "4855", "4837", "4863", "4834"],
          requestId: expect.any(String),
        });
      });
      it("should handle database errors gracefully", async () => {
        mockDatabase.query.mockRejectedValue(
          new Error("Database connection failed"),
        );
        const response = await request(app)
          .post("/api/v1/action/open-dispute")
          .set("X-API-Key", validApiKey)
          .send({
            txnId: "txn-123",
            reasonCode: "10.4",
            confirm: true,
          })
          .expect(500);
        expect(response.body).toMatchObject({
          error: "Failed to open dispute",
          requestId: expect.any(String),
          details: "Database connection failed",
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "tool_call_total",
          { tool: "open_dispute", ok: "false" },
        );
      });
    });
  });
  describe("POST /api/v1/action/contact-customer", () => {
    describe("Positive Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });
      it("should send email communication successfully", async () => {
        const response = await request(app)
          .post("/api/v1/action/contact-customer")
          .set("X-API-Key", validApiKey)
          .send({
            customerId: "cust-123",
            communicationType: "email",
            template: "fraud_alert",
            variables: { alertId: "alert-123", amount: "$500" },
          })
          .expect(200);
        expect(response.body).toEqual({
          status: "SENT",
          communicationId: expect.stringMatching(/^COMM-/),
          customerId: "cust-123",
          type: "email",
          requestId: expect.any(String),
          timestamp: expect.any(Number),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "tool_call_total",
          { tool: "contact_customer", ok: "true" },
        );
      });
      it("should send SMS communication successfully", async () => {
        const response = await request(app)
          .post("/api/v1/action/contact-customer")
          .set("X-API-Key", validApiKey)
          .send({
            customerId: "cust-456",
            communicationType: "sms",
            template: "account_locked",
          })
          .expect(200);
        expect(response.body.status).toBe("SENT");
        expect(response.body.type).toBe("sms");
        expect(response.body.customerId).toBe("cust-456");
      });
      it("should send phone communication successfully", async () => {
        const response = await request(app)
          .post("/api/v1/action/contact-customer")
          .set("X-API-Key", validApiKey)
          .send({
            customerId: "cust-789",
            communicationType: "phone",
            template: "verification_call",
          })
          .expect(200);
        expect(response.body.status).toBe("SENT");
        expect(response.body.type).toBe("phone");
      });
      it("should handle request with custom request ID", async () => {
        const customRequestId = "custom-req-123";
        const response = await request(app)
          .post("/api/v1/action/contact-customer")
          .set("X-API-Key", validApiKey)
          .set("X-Request-ID", customRequestId)
          .send({
            customerId: "cust-123",
            communicationType: "email",
            template: "welcome",
          })
          .expect(200);
        expect(response.body.requestId).toBe(customRequestId);
      });
    });
    describe("Negative Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });
      it("should return 400 when required fields are missing", async () => {
        const response = await request(app)
          .post("/api/v1/action/contact-customer")
          .set("X-API-Key", validApiKey)
          .send({
            customerId: "cust-123",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required fields",
          message: "customerId, communicationType, and template are required",
          requestId: expect.any(String),
        });
      });
      it("should return 400 for invalid communication type", async () => {
        const response = await request(app)
          .post("/api/v1/action/contact-customer")
          .set("X-API-Key", validApiKey)
          .send({
            customerId: "cust-123",
            communicationType: "carrier_pigeon",
            template: "urgent_message",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Invalid communication type",
          message: "communicationType must be email, sms, or phone",
          requestId: expect.any(String),
        });
      });

    });
  });
  describe("POST /api/v1/action/mark-false-positive", () => {
    describe("Positive Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
        mockDatabase.query
          .mockResolvedValueOnce([]) // UPDATE alerts query
          .mockResolvedValueOnce([{ id: "case-123" }]); // INSERT INTO cases query
      });
      it("should mark alert as false positive successfully", async () => {
        const response = await request(app)
          .post("/api/v1/action/mark-false-positive")
          .set("X-API-Key", validApiKey)
          .send({
            alertId: "alert-123",
            reason: "Customer verified transaction",
          })
          .expect(200);
        expect(response.body).toEqual({
          status: "FALSE_POSITIVE",
          alertId: "alert-123",
          markedAt: expect.any(String),
          reason: "Customer verified transaction",
          caseId: "case-123",
          requestId: expect.any(String),
        });
        expect(mockDatabase.query).toHaveBeenCalledWith(
          "UPDATE alerts SET status = $2, updated_at = NOW() WHERE id = $1",
          ["alert-123", "FALSE_POSITIVE"],
        );
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "tool_call_total",
          { tool: "mark_false_positive", ok: "true" },
        );
      });
      it("should mark alert as false positive without reason", async () => {
        const response = await request(app)
          .post("/api/v1/action/mark-false-positive")
          .set("X-API-Key", validApiKey)
          .send({
            alertId: "alert-456",
          })
          .expect(200);
        expect(response.body.reason).toBe("No reason provided");
        expect(response.body.status).toBe("FALSE_POSITIVE");
      });

    });
    describe("Negative Scenarios", () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });
      it("should return 400 when alertId is missing", async () => {
        const response = await request(app)
          .post("/api/v1/action/mark-false-positive")
          .set("X-API-Key", validApiKey)
          .send({
            reason: "Test reason",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required field: alertId",
          requestId: expect.any(String),
        });
      });

    });
  });
  describe("Request Metrics and Logging", () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
    });
    it("should record HTTP request metrics for all endpoints", async () => {
      await request(app)
        .post("/api/v1/action/freeze-card")
        .set("X-API-Key", validApiKey)
        .send({ cardId: "card-123", otp: "123456" });
      expect(mockMetrics.recordHttpRequest).toHaveBeenCalledWith(
        "POST",
        "/action/freeze-card",
        200,
        expect.any(Number),
      );
    });
    it("should store audit events in Redis", async () => {
      await request(app)
        .post("/api/v1/action/freeze-card")
        .set("X-API-Key", validApiKey)
        .send({ cardId: "card-123", otp: "123456" });
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^audit:/),
        expect.stringContaining('"action":"FREEZE_CARD"'),
        86400,
      );
    });
  });
});
