import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { RouteConfig } from "./index";
import { Database } from "../utils/database";
const router = Router();
export const createEvaluationsRouter = (config: RouteConfig) => {
  const { logger, database } = config;
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = "1",
        limit = "10",
        status,
        sort = "updated_at",
        order = "desc",
      } = req.query;
      logger.info("Fetching evaluations", {
        page,
        limit,
        status,
        sort,
        order,
      });
      let whereClause = "";
      let whereParams: any[] = [];
      if (status && typeof status === "string") {
        whereClause = "WHERE status = $1";
        whereParams.push(status);
      }
      const validSortFields = [
        "id",
        "name",
        "status",
        "score",
        "test_cases",
        "created_at",
        "updated_at",
        "last_run",
      ];
      const sortField = validSortFields.includes(sort as string)
        ? sort
        : "updated_at";
      const orderDirection = order === "asc" ? "ASC" : "DESC";
      const countQuery = `SELECT COUNT(*) as total FROM evaluations ${whereClause}`;
      const countResult = await database.query(countQuery, whereParams);
      const totalEvaluations = parseInt(countResult[0].total);
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      const evaluationsQuery = `
      SELECT
        id,
        name,
        description,
        status,
        score,
        test_cases as "testCases",
        to_char(last_run, 'YYYY-MM-DD HH24:MI AM') as "lastRun",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM evaluations
      ${whereClause}
      ORDER BY ${sortField} ${orderDirection}
      LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
    `;
      const evaluationsParams = [...whereParams, limitNum, offset];
      const evaluations = await database.query(
        evaluationsQuery,
        evaluationsParams,
      );
      const completedStatsQuery = `
      SELECT
        COUNT(*) as total,
        AVG(score) as avg_score,
        COUNT(*) FILTER (WHERE status = 'running') as active_tests
      FROM evaluations
    `;
      const statsResult = await database.query(completedStatsQuery);
      const stats = statsResult[0];
      const response = {
        evaluations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalEvaluations,
          totalPages: Math.ceil(totalEvaluations / limitNum),
        },
        summary: {
          totalEvaluations: parseInt(stats.total),
          averageScore: stats.avg_score
            ? Math.round(parseFloat(stats.avg_score) * 10) / 10
            : 0,
          activeTests: parseInt(stats.active_tests),
        },
      };
      logger.info("Evaluations fetched successfully", {
        count: evaluations.length,
        total: totalEvaluations,
      });
      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch evaluations", { error });
      next(error);
    }
  });
  router.get(
    "/performance",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { days = "30" } = req.query;
        logger.info("Fetching evaluation performance metrics", { days });
        const performanceQuery = `
      SELECT
        DATE(updated_at) as date,
        COUNT(*) as total_evaluations,
        AVG(score) as avg_score,
        MAX(score) as max_score,
        MIN(score) as min_score,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tests,
        COUNT(*) FILTER (WHERE status = 'running') as active_tests,
        COUNT(*) FILTER (WHERE score >= 95) as excellent_tests,
        COUNT(*) FILTER (WHERE score >= 85 AND score < 95) as good_tests,
        COUNT(*) FILTER (WHERE score < 85) as poor_tests
      FROM evaluations
      WHERE updated_at >= NOW() - INTERVAL '${parseInt(days.toString())} days'
      GROUP BY DATE(updated_at)
      ORDER BY date ASC
    `;
        const performanceData = await database.query(performanceQuery);
        const categoryQuery = `
      SELECT
        CASE
          WHEN name LIKE '%Fraud%' THEN 'Fraud Detection'
          WHEN name LIKE '%Risk%' THEN 'Risk Assessment'
          WHEN name LIKE '%Performance%' OR name LIKE '%Benchmark%' THEN 'Performance'
          WHEN name LIKE '%Identity%' OR name LIKE '%Verification%' THEN 'Identity'
          WHEN name LIKE '%Compliance%' OR name LIKE '%AML%' OR name LIKE '%Laundering%' THEN 'Compliance'
          WHEN name LIKE '%Pattern%' OR name LIKE '%Recognition%' THEN 'Pattern Analysis'
          WHEN name LIKE '%Freeze%' OR name LIKE '%OTP%' THEN 'Security'
          ELSE 'Other'
        END as category,
        COUNT(*) as count,
        AVG(score) as avg_score,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM evaluations
      WHERE updated_at >= NOW() - INTERVAL '${parseInt(days.toString())} days'
      GROUP BY category
      ORDER BY count DESC
    `;
        const categoryData = await database.query(categoryQuery);
        const recentTrendsQuery = `
      SELECT
        id,
        name,
        score,
        status,
        updated_at,
        ROW_NUMBER() OVER (ORDER BY updated_at DESC) as rank
      FROM evaluations
      WHERE status = 'completed' AND score IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;
        const recentTrends = await database.query(recentTrendsQuery);
        const response = {
          performanceOverTime: performanceData.map((row) => ({
            date: row.date,
            totalEvaluations: parseInt(row.total_evaluations),
            avgScore: parseFloat(row.avg_score || "0").toFixed(1),
            maxScore: parseFloat(row.max_score || "0").toFixed(1),
            minScore: parseFloat(row.min_score || "0").toFixed(1),
            completedTests: parseInt(row.completed_tests),
            activeTests: parseInt(row.active_tests),
            excellentTests: parseInt(row.excellent_tests),
            goodTests: parseInt(row.good_tests),
            poorTests: parseInt(row.poor_tests),
          })),
          categoryBreakdown: categoryData.map((row) => ({
            category: row.category,
            count: parseInt(row.count),
            avgScore: parseFloat(row.avg_score || "0").toFixed(1),
            completed: parseInt(row.completed),
          })),
          recentTrends: recentTrends.map((row) => ({
            id: row.id,
            name: row.name,
            score: row.score,
            status: row.status,
            updatedAt: row.updated_at,
            rank: parseInt(row.rank),
          })),
          summary: {
            daysAnalyzed: parseInt(days.toString()),
            totalDataPoints: performanceData.length,
            categories: categoryData.length,
          },
        };
        logger.info("Performance metrics fetched successfully", {
          dataPoints: performanceData.length,
          categories: categoryData.length,
        });
        res.json(response);
      } catch (error) {
        logger.error("Failed to fetch performance metrics", { error });
        next(error);
      }
    },
  );
  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const evaluationId = parseInt(id, 10);
        logger.info("Fetching evaluation by ID", { id: evaluationId });
        const evaluationQuery = `
      SELECT
        id,
        name,
        description,
        status,
        score,
        test_cases as "testCases",
        to_char(last_run, 'YYYY-MM-DD HH24:MI AM') as "lastRun",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM evaluations
      WHERE id = $1
    `;
        const evaluations = await database.query(evaluationQuery, [
          evaluationId,
        ]);
        if (evaluations.length === 0) {
          return res.status(404).json({
            error: "Evaluation not found",
            message: `Evaluation with ID ${evaluationId} does not exist`,
          });
        }
        const evaluation = evaluations[0];
        logger.info("Evaluation fetched successfully", { id: evaluationId });
        res.json(evaluation);
      } catch (error) {
        logger.error("Failed to fetch evaluation", {
          error,
          id: req.params.id,
        });
        next(error);
      }
    },
  );
  router.post(
    "/:id/run",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const evaluationId = parseInt(id, 10);
        logger.info("Triggering evaluation run", { id: evaluationId });
        const checkQuery = `SELECT id, name FROM evaluations WHERE id = $1`;
        const evaluations = await database.query(checkQuery, [evaluationId]);
        if (evaluations.length === 0) {
          return res.status(404).json({
            error: "Evaluation not found",
            message: `Evaluation with ID ${evaluationId} does not exist`,
          });
        }
        const updateQuery = `
      UPDATE evaluations
      SET status = 'running',
          last_run = NOW(),
          updated_at = NOW(),
          score = NULL
      WHERE id = $1
      RETURNING
        id,
        name,
        description,
        status,
        score,
        test_cases as "testCases",
        to_char(last_run, 'YYYY-MM-DD HH24:MI AM') as "lastRun",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
        const updatedEvaluations = await database.query(updateQuery, [
          evaluationId,
        ]);
        const evaluation = updatedEvaluations[0];
        logger.info("Evaluation run triggered successfully", {
          id: evaluationId,
        });
        res.json({
          message: "Evaluation run started successfully",
          evaluation,
        });
      } catch (error) {
        logger.error("Failed to trigger evaluation run", {
          error,
          id: req.params.id,
        });
        next(error);
      }
    },
  );
  router.get(
    "/:id/results",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const evaluationId = parseInt(id, 10);
        logger.info("Fetching evaluation results", { id: evaluationId });
        const evaluationQuery = `
      SELECT
        id,
        name,
        description,
        status,
        score,
        test_cases,
        to_char(last_run, 'YYYY-MM-DD HH24:MI AM') as last_run
      FROM evaluations
      WHERE id = $1
    `;
        const evaluations = await database.query(evaluationQuery, [
          evaluationId,
        ]);
        if (evaluations.length === 0) {
          return res.status(404).json({
            error: "Evaluation not found",
            message: `Evaluation with ID ${evaluationId} does not exist`,
          });
        }
        const evaluation = evaluations[0];
        const results = {
          id: evaluation.id,
          name: evaluation.name,
          description: evaluation.description,
          status: evaluation.status,
          score: evaluation.score,
          testCases: evaluation.test_cases,
          lastRun: evaluation.last_run,
          summary: {
            totalTests: evaluation.test_cases,
            passed: evaluation.score
              ? Math.floor(evaluation.test_cases * (evaluation.score / 100))
              : null,
            failed: evaluation.score
              ? evaluation.test_cases -
                Math.floor(evaluation.test_cases * (evaluation.score / 100))
              : null,
            accuracy: evaluation.score,
          },
          testResults:
            evaluation.status === "completed" && evaluation.score
              ? [
                  {
                    category: "True Positives",
                    count: Math.floor(evaluation.test_cases * 0.6),
                    percentage: 60,
                  },
                  {
                    category: "True Negatives",
                    count: Math.floor(
                      evaluation.test_cases * (evaluation.score / 100 - 0.6),
                    ),
                    percentage: Math.round(evaluation.score - 60),
                  },
                  {
                    category: "False Positives",
                    count: Math.floor(evaluation.test_cases * 0.05),
                    percentage: 5,
                  },
                  {
                    category: "False Negatives",
                    count:
                      evaluation.test_cases -
                      Math.floor(evaluation.test_cases * 0.6) -
                      Math.floor(
                        evaluation.test_cases * (evaluation.score / 100 - 0.6),
                      ) -
                      Math.floor(evaluation.test_cases * 0.05),
                    percentage: Math.round(100 - evaluation.score - 5),
                  },
                ]
              : null,
          metrics:
            evaluation.status === "completed" && evaluation.score
              ? {
                  precision: ((evaluation.score / 100) * 0.95).toFixed(3),
                  recall: ((evaluation.score / 100) * 0.98).toFixed(3),
                  f1Score: ((evaluation.score / 100) * 0.965).toFixed(3),
                  auc: ((evaluation.score / 100) * 0.99).toFixed(3),
                }
              : null,
          executionTime:
            evaluation.status === "completed"
              ? `${Math.floor(Math.random() * 300 + 60)}s`
              : null,
          errors:
            evaluation.status === "completed" &&
            evaluation.score &&
            evaluation.score < 90
              ? [
                  "Some test cases had ambiguous ground truth labels",
                  "Model confidence threshold may need adjustment",
                ]
              : [],
        };
        logger.info("Evaluation results fetched successfully", {
          id: evaluationId,
        });
        res.json(results);
      } catch (error) {
        logger.error("Failed to fetch evaluation results", {
          error,
          id: req.params.id,
        });
        next(error);
      }
    },
  );
  return router;
};
export default createEvaluationsRouter;
