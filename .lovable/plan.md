

# Análise e Limpeza da tabela `user_permissions` (362 → ~180 registros)

## Diagnóstico

362 permissões distribuídas entre 8 usuários × 8 organizações. Três problemas identificados:

### 1. Módulos obsoletos/fantasma (estimativa: ~85 registros removíveis)

| Módulo | Registros | Problema |
|--------|-----------|----------|
| `scope` | 8 | Meta-dado, não é módulo real — controlado por `user_cost_center_access` |
| `action` | 19 | Meta-dado genérico, não utilizado na lógica de `canAccessModule` |
| `conciliacao` | 16 | Módulo foi integrado como aba do Financeiro — agora é `financeiro` tab `conciliacao` |
| `fluxo-caixa` | 28 | Idem — agora é `financeiro` tab `fluxo-caixa` |
| `documentos` | 2 | Módulo não existe no sistema |

Esses 73+ registros podem ser removidos ou migrados.

### 2. Propagação multiplica linhas desnecessariamente

Ao propagar permissões para 6 subsidiárias, cada usuário gera ~21 linhas × 6 orgs = 126 linhas. O modelo "1 linha por módulo/tab" é correto, mas o problema é que **cada módulo grava uma linha mesmo quando `allowed=true` e o comportamento padrão já seria permitir** (para owners/admins).

### 3. Granularidade de tabs sem necessidade

Várias permissões de tabs (ex: `planejamento` × `cenarios`, `planejamento` × `comercial`, etc.) estão gravadas como `allowed=false` para todos os usuários — seriam melhor representadas por uma única regra no módulo pai.

---

## Plano de Correção

### Etapa 1 — Migrar permissões de módulos obsoletos (SQL data update)

- Converter `conciliacao` → `financeiro` tab `conciliacao` (onde não existir duplicata)
- Converter `fluxo-caixa` → `financeiro` tab `fluxo-caixa` (onde não existir duplicata)  
- Deletar registros de `scope`, `action`, `documentos`

### Etapa 2 — Atualizar código para não gerar registros fantasma

**`src/hooks/useBackoffice.ts`**: No `upsertPermission` e `propagateToGroup`, filtrar módulos `scope` e `action` para não serem copiados/propagados.

**`src/hooks/useUserPermissions.ts`**: Já filtra `scope`/`action` na verificação `hasConfiguredPermissions` — manter.

### Etapa 3 — Atualizar `moduleDefinitions.ts`

Garantir que `conciliacao` e `fluxo-caixa` como módulos standalone não existam (já feito na consolidação anterior), e que a tela de configuração de permissões do backoffice use `MODULE_DEFINITIONS` como fonte canônica — evitando gravar permissões para módulos inexistentes.

### Etapa 4 — Limpeza na tela de permissões do Backoffice

Verificar o componente que renderiza checkboxes de permissões e garantir que ele use `MODULE_DEFINITIONS` como lista de módulos, não uma lista hardcoded que ainda inclua módulos extintos.

---

## Resultado esperado

| Antes | Depois |
|-------|--------|
| 362 registros | ~180 registros |
| 5 módulos fantasma | 0 |
| Propagação copia tudo | Propagação filtra meta-dados |

## Arquivos envolvidos

- **SQL (data update)**: migrar `conciliacao`/`fluxo-caixa` → tabs do financeiro, deletar `scope`/`action`/`documentos`
- `src/hooks/useBackoffice.ts` — filtrar meta-permissões na propagação
- `src/data/moduleDefinitions.ts` — confirmar que é fonte única
- Componente de configuração de permissões no Backoffice — usar `MODULE_DEFINITIONS`

