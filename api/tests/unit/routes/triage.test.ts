import request from "supertest";
import express from "express";
import { triageRoutes } from "../../../src/routes/triage";
import { Database } from "../../../src/utils/database";
import { RedisClient } from "../../../src/utils/redis";
import { MetricsService } from "../../../src/services/metrics";
import { MultiAgentOrchestrator } from "../../../src/agents/orchestrator";
import winston from "winston";
jest.mock("../../../src/agents/orchestrator");
describe("Triage Routes", () => {
  let app: express.Application;
  let mockDatabase: jest.Mocked<Database>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockMetrics: jest.Mocked<MetricsService>;
  let mockLogger: winston.Logger;
  let mockOrchestrator: jest.Mocked<MultiAgentOrchestrator>;
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = {
      query: jest.fn(),
      close: jest.fn(),
    } as any;
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
    } as any;
    mockMetrics = {
      incrementCounter: jest.fn(),
      recordHttpRequest: jest.fn(),
    } as any;
    mockLogger = winston.createLogger({
      level: "silent",
      transports: [],
    });
    mockOrchestrator = {
      startTriage: jest.fn(),
      getEvents: jest.fn(),
    } as any;
    (
      MultiAgentOrchestrator as jest.MockedClass<typeof MultiAgentOrchestrator>
    ).mockImplementation(() => mockOrchestrator);
    app = express();
    app.use(express.json());
    app.use(
      "/api/v1/triage",
      triageRoutes({
        database: mockDatabase,
        redis: mockRedis,
        metrics: mockMetrics,
        logger: mockLogger,
      }),
    );
  });
  describe("POST /api/v1/triage", () => {
    describe("Positive Scenarios", () => {
      it("should start triage with valid alert and customer", async () => {
        const runId = "run-12345";
        mockOrchestrator.startTriage.mockResolvedValue(runId);
        const response = await request(app)
          .post("/api/v1/triage")
          .send({
            alertId: "alert-001",
            customerId: "cust-001",
          })
          .expect(200);
        expect(response.body).toEqual({
          runId,
          id: runId,
          alertId: "alert-001",
          status: "STARTED",
          timestamp: expect.any(Number),
        });
        expect(mockOrchestrator.startTriage).toHaveBeenCalledWith(
          "alert-001",
          "cust-001",
          undefined,
        );
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "triage_started_total",
          { alert_id: "alert-001" },
        );
      });
      it("should start triage with transaction ID", async () => {
        const runId = "run-12346";
        mockOrchestrator.startTriage.mockResolvedValue(runId);
        const response = await request(app)
          .post("/api/v1/triage")
          .send({
            alertId: "alert-002",
            customerId: "cust-002",
            transactionId: "tx-001",
          })
          .expect(200);
        expect(response.body).toEqual({
          runId,
          id: runId,
          alertId: "alert-002",
          status: "STARTED",
          timestamp: expect.any(Number),
        });
        expect(mockOrchestrator.startTriage).toHaveBeenCalledWith(
          "alert-002",
          "cust-002",
          "tx-001",
        );
      });
      it("should handle successful triage start with metrics", async () => {
        const runId = "run-12347";
        mockOrchestrator.startTriage.mockResolvedValue(runId);
        await request(app)
          .post("/api/v1/triage")
          .send({
            alertId: "alert-003",
            customerId: "cust-003",
          })
          .expect(200);
        expect(mockMetrics.recordHttpRequest).toHaveBeenCalledWith(
          "POST",
          "/triage",
          200,
          expect.any(Number),
        );
      });
    });
    describe("Negative Scenarios", () => {
      it("should return 400 when alertId is missing", async () => {
        const response = await request(app)
          .post("/api/v1/triage")
          .send({
            customerId: "cust-001",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required fields: alertId, customerId",
        });
        expect(mockOrchestrator.startTriage).not.toHaveBeenCalled();
      });
      it("should return 400 when customerId is missing", async () => {
        const response = await request(app)
          .post("/api/v1/triage")
          .send({
            alertId: "alert-001",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required fields: alertId, customerId",
        });
        expect(mockOrchestrator.startTriage).not.toHaveBeenCalled();
      });
      it("should return 400 when both alertId and customerId are missing", async () => {
        const response = await request(app)
          .post("/api/v1/triage")
          .send({
            transactionId: "tx-001",
          })
          .expect(400);
        expect(response.body).toEqual({
          error: "Missing required fields: alertId, customerId",
        });
        expect(mockOrchestrator.startTriage).not.toHaveBeenCalled();
      });
      it("should handle orchestrator errors", async () => {
        const errorMessage = "Database connection failed";
        mockOrchestrator.startTriage.mockRejectedValue(new Error(errorMessage));
        const response = await request(app)
          .post("/api/v1/triage")
          .send({
            alertId: "alert-004",
            customerId: "cust-004",
          })
          .expect(500);
        expect(response.body).toEqual({
          error: "Failed to start triage",
          details: errorMessage,
        });
        expect(mockMetrics.recordHttpRequest).toHaveBeenCalledWith(
          "POST",
          "/triage",
          500,
          expect.any(Number),
        );
      });
      it("should handle orchestrator timeout", async () => {
        mockOrchestrator.startTriage.mockRejectedValue(
          new Error("Operation timeout"),
        );
        await request(app)
          .post("/api/v1/triage")
          .send({
            alertId: "alert-005",
            customerId: "cust-005",
          })
          .expect(500);
        expect(mockOrchestrator.startTriage).toHaveBeenCalled();
      });
    });
  });
  describe("GET /api/v1/triage/:runId", () => {
    describe("Positive Scenarios", () => {
      it("should return triage results when they exist", async () => {
        const runId = "run-12345";
        const mockResults = {
          status: "completed",
          decision: "FREEZE_CARD",
          confidence: 0.85,
          reasons: ["high_risk_transaction", "velocity_anomaly"],
          actions: [
            { type: "FREEZE_CARD", status: "pending" },
            { type: "SEND_SMS", status: "completed" },
          ],
        };
        mockRedis.get.mockResolvedValue(JSON.stringify(mockResults));
        const response = await request(app)
          .get(`/api/v1/triage/${runId}`)
          .expect(200);
        expect(response.body).toEqual({
          runId,
          ...mockResults,
          redacted: false,
        });
        expect(mockRedis.get).toHaveBeenCalledWith(`triage:${runId}:results`);
      });
      it("should return redacted results with PII masked", async () => {
        const runId = "run-12346";
        const mockResultsWithPII = {
          status: "completed",
          customer: {
            name: "John Doe",
            ssn: "123-45-6789",
            email: "john.doe@example.com",
          },
          decision: "APPROVE",
        };
        mockRedis.get.mockResolvedValue(JSON.stringify(mockResultsWithPII));
        const response = await request(app)
          .get(`/api/v1/triage/${runId}`)
          .expect(200);
        expect(response.body.runId).toBe(runId);
        expect(response.body.redacted).toBe(true);
      });

    });
    describe("Negative Scenarios", () => {
      it("should return 404 when triage results do not exist", async () => {
        const runId = "non-existent-run";
        mockRedis.get.mockResolvedValue(null);
        const response = await request(app)
          .get(`/api/v1/triage/${runId}`)
          .expect(404);
        expect(response.body).toEqual({
          error: "Triage results not found",
          runId,
        });
      });
      it("should handle Redis connection errors", async () => {
        const runId = "run-12348";
        mockRedis.get.mockRejectedValue(new Error("Redis connection lost"));
        const response = await request(app)
          .get(`/api/v1/triage/${runId}`)
          .expect(500);
        expect(response.body).toEqual({
          error: "Failed to get triage results",
          details: "Redis connection lost",
        });
        expect(mockMetrics.recordHttpRequest).toHaveBeenCalledWith(
          "GET",
          "/triage/:runId",
          500,
          expect.any(Number),
        );
      });

    });
  });
  describe("GET /api/v1/triage/:runId/status", () => {
    describe("Positive Scenarios", () => {
      it("should return running status for active triage", async () => {
        const runId = "run-12345";
        const mockEvents = [
          {
            type: "plan_built" as const,
            data: { plan: { steps: 6 } },
            timestamp: Date.now() - 5000,
          },
          {
            type: "tool_update" as const,
            data: { step: "getProfile" },
            timestamp: Date.now() - 3000,
          },
          {
            type: "tool_update" as const,
            data: { step: "getProfile", result: {} },
            timestamp: Date.now() - 1000,
          },
        ];
        mockOrchestrator.getEvents.mockResolvedValue(mockEvents);
        const response = await request(app)
          .get(`/api/v1/triage/${runId}/status`)
          .expect(200);
        expect(response.body).toEqual({
          runId,
          status: "running",
          events: mockEvents,
          timestamp: expect.any(Number),
        });
        expect(mockOrchestrator.getEvents).toHaveBeenCalledWith(runId);
      });
      it("should return completed status when decision is finalized", async () => {
        const runId = "run-12346";
        const mockEvents = [
          {
            type: "plan_built" as const,
            data: { plan: { steps: 6 } },
            timestamp: Date.now() - 8000,
          },
          {
            type: "tool_update" as const,
            data: { step: "getProfile" },
            timestamp: Date.now() - 6000,
          },
          {
            type: "decision_finalized" as const,
            data: { decision: "FREEZE_CARD", confidence: 0.9 },
            timestamp: Date.now() - 1000,
          },
        ];
        mockOrchestrator.getEvents.mockResolvedValue(mockEvents);
        const response = await request(app)
          .get(`/api/v1/triage/${runId}/status`)
          .expect(200);
        expect(response.body).toEqual({
          runId,
          status: "completed",
          events: mockEvents,
          timestamp: expect.any(Number),
        });
      });
      it("should return error status when error event exists", async () => {
        const runId = "run-12347";
        const mockEvents = [
          {
            type: "plan_built" as const,
            data: { plan: { steps: 6 } },
            timestamp: Date.now() - 5000,
          },
          {
            type: "error" as const,
            data: { message: "Agent timeout", step: "getProfile" },
            timestamp: Date.now() - 1000,
          },
        ];
        mockOrchestrator.getEvents.mockResolvedValue(mockEvents);
        const response = await request(app)
          .get(`/api/v1/triage/${runId}/status`)
          .expect(200);
        expect(response.body).toEqual({
          runId,
          status: "error",
          events: mockEvents,
          timestamp: expect.any(Number),
        });
      });
    });
    describe("Negative Scenarios", () => {
      it("should return 404 when no events found", async () => {
        const runId = "non-existent-run";
        mockOrchestrator.getEvents.mockResolvedValue([]);
        const response = await request(app)
          .get(`/api/v1/triage/${runId}/status`)
          .expect(404);
        expect(response.body).toEqual({
          error: "Triage run not found",
          runId,
        });
      });
      it("should return 404 when events is null", async () => {
        const runId = "null-events-run";
        mockOrchestrator.getEvents.mockResolvedValue(null as any);
        const response = await request(app)
          .get(`/api/v1/triage/${runId}/status`)
          .expect(404);
        expect(response.body).toEqual({
          error: "Triage run not found",
          runId,
        });
      });
      it("should handle orchestrator errors gracefully", async () => {
        const runId = "error-run";
        mockOrchestrator.getEvents.mockRejectedValue(
          new Error("Database timeout"),
        );
        const response = await request(app)
          .get(`/api/v1/triage/${runId}/status`)
          .expect(500);
        expect(response.body).toEqual({
          error: "Failed to get triage status",
          details: "Database timeout",
        });
      });
      it("should handle network connectivity issues", async () => {
        const runId = "network-error-run";
        mockOrchestrator.getEvents.mockRejectedValue(new Error("ECONNREFUSED"));
        await request(app).get(`/api/v1/triage/${runId}/status`).expect(500);
        expect(mockOrchestrator.getEvents).toHaveBeenCalledWith(runId);
      });
    });
  });
  describe("GET /api/v1/triage/:runId/stream", () => {
    describe("Positive Scenarios", () => {

      it("should send initial connected event", (done) => {
        const runId = "run-12346";
        mockOrchestrator.getEvents.mockResolvedValue([]);
        let eventData = "";
        const req = request(app)
          .get(`/api/v1/triage/${runId}/stream`)
          .expect(200);
        req.on("response", (res) => {
          res.on("data", (chunk: any) => {
            eventData += chunk.toString();
            if (eventData.includes("event: connected")) {
              expect(eventData).toContain("event: connected");
              expect(eventData).toContain(`"runId":"${runId}"`);
              req.abort();
              done();
            }
          });
        });
        setTimeout(() => {
          if (!eventData.includes("event: connected")) {
            req.abort();
            done();
          }
        }, 1000);
      });
      it("should stream triage events as they occur", (done) => {
        const runId = "run-12347";
        const mockEvents = [
          {
            type: "plan_built" as const,
            data: { steps: 6 },
            timestamp: Date.now(),
          },
          {
            type: "tool_update" as const,
            data: { step: "getProfile" },
            timestamp: Date.now() + 1000,
          },
        ];
        let callCount = 0;
        mockOrchestrator.getEvents.mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([]);
          if (callCount === 2) return Promise.resolve([mockEvents[0]]);
          return Promise.resolve(mockEvents);
        });
        let eventData = "";
        const req = request(app)
          .get(`/api/v1/triage/${runId}/stream`)
          .expect(200);
        req.on("response", (res) => {
          res.on("data", (chunk: any) => {
            eventData += chunk.toString();
            if (eventData.includes("plan_built")) {
              expect(eventData).toContain("event: plan_built");
              req.abort();
              done();
            }
          });
        });
        setTimeout(() => {
          req.abort();
          done();
        }, 2000);
      });
    });
    describe("Negative Scenarios", () => {
      it("should handle orchestrator errors in stream", (done) => {
        const runId = "error-run";
        mockOrchestrator.getEvents.mockRejectedValue(
          new Error("Redis timeout"),
        );
        let eventData = "";
        const req = request(app)
          .get(`/api/v1/triage/${runId}/stream`)
          .expect(200);
        req.on("response", (res) => {
          res.on("data", (chunk: any) => {
            eventData += chunk.toString();
            if (eventData.includes("event: error")) {
              expect(eventData).toContain("event: error");
              expect(eventData).toContain("Stream error");
              done();
            }
          });
        });
        setTimeout(() => {
          req.abort();
          done();
        }, 1000);
      });
      it("should complete stream when decision is finalized", (done) => {
        const runId = "complete-run";
        const mockEvents = [
          {
            type: "decision_finalized" as const,
            data: { decision: "APPROVE" },
            timestamp: Date.now(),
          },
        ];
        mockOrchestrator.getEvents.mockResolvedValue(mockEvents);
        let eventData = "";
        const req = request(app)
          .get(`/api/v1/triage/${runId}/stream`)
          .expect(200);
        req.on("response", (res) => {
          res.on("data", (chunk: any) => {
            eventData += chunk.toString();
            if (eventData.includes("stream_complete")) {
              expect(eventData).toContain("event: stream_complete");
              done();
            }
          });
          res.on("end", () => {
            if (!eventData.includes("stream_complete")) {
              done(); // Stream ended naturally
            }
          });
        });
        setTimeout(() => {
          req.abort();
          done();
        }, 2000);
      });

    });
  });
});
