 import { useState, useEffect, useCallback } from "react";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { BookOpen, Layers, CheckCircle2, Circle, BarChart3 } from "lucide-react";
 import { getSubjects, getChapters, BoardType } from "@/data/syllabusData";
 import { useChapterProgress } from "@/hooks/useChapterProgress";
 import { Button } from "@/components/ui/button";
 import { Progress } from "@/components/ui/progress";
 import { cn } from "@/lib/utils";
 
 interface SubjectChapterSelectorProps {
   studentClass?: string;
   studentBoard?: BoardType;
   onSubjectChange: (subject: string) => void;
   onChapterChange: (chapter: string) => void;
   selectedSubject: string;
   selectedChapter: string;
 }
 
 const SubjectChapterSelector = ({
   studentClass = "10",
   studentBoard = "CBSE",
   onSubjectChange,
   onChapterChange,
   selectedSubject,
   selectedChapter,
 }: SubjectChapterSelectorProps) => {
   const [showProgressView, setShowProgressView] = useState(false);
   const [subjects, setSubjects] = useState<string[]>([]);
   const [chapters, setChapters] = useState<string[]>([]);
 
   // Chapter progress tracking
   const { 
     isChapterComplete, 
     toggleChapterComplete, 
     getCompletedCount,
   } = useChapterProgress({
     board: studentBoard,
     classLevel: studentClass,
     subject: selectedSubject,
   });
 
   // Get subjects for the selected class and board
   useEffect(() => {
     const subjectList = getSubjects(studentBoard, studentClass);
     setSubjects(subjectList);
   }, [studentClass, studentBoard]);
 
   // Get chapters for the selected subject based on board
   useEffect(() => {
     if (selectedSubject) {
       const chapterList = getChapters(studentBoard, studentClass, selectedSubject);
       setChapters(chapterList);
     } else {
       setChapters([]);
     }
   }, [studentClass, studentBoard, selectedSubject]);
 
   const completedCount = getCompletedCount();
   const totalChapters = chapters.length;
   const progressPercent = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;
 
   const handleChapterToggle = useCallback((chapter: string, e: React.MouseEvent) => {
     e.stopPropagation();
     toggleChapterComplete(chapter);
   }, [toggleChapterComplete]);
 
   return (
     <div className="flex flex-col gap-2 w-full">
       {/* Progress Summary - Only show when subject is selected */}
       {selectedSubject && chapters.length > 0 && (
         <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-lg">
           <BarChart3 className="w-3.5 h-3.5 text-primary" />
           <div className="flex-1 min-w-0">
             <Progress value={progressPercent} className="h-1.5" />
           </div>
           <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
             {completedCount}/{totalChapters} ({progressPercent}%)
           </span>
           <Button
             variant="ghost"
             size="sm"
             className="h-6 px-2 text-xs"
             onClick={() => setShowProgressView(!showProgressView)}
           >
             {showProgressView ? "Hide" : "View All"}
           </Button>
         </div>
       )}
 
       {/* Chapter Progress Grid View */}
       {showProgressView && selectedSubject && chapters.length > 0 && (
         <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto p-2 bg-muted/30 rounded-lg border">
           {chapters.map((chapter, index) => {
             const isComplete = isChapterComplete(chapter);
             return (
               <div
                 key={index}
                 className={cn(
                   "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all text-xs",
                   isComplete 
                     ? "bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400" 
                     : "bg-background border border-border hover:bg-muted"
                 )}
                 onClick={(e) => handleChapterToggle(chapter, e)}
               >
                 {isComplete ? (
                   <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                 ) : (
                   <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                 )}
                 <span className="flex-1 truncate">
                   {index + 1}. {chapter}
                 </span>
               </div>
             );
           })}
         </div>
       )}
 
       {/* Selectors Row */}
       <div className="flex flex-col sm:flex-row gap-2">
         {/* Subject Selector */}
         <div className="flex-1 min-w-0">
           <Select value={selectedSubject} onValueChange={onSubjectChange}>
             <SelectTrigger className="h-9 text-xs sm:text-sm">
               <BookOpen className="w-3 h-3 mr-1 flex-shrink-0" />
               <SelectValue placeholder="Subject चुनें" />
             </SelectTrigger>
             <SelectContent>
               {subjects.map((subject) => (
                 <SelectItem key={subject} value={subject} className="text-xs sm:text-sm">
                   {subject}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
 
         {/* Chapter Selector */}
         <div className="flex-1 min-w-0">
           <Select 
             value={selectedChapter} 
             onValueChange={onChapterChange}
             disabled={!selectedSubject}
           >
             <SelectTrigger className="h-9 text-xs sm:text-sm">
               <Layers className="w-3 h-3 mr-1 flex-shrink-0" />
               <SelectValue placeholder={selectedSubject ? "Chapter चुनें" : "Pehle Subject चुनें"}>
                 {selectedChapter && (
                   <span className="flex items-center gap-1">
                     {isChapterComplete(selectedChapter) && (
                       <CheckCircle2 className="w-3 h-3 text-green-500" />
                     )}
                     <span className="truncate">{selectedChapter}</span>
                   </span>
                 )}
               </SelectValue>
             </SelectTrigger>
             <SelectContent>
               {chapters.map((chapter, index) => (
                 <SelectItem key={index} value={chapter} className="text-xs sm:text-sm">
                   <div className="flex items-center gap-2 w-full">
                     {isChapterComplete(chapter) ? (
                       <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                     ) : (
                       <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                     )}
                     <span className="truncate">{index + 1}. {chapter}</span>
                   </div>
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
       </div>
     </div>
   );
 };
 
 export default SubjectChapterSelector;