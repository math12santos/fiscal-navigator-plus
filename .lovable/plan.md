
# Contratos Avulsos com Cronograma de Parcelas

## Resumo
Adicionar a opcao "Unico (sem recorrencia)" ao tipo de recorrencia e criar um sistema de **parcelas personalizadas** para contratos avulsos, permitindo cadastrar cronogramas como "Entrada + X parcelas".

## O que muda para o usuario

1. No formulario de contrato, um novo tipo de recorrencia: **"Unico (sem recorrencia)"**
2. Quando selecionado, os campos de recorrencia (dia de vencimento mensal, prazo indeterminado) ficam ocultos
3. Aparece uma nova secao **"Parcelas"** onde o usuario pode:
   - Adicionar quantas parcelas quiser (ex: "Entrada", "Parcela 1", "Parcela 2"...)
   - Definir valor e data de vencimento de cada parcela
   - Ver o total das parcelas vs. valor do contrato
   - Remover parcelas individualmente
4. Botao de atalho para gerar parcelas automaticamente (ex: "Gerar 3 parcelas iguais a partir de uma data")

## Alteracoes Tecnicas

### 1. Nova tabela no banco de dados: `contract_installments`

```sql
CREATE TABLE public.contract_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  organization_id uuid,
  user_id uuid NOT NULL,
  descricao text NOT NULL DEFAULT 'Parcela',
  numero integer NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies seguindo o padrao existente (org member)
-- Indice em contract_id
```

Campos:
- `descricao`: "Entrada", "Parcela 1", etc.
- `numero`: ordem da parcela
- `valor`: valor individual
- `data_vencimento`: quando vence
- `status`: pendente / pago / vencido

### 2. `src/hooks/useContractInstallments.ts` (novo)
- Hook para CRUD das parcelas vinculadas a um contrato
- Queries filtradas por `contract_id`

### 3. `src/components/ContractFormDialog.tsx`
- Adicionar `{ value: "unico", label: "Unico (sem recorrencia)" }` na lista de recorrencias
- Quando `tipo_recorrencia === "unico"`:
  - Ocultar: dia de vencimento mensal, prazo indeterminado
  - Manter: valor total, data inicio, data fim
- Adicionar sub-secao de **Parcelas** na aba Recorrencia (visivel apenas para contratos unicos e quando editando)
  - Lista de parcelas com descricao, valor, data
  - Botoes de adicionar/remover parcela
  - Atalho "Gerar parcelas" (quantidade + valor + data inicial + intervalo em dias)
  - Totalizador comparando soma das parcelas vs. valor do contrato

### 4. `src/hooks/useContracts.ts`
- Nenhuma alteracao de schema necessaria (`tipo_recorrencia` ja e `text`)

### 5. `src/pages/Contratos.tsx`
- Exibir "Unico" na coluna de tipo quando aplicavel
