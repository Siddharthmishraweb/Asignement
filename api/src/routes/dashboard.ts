import { Router, Request, Response } from "express";
import { RouteConfig } from "./index";
const router = Router();
export const createDashboardRouter = (config: RouteConfig) => {
  const { database, logger } = config;
  router.get("/metrics", async (req: Request, res: Response): Promise<void> => {
    try {
      const metricsQueries = await Promise.allSettled([
        database.query(`
          SELECT status, COUNT(*) as count
          FROM alerts
          WHERE status != 'FALSE_POSITIVE'
          GROUP BY status
        `),
        database.query(`
          SELECT status, COUNT(*) as count
          FROM transactions
          GROUP BY status
        `),
        database.query(`
          SELECT kyc_level, COUNT(*) as count
          FROM customers
          GROUP BY kyc_level
        `),
        database.query(`
          SELECT
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_alerts,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_transactions
          FROM (
            SELECT created_at FROM alerts WHERE status != 'FALSE_POSITIVE'
            UNION ALL
            SELECT created_at FROM transactions
          ) activity
        `),
        database.query(`
          SELECT COUNT(*) as count
          FROM transactions
          WHERE risk_score > 0.7 AND created_at > NOW() - INTERVAL '7 days'
        `),
        database.query(`
          SELECT
            AVG(latency_ms) as avg_latency_ms,
            COUNT(*) as triage_count
          FROM triage_runs
          WHERE ended_at IS NOT NULL
            AND started_at > NOW() - INTERVAL '7 days'
        `),
      ]);
      const alertsByStatus =
        metricsQueries[0].status === "fulfilled" ? metricsQueries[0].value : [];
      const transactionsByStatus =
        metricsQueries[1].status === "fulfilled" ? metricsQueries[1].value : [];
      const customersByKyc =
        metricsQueries[2].status === "fulfilled" ? metricsQueries[2].value : [];
      const recentActivity =
        metricsQueries[3].status === "fulfilled"
          ? metricsQueries[3].value[0]
          : {};
      const highRiskTransactions =
        metricsQueries[4].status === "fulfilled"
          ? metricsQueries[4].value[0]
          : { count: 0 };
      const triageLatency =
        metricsQueries[5].status === "fulfilled"
          ? metricsQueries[5].value[0]
          : { avg_latency_ms: 0, triage_count: 0 };
      const metrics = {
        alerts: {
          total: alertsByStatus.reduce(
            (sum: number, item: any) => sum + parseInt(item.count),
            0,
          ),
          by_status: alertsByStatus.reduce((acc: any, item: any) => {
            acc[item.status] = parseInt(item.count);
            return acc;
          }, {}),
        },
        transactions: {
          total: transactionsByStatus.reduce(
            (sum: number, item: any) => sum + parseInt(item.count),
            0,
          ),
          by_status: transactionsByStatus.reduce((acc: any, item: any) => {
            acc[item.status] = parseInt(item.count);
            return acc;
          }, {}),
          high_risk: parseInt(highRiskTransactions.count || 0),
        },
        customers: {
          total: customersByKyc.reduce(
            (sum: number, item: any) => sum + parseInt(item.count),
            0,
          ),
          by_kyc_level: customersByKyc.reduce((acc: any, item: any) => {
            acc[item.kyc_level] = parseInt(item.count);
            return acc;
          }, {}),
        },
        activity: {
          new_alerts_24h: parseInt(recentActivity.new_alerts || 0),
          new_transactions_24h: parseInt(recentActivity.new_transactions || 0),
        },
        performance: {
          avg_triage_latency_ms: Math.round(
            parseFloat(triageLatency.avg_latency_ms || 0),
          ),
          triage_count_7d: parseInt(triageLatency.triage_count || 0),
        },
        timestamp: new Date().toISOString(),
      };
      res.json(metrics);
    } catch (error: any) {
      logger.error("Failed to fetch dashboard metrics", { error });
      res.status(500).json({
        error: "Failed to fetch dashboard metrics",
        message: error?.message || "Unknown error",
      });
    }
  });
  return router;
};
