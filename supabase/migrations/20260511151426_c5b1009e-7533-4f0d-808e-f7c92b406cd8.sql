INSERT INTO public.system_modules (module_key, label, enabled, maintenance_message)
VALUES ('compras', 'Compras', true, NULL)
ON CONFLICT (module_key) DO NOTHING;