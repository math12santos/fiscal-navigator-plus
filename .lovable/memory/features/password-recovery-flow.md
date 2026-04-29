---
name: Password Recovery & Profile
description: /reset-password route, profile page (avatar/phone/password), HIBP, throttle, reauth, theme preference
type: feature
---

# Reset de senha
- Rota pública `/reset-password` (fora de ProtectedRoutes) escuta `PASSWORD_RECOVERY` e chama `updateUser({ password })`. Após sucesso faz `signOut` e redireciona para `/auth` para login limpo. **O link de e-mail nunca concede acesso ao app.**
- `redirectTo` em `Auth.tsx` (`handleForgotPassword`) e `BackofficeCompany.tsx` (admin reset) **DEVE** apontar para `${origin}/reset-password`. Apontar para `/` ou `/auth` faz o usuário entrar logado sem trocar a senha.
- "Esqueci a senha" usa **mensagem genérica** (não revela se o e-mail existe) + **throttle de 60s** persistido em `sessionStorage[pwd_reset_last_ts]`.
- **HIBP enabled** (`password_hibp_enabled: true`) → senhas vazadas são rejeitadas em signup, reset e troca.

# Perfil do usuário
- Rota `/perfil` (protegida). Botão `UserCog` no footer do sidebar abre.
- Tabela `profiles`: `full_name`, `email`, `phone`, `avatar_url`, `cargo`, `company_name`, `must_change_password`, `active`, `theme_preference`.
- Avatar: bucket `avatars` público, path `<user_id>/avatar-<ts>.<ext>`, RLS por pasta com `user_id`. Limite 2MB no client.
- Card "Alterar senha" exige **reautenticação** (`signInWithPassword` com a senha atual) antes de chamar `updateUser({ password })`. Bloqueia também senha igual à atual.

# Tema (claro/escuro)
- Coluna `profiles.theme_preference` (`'light' | 'dark' | NULL`).
- `useThemePreference()` lê do banco no boot autenticado: se `NULL` → abre `ThemePreferenceDialog` modal bloqueante (no primeiro login). Se preenchido → sincroniza `<html>.dark` + `localStorage.theme` (DB vence — preferência segue o usuário entre dispositivos).
- `ThemeToggle` continua salvando `localStorage`, mas também grava `theme_preference` em `profiles` (fire-and-forget) quando há usuário logado.
