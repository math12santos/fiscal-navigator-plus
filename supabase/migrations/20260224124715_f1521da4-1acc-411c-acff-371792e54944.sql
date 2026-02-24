
INSERT INTO public.system_modules (module_key, label, enabled)
VALUES ('crm', 'CRM Comercial', true)
ON CONFLICT (module_key) DO NOTHING;
