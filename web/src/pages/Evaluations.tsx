import { CheckCircle2, Play, BarChart3, Eye } from "lucide-react";
import {
  useEvaluations,
  useRunEvaluation,
  useEvaluationResults,
} from "../hooks/api";
import PerformanceChart from "../components/PerformanceChart";
export default function Evaluations() {
  const { data, isLoading, error } = useEvaluations();
  const runEvaluationMutation = useRunEvaluation();
  const evaluations = data?.evaluations || [];
  const summary = data?.summary || {
    totalEvaluations: 0,
    averageScore: 0,
    activeTests: 0,
  };
  const completedEvaluation =
    evaluations.find((evaluation) => evaluation.status === "completed") ||
    evaluations[0];
  const evaluationId = completedEvaluation?.id;
  const { data: resultsData, isLoading: resultsLoading } = useEvaluationResults(
    evaluationId || 0,
  );
  const confusionMatrix = resultsData?.testResults?.reduce(
    (acc, result) => {
      if (result.category === "True Positives") acc.tp = result.count;
      if (result.category === "False Positives") acc.fp = result.count;
      if (result.category === "True Negatives") acc.tn = result.count;
      if (result.category === "False Negatives") acc.fn = result.count;
      return acc;
    },
    { tp: 0, fp: 0, tn: 0, fn: 0 },
  ) || { tp: 0, fp: 0, tn: 0, fn: 0 };
  const metrics = resultsData?.metrics || {
    precision: "0.0",
    recall: "0.0",
    f1Score: "0.0",
    auc: "0.0",
  };
  const handleRunEvaluation = async (evaluationId: number) => {
    try {
      await runEvaluationMutation.mutateAsync(evaluationId);
    } catch (error) {
      console.error("Failed to run evaluation:", error);
    }
  };
  const handleRunNewEvaluation = async () => {
    if (evaluations.length === 0) {
      alert("No evaluations available to run");
      return;
    }
    const pendingEval = evaluations.find((e) => e.status === "pending");
    const completedEval = evaluations.find((e) => e.status === "completed");
    const targetEval = pendingEval || completedEval || evaluations[0];
    if (targetEval) {
      try {
        console.log(`Running evaluation: ${targetEval.name}`);
        await handleRunEvaluation(targetEval.id);
      } catch (error) {
        console.error("Failed to run evaluation:", error);
        alert(
          `Failed to run evaluation: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  };
  const handleViewResults = (evaluationId: number) => {
    const targetEvaluation = evaluations.find((e) => e.id === evaluationId);
    if (targetEvaluation && targetEvaluation.status !== "completed") {
      alert(
        `Evaluation "${targetEvaluation.name}" is not completed yet. Please wait for it to finish or run it first.`,
      );
      return;
    }
    const resultsSection = document.getElementById("results-section");
    if (resultsSection) {
      resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      resultsSection.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.5)";
      setTimeout(() => {
        resultsSection.style.boxShadow = "";
      }, 2000);
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading evaluations...</p>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 15.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="text-gray-600">
              Failed to load evaluations. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <CheckCircle2 className="h-8 w-8 mr-3 text-green-500" />
            Model Evaluations
          </h1>
          <p className="mt-2 text-gray-600">
            Test and validate AI model performance
          </p>
        </div>
        <button
          className="btn btn-primary btn-md"
          onClick={handleRunNewEvaluation}
          disabled={runEvaluationMutation.isPending}
        >
          <Play className="h-4 w-4 mr-2" />
          {runEvaluationMutation.isPending
            ? "Running..."
            : "Run New Evaluation"}
        </button>
      </div>
      {}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">
                Total Evaluations
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.totalEvaluations}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Average Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.averageScore}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Active Tests</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary.activeTests}
              </p>
            </div>
          </div>
        </div>
      </div>
      {}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Recent Evaluations
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Evaluation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test Cases
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {evaluations.map((evaluation) => (
                <tr key={evaluation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {evaluation.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {evaluation.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(evaluation.status)}`}
                    >
                      {evaluation.status.charAt(0).toUpperCase() +
                        evaluation.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {evaluation.score ? `${evaluation.score}%` : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {evaluation.testCases}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {evaluation.lastRun}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      className="text-primary-600 hover:text-primary-900 hover:underline mr-4 font-medium flex items-center"
                      onClick={() => handleViewResults(evaluation.id)}
                      title="Scroll to detailed results below"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Results
                    </button>
                    <button
                      className="text-gray-600 hover:text-gray-900 disabled:opacity-50 flex items-center"
                      onClick={() => handleRunEvaluation(evaluation.id)}
                      disabled={runEvaluationMutation.isPending}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      {runEvaluationMutation.isPending
                        ? "Running..."
                        : "Run Again"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {}
      <div id="results-section" className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Model Performance Matrix
          </h2>
          {completedEvaluation && (
            <p className="text-sm text-gray-600 mt-1">
              Showing results for: {completedEvaluation.name}
            </p>
          )}
        </div>
        <div className="px-6 py-4">
          {resultsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">
                Loading evaluation results...
              </span>
            </div>
          ) : resultsData || completedEvaluation ? (
            <>
              <div className="mb-6">
                <h3 className="text-md font-medium text-gray-700 mb-4">
                  Confusion Matrix - Fraud Detection Model
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="text-center py-2 px-4"></th>
                        <th
                          className="text-center py-2 px-4 text-sm font-medium text-gray-700"
                          colSpan={2}
                        >
                          Predicted
                        </th>
                      </tr>
                      <tr>
                        <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">
                          Actual
                        </th>
                        <th className="text-center py-2 px-4 text-sm font-medium text-blue-600 bg-blue-50">
                          Fraud
                        </th>
                        <th className="text-center py-2 px-4 text-sm font-medium text-green-600 bg-green-50">
                          Legitimate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-center py-3 px-4 text-sm font-medium text-blue-600 bg-blue-50">
                          Fraud
                        </td>
                        <td className="text-center py-3 px-4 text-lg font-bold text-green-700 bg-green-100 border border-green-300">
                          {confusionMatrix.tp}
                        </td>
                        <td className="text-center py-3 px-4 text-lg font-medium text-red-700 bg-red-100 border border-red-300">
                          {confusionMatrix.fp}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-center py-3 px-4 text-sm font-medium text-green-600 bg-green-50">
                          Legitimate
                        </td>
                        <td className="text-center py-3 px-4 text-lg font-medium text-red-700 bg-red-100 border border-red-300">
                          {confusionMatrix.fn}
                        </td>
                        <td className="text-center py-3 px-4 text-lg font-bold text-green-700 bg-green-100 border border-green-300">
                          {confusionMatrix.tn}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
                  <div className="text-2xl font-bold text-green-700">
                    {metrics.precision}%
                  </div>
                  <div className="text-sm text-green-600">Precision</div>
                  <div className="text-xs text-gray-500 mt-1">
                    True Fraud / Predicted Fraud
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">
                    {metrics.recall}%
                  </div>
                  <div className="text-sm text-blue-600">Recall</div>
                  <div className="text-xs text-gray-500 mt-1">
                    True Fraud / Actual Fraud
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
                  <div className="text-2xl font-bold text-purple-700">
                    {metrics.f1Score}%
                  </div>
                  <div className="text-sm text-purple-600">F1-Score</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Harmonic Mean
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200">
                  <div className="text-2xl font-bold text-gray-700">
                    {metrics.auc}%
                  </div>
                  <div className="text-sm text-gray-600">Accuracy</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Overall Correct
                  </div>
                </div>
              </div>
              {}
              <PerformanceChart className="mt-6" compact days={30} />
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">
                No completed evaluations found. Run an evaluation to see
                performance metrics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
