-- Create session_tokens table for server-side session validation
CREATE TABLE public.session_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'school')),
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_revoked BOOLEAN NOT NULL DEFAULT false
);

-- Create index for fast token lookups
CREATE INDEX idx_session_tokens_token ON public.session_tokens(token);
CREATE INDEX idx_session_tokens_user ON public.session_tokens(user_type, user_id);
CREATE INDEX idx_session_tokens_expires ON public.session_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access session tokens (no client access)
CREATE POLICY "Service role can manage session tokens"
ON public.session_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Add password_reset_required column to schools
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP WITH TIME ZONE;

-- Add password_reset_required column to admins
ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP WITH TIME ZONE;

-- Create function to clean up expired sessions (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.session_tokens
    WHERE expires_at < now() OR is_revoked = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Create function to validate session token
CREATE OR REPLACE FUNCTION public.validate_session_token(p_token TEXT)
RETURNS TABLE(user_id UUID, user_type TEXT, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.user_id,
        st.user_type,
        (st.expires_at > now() AND NOT st.is_revoked) as is_valid
    FROM public.session_tokens st
    WHERE st.token = p_token
    LIMIT 1;
END;
$$;