

# Etapa 3 — Integrações (Upload de Planilhas com DE/PARA)

## Objetivo

Substituir o placeholder da Etapa 3 por um componente funcional que permite:
1. **Upload de planilhas** (CSV/XLSX) com dados financeiros
2. **Mapeamento DE/PARA** — o usuário associa colunas da planilha a campos do sistema (conta, valor, data, descrição, centro de custo)
3. **Preview dos dados mapeados** antes de confirmar importação
4. **Importação real** dos dados para a tabela de lançamentos financeiros

Bancos e ERPs ficam como placeholders visuais (Fase 2). Apenas o upload manual é funcional.

## Database

### Nova tabela `data_imports`

Registra cada importação feita, com metadados e mapeamento usado.

```sql
CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  source_type text NOT NULL DEFAULT 'spreadsheet', -- spreadsheet, ofx, api
  row_count integer DEFAULT 0,
  column_mapping jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending', -- pending, mapped, imported, failed
  imported_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage imports" ON public.data_imports
  FOR ALL TO authenticated USING (is_org_member(auth.uid(), organization_id));
```

### Nova tabela `data_import_rows`

Armazena as linhas brutas importadas + dados mapeados.

```sql
CREATE TABLE public.data_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}',
  mapped_data jsonb DEFAULT '{}',
  status text DEFAULT 'pending', -- pending, valid, error
  error_message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.data_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage import rows" ON public.data_import_rows
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM data_imports di WHERE di.id = import_id AND is_org_member(auth.uid(), di.organization_id))
  );
```

## Componente Principal

### `src/components/onboarding-guiado/Step3Integracoes.tsx`

Layout com 3 seções:

#### Seção 1: Fontes Disponíveis (visual/informativa)
- Cards para Bancos, ERPs com badge "Em breve"
- Card "Importação Manual" como ativo e clicável

#### Seção 2: Upload de Planilha (funcional)
- Área de drag & drop / file input para CSV
- Parse client-side com leitura de headers
- Mostra preview das primeiras 5 linhas

#### Seção 3: Mapeamento DE/PARA
- Para cada coluna detectada na planilha, um `<Select>` com os campos-alvo:
  - `data` (Data)
  - `descricao` (Descrição)
  - `valor` (Valor)
  - `tipo` (Receita/Despesa)
  - `conta` (Conta — plano de contas)
  - `centro_custo` (Centro de Custo)
  - `ignorar` (Ignorar coluna)
- Botão "Confirmar Mapeamento" salva em `data_imports` + `data_import_rows`
- Preview tabela com dados mapeados
- Botão "Importar" muda status para `imported`

O parsing de CSV será feito client-side (split por delimitador). Sem dependência externa.

## Integração no Wizard

**`OnboardingGuiado.tsx`**: Renderizar `Step3Integracoes` quando `currentStep === 3`.

## Dados salvos no `integrations_data`

```json
{
  "imports_count": 1,
  "total_rows_imported": 150,
  "last_import_date": "2026-03-09"
}
```

## Arquivos

- **Migration**: `data_imports` + `data_import_rows` tables + RLS
- **Novo**: `src/components/onboarding-guiado/Step3Integracoes.tsx`
- **Editado**: `src/pages/OnboardingGuiado.tsx` (render step 3)

