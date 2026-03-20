

# Importador CSV/XLSX com IA + Mapeamento Manual para o Financeiro

## Visão geral

Ferramenta de importação no módulo Financeiro com fluxo em 4 etapas: **Upload → IA sugere mapeamento → Usuário revisa/ajusta → Preview e confirma**. Reutiliza as tabelas `data_imports` e `data_import_rows` já existentes e uma edge function para detecção automática via IA.

## Fluxo do usuário

```text
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  1. Upload  │───▶│ 2. IA detecta    │───▶│ 3. Revisar      │───▶│ 4. Preview   │
│  CSV / XLSX │    │    colunas e      │    │    mapeamento   │    │    + Importar│
│  drag&drop  │    │    sugere mapping │    │    DE/PARA      │    │              │
└─────────────┘    └──────────────────┘    └─────────────────┘    └──────────────┘
```

## Detecção por IA

Uma edge function `detect-import-mapping` recebe os headers + 5 primeiras linhas do arquivo e retorna:
- Separador detectado (`;`, `,`, `\t`)
- Formato de data (`dd/MM/yyyy`, `yyyy-MM-dd`, etc.)
- Formato numérico (vírgula decimal BR vs ponto decimal US)
- Mapeamento sugerido: `{ "Data pagamento": "data_realizada", "Fornecedor": "entity_name", "Categoria": "categoria", "Valor": "valor_previsto", ... }`
- Confiança por campo (alta/média/baixa)

Usa Lovable AI (Gemini Flash) com tool calling para structured output.

## Campos-alvo do mapeamento

| Campo sistema | Descrição | Obrigatório |
|---|---|---|
| `descricao` | Descrição do lançamento | Sim |
| `valor_previsto` | Valor | Sim |
| `data_prevista` | Data de vencimento ou pagamento | Sim |
| `data_realizada` | Data do pagamento efetivo | Não |
| `entity_name` | Nome do fornecedor/cliente | Não |
| `categoria` | Categoria da despesa | Não |
| `documento` | Nº documento | Não |
| `conta_bancaria_nome` | Conta financeira | Não |
| `notes` | Observações | Não |
| `ignorar` | Não importar | — |

## Arquivos a criar/alterar

### Novos
1. **`supabase/functions/detect-import-mapping/index.ts`** — Edge function que usa Lovable AI para analisar headers + sample rows e retornar mapeamento estruturado via tool calling
2. **`src/components/financeiro/ImportDialog.tsx`** — Dialog com as 4 etapas (upload, IA, revisão, preview/importação)
3. **`src/hooks/useFinanceiroImport.ts`** — Hook para gerenciar o fluxo de importação (upload, chamar IA, staging, persistência em `cashflow_entries`)

### Alterados
4. **`src/components/financeiro/ContasAPagar.tsx`** — Adicionar botão "Importar CSV/XLSX" ao lado do "Nova Despesa"
5. **`src/components/financeiro/ContasAReceber.tsx`** — Mesmo botão para importação de receitas

## Lógica de importação

1. **Parse local** — CSV (detectando separador) ou XLSX via `SheetJS` (já disponível como `xlsx` no npm)
2. **IA detecta** — Envia headers + 5 rows para edge function, recebe mapping sugerido
3. **Usuário revisa** — Interface DE/PARA com dropdowns para cada coluna, campos com confiança baixa destacados em amarelo
4. **Preview** — Tabela com as primeiras 10 linhas convertidas, alertas de validação (datas inválidas, valores zerados)
5. **Persistência** — Salva no staging (`data_imports` + `data_import_rows`), depois materializa em `cashflow_entries` com `source: "importacao"`

## Tratamento de formatos brasileiros

O parse deve tratar:
- Valores: `1.354,47` → `1354.47` (remove pontos de milhar, troca vírgula por ponto)
- Datas: `01/01/2026` → `2026-01-01`
- Campos vazios entre separadores (`;;`) como null

## Migração de banco

Nenhuma nova tabela necessária — reutiliza `data_imports` e `data_import_rows`. Os lançamentos finais vão para `cashflow_entries` já existente.

## Dependência npm

Adicionar `xlsx` (SheetJS) para parsing de arquivos XLSX no client-side.

