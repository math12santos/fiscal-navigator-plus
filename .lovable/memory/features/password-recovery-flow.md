---
name: Password Recovery & Profile Security
description: /reset-password obrigatório, /perfil com zod+preview avatar, signOut global pós-troca, security_events auditados no Backoffice
type: feature
---

## Fluxo
- **Esqueci a senha** (Auth.tsx): cooldown 60s sessionStorage, mensagem genérica anti-enumeração, registra `password_reset_requested` / `rate_limit_blocked`.
- **/reset-password**: aceita PASSWORD_RECOVERY ou sessão ativa; senha mín. 8; após `updateUser` faz `signOut({ scope: 'global' })` e redireciona para /auth. Loga `password_changed` + `session_revoked_global`. Link inválido loga `password_reset_link_invalid`.
- **/perfil**: validação zod (nome, telefone, senha forte com indicador visual), preview de avatar com Progress de tamanho (2MB max, JPG/PNG/WebP), confirmar/cancelar antes do upload, reauth via `signInWithPassword` antes de trocar senha, signOut global após troca.

## Auditoria
- Tabela `security_events` (RLS: insert próprio/anon eventos públicos; select apenas backoffice).
- Helper `src/lib/securityEvents.ts` (fire-and-forget, nunca lança).
- Tipos: password_reset_requested, password_reset_link_invalid/expired, password_changed, password_change_reauth_failed, session_revoked_global, login_success/failed, rate_limit_blocked.
- UI: BackofficeAudit com Tabs (Auditoria geral / Segurança); coluna Dispositivo derivada do user_agent.

## Tema
- `theme_preference` aceita 'light' | 'dark' | 'system'.
- ThemeToggle: ícone alterna manual + botão Monitor "Redefinir para sistema"; quando 'system', escuta `prefers-color-scheme` e mostra badge Monitor sobre o ícone.
- useThemePreference resolve 'system' via matchMedia ao hidratar do DB.
