# `src/modules/` — Arquitetura modular do FinCore

Veja `docs/architecture.md` para o guia completo.

## Layout

```
modules/
├── _contracts/        ← tipos versionados compartilhados (sem dependências do app)
├── _integrations/     ← orquestradores cross-módulo
├── juridico/          ← módulo (services + domain + hooks)
├── ti/
└── ... (outros à medida que migramos)
```

## Regra de ouro

Um módulo NUNCA importa de outro módulo diretamente.
Para conversar com outro módulo, use `_contracts/` ou crie um orquestrador em `_integrations/`.
