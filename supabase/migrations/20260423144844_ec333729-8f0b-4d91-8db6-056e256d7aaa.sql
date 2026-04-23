-- 1. Register the new module
INSERT INTO public.system_modules (module_key, label, enabled)
VALUES ('cadastro', 'Cadastros', true)
ON CONFLICT (module_key) DO NOTHING;

-- 2. Mirror existing user_permissions from configuracoes -> cadastro (idempotent)
-- entities tab -> fornecedores + clientes
INSERT INTO public.user_permissions (user_id, organization_id, module, tab, allowed)
SELECT user_id, organization_id, 'cadastro', 'fornecedores', allowed
FROM public.user_permissions
WHERE module = 'configuracoes' AND tab = 'entities'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, organization_id, module, tab, allowed)
SELECT user_id, organization_id, 'cadastro', 'clientes', allowed
FROM public.user_permissions
WHERE module = 'configuracoes' AND tab = 'entities'
ON CONFLICT DO NOTHING;

-- products tab -> produtos + servicos
INSERT INTO public.user_permissions (user_id, organization_id, module, tab, allowed)
SELECT user_id, organization_id, 'cadastro', 'produtos', allowed
FROM public.user_permissions
WHERE module = 'configuracoes' AND tab = 'products'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, organization_id, module, tab, allowed)
SELECT user_id, organization_id, 'cadastro', 'servicos', allowed
FROM public.user_permissions
WHERE module = 'configuracoes' AND tab = 'products'
ON CONFLICT DO NOTHING;

-- 3. Mirror cost_center_permissions similarly
INSERT INTO public.cost_center_permissions (organization_id, cost_center_id, role, module_key, tab_key, allowed)
SELECT organization_id, cost_center_id, role, 'cadastro', 'fornecedores', allowed
FROM public.cost_center_permissions
WHERE module_key = 'configuracoes' AND tab_key = 'entities'
ON CONFLICT DO NOTHING;

INSERT INTO public.cost_center_permissions (organization_id, cost_center_id, role, module_key, tab_key, allowed)
SELECT organization_id, cost_center_id, role, 'cadastro', 'clientes', allowed
FROM public.cost_center_permissions
WHERE module_key = 'configuracoes' AND tab_key = 'entities'
ON CONFLICT DO NOTHING;

INSERT INTO public.cost_center_permissions (organization_id, cost_center_id, role, module_key, tab_key, allowed)
SELECT organization_id, cost_center_id, role, 'cadastro', 'produtos', allowed
FROM public.cost_center_permissions
WHERE module_key = 'configuracoes' AND tab_key = 'products'
ON CONFLICT DO NOTHING;

INSERT INTO public.cost_center_permissions (organization_id, cost_center_id, role, module_key, tab_key, allowed)
SELECT organization_id, cost_center_id, role, 'cadastro', 'servicos', allowed
FROM public.cost_center_permissions
WHERE module_key = 'configuracoes' AND tab_key = 'products'
ON CONFLICT DO NOTHING;

-- 4. Activate the module for all organizations that have configuracoes enabled
INSERT INTO public.organization_modules (organization_id, module_key, enabled)
SELECT DISTINCT organization_id, 'cadastro', true
FROM public.organization_modules
WHERE module_key = 'configuracoes' AND enabled = true
ON CONFLICT (organization_id, module_key) DO NOTHING;