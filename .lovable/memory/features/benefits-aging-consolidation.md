---
name: Benefits Aging Consolidation
description: VR/VA/Plano de Saúde geram 1 guia consolidada por empresa/mês no aging; VT permanece individual por colaborador
type: feature
---

## Regra de materialização de benefícios no Aging List (Contas a Pagar)

Em `src/hooks/usePayrollProjections.ts`:

- **VR (vale_refeicao) / VA (vale_alimentacao) / Plano de Saúde / Outros benefícios**:
  - Geram **1 entrada `proj-dp-<sub>-<orgId>-<monthKey>` por empresa/mês**, somando todos os colaboradores ativos+férias+afastados daquela organização.
  - `cost_center_id = null` (guia corporativa).
  - Notes incluem contagem de colaboradores e amostra dos primeiros 20 detalhes.
  - VR/VA/Outros pagos no mês N-1 (`benefitsPaymentDate`); Plano de Saúde no mês de competência (`healthPaymentDate`).

- **VT (Vale Transporte)**:
  - Permanece **1 entrada por colaborador** (`proj-dp-vt-<empId>-<monthKey>`), pois cada VT é uma recarga isolada/individual.

- **Holding consolidada**: como cada filiada gera sua própria guia única, o modo Holding (`activeOrgIds` múltiplos) já consolida naturalmente as guias individuais das empresas no aging list.

## Filtro de elegibilidade

`activeEmployees = employees.filter(e => e.status !== "desligado")` — inclui `ativo`, `ferias` e `afastado` (todos continuam recebendo folha e benefícios). A exclusão por `dismissal_date < cursor` continua valendo.
