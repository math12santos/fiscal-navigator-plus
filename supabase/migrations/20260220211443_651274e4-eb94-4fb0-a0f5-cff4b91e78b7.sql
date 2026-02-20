-- Add backoffice fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa',
ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'básico',
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Add fields to profiles for backoffice user management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cargo text,
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Allow masters to view all profiles
CREATE POLICY "Masters can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'master'));

-- Allow masters to update all profiles
CREATE POLICY "Masters can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'master'));

-- Allow masters to view all org members
CREATE POLICY "Masters can manage org members"
ON public.organization_members
FOR ALL
USING (has_role(auth.uid(), 'master'));

-- Allow masters to manage user_roles
CREATE POLICY "Masters can view user roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'master'));