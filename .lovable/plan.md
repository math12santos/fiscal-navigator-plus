

# Seed Data: Plano de Contas + Centros de Custo Padrao

## Objetivo

Inserir dados iniciais (seed) na base do usuario autenticado, contemplando o **Plano de Contas** (ja aprovado anteriormente) e os **Centros de Custo** padrao para uma empresa de Assessoria em BPO Financeiro, Contabilidade e Licitacoes.

---

## Centros de Custo Propostos

A estrutura reflete as areas operacionais tipicas desse tipo de empresa, usando hierarquia pai/filho:

```text
CC-01       Diretoria / Administracao Geral
CC-01.01      Financeiro Interno
CC-01.02      Juridico
CC-01.03      TI e Infraestrutura

CC-02       Operacoes BPO Financeiro
CC-02.01      Contas a Pagar
CC-02.02      Contas a Receber
CC-02.03      Conciliacao Bancaria
CC-02.04      Faturamento

CC-03       Operacoes Contabilidade
CC-03.01      Escrituracao Fiscal
CC-03.02      Obrigacoes Acessorias
CC-03.03      Folha de Pagamento

CC-04       Operacoes Licitacoes
CC-04.01      Prospecao e Editais
CC-04.02      Elaboracao de Propostas
CC-04.03      Acompanhamento de Pregoes

CC-05       Comercial e Marketing
CC-05.01      Vendas e Relacionamento
CC-05.02      Marketing Digital

CC-06       Recursos Humanos
```

Todos os centros terao `active = true` e `is_system_default` nao se aplica a esta tabela (campo inexistente), porem serao identificaveis pelo padrao de codigo.

---

## Implementacao Tecnica

### Metodo

Adicionar um botao **"Gerar Plano Padrao"** na pagina de Configuracoes que:

1. Verifica se o usuario ja possui contas/centros cadastrados
2. Se vazio, insere o plano de contas completo (conforme plano anterior aprovado) e os centros de custo acima
3. Se ja houver dados, exibe confirmacao antes de prosseguir (para evitar duplicatas)
4. A insercao respeita a hierarquia: primeiro nivel 1, depois nivel 2 referenciando os pais, depois nivel 3

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Configuracoes.tsx` | Adicionar botao "Gerar Plano Padrao" no topo da pagina |
| `src/hooks/useChartOfAccounts.ts` | Adicionar funcao `seedDefaultAccounts` com os ~40 registros do plano de contas |
| `src/hooks/useCostCenters.ts` | Adicionar funcao `seedDefaultCenters` com os ~17 registros de centros de custo |

### Detalhes dos centros de custo

Cada registro tera:
- `code`: conforme arvore acima (CC-01, CC-01.01, etc.)
- `name`: nome descritivo
- `parent_id`: referencia ao centro pai (null para nivel 1)
- `business_unit`: "Matriz" para todos (usuario pode alterar depois)
- `responsible`: null (usuario preenche conforme sua equipe)
- `description`: null
- `active`: true

### Fluxo do usuario

1. Acessa /configuracoes
2. Clica em "Gerar Plano Padrao"
3. Dialog de confirmacao aparece informando que serao criados X contas e Y centros de custo
4. Ao confirmar, os dados sao inseridos em lote
5. A arvore de contas e a tabela de centros de custo sao atualizadas automaticamente

### Protecao contra duplicatas

A funcao verifica se ja existem registros do usuario antes de inserir. Se existirem, oferece a opcao de pular a insercao ou substituir (com confirmacao extra).

