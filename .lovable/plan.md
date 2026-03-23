# Reformular tabela de mapeamento: DE → PARA com seção "Ajustar depois"

## Problema

A tabela atual mostra "Campo do sistema" na esquerda e "Coluna do arquivo" na direita — o fluxo natural de leitura é o inverso: o usuário pensa "esta coluna do arquivo (DE) vai para qual campo (PARA)". Além disso, campos obrigatórios sem coluna correspondente ficam perdidos no meio da lista.

## Solução

Dividir a etapa de mapeamento em duas seções:

```text
┌─────────────────────────────────────────────────────────┐
│  SEÇÃO 1 — Colunas do arquivo detectadas                │
│                                                         │
│  Coluna do arquivo (DE)  │  Campo do sistema (PARA)     │
│  ────────────────────────┼──────────────────────────     │
│  Valor_Total             │  [dropdown: Valor *]          │
│  Dt_Venc                 │  [dropdown: Data Vencimento*] │
│  Razao_Social            │  [dropdown: Fornecedor]       │
│  Obs                     │  [dropdown: Ignorar]          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  SEÇÃO 2 — Campos não mapeados (se houver)              │
│  ⚠ Os seguintes campos ainda precisam ser atribuídos:   │
│                                                         │
│  Campo            │  Ação                               │
│  ─────────────────┼──────────────────────                │
│  Descrição *      │  [dropdown: headers] | Ajustar depois│
│  Data Pagamento   │  [dropdown: headers] | Ajustar depois│
│                                                         │
│  ℹ Campos marcados como "Ajustar depois" poderão ser    │
│  corrigidos em Contas a Pagar após a importação.        │
└─────────────────────────────────────────────────────────┘
```

### Regra de negócio "Ajustar depois"

- Campos **opcionais** podem ser marcados como "Ajustar depois" , uma notificação indicando a importância de classificar aquela parte da tabela deve aparecer para o usuário e ele clicar em OK ou Classificar Agora permitindo que ele informe ao que se refere aquela coluna específica..
- Campos **obrigatórios** (Descrição, Valor, Data Vencimento) **Também** podem ser "Ajustar depois" — antes de bloquear o botão Próximo informa a importância da referida coluna não ajustada.
- Ao marcar "Ajustar depois", um alerta âmbar informa que esses dados precisarão ser completados nos módulos financeiros integrados (AP/AR que são integrados às funcionalidades Aging List, Fluxo de Caixa e etc.

## Mudanças

### 1. `src/hooks/useFinanceiroImport.ts`

- Adicionar estado `deferredFields: string[]` — campos marcados como "Ajustar depois".
- Expor `toggleDeferred(targetField)` e `deferredFields` no retorno.
- Incluir `deferredFields` no reset.

### 2. `src/components/financeiro/ImportDialog.tsx`

**Seção 1 — Colunas do arquivo (DE → PARA)**:

- Iterar sobre `rawHeaders` (colunas do arquivo) na esquerda.
- Dropdown na direita com todos os `TARGET_FIELDS` + "Ignorar".
- Preencher com o mapeamento da IA quando disponível.

**Seção 2 — Campos não mapeados**:

- Listar `TARGET_FIELDS` que não foram atribuídos a nenhuma coluna.
- Cada campo terá: dropdown com `rawHeaders` disponíveis OU botão "Ajustar depois".
- Campos obrigatórios não podem ser deferidos.
- Mensagem informativa sobre integração com os módulos AP, Aging, Fluxo de Caixa e Conciliação.

**Botão Próximo**: habilitado quando todos os campos obrigatórios estão mapeados (mesma regra atual).

### 3. Etapa Done — informar campos diferidos

- Se `deferredFields.length > 0`, mostrar na tela de conclusão:
  > "Atenção: os campos X, Y não foram mapeados. Ajuste-os diretamente nos lançamentos importados via Contas a Pagar, Aging List, Fluxo de Caixa ou Conciliação."