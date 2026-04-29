## Objetivo

1. Confirmar e blindar o fluxo de "Esqueci a senha" para que o link **nunca conceda acesso** — apenas leve à redefinição e, em seguida, à tela de login.
2. Aplicar 3 melhorias de segurança (sem 2FA): proteção contra senhas vazadas, throttle no botão de recuperação e reautenticação obrigatória ao trocar senha logado.
3. Adicionar um passo de **escolha de tema (claro/escuro) no primeiro login**, persistindo a preferência no perfil para sincronizar entre dispositivos.

---

## Fluxo final de senha (confirmação)

```text
Auth (Esqueci a senha)
   ↓ digita e-mail
   ↓ resetPasswordForEmail({ redirectTo: /reset-password })
E-mail com link
   ↓ clique
/reset-password
   ↓ detecta evento PASSWORD_RECOVERY
   ↓ exige nova senha + confirmação
   ↓ updateUser({ password })
   ↓ signOut() forçado  ← garante que o link NÃO concede acesso
/auth (login limpo com a nova senha)
```

Esse fluxo já está implementado em `src/pages/ResetPassword.tsx` e `src/pages/Auth.tsx` (com `redirectTo` apontando para `/reset-password`). O plano abaixo apenas reforça e adiciona as proteções.

---

## Mudanças

### 1. Proteção contra senhas vazadas (HIBP)
- Habilitar `password_hibp_enabled: true` via configuração de auth da Lovable Cloud.
- Efeito: senhas presentes em vazamentos públicos são rejeitadas no signup, no `/reset-password` e na troca de senha do `/perfil`. Sem ação extra do usuário.

### 2. Throttle de 60s no "Esqueci a senha"
Em `src/pages/Auth.tsx`:
- Adicionar estado `cooldownSec` (number).
- Ao clicar em "Esqueci minha senha" com sucesso, iniciar contagem regressiva de 60s.
- Botão fica desabilitado e exibe "Aguarde 60s" → "Aguarde 59s"... durante a janela.
- Persistir o timestamp da última solicitação em `sessionStorage` (`pwd_reset_last_ts`) para resistir a recarregamentos da página.
- Mantém a mensagem genérica de sucesso (não revela se o e-mail existe).

### 3. Reautenticação obrigatória no `/perfil` → "Alterar senha"
Em `src/pages/Perfil.tsx`:
- Adicionar campo `currentPassword` (PasswordInput) acima dos campos de nova senha.
- Antes de chamar `updateUser({ password })`, validar a senha atual com:
  ```ts
  await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  ```
  Se falhar → toast "Senha atual incorreta" e aborta.
- Só então chama `updateUser({ password: newPassword })`.
- Mantém HIBP atuando automaticamente.

### 4. Escolha de tema no primeiro login
**Banco** — adicionar coluna em `profiles`:
```sql
ALTER TABLE public.profiles
ADD COLUMN theme_preference text CHECK (theme_preference IN ('light','dark'));
```
(nullable; quando `NULL` significa "ainda não escolheu").

**Componente novo** `src/components/ThemePreferenceDialog.tsx`:
- Dialog modal (não fechável por overlay/ESC) com dois cards visuais grandes: **Claro** (ícone Sun) e **Escuro** (ícone Moon), com preview de cores.
- Ao selecionar:
  - Aplica imediatamente no `<html>` (`classList.add/remove("dark")`).
  - Salva em `localStorage.theme` (mantém compatibilidade com `ThemeToggle` existente).
  - Faz `update profiles set theme_preference = ...` para o usuário logado.
  - Fecha o dialog.

**Hook novo** `src/hooks/useThemePreference.ts`:
- Em `App.tsx`/`AppLayout.tsx`, ao carregar o usuário:
  - Lê `profiles.theme_preference`.
  - Se `NULL` → seta `showThemeDialog = true`.
  - Se preenchido e diferente do `localStorage.theme` atual → sincroniza local com o do banco (preferência do banco vence, mantendo escolha entre dispositivos).

**Sincronização contínua**:
- Atualizar `ThemeToggle.tsx` para, além de gravar no `localStorage`, também persistir em `profiles.theme_preference` quando houver usuário logado (fire-and-forget). Assim a preferência segue o usuário em qualquer dispositivo.

**Onde renderizar o dialog**:
- Em `AppLayout.tsx`, montar `<ThemePreferenceDialog />` controlado pelo hook. Aparece na primeira tela autenticada e só some após a escolha.

---

## Arquivos afetados

- **Edit** `src/pages/Auth.tsx` — throttle 60s no botão de reset.
- **Edit** `src/pages/Perfil.tsx` — campo "Senha atual" + reautenticação antes de `updateUser`.
- **Edit** `src/components/ThemeToggle.tsx` — persistir `theme_preference` em `profiles` quando logado.
- **Edit** `src/components/AppLayout.tsx` — montar o `ThemePreferenceDialog`.
- **Create** `src/components/ThemePreferenceDialog.tsx` — modal de escolha inicial.
- **Create** `src/hooks/useThemePreference.ts` — leitura, sincronização e gating do dialog.
- **Migration** — `ALTER TABLE profiles ADD COLUMN theme_preference text` + check constraint.
- **Auth config** — habilitar `password_hibp_enabled: true`.
- **Memory update** `mem://features/password-recovery-flow` — registrar HIBP, throttle, reauth e `theme_preference`.

---

## Considerações de UX

- O e-mail de recuperação continua sendo o template padrão da Lovable Cloud (não vamos customizar agora). Se quiser branding, posso fazer em uma rodada separada.
- A mensagem de sucesso no "Esqueci a senha" permanece genérica ("Se o e-mail estiver cadastrado, você receberá um link") para evitar enumeração de usuários.
- O dialog de tema bloqueia a interação até a escolha — é rápido (2 cliques) e só acontece uma vez na vida do usuário.
- A escolha pode ser trocada depois pelo `ThemeToggle` no header (já existente) e fica sincronizada entre dispositivos.

Posso seguir com a implementação?