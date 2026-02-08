import { Users, TrendingUp, TrendingDown, Minus, Award, Target, Clock, Brain } from "lucide-react";
import { useReportLanguage } from "./ReportLanguageContext";

interface ComparisonMetric {
  label: string;
  studentValue: number;
  classAverage: number;
  unit?: string;
  icon: React.ReactNode;
}

interface PeerComparisonCardProps {
  studentName: string;
  metrics: ComparisonMetric[];
  percentile?: number;
  classRank?: number;
  totalStudents?: number;
}

export const PeerComparisonCard = ({
  studentName,
  metrics,
  percentile,
  classRank,
  totalStudents,
}: PeerComparisonCardProps) => {
  const { t } = useReportLanguage();

  const getComparisonStatus = (studentValue: number, classAverage: number) => {
    const diff = ((studentValue - classAverage) / classAverage) * 100;
    if (diff > 10) return { status: "above", diff: Math.round(diff), icon: <TrendingUp className="w-4 h-4" /> };
    if (diff < -10) return { status: "below", diff: Math.round(Math.abs(diff)), icon: <TrendingDown className="w-4 h-4" /> };
    return { status: "equal", diff: 0, icon: <Minus className="w-4 h-4" /> };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "above":
        return "text-accent bg-accent/10";
      case "below":
        return "text-destructive bg-destructive/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl p-5 border border-indigo-500/20">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Class Comparison
        </h3>
        
        {/* Rank Badge */}
        {classRank && totalStudents && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
            <Award className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium">
              Rank #{classRank}/{totalStudents}
            </span>
          </div>
        )}
      </div>

      {/* Percentile Banner */}
      {percentile && (
        <div className="mb-5 p-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl border border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{studentName} is performing better than</p>
              <p className="text-3xl font-bold text-primary">{percentile}%</p>
              <p className="text-sm text-muted-foreground">of their classmates</p>
            </div>
            <div className="w-20 h-20 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="hsl(var(--muted))"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="hsl(var(--primary))"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(percentile / 100) * 220} 220`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{percentile}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-3">
        {metrics.map((metric, index) => {
          const comparison = getComparisonStatus(metric.studentValue, metric.classAverage);
          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {metric.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t.classAvg}: {metric.classAverage}{metric.unit || ""}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">
                  {metric.studentValue}{metric.unit || ""}
                </span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${getStatusColor(comparison.status)}`}>
                  {comparison.icon}
                  {comparison.diff > 0 && (
                    <span className="text-xs font-medium">
                      {comparison.status === "above" ? "+" : "-"}{comparison.diff}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span>Above Average</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span>On Par</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span>Below Average</span>
        </div>
      </div>
    </div>
  );
};
