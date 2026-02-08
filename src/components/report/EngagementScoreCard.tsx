import { Activity, Flame, Target, Clock, Brain, Zap } from "lucide-react";
import { useReportLanguage } from "./ReportLanguageContext";

interface EngagementScoreCardProps {
  score: number;
  breakdown: {
    sessions: number;
    maxSessions: number;
    timeSpent: number;
    maxTime: number;
    quizzes: number;
    maxQuizzes: number;
    streak: number;
    maxStreak: number;
    accuracy: number;
    maxAccuracy: number;
  };
}

export const EngagementScoreCard = ({ score, breakdown }: EngagementScoreCardProps) => {
  const { t } = useReportLanguage();

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { label: "🌟 Outstanding", color: "text-accent", bg: "from-accent/20 to-accent/5" };
    if (score >= 60) return { label: "🔥 Great", color: "text-primary", bg: "from-primary/20 to-primary/5" };
    if (score >= 40) return { label: "👍 Good", color: "text-orange-500", bg: "from-orange-500/20 to-orange-500/5" };
    return { label: "💪 Getting Started", color: "text-muted-foreground", bg: "from-muted/20 to-muted/5" };
  };

  const level = getScoreLevel(score);

  const metrics = [
    {
      label: t.sessions,
      value: breakdown.sessions,
      max: breakdown.maxSessions,
      icon: <Target className="w-4 h-4" />,
      color: "bg-blue-500",
    },
    {
      label: t.studyTime,
      value: breakdown.timeSpent,
      max: breakdown.maxTime,
      icon: <Clock className="w-4 h-4" />,
      color: "bg-green-500",
    },
    {
      label: t.quizzes,
      value: breakdown.quizzes,
      max: breakdown.maxQuizzes,
      icon: <Brain className="w-4 h-4" />,
      color: "bg-purple-500",
    },
    {
      label: t.streak,
      value: breakdown.streak,
      max: breakdown.maxStreak,
      icon: <Flame className="w-4 h-4" />,
      color: "bg-orange-500",
    },
    {
      label: t.accuracy,
      value: breakdown.accuracy,
      max: breakdown.maxAccuracy,
      icon: <Zap className="w-4 h-4" />,
      color: "bg-yellow-500",
    },
  ];

  return (
    <div className={`bg-gradient-to-br ${level.bg} rounded-2xl p-5 border border-primary/20`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          {t.engagementScore}
        </h3>
        <span className={`text-sm font-semibold ${level.color}`}>{level.label}</span>
      </div>

      {/* Main Score Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(score / 100) * 352} 352`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{score}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>
      </div>

      {/* Breakdown Bars */}
      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                {metric.icon}
                <span>{metric.label}</span>
              </div>
              <span className="font-medium">
                {metric.value}/{metric.max}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${metric.color} transition-all duration-500`}
                style={{ width: `${(metric.value / metric.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
