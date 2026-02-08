import { createContext, useContext, useState, ReactNode } from "react";

type ReportLanguage = "en" | "hi";

interface ReportTranslations {
  // Headers
  weeklyReport: string;
  weeklyProgress: string;
  generatedOn: string;
  reportPeriod: string;
  
  // Stats
  sessions: string;
  studyTime: string;
  quizzes: string;
  accuracy: string;
  grade: string;
  minutes: string;
  
  // Sections
  weeklySummary: string;
  whatChildStudied: string;
  dailyBreakdown: string;
  learningPatterns: string;
  quizAnalytics: string;
  topicPerformance: string;
  recommendations: string;
  parentTips: string;
  performanceCharts: string;
  skillAssessment: string;
  understandingDist: string;
  subjectPerformance: string;
  
  // Learning times
  morning: string;
  afternoon: string;
  evening: string;
  night: string;
  bestStudyTime: string;
  
  // Trends
  improving: string;
  declining: string;
  stable: string;
  
  // Grade labels
  excellent: string;
  veryGood: string;
  good: string;
  aboveAverage: string;
  average: string;
  needsImprovement: string;
  
  // Areas
  weakAreas: string;
  strongAreas: string;
  
  // Comparison
  classAvg: string;
  showClassAvg: string;
  hideClassAvg: string;
  
  // Actions
  downloadPdf: string;
  exportCharts: string;
  sendWhatsApp: string;
  
  // Quiz stats
  totalCorrect: string;
  avgAccuracy: string;
  bestQuiz: string;
  passRate: string;
  
  // Metrics
  totalSessions: string;
  totalMinutes: string;
  subjectsStudied: string;
  streak: string;
  currentStreak: string;
  longestStreak: string;
  daysStudied: string;
  engagementScore: string;
  
  // Recommendations
  recStartStudying: string;
  recKeepStreak: string;
  recExcellentStreak: string;
  recImproveQuiz: string;
  recExcellentQuiz: string;
  recFocusTopics: string;
  recIncreaseTime: string;
  recBestTime: string;
  
  // Parent Tips
  tipTalkDaily: string;
  tipPraise: string;
  tipScreenBalance: string;
  tipQuietPlace: string;
}

