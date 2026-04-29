ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_preference text
CHECK (theme_preference IN ('light','dark'));