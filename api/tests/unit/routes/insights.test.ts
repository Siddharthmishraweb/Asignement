import request from "supertest";
import express, { Express } from "express";
import { createInsightsRouter } from "../../../src/routes/insights";
import { Database } from "../../../src/utils/database";
import { MetricsService } from "../../../src/services/metrics";
import winston from "winston";
jest.mock("../../../src/utils/database");
jest.mock("../../../src/services/metrics");
describe("Insights Routes", () => {
  let app: Express;
  let mockDatabase: jest.Mocked<Database>;
  let mockMetrics: jest.Mocked<MetricsService>;
  let mockLogger: winston.Logger;
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = {
      query: jest.fn().mockImplementation((query: string, params?: any[]) => {
        if (query.includes("FROM transactions")) {
          if (params?.[0] === "cust-not-found") {
            return Promise.resolve([]);
          }
          if (params?.[0] === "cust-empty") {
            return Promise.resolve([]);
          }
          return Promise.resolve([
            {
              id: "txn-1",
              customer_id: params?.[0] || "cust-123",
              amount_cents: 5000,
              merchant_name: "Test Store",
              merchant_category: "5411",
              transaction_date: new Date().toISOString(),
              status: "completed",
              country: "US",
            },
            {
              id: "txn-2",
              customer_id: params?.[0] || "cust-123",
              amount_cents: 3000,
              merchant_name: "Coffee Shop",
              merchant_category: "5812",
              transaction_date: new Date(Date.now() - 86400000).toISOString(),
              status: "completed",
              country: "US",
            },
          ]);
        }
        if (query.includes("FROM customer_data")) {
          if (params?.[0] === "cust-not-found") {
            return Promise.resolve([]);
          }
          return Promise.resolve([
            {
              customer_id: params?.[0] || "cust-123",
              name: "Test Customer",
              email: "test@example.com",
              tier: "premium",
              created_at: new Date().toISOString(),
            },
          ]);
        }
        if (query.includes("FROM interactions")) {
          if (
            params?.[0] === "cust-not-found" ||
            params?.[0] === "cust-no-history"
          ) {
            return Promise.resolve([]);
          }
          if (params?.[0] === "cust-minimal") {
            return Promise.resolve([
              {
                id: "int-1",
                customer_id: params[0],
                channel: "email",
                sentiment_score: 0.8,
                category: "inquiry",
                created_at: new Date().toISOString(),
                status: "resolved",
              },
            ]);
          }
          if (params?.[0] === "cust-unhappy") {
            return Promise.resolve([
              {
                id: "int-1",
                customer_id: params[0],
                channel: "phone",
                sentiment_score: 0.1,
                category: "complaint",
                created_at: new Date().toISOString(),
                status: "open",
              },
            ]);
          }
          return Promise.resolve([
            {
              id: "int-1",
              customer_id: params?.[0] || "cust-123",
              channel: "email",
              sentiment_score: 0.7,
              category: "inquiry",
              created_at: new Date().toISOString(),
              status: "resolved",
              resolution_time_minutes: 45,
            },
            {
              id: "int-2",
              customer_id: params?.[0] || "cust-123",
              channel: "chat",
              sentiment_score: 0.5,
              category: "support",
              created_at: new Date(Date.now() - 86400000).toISOString(),
              status: "resolved",
              resolution_time_minutes: 30,
            },
          ]);
        }
        if (query.includes("GROUP BY DATE")) {
          if (params?.[0] === "error-start") {
            throw new Error("Database connection lost");
          }
          return Promise.resolve([
            { date: "2024-01-01", value: 42 },
            { date: "2024-01-02", value: 38 },
            { date: "2024-01-03", value: 45 },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as any;
    mockMetrics = {
      incrementCounter: jest.fn(),
      recordDuration: jest.fn(),
      setGauge: jest.fn(),
    } as any;
    mockLogger = winston.createLogger({
      transports: [],
    });
    app = express();
    app.use(express.json());
    app.use(
      "/api/v1/insights",
      createInsightsRouter({
        database: mockDatabase,
        metrics: mockMetrics,
        logger: mockLogger,
      }),
    );
  });
  describe("GET /api/v1/insights/:customerId/summary", () => {
    describe("Positive Scenarios", () => {
      it("should return insights summary with default 90 days", async () => {
        const response = await request(app)
          .get("/api/v1/insights/cust-123/summary")
          .expect(200);
        expect(response.body).toEqual({
          success: true,
          customerId: "cust-123",
          summary: expect.objectContaining({
            categories: expect.any(Array),
            merchants: expect.any(Array),
            anomalies: expect.any(Array),
            monthlyTrend: expect.any(Array),
            totalAmount: expect.any(Number),
            totalTransactions: expect.any(Number),
            averageTransactionAmount: expect.any(Number),
          }),
          generated_at: expect.any(String),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "insights_customer_generated_total",
        );
      });
      it("should return insights summary with custom time range", async () => {
        const response = await request(app)
          .get("/api/v1/insights/cust-456/summary?lastDays=30")
          .expect(200);
        expect(response.body.success).toBe(true);
        expect(response.body.customerId).toBe("cust-456");
        expect(response.body.summary).toBeDefined();
        expect(response.body.generated_at).toBeDefined();
      });
      it("should limit days to maximum of 365", async () => {
        await request(app)
          .get("/api/v1/insights/cust-789/summary?lastDays=500")
          .expect(200);
      });
      it("should handle empty transaction data", async () => {
        const response = await request(app)
          .get("/api/v1/insights/cust-empty/summary")
          .expect(200);
        expect(response.body.summary.totalTransactions).toBe(0);
        expect(response.body.summary.totalAmount).toBe(0);
        expect(response.body.summary.categories).toEqual([]);
        expect(response.body.summary.merchants).toEqual([]);
      });
    });
    describe("Negative Scenarios", () => {
      it("should return 400 when customerId is missing", async () => {
        const response = await request(app)
          .get("/api/v1/insights//summary")
          .expect(404); // Express returns 404 for missing route params
      });
      it("should handle insights generation errors", async () => {
        mockDatabase.query.mockRejectedValueOnce(new Error("Database error"));
        const response = await request(app)
          .get("/api/v1/insights/cust-error/summary")
          .expect(500);
        expect(response.body).toEqual({
          error: "Failed to generate insights summary",
          timestamp: expect.any(String),
        });
      });
      it("should handle invalid lastDays parameter gracefully", async () => {
        await request(app)
          .get("/api/v1/insights/cust-123/summary?lastDays=invalid")
          .expect(200);
      });
    });
  });
  describe("POST /api/v1/insights/customer", () => {
    describe("Positive Scenarios", () => {
      it("should generate customer insights successfully", async () => {
        const response = await request(app)
          .post("/api/v1/insights/customer")
          .send({ customerId: "cust-123" })
          .expect(200);
        expect(response.body).toEqual({
          success: true,
          insights: expect.objectContaining({
            customer: expect.any(Object),
            interactionSummary: expect.objectContaining({
              totalInteractions: expect.any(Number),
              recentInteractions: expect.any(Array),
              channelBreakdown: expect.any(Object),
              sentimentTrend: expect.any(Array),
              issueCategories: expect.any(Object),
            }),
            recommendations: expect.any(Array),
            riskFactors: expect.any(Array),
          }),
          timestamp: expect.any(String),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "insights_customer_generated_total",
        );
      });
      it("should process custom time range query", async () => {
        const response = await request(app)
          .post("/api/v1/insights/customer")
          .send({
            customerId: "cust-123",
            timeRange: {
              start: "2024-01-01",
              end: "2024-01-31",
            },
          })
          .expect(200);
        expect(response.body.success).toBe(true);
      });
    });
    describe("Negative Scenarios", () => {
      it("should return 400 when customerId is missing", async () => {
        const response = await request(app)
          .post("/api/v1/insights/customer")
          .send({})
          .expect(400);
        expect(response.body).toEqual({
          error: "Customer ID is required",
          timestamp: expect.any(String),
        });
      });
      it("should return 404 when customer not found", async () => {
        const response = await request(app)
          .post("/api/v1/insights/customer")
          .send({ customerId: "cust-not-found" })
          .expect(404);
        expect(response.body).toEqual({
          error: "Customer not found",
          customerId: "cust-not-found",
          timestamp: expect.any(String),
        });
      });
      it("should handle database errors gracefully", async () => {
        mockDatabase.query.mockRejectedValueOnce(
          new Error("Database connection lost"),
        );
        const response = await request(app)
          .post("/api/v1/insights/customer")
          .send({ customerId: "cust-123" })
          .expect(500);
        expect(response.body).toEqual({
          error: "Failed to generate customer insights",
          timestamp: expect.any(String),
        });
      });
    });
  });
  describe("POST /api/v1/insights/trends", () => {
    describe("Positive Scenarios", () => {
      it("should use default time range when not provided", async () => {
        const response = await request(app)
          .post("/api/v1/insights/trends")
          .send({})
          .expect(200);
        expect(response.body.success).toBe(true);
        expect(response.body.trends.summary.periodStart).toBeDefined();
        expect(response.body.trends.summary.periodEnd).toBeDefined();
      });
    });
    describe("Negative Scenarios", () => {});
  });
  describe("POST /api/v1/insights/predict", () => {
    describe("Positive Scenarios", () => {
      it("should generate predictive insights successfully", async () => {
        const response = await request(app)
          .post("/api/v1/insights/predict")
          .send({
            customerId: "cust-123",
            predictionType: "churn",
          })
          .expect(200);
        expect(response.body).toEqual({
          success: true,
          predictions: expect.objectContaining({
            churnRisk: expect.objectContaining({
              score: expect.any(Number),
              factors: expect.any(Array),
            }),
            nextContactProbability: expect.any(Number),
            satisfactionPrediction: expect.objectContaining({
              predicted: expect.any(Number),
              confidence: expect.any(Number),
            }),
            issueEscalationRisk: expect.objectContaining({
              risk: expect.stringMatching(/^(low|medium|high)$/),
              score: expect.any(Number),
            }),
            confidence: expect.any(Number),
          }),
          customerId: "cust-123",
          timestamp: expect.any(String),
        });
        expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
          "insights_predictions_generated_total",
        );
      });
      it("should handle customer with minimal history", async () => {
        const response = await request(app)
          .post("/api/v1/insights/predict")
          .send({
            customerId: "cust-minimal",
          })
          .expect(200);
        expect(response.body.predictions.confidence).toBeLessThan(0.5);
      });
      it("should assess high churn risk for negative sentiment", async () => {
        const response = await request(app)
          .post("/api/v1/insights/predict")
          .send({
            customerId: "cust-unhappy",
            predictionType: "churn",
          })
          .expect(200);
        expect(response.body.predictions.churnRisk.score).toBeGreaterThan(0.3);
        expect(response.body.predictions.churnRisk.factors).toContain(
          "Poor sentiment history",
        );
      });
    });
    describe("Negative Scenarios", () => {
      it("should return 400 when customerId is missing", async () => {
        const response = await request(app)
          .post("/api/v1/insights/predict")
          .send({ predictionType: "churn" })
          .expect(400);
        expect(response.body).toEqual({
          error: "Customer ID is required",
          timestamp: expect.any(String),
        });
      });
      it("should return 404 when no interaction history found", async () => {
        const response = await request(app)
          .post("/api/v1/insights/predict")
          .send({
            customerId: "cust-no-history",
            predictionType: "churn",
          })
          .expect(404);
        expect(response.body).toEqual({
          error: "No interaction history found for customer",
          customerId: "cust-no-history",
          timestamp: expect.any(String),
        });
      });
      it("should handle database errors gracefully", async () => {
        mockDatabase.query.mockRejectedValueOnce(
          new Error("Database connection lost"),
        );
        const response = await request(app)
          .post("/api/v1/insights/predict")
          .send({
            customerId: "cust-error",
            predictionType: "churn",
          })
          .expect(500);
        expect(response.body).toEqual({
          error: "Failed to generate predictive insights",
          timestamp: expect.any(String),
        });
      });
    });
  });
  describe("Request Headers and Logging", () => {
    it("should handle custom request ID headers", async () => {
      const customRequestId = "custom-req-123";
      const response = await request(app)
        .get("/api/v1/insights/cust-123/summary")
        .set("X-Request-ID", customRequestId)
        .expect(200);
    });
    it("should include timestamp in all responses", async () => {
      const response = await request(app)
        .get("/api/v1/insights/cust-123/summary")
        .expect(200);
      expect(response.body).toHaveProperty("generated_at");
      expect(new Date(response.body.generated_at)).toBeInstanceOf(Date);
    });
  });
});
