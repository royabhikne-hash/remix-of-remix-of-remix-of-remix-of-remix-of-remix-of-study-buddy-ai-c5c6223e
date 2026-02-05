-- Enable pg_net extension for HTTP calls (pg_cron may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;