

# Mostrar campos obrigatórios faltantes na etapa de Mapeamento

## Problema

O botão "Próximo: Preview" desabilita corretamente quando campos obrigatórios (Descrição, Valor, Data Vencimento) não estão mapeados. Porém **não há feedback visual** explicando por que está desabilitado, o que confunde o usuário ao editar mapeamentos.

## Correção

### `src/components/financeiro/ImportDialog.tsx`

Adicionar uma mensagem de alerta abaixo da tabela de mapeamento, visível apenas quando `!requiredMapped`, listando os campos obrigatórios que ainda não foram atribuídos a nenhuma coluna.

```text
⚠ Campos obrigatórios não mapeados: Descrição, Valor
```

- Calcular `missingFields` filtrando `TARGET_FIELDS` obrigatórios cujo `value` não aparece em nenhum mapping
- Exibir como texto de alerta âmbar entre a tabela e os botões
- Nenhuma mudança de lógica — apenas feedback visual

Mudança de ~5 linhas em um único arquivo.

