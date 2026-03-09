

# Diagnóstico de Integração do Onboarding Guiado

## Situacao Atual

Existem **dois fluxos de onboarding separados** que nao estao conectados entre si:

1. **Onboarding Obrigatório** (`/onboarding`): Senha → Criar Empresa → Selecionar Módulos → marca `onboarding_completed = true` → redireciona para `/`
2. **Onboarding Guiado** (`/onboarding-guiado`): 10 etapas de implantação financeira → ao concluir, apenas faz `navigate("/")` sem marcar nada

## Lacunas Identificadas

### 1. Rota desprotegida
`/onboarding-guiado` nao tem guard de autenticação. Qualquer visitante pode acessar a URL diretamente.

### 2. Nenhum ponto de entrada no app
Nao existe link, botao ou redirecionamento que leve o usuario ao `/onboarding-guiado`. O fluxo obrigatório termina em `OnboardingModules` e vai direto para `/`. O sidebar (`AppLayout`) tambem nao tem link.

### 3. Conclusão do Onboarding Guiado nao persiste estado final
`handleFinish` apenas navega para `/` com um toast. Nao:
- Marca `onboarding_completed = true` na org (caso se torne o fluxo principal)
- Nem marca `status = "concluido"` no `onboarding_progress`

### 4. Relação entre os dois fluxos indefinida
Nao esta claro se o Guiado substitui o Obrigatório ou se e complementar (pos-onboarding).

---

## Proposta de Integração

### Decisao de arquitetura: Guiado como etapa pos-onboarding obrigatório

O fluxo obrigatório (senha + empresa + módulos) continua existindo. Apos ele, o usuario e direcionado ao Onboarding Guiado como etapa de implantação.

### Mudanças

**1. Proteger a rota `/onboarding-guiado`**
Em `App.tsx`, envolver a rota com verificação de auth (como `OnboardingRoute` faz).

**2. Adicionar ponto de entrada**
- No `Dashboard`, exibir um banner/card quando `onboarding_progress.status !== "concluido"` convidando a continuar o onboarding guiado
- No sidebar (`AppLayout`), adicionar item contextual "Onboarding" quando o status nao for concluido

**3. Redirecionar apos OnboardingModules**
Apos selecionar módulos (fim do onboarding obrigatório), redirecionar para `/onboarding-guiado` em vez de `/`.

**4. Finalização do Guiado**
No `handleFinish` de `OnboardingGuiado.tsx`:
- Chamar `finishOnboarding()` do hook (já existe, marca `status: "concluido"`)
- Garantir que `onboarding_completed = true` ja foi marcado (pelo fluxo obrigatório)

### Arquivos afetados

- `src/App.tsx` — proteger rota `/onboarding-guiado`
- `src/pages/OnboardingModules.tsx` — redirecionar para `/onboarding-guiado` apos concluir
- `src/pages/OnboardingGuiado.tsx` — chamar `finishOnboarding()` no `handleFinish`
- `src/pages/Dashboard.tsx` — banner de continuidade do onboarding guiado
- `src/components/AppLayout.tsx` — item "Onboarding" condicional no sidebar

