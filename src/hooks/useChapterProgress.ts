 import { useState, useEffect, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { useToast } from "@/hooks/use-toast";
 
 interface ChapterProgress {
   id: string;
   chapter: string;
   is_completed: boolean;
   completed_at: string | null;
 }
 
 interface UseChapterProgressProps {
   board: string;
   classLevel: string;
   subject: string;
 }
 
 export const useChapterProgress = ({ board, classLevel, subject }: UseChapterProgressProps) => {
   const { user } = useAuth();
   const { toast } = useToast();
   const [progress, setProgress] = useState<ChapterProgress[]>([]);
   const [loading, setLoading] = useState(false);
   const [studentId, setStudentId] = useState<string | null>(null);
 
   // Get student ID
   useEffect(() => {
     const fetchStudentId = async () => {
       if (!user) return;
       
       const { data } = await supabase
         .from("students")
         .select("id")
         .eq("user_id", user.id)
         .maybeSingle();
       
       if (data) {
         setStudentId(data.id);
       }
     };
     
     fetchStudentId();
   }, [user]);
 
   // Fetch progress for subject
   useEffect(() => {
     const fetchProgress = async () => {
       if (!studentId || !subject) {
         setProgress([]);
         return;
       }
 
       setLoading(true);
       try {
         const { data, error } = await supabase
           .from("chapter_progress")
           .select("id, chapter, is_completed, completed_at")
           .eq("student_id", studentId)
           .eq("board", board)
           .eq("class", classLevel)
           .eq("subject", subject);
 
         if (error) throw error;
         setProgress(data || []);
       } catch (err) {
         console.error("Error fetching chapter progress:", err);
       } finally {
         setLoading(false);
       }
     };
 
     fetchProgress();
   }, [studentId, board, classLevel, subject]);
 
   const toggleChapterComplete = useCallback(async (chapter: string) => {
     if (!studentId) {
       toast({
         title: "Login Required",
         description: "Chapter mark karne ke liye login karo!",
         variant: "destructive",
       });
       return;
     }
 
     const existing = progress.find(p => p.chapter === chapter);
     
     try {
       if (existing) {
         // Toggle completion status
         const newStatus = !existing.is_completed;
         const { error } = await supabase
           .from("chapter_progress")
           .update({
             is_completed: newStatus,
             completed_at: newStatus ? new Date().toISOString() : null,
           })
           .eq("id", existing.id);
 
         if (error) throw error;
 
         setProgress(prev =>
           prev.map(p =>
             p.id === existing.id
               ? { ...p, is_completed: newStatus, completed_at: newStatus ? new Date().toISOString() : null }
               : p
           )
         );
 
         toast({
           title: newStatus ? "Chapter Complete! ✅" : "Chapter Unmarked",
           description: newStatus ? `"${chapter}" complete ho gaya!` : `"${chapter}" ko incomplete mark kiya.`,
           duration: 2000,
         });
       } else {
         // Create new progress record
         const { data, error } = await supabase
           .from("chapter_progress")
           .insert({
             student_id: studentId,
             board,
             class: classLevel,
             subject,
             chapter,
             is_completed: true,
             completed_at: new Date().toISOString(),
           })
           .select()
           .single();
 
         if (error) throw error;
 
         setProgress(prev => [...prev, {
           id: data.id,
           chapter,
           is_completed: true,
           completed_at: data.completed_at,
         }]);
 
         toast({
           title: "Chapter Complete! ✅",
           description: `"${chapter}" complete ho gaya! Keep it up! 🎉`,
           duration: 2000,
         });
       }
     } catch (err) {
       console.error("Error updating chapter progress:", err);
       toast({
         title: "Error",
         description: "Chapter update nahi ho paya. Try again!",
         variant: "destructive",
       });
     }
   }, [studentId, board, classLevel, subject, progress, toast]);
 
   const isChapterComplete = useCallback((chapter: string) => {
     return progress.some(p => p.chapter === chapter && p.is_completed);
   }, [progress]);
 
   const getCompletedCount = useCallback(() => {
     return progress.filter(p => p.is_completed).length;
   }, [progress]);
 
   return {
     progress,
     loading,
     toggleChapterComplete,
     isChapterComplete,
     getCompletedCount,
   };
 };