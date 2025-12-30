-- Create admin_role enum
CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin');

-- Create admins table
CREATE TABLE public.admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Policy: Admins are viewable by authenticated users for login check
CREATE POLICY "Admins viewable for login" ON public.admins FOR SELECT USING (true);

-- Create quiz_attempts table for storing end-study quiz results
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '[]',
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  accuracy_percentage DECIMAL(5,2) DEFAULT 0,
  understanding_result TEXT CHECK (understanding_result IN ('strong', 'partial', 'weak')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quiz_attempts
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for quiz_attempts
CREATE POLICY "Students can view own quiz attempts" ON public.quiz_attempts 
FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

CREATE POLICY "Students can insert own quiz attempts" ON public.quiz_attempts 
FOR INSERT WITH CHECK (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

CREATE POLICY "Anyone can view quiz attempts" ON public.quiz_attempts 
FOR SELECT USING (true);

-- Insert preloaded admin
INSERT INTO public.admins (admin_id, password_hash, name, role) VALUES
('56708921eduimprovmentai', 'kishanganj85510856708921kne', 'Super Admin', 'super_admin');

-- Insert preloaded schools (if not exists)
INSERT INTO public.schools (school_id, password_hash, name, district, state) VALUES
('ips855108', 'ipskne855108', 'Insight Public School, Kishanganj', 'Kishanganj', 'Bihar'),
('dps855108', 'dpskne855108', 'Delhi Public School, Kishanganj', 'Kishanganj', 'Bihar'),
('sxc855108', 'sxckne855108', 'St. Xavier School', 'Kishanganj', 'Bihar'),
('bms855108', 'bmskne855108', 'Bal Mandir School, Kishanganj', 'Kishanganj', 'Bihar'),
('ops855108', 'opskne855108', 'Oriental Public School, Kishanganj', 'Kishanganj', 'Bihar'),
('ihs855108', 'ihskne855108', 'Inter High School Kishanganj', 'Kishanganj', 'Bihar')
ON CONFLICT (school_id) DO NOTHING;

-- Create parent_reports table
CREATE TABLE public.parent_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'weekly',
  report_data JSONB NOT NULL DEFAULT '{}',
  pdf_url TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_by_type TEXT CHECK (created_by_type IN ('admin', 'school'))
);

-- Enable RLS on parent_reports
ALTER TABLE public.parent_reports ENABLE ROW LEVEL SECURITY;

-- Policies for parent_reports
CREATE POLICY "Anyone can view parent reports" ON public.parent_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert parent reports" ON public.parent_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update parent reports" ON public.parent_reports FOR UPDATE USING (true);