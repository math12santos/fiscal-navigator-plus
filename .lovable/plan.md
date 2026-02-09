

# Atualizacao do plan.md - Base de Conhecimento com RLS

## Conteudo completo do plan.md

O arquivo sera reescrito com todas as secoes anteriormente propostas, acrescido de uma secao dedicada as politicas de RLS por tabela.

---

### Estrutura final do documento

**1. Padroes Arquiteturais**
- Multi-tenancy (organization_id obrigatorio)
- Template de hook (`use[Entidade].ts`)
- Template de pagina (PageHeader > KPIs > Filtros > Tabela > FormDialog)
- Template de formulario (open/onOpenChange/onSubmit/initialData)
- Rotas, navegacao, audit log, origem de dados, UI

**2. Tabelas e Politicas RLS**

Cada tabela sera documentada com colunas-chave, constraints e suas politicas RLS:

- **profiles**: SELECT/UPDATE/INSERT proprio usuario (`auth.uid() = id`). Sem DELETE.
- **organizations**: SELECT por criador ou membro (`is_org_member`). INSERT por criador. UPDATE por owner/admin (`has_org_role`). DELETE por owner.
- **organization_members**: SELECT por membros (`is_org_member`). INSERT proprio ou admin. UPDATE por owner/admin. DELETE proprio ou owner.
- **chart_of_accounts**: SELECT por dono ou membro org. INSERT por dono + membro org. UPDATE por dono ou owner/admin/member. DELETE por dono ou owner/admin. UNIQUE(organization_id, code).
- **cost_centers**: mesma estrutura do chart_of_accounts. UNIQUE(organization_id, code).
- **contracts**: mesma estrutura do chart_of_accounts (SELECT/INSERT/UPDATE/DELETE com mesmas regras de role).
- **audit_log**: INSERT proprio usuario. SELECT proprio ou membro org. Sem UPDATE/DELETE.
- **plan_migrations**: SELECT proprio ou membro org. INSERT/UPDATE/DELETE proprio usuario.

Funcoes auxiliares de seguranca documentadas:
- `is_org_member(p_user_id, p_org_id)` - verifica membership
- `has_org_role(p_user_id, p_org_id, p_roles[])` - verifica role especifica
- `get_user_org_ids(p_user_id)` - retorna org_ids do usuario

**3. Modulos implementados** (resumo de uma linha por modulo)

**4. Especificacao do Modulo de Contratos** (escopo completo com secoes 3.1 a 3.8)

---

## Detalhes tecnicos

- Arquivo: `.lovable/plan.md`
- Acao: reescrever conteudo completo
- Nenhuma alteracao em codigo ou banco de dados

