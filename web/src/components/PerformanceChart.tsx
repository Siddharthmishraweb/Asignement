import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useEvaluationPerformance } from "../hooks/api";
interface PerformanceData {
  date: string;
  totalEvaluations: number;
  avgScore: string;
  maxScore: string;
  minScore: string;
  completedTests: number;
  activeTests: number;
  excellentTests: number;
  goodTests: number;
  poorTests: number;
}
interface CategoryData {
  category: string;
  count: number;
  avgScore: string;
  completed: number;
}
interface RecentTrend {
  id: number;
  name: string;
  score: number;
  status: string;
  updatedAt: string;
  rank: number;
}
interface PerformanceMetrics {
  performanceOverTime: PerformanceData[];
  categoryBreakdown: CategoryData[];
  recentTrends: RecentTrend[];
  summary: {
    daysAnalyzed: number;
    totalDataPoints: number;
    categories: number;
  };
}
interface PerformanceChartProps {
  className?: string;
  compact?: boolean;
  days?: number;
}
const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
];
export default function PerformanceChart({
  className = "",
  compact = false,
  days = 30,
}: PerformanceChartProps) {
  const [activeTab, setActiveTab] = useState<
    "trends" | "categories" | "recent"
  >("trends");
  const { data, isLoading, error } = useEvaluationPerformance({ days });
  const performanceData = data as PerformanceMetrics | undefined;
  if (isLoading) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-600">
            <p className="mb-2">Failed to load performance chart</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (
    !performanceData ||
    !performanceData.performanceOverTime ||
    performanceData.performanceOverTime.length === 0
  ) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-4" />
            <p>No performance data available</p>
            <p className="text-sm mt-2">
              Run some evaluations to see performance trends
            </p>
          </div>
        </div>
      </div>
    );
  }
  const renderTrendsChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={performanceData.performanceOverTime}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(value) => new Date(value).toLocaleDateString()}
          formatter={(value: any, name: string) => {
            if (
              name === "avgScore" ||
              name === "maxScore" ||
              name === "minScore"
            ) {
              return [
                `${value}%`,
                name === "avgScore"
                  ? "Average Score"
                  : name === "maxScore"
                    ? "Max Score"
                    : "Min Score",
              ];
            }
            return [value, name];
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="avgScore"
          stroke="#3B82F6"
          strokeWidth={2}
          name="Average Score"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="maxScore"
          stroke="#10B981"
          strokeWidth={1}
          strokeDasharray="5 5"
          name="Max Score"
          dot={{ r: 2 }}
        />
        <Line
          type="monotone"
          dataKey="minScore"
          stroke="#EF4444"
          strokeWidth={1}
          strokeDasharray="5 5"
          name="Min Score"
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
  const renderCategoriesChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={performanceData.categoryBreakdown}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: any, name: string) => {
            if (name === "avgScore") {
              return [`${value}%`, "Average Score"];
            }
            return [
              value,
              name === "count" ? "Total Tests" : "Completed Tests",
            ];
          }}
        />
        <Legend />
        <Bar dataKey="count" fill="#3B82F6" name="Total Tests" />
        <Bar dataKey="completed" fill="#10B981" name="Completed Tests" />
      </BarChart>
    </ResponsiveContainer>
  );
  const renderRecentChart = () => {
    const pieData = performanceData.categoryBreakdown.map((item) => ({
      name: item.category,
      value: parseInt(item.count.toString()),
    }));
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Test Distribution by Category
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Recent Evaluation Scores
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {performanceData.recentTrends.map((trend) => (
              <div
                key={trend.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {trend.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(trend.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${
                      trend.score >= 95
                        ? "text-green-600"
                        : trend.score >= 85
                          ? "text-blue-600"
                          : "text-red-600"
                    }`}
                  >
                    {trend.score}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className={`bg-white shadow rounded-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2 text-blue-500" />
            Performance Overview
          </h2>
          <div className="text-sm text-gray-500">
            Last {performanceData.summary.daysAnalyzed} days •{" "}
            {performanceData.summary.totalDataPoints} data points
          </div>
        </div>
        {!compact && (
          <div className="mt-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab("trends")}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === "trends"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <TrendingUp className="h-4 w-4 inline mr-2" />
                Score Trends
              </button>
              <button
                onClick={() => setActiveTab("categories")}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === "categories"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                Categories
              </button>
              <button
                onClick={() => setActiveTab("recent")}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === "recent"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <PieChartIcon className="h-4 w-4 inline mr-2" />
                Overview
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="px-6 py-4">
        {compact ? (
          renderTrendsChart()
        ) : (
          <>
            {activeTab === "trends" && renderTrendsChart()}
            {activeTab === "categories" && renderCategoriesChart()}
            {activeTab === "recent" && renderRecentChart()}
          </>
        )}
      </div>
    </div>
  );
}
