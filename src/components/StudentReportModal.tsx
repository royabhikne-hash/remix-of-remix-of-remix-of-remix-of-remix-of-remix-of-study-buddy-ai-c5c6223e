import { useState, useEffect, useRef } from "react"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  Brain,
  Target,
  Calendar,
  MessageCircle,
  FileText,
  Loader2,
  Download,
  BarChart3,
  Image,
  Users,
  Award,
  Clock,
  CheckCircle,
  Star,
} from "lucide-react";

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  studentClass: string;
  schoolId?: string;
}

interface SessionData {
  id: string;
  topic: string;
  subject: string | null;
  created_at: string;
  understanding_level: string | null;
  time_spent: number | null;
  improvement_score: number | null;
  weak_areas: string[] | null;
  strong_areas: string[] | null;
  ai_summary: string | null;
}

interface QuizData {
  id: string;
  created_at: string;
  accuracy_percentage: number | null;
  correct_count: number;
  total_questions: number;
  understanding_result: string | null;
}

interface ClassAverages {
  avgSessions: number;
  avgTimeSpent: number;
  avgAccuracy: number;
  avgQuizzes: number;
  avgImprovementScore: number;
}

interface SchoolInfo {
  name: string;
  district: string | null;
  state: string | null;
}

const StudentReportModal = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  studentPhoto,
  studentClass,
  schoolId,
}: StudentReportModalProps) => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [quizzes, setQuizzes] = useState<QuizData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [exportingCharts, setExportingCharts] = useState(false);
  const [classAverages, setClassAverages] = useState<ClassAverages | null>(null);
  const [showComparison, setShowComparison] = useState(true);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const chartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && studentId) {
      loadStudentData();
    }
  }, [isOpen, studentId]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // Load student info with school
      const { data: studentData } = await supabase
        .from("students")
        .select("*, schools(*)")
        .eq("id", studentId)
        .maybeSingle();

      if (studentData?.schools) {
        setSchoolInfo({
          name: (studentData.schools as any).name,
          district: (studentData.schools as any).district,
          state: (studentData.schools as any).state,
        });
      }

      // Load study sessions from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: sessionsData } = await supabase
        .from("study_sessions")
        .select("*")
        .eq("student_id", studentId)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false });

      const { data: quizzesData } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("student_id", studentId)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false });

      setSessions(sessionsData || []);
      setQuizzes(quizzesData || []);

      // Load class averages for comparison
      await loadClassAverages(weekAgo);
    } catch (error) {
      console.error("Error loading student data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadClassAverages = async (weekAgo: Date) => {
    try {
      // Get all students in the same class
      const { data: classStudents } = await supabase
        .from("students")
        .select("id")
        .eq("class", studentClass);

      if (!classStudents || classStudents.length === 0) return;

      const studentIds = classStudents.map((s) => s.id);

      // Get all sessions for these students
      const { data: classSessions } = await supabase
        .from("study_sessions")
        .select("*")
        .in("student_id", studentIds)
        .gte("created_at", weekAgo.toISOString());

      const { data: classQuizzes } = await supabase
        .from("quiz_attempts")
        .select("*")
        .in("student_id", studentIds)
        .gte("created_at", weekAgo.toISOString());

      if (!classSessions && !classQuizzes) return;

      const studentCount = classStudents.length;
      const totalSessions = classSessions?.length || 0;
      const totalQuizzes = classQuizzes?.length || 0;
      const totalTimeSpent = classSessions?.reduce((acc, s) => acc + (s.time_spent || 0), 0) || 0;
      const totalAccuracy = classQuizzes?.reduce((acc, q) => acc + (q.accuracy_percentage || 0), 0) || 0;
      const totalImprovementScore = classSessions?.reduce((acc, s) => acc + (s.improvement_score || 50), 0) || 0;

      setClassAverages({
        avgSessions: Math.round((totalSessions / studentCount) * 10) / 10,
        avgTimeSpent: Math.round(totalTimeSpent / studentCount),
        avgAccuracy: totalQuizzes > 0 ? Math.round(totalAccuracy / totalQuizzes) : 0,
        avgQuizzes: Math.round((totalQuizzes / studentCount) * 10) / 10,
        avgImprovementScore: totalSessions > 0 ? Math.round(totalImprovementScore / totalSessions) : 50,
      });
    } catch (error) {
      console.error("Error loading class averages:", error);
    }
  };

  const handleExportCharts = async () => {
    if (!chartsRef.current) return;
    
    setExportingCharts(true);
    try {
      const canvas = await html2canvas(chartsRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      
      const link = document.createElement("a");
      link.download = `${studentName.replace(/\s+/g, "_")}_Charts_${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "Charts Exported!",
        description: "Performance charts saved as image.",
      });
    } catch (error) {
      console.error("Error exporting charts:", error);
      toast({
        title: "Export Failed",
        description: "Could not export charts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingCharts(false);
    }
  };

  // Calculate weekly stats
  const weeklyStats = {
    totalSessions: sessions.length,
    totalTimeSpent: sessions.reduce((acc, s) => acc + (s.time_spent || 0), 0),
    avgAccuracy: quizzes.length > 0
      ? Math.round(quizzes.reduce((acc, q) => acc + (q.accuracy_percentage || 0), 0) / quizzes.length)
      : 0,
    totalQuizzes: quizzes.length,
    avgImprovementScore: sessions.length > 0
      ? Math.round(sessions.reduce((acc, s) => acc + (s.improvement_score || 50), 0) / sessions.length)
      : 50,
  };

  // Get all weak areas from sessions
  const allWeakAreas = sessions
    .flatMap((s) => s.weak_areas || [])
    .reduce((acc, area) => {
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topWeakAreas = Object.entries(allWeakAreas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get all strong areas from sessions
  const allStrongAreas = sessions
    .flatMap((s) => s.strong_areas || [])
    .reduce((acc, area) => {
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topStrongAreas = Object.entries(allStrongAreas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get subjects studied
  const subjectsStudied = [...new Set(sessions.map((s) => s.subject).filter(Boolean))];

  // Calculate understanding distribution
  const understandingDist = sessions.reduce((acc, s) => {
    const level = s.understanding_level || "average";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate improvement trend
  const improvementScores = sessions
    .filter((s) => s.improvement_score !== null)
    .map((s) => s.improvement_score!);
  
  let overallTrend: "up" | "down" | "stable" = "stable";
  if (improvementScores.length >= 2) {
    const firstHalf = improvementScores.slice(Math.floor(improvementScores.length / 2));
    const secondHalf = improvementScores.slice(0, Math.floor(improvementScores.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (avgSecond > avgFirst + 5) overallTrend = "up";
    else if (avgSecond < avgFirst - 5) overallTrend = "down";
  }

  // Generate AI feedback summary
  const aiSummaries = sessions
    .filter((s) => s.ai_summary)
    .map((s) => s.ai_summary!)
    .slice(0, 3);

  // Chart data preparation
  const getProgressChartData = () => {
    const last7Days: { date: string; score: number; time: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      
      const daySessions = sessions.filter((s) => {
        const sessionDate = new Date(s.created_at);
        return sessionDate.toDateString() === date.toDateString();
      });
      
      const avgScore = daySessions.length > 0
        ? Math.round(daySessions.reduce((acc, s) => acc + (s.improvement_score || 50), 0) / daySessions.length)
        : 0;
      const totalTime = daySessions.reduce((acc, s) => acc + (s.time_spent || 0), 0);
      
      last7Days.push({ date: dateStr, score: avgScore, time: Math.round(totalTime / 60) });
    }
    return last7Days;
  };

  const getSubjectChartData = () => {
    const subjectData: Record<string, { sessions: number; avgScore: number; totalScore: number }> = {};
    sessions.forEach((s) => {
      const subject = s.subject || "General";
      if (!subjectData[subject]) {
        subjectData[subject] = { sessions: 0, avgScore: 0, totalScore: 0 };
      }
      subjectData[subject].sessions++;
      subjectData[subject].totalScore += s.improvement_score || 50;
    });
    
    return Object.entries(subjectData)
      .map(([name, data]) => ({
        name,
        sessions: data.sessions,
        avgScore: Math.round(data.totalScore / data.sessions),
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);
  };

  const getUnderstandingChartData = () => {
    const colors: Record<string, string> = {
      excellent: "#22c55e",
      good: "#3b82f6",
      average: "#f59e0b",
      weak: "#ef4444",
    };
    
    return Object.entries(understandingDist).map(([level, count]) => ({
      name: level.charAt(0).toUpperCase() + level.slice(1),
      value: count,
      color: colors[level] || "#6b7280",
    }));
  };

  // Skill radar chart data
  const getSkillRadarData = () => {
    const consistency = sessions.length > 0 ? Math.min(100, sessions.length * 15) : 0;
    const accuracy = weeklyStats.avgAccuracy;
    const engagement = Math.min(100, (weeklyStats.totalTimeSpent / 60) * 2);
    const quizPerformance = quizzes.length > 0 
      ? Math.round(quizzes.reduce((acc, q) => acc + ((q.correct_count / q.total_questions) * 100), 0) / quizzes.length)
      : 0;
    const improvement = weeklyStats.avgImprovementScore;

    return [
      { skill: "Consistency", value: consistency, fullMark: 100 },
      { skill: "Accuracy", value: accuracy, fullMark: 100 },
      { skill: "Engagement", value: engagement, fullMark: 100 },
      { skill: "Quiz Score", value: quizPerformance, fullMark: 100 },
      { skill: "Improvement", value: improvement, fullMark: 100 },
    ];
  };

  const progressData = getProgressChartData();
  const subjectData = getSubjectChartData();
  const understandingChartData = getUnderstandingChartData();
  const skillRadarData = getSkillRadarData();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate overall grade
  const calculateGrade = () => {
    const score = (weeklyStats.avgImprovementScore * 0.4) + (weeklyStats.avgAccuracy * 0.3) + (sessions.length * 5 * 0.3);
    if (score >= 85) return { grade: "A+", color: "#22c55e", label: "Excellent" };
    if (score >= 75) return { grade: "A", color: "#22c55e", label: "Very Good" };
    if (score >= 65) return { grade: "B+", color: "#3b82f6", label: "Good" };
    if (score >= 55) return { grade: "B", color: "#3b82f6", label: "Above Average" };
    if (score >= 45) return { grade: "C", color: "#f59e0b", label: "Average" };
    return { grade: "D", color: "#ef4444", label: "Needs Improvement" };
  };

  const gradeInfo = calculateGrade();

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPos = 15;
      const lineHeight = 6;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Helper function to add new page if needed
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 25) {
          pdf.addPage();
          yPos = 20;
          // Add header on new page
          pdf.setFontSize(8);
          pdf.setTextColor(128, 128, 128);
          pdf.text("Edu Improvement AI - Student Progress Report", margin, 10);
          pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, 10, { align: "right" });
          pdf.setTextColor(0, 0, 0);
        }
      };

      // Header with branding
      pdf.setFillColor(59, 130, 246); // Primary blue
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("Edu Improvement AI", margin, 15);
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Weekly Progress Report", margin, 23);
      
      // School info on header
      if (schoolInfo) {
        pdf.setFontSize(10);
        pdf.text(schoolInfo.name, pageWidth - margin, 15, { align: "right" });
        pdf.setFontSize(8);
        pdf.text(`${schoolInfo.district || ""}, ${schoolInfo.state || ""}`, pageWidth - margin, 21, { align: "right" });
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, margin, 31);

      yPos = 45;
      pdf.setTextColor(0, 0, 0);

      // Student Info Card
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(margin, yPos, contentWidth, 28, 3, 3, "F");
      
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(studentName, margin + 5, yPos + 10);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Class: ${studentClass}`, margin + 5, yPos + 18);
      pdf.text(`Report Period: Last 7 Days`, margin + 5, yPos + 24);

      // Grade badge
      pdf.setFillColor(
        gradeInfo.color === "#22c55e" ? 34 : gradeInfo.color === "#3b82f6" ? 59 : gradeInfo.color === "#f59e0b" ? 245 : 239,
        gradeInfo.color === "#22c55e" ? 197 : gradeInfo.color === "#3b82f6" ? 130 : gradeInfo.color === "#f59e0b" ? 158 : 68,
        gradeInfo.color === "#22c55e" ? 94 : gradeInfo.color === "#3b82f6" ? 246 : gradeInfo.color === "#f59e0b" ? 11 : 68
      );
      pdf.circle(pageWidth - margin - 15, yPos + 14, 12, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(gradeInfo.grade, pageWidth - margin - 15, yPos + 18, { align: "center" });
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(8);
      pdf.text(gradeInfo.label, pageWidth - margin - 15, yPos + 26, { align: "center" });

      yPos += 35;

      // Overall Trend Banner
      const trendColor = overallTrend === "up" ? { r: 34, g: 197, b: 94 } : overallTrend === "down" ? { r: 239, g: 68, b: 68 } : { r: 156, g: 163, b: 175 };
      pdf.setFillColor(trendColor.r, trendColor.g, trendColor.b);
      pdf.roundedRect(margin, yPos, contentWidth, 12, 2, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      const trendText = overallTrend === "up" ? "📈 IMPROVING - Keep up the great work!" : overallTrend === "down" ? "📉 DECLINING - Needs more focus" : "➡️ STABLE - Consistent performance";
      pdf.text(trendText, pageWidth / 2, yPos + 8, { align: "center" });
      
      yPos += 18;
      pdf.setTextColor(0, 0, 0);

      // Weekly Summary Section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Weekly Summary", margin, yPos);
      yPos += 8;

      // Stats boxes
      const boxWidth = (contentWidth - 15) / 4;
      const stats = [
        { label: "Sessions", value: weeklyStats.totalSessions.toString(), color: { r: 59, g: 130, b: 246 } },
        { label: "Study Time", value: `${Math.round(weeklyStats.totalTimeSpent / 60)}m`, color: { r: 34, g: 197, b: 94 } },
        { label: "Quizzes", value: weeklyStats.totalQuizzes.toString(), color: { r: 168, g: 85, b: 247 } },
        { label: "Accuracy", value: `${weeklyStats.avgAccuracy}%`, color: { r: 245, g: 158, b: 11 } },
      ];

      stats.forEach((stat, i) => {
        const x = margin + (boxWidth + 5) * i;
        pdf.setFillColor(stat.color.r, stat.color.g, stat.color.b);
        pdf.roundedRect(x, yPos, boxWidth, 22, 2, 2, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(stat.value, x + boxWidth / 2, yPos + 10, { align: "center" });
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(stat.label, x + boxWidth / 2, yPos + 18, { align: "center" });
      });

      yPos += 30;
      pdf.setTextColor(0, 0, 0);

      // Class Comparison
      if (classAverages) {
        checkPageBreak(25);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Comparison with Class Average", margin, yPos);
        yPos += 7;
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        
        const comparisons = [
          { label: "Sessions", student: weeklyStats.totalSessions, classAvg: classAverages.avgSessions },
          { label: "Study Time (min)", student: Math.round(weeklyStats.totalTimeSpent / 60), classAvg: Math.round(classAverages.avgTimeSpent / 60) },
          { label: "Accuracy", student: weeklyStats.avgAccuracy, classAvg: classAverages.avgAccuracy },
        ];

        comparisons.forEach((comp) => {
          const isAbove = comp.student >= comp.classAvg;
          pdf.setTextColor(isAbove ? 34 : 239, isAbove ? 197 : 68, isAbove ? 94 : 68);
          const symbol = isAbove ? "▲" : "▼";
          pdf.text(`${symbol} ${comp.label}: ${comp.student} (Class Avg: ${comp.classAvg})`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 5;
      }

      // Subjects Studied
      if (subjectsStudied.length > 0) {
        checkPageBreak(18);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Subjects Studied", margin, yPos);
        yPos += 7;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(subjectsStudied.join(" • "), margin + 5, yPos);
        yPos += 10;
      }

      // Understanding Levels
      if (Object.keys(understandingDist).length > 0) {
        checkPageBreak(25);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Understanding Levels", margin, yPos);
        yPos += 7;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        Object.entries(understandingDist).forEach(([level, count]) => {
          const levelColors: Record<string, { r: number; g: number; b: number }> = {
            excellent: { r: 34, g: 197, b: 94 },
            good: { r: 59, g: 130, b: 246 },
            average: { r: 245, g: 158, b: 11 },
            weak: { r: 239, g: 68, b: 68 },
          };
          const color = levelColors[level] || { r: 100, g: 100, b: 100 };
          pdf.setTextColor(color.r, color.g, color.b);
          pdf.text(`● ${level.charAt(0).toUpperCase() + level.slice(1)}: ${count} session(s)`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 5;
      }

      // Weak Areas
      if (topWeakAreas.length > 0) {
        checkPageBreak(30);
        pdf.setTextColor(239, 68, 68);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("⚠ Areas Needing Improvement", margin, yPos);
        yPos += 7;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        topWeakAreas.forEach(([area, count]) => {
          pdf.text(`• ${area} (identified in ${count} session${count > 1 ? "s" : ""})`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 5;
      }

      // Strong Areas
      if (topStrongAreas.length > 0) {
        checkPageBreak(30);
        pdf.setTextColor(34, 197, 94);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("✓ Strong Areas", margin, yPos);
        yPos += 7;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        topStrongAreas.forEach(([area, count]) => {
          pdf.text(`• ${area} (demonstrated in ${count} session${count > 1 ? "s" : ""})`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 5;
      }

      // Recent Quiz Results
      if (quizzes.length > 0) {
        checkPageBreak(40);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Recent Quiz Results", margin, yPos);
        yPos += 7;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        quizzes.slice(0, 5).forEach((quiz) => {
          checkPageBreak(lineHeight);
          const date = new Date(quiz.created_at).toLocaleDateString("en-IN");
          const percentage = quiz.accuracy_percentage?.toFixed(0) || 0;
          const color = Number(percentage) >= 70 ? { r: 34, g: 197, b: 94 } : Number(percentage) >= 50 ? { r: 245, g: 158, b: 11 } : { r: 239, g: 68, b: 68 };
          pdf.setTextColor(color.r, color.g, color.b);
          pdf.text(`${date}: ${quiz.correct_count}/${quiz.total_questions} correct (${percentage}%)`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += 5;
      }

      // AI Feedback
      if (aiSummaries.length > 0) {
        checkPageBreak(40);
        pdf.setTextColor(59, 130, 246);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("AI Study Feedback", margin, yPos);
        yPos += 7;
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        aiSummaries.forEach((summary) => {
          checkPageBreak(20);
          const lines = pdf.splitTextToSize(`"${summary}"`, contentWidth - 10);
          lines.forEach((line: string) => {
            pdf.text(line, margin + 5, yPos);
            yPos += 4.5;
          });
          yPos += 3;
        });
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFillColor(59, 130, 246);
        pdf.rect(0, pageHeight - 15, pageWidth, 15, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text("Generated by Edu Improvement AI | Your Personal Study Buddy", pageWidth / 2, pageHeight - 7, { align: "center" });
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
        if (schoolInfo) {
          pdf.text(schoolInfo.name, margin, pageHeight - 7);
        }
      }

      // Save PDF
      const fileName = `${studentName.replace(/\s+/g, "_")}_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Downloaded!",
        description: `Report saved as ${fileName}`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Download Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getUnderstandingColor = (level: string) => {
    switch (level) {
      case "excellent":
        return "bg-accent text-accent-foreground";
      case "good":
        return "bg-primary text-primary-foreground";
      case "average":
        return "bg-secondary text-secondary-foreground";
      case "weak":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {studentPhoto ? (
                <img
                  src={studentPhoto}
                  alt={studentName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  {studentName.charAt(0)}
                </div>
              )}
              <div>
                <DialogTitle className="text-xl">{studentName}</DialogTitle>
                <p className="text-muted-foreground">{studentClass}</p>
                {schoolInfo && (
                  <p className="text-xs text-muted-foreground">{schoolInfo.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Grade Badge */}
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: gradeInfo.color }}
              >
                {gradeInfo.grade}
              </div>
              {overallTrend === "up" && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium">
                  <TrendingUp className="w-4 h-4" /> Improving
                </span>
              )}
              {overallTrend === "down" && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/20 text-destructive text-sm font-medium">
                  <TrendingDown className="w-4 h-4" /> Declining
                </span>
              )}
              {overallTrend === "stable" && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                  <Minus className="w-4 h-4" /> Stable
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || loading}
              >
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Weekly Summary Stats with Class Comparison */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Weekly Summary (Last 7 Days)
                  </h3>
                  {classAverages && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowComparison(!showComparison)}
                      className="flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      {showComparison ? "Hide" : "Show"} Class Avg
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="edu-card p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{weeklyStats.totalSessions}</p>
                    <p className="text-sm text-muted-foreground">Study Sessions</p>
                    {showComparison && classAverages && (
                      <div className="mt-2 text-xs">
                        <span className={weeklyStats.totalSessions >= classAverages.avgSessions ? "text-accent" : "text-destructive"}>
                          Class Avg: {classAverages.avgSessions}
                          {weeklyStats.totalSessions >= classAverages.avgSessions ? " ↑" : " ↓"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="edu-card p-4 text-center">
                    <p className="text-3xl font-bold text-accent">
                      {Math.round(weeklyStats.totalTimeSpent / 60)}m
                    </p>
                    <p className="text-sm text-muted-foreground">Time Spent</p>
                    {showComparison && classAverages && (
                      <div className="mt-2 text-xs">
                        <span className={weeklyStats.totalTimeSpent >= classAverages.avgTimeSpent ? "text-accent" : "text-destructive"}>
                          Class Avg: {Math.round(classAverages.avgTimeSpent / 60)}m
                          {weeklyStats.totalTimeSpent >= classAverages.avgTimeSpent ? " ↑" : " ↓"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="edu-card p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{weeklyStats.totalQuizzes}</p>
                    <p className="text-sm text-muted-foreground">Quizzes Taken</p>
                    {showComparison && classAverages && (
                      <div className="mt-2 text-xs">
                        <span className={weeklyStats.totalQuizzes >= classAverages.avgQuizzes ? "text-accent" : "text-destructive"}>
                          Class Avg: {classAverages.avgQuizzes}
                          {weeklyStats.totalQuizzes >= classAverages.avgQuizzes ? " ↑" : " ↓"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="edu-card p-4 text-center">
                    <p className="text-3xl font-bold text-accent">{weeklyStats.avgAccuracy}%</p>
                    <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                    {showComparison && classAverages && (
                      <div className="mt-2 text-xs">
                        <span className={weeklyStats.avgAccuracy >= classAverages.avgAccuracy ? "text-accent" : "text-destructive"}>
                          Class Avg: {classAverages.avgAccuracy}%
                          {weeklyStats.avgAccuracy >= classAverages.avgAccuracy ? " ↑" : " ↓"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="edu-card p-4 text-center">
                    <div 
                      className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: gradeInfo.color }}
                    >
                      {gradeInfo.grade}
                    </div>
                    <p className="text-sm text-muted-foreground">{gradeInfo.label}</p>
                  </div>
                </div>
              </div>

              {/* Performance Charts Section */}
              {sessions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Performance Analytics
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCharts}
                      disabled={exportingCharts}
                      className="flex items-center gap-2"
                    >
                      {exportingCharts ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Image className="w-4 h-4" />
                          Export Charts
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Charts container with ref for export */}
                  <div ref={chartsRef} className="bg-background p-2 rounded-lg">
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Progress Over Time Chart */}
                      <div className="edu-card p-4">
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Progress Over Time (7 Days)
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={progressData}>
                            <defs>
                              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                            />
                            {showComparison && classAverages && (
                              <ReferenceLine 
                                y={classAverages.avgImprovementScore} 
                                stroke="hsl(var(--destructive))"
                                strokeDasharray="5 5"
                                label={{ value: "Class Avg", position: "right", fontSize: 10, fill: "hsl(var(--destructive))" }}
                              />
                            )}
                            <Area
                              type="monotone"
                              dataKey="score"
                              stroke="hsl(var(--primary))"
                              fillOpacity={1}
                              fill="url(#scoreGradient)"
                              strokeWidth={2}
                              name="Avg Score"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Skill Radar Chart */}
                      <div className="edu-card p-4">
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          Skill Assessment
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <RadarChart data={skillRadarData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                            <Radar
                              name="Skills"
                              dataKey="value"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary))"
                              fillOpacity={0.4}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Understanding Distribution Pie Chart */}
                      {understandingChartData.length > 0 && (
                        <div className="edu-card p-4">
                          <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            Understanding Distribution
                          </h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={understandingChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {understandingChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                }}
                              />
                              <Legend
                                formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Subject Performance Bar Chart */}
                      {subjectData.length > 0 && (
                        <div className="edu-card p-4">
                          <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            Subject Performance
                          </h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={subjectData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                }}
                                labelStyle={{ color: "hsl(var(--foreground))" }}
                              />
                              <Bar dataKey="avgScore" fill="hsl(var(--accent))" name="Avg Score" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subjects Studied */}
              {subjectsStudied.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Subjects Studied
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {subjectsStudied.map((subject, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Understanding Levels */}
              {Object.keys(understandingDist).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Understanding Levels
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(understandingDist).map(([level, count]) => (
                      <span
                        key={level}
                        className={`px-3 py-1 rounded-full text-sm capitalize ${getUnderstandingColor(level)}`}
                      >
                        {level}: {count} sessions
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak & Strong Areas */}
              <div className="grid md:grid-cols-2 gap-6">
                {topStrongAreas.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      Strong Areas
                    </h3>
                    <div className="space-y-2">
                      {topStrongAreas.map(([area, count], i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-accent/10 rounded-lg"
                        >
                          <span className="font-medium">{area}</span>
                          <span className="text-sm text-muted-foreground">{count} sessions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {topWeakAreas.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5 text-destructive" />
                      Needs Improvement
                    </h3>
                    <div className="space-y-2">
                      {topWeakAreas.map(([area, count], i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg"
                        >
                          <span className="font-medium">{area}</span>
                          <span className="text-sm text-muted-foreground">{count} sessions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Quiz Results */}
              {quizzes.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    Recent Quiz Results
                  </h3>
                  <div className="space-y-2">
                    {quizzes.slice(0, 5).map((quiz) => (
                      <div
                        key={quiz.id}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{formatDate(quiz.created_at)}</p>
                            <p className="text-sm text-muted-foreground">
                              {quiz.understanding_result || "Quiz completed"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {quiz.correct_count}/{quiz.total_questions}
                          </p>
                          <p className={`text-sm font-medium ${
                            (quiz.accuracy_percentage || 0) >= 70 ? "text-accent" : 
                            (quiz.accuracy_percentage || 0) >= 50 ? "text-yellow-500" : "text-destructive"
                          }`}>
                            {quiz.accuracy_percentage?.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Feedback Summary */}
              {aiSummaries.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    AI Feedback Summary
                  </h3>
                  <div className="space-y-3">
                    {aiSummaries.map((summary, i) => (
                      <div
                        key={i}
                        className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary"
                      >
                        <p className="text-sm italic text-muted-foreground">"{summary}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Data State */}
              {sessions.length === 0 && quizzes.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Data This Week</h3>
                  <p className="text-muted-foreground">
                    This student hasn't completed any study sessions in the last 7 days.
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default StudentReportModal;