const translations: Record<ReportLanguage, ReportTranslations> = {
  en: {
    weeklyReport: "Weekly Progress Report",
    weeklyProgress: "Weekly Progress",
    generatedOn: "Generated on",
    reportPeriod: "Report Period: Last 7 Days",
    
    sessions: "Sessions",
    studyTime: "Study Time",
    quizzes: "Quizzes",
    accuracy: "Accuracy",
    grade: "Grade",
    minutes: "min",
    
    weeklySummary: "Weekly Summary (Last 7 Days)",
    whatChildStudied: "What Child Studied This Week",
    dailyBreakdown: "Daily Progress Breakdown",
    learningPatterns: "Learning Patterns",
    quizAnalytics: "Detailed Quiz Analytics",
    topicPerformance: "Topic-wise Performance",
    recommendations: "AI Recommendations",
    parentTips: "Tips for Parents",
    performanceCharts: "Performance Analytics",
    skillAssessment: "Skill Assessment",
    understandingDist: "Understanding Distribution",
    subjectPerformance: "Subject Performance",
    
    morning: "Morning (5am-12pm)",
    afternoon: "Afternoon (12pm-5pm)",
    evening: "Evening (5pm-9pm)",
    night: "Night (9pm-5am)",
    bestStudyTime: "Best Study Time",
    
    improving: "Improving",
    declining: "Declining",
    stable: "Stable",
    
    excellent: "Excellent",
    veryGood: "Very Good",
    good: "Good",
    aboveAverage: "Above Average",
    average: "Average",
    needsImprovement: "Needs Improvement",
    
    weakAreas: "Areas Needing Improvement",
    strongAreas: "Strong Areas",
    
    classAvg: "Class Avg",
    showClassAvg: "Show Class Avg",
    hideClassAvg: "Hide Class Avg",
    
    downloadPdf: "Download PDF",
    exportCharts: "Export Charts",
    sendWhatsApp: "Send WhatsApp",
    
    totalCorrect: "Total Correct",
    avgAccuracy: "Avg Accuracy",
    bestQuiz: "Best Quiz",
    passRate: "Pass Rate (≥50%)",
    
    totalSessions: "Total Sessions",
    totalMinutes: "Total Minutes",
    subjectsStudied: "Subjects Studied",
    streak: "Streak",
    currentStreak: "Current Streak",
    longestStreak: "Longest Streak",
    daysStudied: "Days Studied",
    engagementScore: "Engagement Score",
    
    recStartStudying: "🎯 Start today! Begin your study streak.",
    recKeepStreak: "🔥 Great! Keep your streak going, study daily.",
    recExcellentStreak: "🏆 Amazing! Your consistency is outstanding!",
    recImproveQuiz: "📖 Re-read topics to improve quiz accuracy.",
    recExcellentQuiz: "⭐ Quiz performance is excellent! Keep it up.",
    recFocusTopics: "⚠️ Focus on these topics:",
    recIncreaseTime: "⏰ Increase study time - aim for 30+ mins daily.",
    recBestTime: "📚 Best study time identified - continue studying at this time.",
    
    tipTalkDaily: "👨‍👩‍👧 Talk to your child about their studies for 10 minutes daily.",
    tipPraise: "🌟 Praise small achievements to build confidence.",
    tipScreenBalance: "📱 Balance screen time with study time.",
    tipQuietPlace: "🏠 Provide a quiet place for studying.",
  },
  hi: {
    weeklyReport: "साप्ताहिक प्रगति रिपोर्ट",
    weeklyProgress: "साप्ताहिक प्रगति",
    generatedOn: "रिपोर्ट की तारीख",
    reportPeriod: "रिपोर्ट अवधि: पिछले 7 दिन",
    
    sessions: "सेशन",
    studyTime: "पढ़ाई का समय",
    quizzes: "क्विज़",
    accuracy: "सटीकता",
    grade: "ग्रेड",
    minutes: "मिनट",
    
    weeklySummary: "साप्ताहिक सारांश (पिछले 7 दिन)",
    whatChildStudied: "इस हफ्ते बच्चे ने क्या पढ़ा",
    dailyBreakdown: "दैनिक प्रगति विवरण",
    learningPatterns: "पढ़ाई का समय",
    quizAnalytics: "विस्तृत क्विज़ विश्लेषण",
    topicPerformance: "विषय-वार प्रदर्शन",
    recommendations: "AI सुझाव",
    parentTips: "माता-पिता के लिए सुझाव",
    performanceCharts: "प्रदर्शन विश्लेषण",
    skillAssessment: "कौशल मूल्यांकन",
    understandingDist: "समझ का वितरण",
    subjectPerformance: "विषय प्रदर्शन",
    
    morning: "सुबह (5-12 बजे)",
    afternoon: "दोपहर (12-5 बजे)",
    evening: "शाम (5-9 बजे)",
    night: "रात (9-5 बजे)",
    bestStudyTime: "सबसे अच्छा पढ़ाई का समय",
    
    improving: "सुधार हो रहा है",
    declining: "गिरावट",
    stable: "स्थिर",
    
    excellent: "उत्कृष्ट",
    veryGood: "बहुत अच्छा",
    good: "अच्छा",
    aboveAverage: "औसत से ऊपर",
    average: "औसत",
    needsImprovement: "सुधार की जरूरत",
    
    weakAreas: "सुधार की जरूरत वाले क्षेत्र",
    strongAreas: "मजबूत क्षेत्र",
    
    classAvg: "कक्षा औसत",
    showClassAvg: "कक्षा औसत दिखाएं",
    hideClassAvg: "कक्षा औसत छुपाएं",
    
    downloadPdf: "PDF डाउनलोड करें",
    exportCharts: "चार्ट निर्यात करें",
    sendWhatsApp: "WhatsApp भेजें",
    
    totalCorrect: "कुल सही",
    avgAccuracy: "औसत सटीकता",
    bestQuiz: "सर्वश्रेष्ठ क्विज़",
    passRate: "पास दर (≥50%)",
    
    totalSessions: "कुल सेशन",
    totalMinutes: "कुल मिनट",
    subjectsStudied: "विषय पढ़े",
    streak: "स्ट्रीक",
    currentStreak: "वर्तमान स्ट्रीक",
    longestStreak: "सबसे लंबी स्ट्रीक",
    daysStudied: "दिन पढ़ाई की",
    engagementScore: "जुड़ाव स्कोर",
    
    recStartStudying: "🎯 शुरू करें! आज से पढ़ाई शुरू करें और streak बनाएं।",
    recKeepStreak: "🔥 बढ़िया! Streak जारी रखें, रोज़ाना पढ़ें।",
    recExcellentStreak: "🏆 शानदार! आपकी consistency कमाल की है!",
    recImproveQuiz: "📖 Quiz accuracy बढ़ाने के लिए topics को दोबारा पढ़ें।",
    recExcellentQuiz: "⭐ Quiz performance excellent है! ऐसे ही जारी रखें।",
    recFocusTopics: "⚠️ इन topics पर ध्यान दें:",
    recIncreaseTime: "⏰ Study time बढ़ाएं - कम से कम 30 मिनट रोज़ाना पढ़ें।",
    recBestTime: "📚 Best study time पहचाना गया - इस समय पढ़ना जारी रखें।",
    
    tipTalkDaily: "👨‍👩‍👧 बच्चे के साथ रोज़ 10 मिनट पढ़ाई की बातें करें।",
    tipPraise: "🌟 छोटी-छोटी उपलब्धियों की तारीफ़ करें।",
    tipScreenBalance: "📱 Screen time को study time में balance करें।",
    tipQuietPlace: "🏠 पढ़ाई के लिए शांत जगह का इंतेज़ाम करें।",
  },
};

interface ReportLanguageContextType {
  language: ReportLanguage;
  setLanguage: (lang: ReportLanguage) => void;
  t: ReportTranslations;
}

const ReportLanguageContext = createContext<ReportLanguageContextType | undefined>(undefined);

export const ReportLanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<ReportLanguage>("hi"); // Default to Hindi

  return (
    <ReportLanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </ReportLanguageContext.Provider>
  );
};

export const useReportLanguage = () => {
  const context = useContext(ReportLanguageContext);
  if (!context) {
    throw new Error("useReportLanguage must be used within a ReportLanguageProvider");
  }
  return context;
};

export { translations };
export type { ReportLanguage, ReportTranslations };
