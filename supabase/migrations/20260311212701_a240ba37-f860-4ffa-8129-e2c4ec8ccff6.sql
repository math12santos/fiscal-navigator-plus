
-- Fix org_members_self_join_escalation: remove self-join clause
DROP POLICY IF EXISTS "Members can insert themselves" ON public.organization_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.organization_members;
DROP POLICY IF EXISTS "Org members can insert" ON public.organization_members;

-- Only owners/admins (or masters) can add members
CREATE POLICY "Only admins can add org members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'master')
    OR has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Fix request_comments cross-org write
DROP POLICY IF EXISTS "Users can create request comments" ON public.request_comments;
CREATE POLICY "Org members can create request comments"
  ON public.request_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
        AND is_org_member(auth.uid(), r.organization_id)
    )
  );

-- Fix request_attachments cross-org write
DROP POLICY IF EXISTS "Users can create request attachments" ON public.request_attachments;
CREATE POLICY "Org members can create request attachments"
  ON public.request_attachments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
        AND is_org_member(auth.uid(), r.organization_id)
    )
  );
