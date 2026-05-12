## Objetivo

Permitir que o usuário troque o mês no card "Fechamento de mês" e que essa seleção propague para as abas **Contas a Pagar**, **Contas a Receber**, **Conciliação** e **Contas Bancárias / Extrato**, possibilitando ajustes em qualquer mês ainda em aberto sem sair da sessão.

## Fluxo desejado

1. No topo de `/financeiro`, o card de fechamento mostra o seletor de mês (já existe).
2. Ao trocar o mês:
   - O card recalcula prontidão para o mês escolhido.
   - Um badge ao lado do seletor mostra **Aberto** ou **Fechado** (a partir de `fiscal_periods`). Se Fechado, exibe aviso "ajustes bloqueados — reabra para editar".
   - Os 3 itens (Extrato / AP / AR) viram **atalhos clicáveis** que abrem a aba correspondente já filtrada pelo mês selecionado.
3. Em cada aba financeira filtrada por mês, um cabeçalho discreto exibe:
   `Mês de trabalho: 2026-04 [Aberto] [Limpar filtro]`
   — clicar em "Limpar filtro" volta para a visão completa (comportamento atual).
4. Ao mudar de organização ou recarregar, o mês de trabalho reseta para o mês corrente.

## Mudanças técnicas

### 1. Estado compartilhado — novo `FinanceiroMonthContext`

Arquivo novo `src/contexts/FinanceiroMonthContext.tsx`:
- Provider colocado em `src/pages/Financeiro.tsx` envolvendo todo o conteúdo da página.
- Estado: `workingMonth: string | null` (formato `yyyy-MM`, default = mês corrente), setter `setWorkingMonth`, e helper `clearWorkingMonth` (define como `null` = "sem filtro").
- Reset automático quando `currentOrg.id` muda.

### 2. `MonthClosingReadinessCard.tsx`
- Substituir o `useState` local pelo contexto.
- Adicionar badge **Aberto / Fechado** (usando `useFiscalPeriods().isMonthClosed`).
- Tornar os 3 cartões `ReadinessItem` clicáveis: ao clicar, chamar uma callback que troca a aba ativa de `Financeiro.tsx` (via `setSearchParams({ tab: 'pagar' | 'receber' | 'conciliacao' })`) mantendo o `workingMonth`.

### 3. Hook de filtro reutilizável — `useFinanceiroMonthFilter.ts`

Novo hook que recebe a lista de `FinanceiroEntry[]` e retorna a lista filtrada pelo `workingMonth` do contexto. Critério:
- Considerar a entry "do mês" se `data_realizada` (quando existir) cair no mês; senão, `data_prevista`/`data_vencimento`.
- Quando `workingMonth === null`, retorna a lista intacta.

### 4. Aplicação do filtro nas abas

Sem alterar `useFinanceiro` (continua trazendo o universo completo, importante para projeções e KPIs globais). O filtro é aplicado no nível de apresentação:

- `ContasAPagar.tsx` e `ContasAReceber.tsx`:
  - Renderizar um `<WorkingMonthBanner />` (componente novo) acima dos KPIs.
  - Aplicar `useFinanceiroMonthFilter(entries)` antes de passar para `FinanceiroTable`, `PendenciasPanel`, `DuplicateAlerts`, e recomputar os totais exibidos nos `KPICard` a partir da lista filtrada (mesma fórmula simples já usada). KPIs continuam respeitando o `is_estorno` / `transferencia_interna` conforme regras MECE.
- `ConciliacaoTab.tsx`: aplicar o mesmo banner e passar o `workingMonth` como filtro adicional para o `StatementResolutionPanel` (filtrar `bank_statement_entries.data` pelo mês).
- `ContasBancariasTab.tsx`: o banner aparece e, no sub-bloco de extratos por conta, filtra as linhas pelo mês. Os saldos manuais/OFX continuam sendo "snapshot atual" (não dependem de mês).
- `FluxoCaixaTab.tsx`: **fora do escopo** desta entrega — já tem seu próprio range/MonthPicker; não tocar.
- `AgingListTab.tsx`: **fora do escopo** (aging é por hoje, não por mês de competência).

### 5. `WorkingMonthBanner.tsx` (novo)
Pequeno componente reutilizável: mostra "Mês de trabalho: AAAA-MM", badge Aberto/Fechado, botão "Limpar filtro". Esconde-se quando `workingMonth` é o mês corrente sem ter sido alterado manualmente (pra não poluir).

### 6. Bloqueio de escrita em mês fechado
Já existe a checagem por `fiscal_periods` no backend (memória "Governance Periods"). O front apenas:
- Desabilita ações de criação/edição nas tabelas quando o mês de trabalho está **Fechado**, com tooltip "Reabra o mês para editar".
- Mostra link "Reabrir mês" no banner (chama `useFiscalPeriods().reopenPeriod`) — visível apenas para perfis que já tinham permissão de fechar.

## O que NÃO muda
- Estrutura de dados, RLS, RPCs.
- `useFinanceiro` (universo continua completo; filtro é só de exibição).
- `FluxoCaixaTab` e `AgingListTab`.
- Lógica de projeções virtuais (`proj-`), MECE, materialização.

## Arquivos

**Novos**
- `src/contexts/FinanceiroMonthContext.tsx`
- `src/hooks/useFinanceiroMonthFilter.ts`
- `src/components/financeiro/WorkingMonthBanner.tsx`

**Editados**
- `src/pages/Financeiro.tsx` (provider + roteamento de aba a partir do card)
- `src/components/financeiro/MonthClosingReadinessCard.tsx` (consome contexto, badge, itens clicáveis)
- `src/components/financeiro/ContasAPagar.tsx`
- `src/components/financeiro/ContasAReceber.tsx`
- `src/components/financeiro/ConciliacaoTab.tsx`
- `src/components/financeiro/ContasBancariasTab.tsx`
- `.lovable/plan.md` (registrar mudança)

## Critérios de aceite
1. Trocar o mês no card altera os totais e listas das abas AP, AR, Conciliação e Extrato.
2. Em mês fechado, o banner mostra **Fechado** e os botões de criar/editar ficam desabilitados, com opção de "Reabrir mês".
3. Clicar nos cartões Extrato/AP/AR do card abre a aba correspondente já filtrada.
4. "Limpar filtro" volta à visão completa atual; trocar de organização zera o filtro.
