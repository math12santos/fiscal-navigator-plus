---
name: Password Recovery & Profile
description: Dedicated /reset-password route, profile page with avatar/phone/password change
type: feature
---

# Reset de senha
- Rota pública `/reset-password` (fora de ProtectedRoutes) escuta `PASSWORD_RECOVERY` e chama `updateUser({ password })`. Após sucesso faz `signOut` e redireciona para `/auth` para login limpo.
- `redirectTo` em `Auth.tsx` (`handleForgotPassword`) e `BackofficeCompany.tsx` (admin reset) **DEVE** apontar para `${origin}/reset-password`. Apontar para `/` ou `/auth` faz o usuário entrar logado sem trocar a senha (a sessão de recovery do Supabase é uma sessão válida).

# Perfil do usuário
- Rota `/perfil` (protegida). Botão `UserCog` no footer do sidebar abre.
- Tabela `profiles`: campos `full_name`, `email`, `phone`, `avatar_url`, `cargo`, `company_name`, `must_change_password`, `active`.
- Avatar: bucket `avatars` público, path `<user_id>/avatar-<ts>.<ext>`, RLS por pasta com `user_id`. Limite 2MB no client.
- Card "Alterar senha" usa `supabase.auth.updateUser({ password })` (sessão ativa, sem fluxo de recovery).
