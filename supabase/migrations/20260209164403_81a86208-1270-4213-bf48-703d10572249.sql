
-- Fix: change unique constraint from user_id+code to organization_id+code for multi-org support

-- chart_of_accounts
ALTER TABLE public.chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_user_code_unique;
ALTER TABLE public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_org_code_unique UNIQUE (organization_id, code);

-- cost_centers (same fix)
ALTER TABLE public.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_user_code_unique;
ALTER TABLE public.cost_centers ADD CONSTRAINT cost_centers_org_code_unique UNIQUE (organization_id, code);
