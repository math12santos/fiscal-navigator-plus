# `_integrations/` — Orquestradores cross-módulo

Cada arquivo aqui representa um fluxo entre dois módulos. Eles são os
únicos lugares autorizados a importar `services/` de mais de um módulo.

Convenções:
- **Sem React.** Funções puras + chamadas a services + emissão de auditoria.
- Toda integração financeira grava um `AuditEvent` (ver `_contracts/audit.ts`).
- Toda materialização em `cashflow_entries` usa `source_ref` MECE de
  `_contracts/projections.ts`.

## Inventário planejado

- `dpToCashflow.ts` — folha → caixa
- `contractToCashflow.ts` — parcelas → caixa
- `crmToContract.ts` — oportunidade ganha → contrato
- `juridicoToCashflow.ts` — acordos/sinistros/despesas → caixa
- `tiToCashflow.ts` — compras/incidentes → caixa
- `autoTaskDispatcher.ts` — tarefas automáticas
