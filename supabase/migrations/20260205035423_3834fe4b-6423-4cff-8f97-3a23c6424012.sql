-- Create chapter_progress table to track completed chapters
CREATE TABLE public.chapter_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  board TEXT NOT NULL,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination per student
  UNIQUE(student_id, board, class, subject, chapter)
);

-- Enable RLS
ALTER TABLE public.chapter_progress ENABLE ROW LEVEL SECURITY;

-- Students can view their own progress
CREATE POLICY "Students can view own chapter progress"
ON public.chapter_progress
FOR SELECT
USING (student_id IN (
  SELECT id FROM students WHERE user_id = auth.uid()
));

-- Students can insert their own progress
CREATE POLICY "Students can insert own chapter progress"
ON public.chapter_progress
FOR INSERT
WITH CHECK (student_id IN (
  SELECT id FROM students WHERE user_id = auth.uid()
));

-- Students can update their own progress
CREATE POLICY "Students can update own chapter progress"
ON public.chapter_progress
FOR UPDATE
USING (student_id IN (
  SELECT id FROM students WHERE user_id = auth.uid()
));

-- Students can delete their own progress (to reset)
CREATE POLICY "Students can delete own chapter progress"
ON public.chapter_progress
FOR DELETE
USING (student_id IN (
  SELECT id FROM students WHERE user_id = auth.uid()
));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to chapter progress"
ON public.chapter_progress
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Create index for faster lookups
CREATE INDEX idx_chapter_progress_student ON public.chapter_progress(student_id);
CREATE INDEX idx_chapter_progress_lookup ON public.chapter_progress(student_id, board, class, subject);

-- Add trigger for updated_at
CREATE TRIGGER update_chapter_progress_updated_at
BEFORE UPDATE ON public.chapter_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();