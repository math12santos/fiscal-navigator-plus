-- 1) Tabela de eventos de segurança (auditoria)
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  email TEXT NULL,
  event_type TEXT NOT NULL,
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_email ON public.security_events(email);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Whitelist de tipos válidos
ALTER TABLE public.security_events
  ADD CONSTRAINT security_events_type_chk
  CHECK (event_type IN (
    'password_reset_requested',
    'password_reset_link_invalid',
    'password_reset_link_expired',
    'password_changed',
    'password_change_reauth_failed',
    'session_revoked_global',
    'login_success',
    'login_failed',
    'rate_limit_blocked'
  ));

-- INSERT: autenticado pode registrar para si; anônimo só para eventos públicos
CREATE POLICY "Authenticated users can log own events"
ON public.security_events
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Anonymous can log public security events"
ON public.security_events
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND event_type IN (
    'password_reset_requested',
    'password_reset_link_invalid',
    'password_reset_link_expired',
    'login_failed',
    'rate_limit_blocked'
  )
);

-- SELECT: apenas backoffice (master / backoffice_admin)
CREATE POLICY "Backoffice can view security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'master')
  OR has_backoffice_role(ARRAY['master','backoffice_admin'])
);

-- 2) Ampliar theme_preference para aceitar 'system'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_theme_preference_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_theme_preference_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IS NULL OR theme_preference IN ('light','dark','system'));