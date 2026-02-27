
-- Recursive function to get all subsidiary org IDs for a holding
CREATE OR REPLACE FUNCTION public.get_all_subsidiary_ids(p_holding_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE tree AS (
    SELECT subsidiary_id
    FROM organization_holdings
    WHERE holding_id = p_holding_id
    UNION
    SELECT oh.subsidiary_id
    FROM organization_holdings oh
    INNER JOIN tree t ON oh.holding_id = t.subsidiary_id
  )
  SELECT subsidiary_id FROM tree;
$$;

-- Function to check if an org is a holding (has subsidiaries)
CREATE OR REPLACE FUNCTION public.is_holding(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_holdings
    WHERE holding_id = p_org_id
  );
$$;
