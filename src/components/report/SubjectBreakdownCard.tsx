import { BookOpen, TrendingUp, TrendingDown, Minus, Clock, Target } from "lucide-react";
import { useReportLanguage } from "./ReportLanguageContext";

interface SubjectData {
  name: string;
  sessions: number;
  avgScore: number;
  totalTime: number;
  trend: "up" | "down" | "stable";
  topics: string[];
  strongAreas: string[];
  weakAreas: string[];
}

interface SubjectBreakdownCardProps {
  subjects: SubjectData[];
}

export const SubjectBreakdownCard = ({ subjects }: SubjectBreakdownCardProps) => {
  const { t } = useReportLanguage();

  if (subjects.length === 0) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-accent";
    if (score >= 50) return "text-primary";
    if (score >= 30) return "text-orange-500";
    return "text-destructive";
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-accent" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" />
        {t.subjectPerformance}
      </h3>
      
      <div className="grid gap-4">
        {subjects.map((subject, index) => (
          <div
            key={index}
            className="bg-gradient-to-br from-muted/30 to-background rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
          >
            {/* Subject Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">{subject.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {subject.sessions} {t.sessions.toLowerCase()} • {Math.round(subject.totalTime / 60)} {t.minutes}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getTrendIcon(subject.trend)}
                <span className={`text-2xl font-bold ${getScoreColor(subject.avgScore)}`}>
                  {subject.avgScore}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${subject.avgScore}%` }}
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.studyTime}:</span>
                <span className="font-medium">{Math.round(subject.totalTime / 60)} {t.minutes}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.accuracy}:</span>
                <span className="font-medium">{subject.avgScore}%</span>
              </div>
            </div>

            {/* Topics Covered */}
            {subject.topics.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-1">Topics covered:</p>
                <div className="flex flex-wrap gap-1">
                  {subject.topics.slice(0, 5).map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                  {subject.topics.length > 5 && (
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                      +{subject.topics.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Strong & Weak Areas */}
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/50">
              {subject.strongAreas.length > 0 && (
                <div>
                  <p className="text-xs text-accent font-medium mb-1">✓ {t.strongAreas}</p>
                  <div className="space-y-0.5">
                    {subject.strongAreas.slice(0, 2).map((area, i) => (
                      <p key={i} className="text-xs text-muted-foreground truncate">
                        • {area}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {subject.weakAreas.length > 0 && (
                <div>
                  <p className="text-xs text-destructive font-medium mb-1">⚠ {t.weakAreas}</p>
                  <div className="space-y-0.5">
                    {subject.weakAreas.slice(0, 2).map((area, i) => (
                      <p key={i} className="text-xs text-muted-foreground truncate">
                        • {area}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
