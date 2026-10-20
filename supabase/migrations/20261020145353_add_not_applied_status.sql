-- Commit the enum addition before using it in defaults, views or functions.
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'not_applied' BEFORE 'applied';
