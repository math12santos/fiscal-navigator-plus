import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CostCenterFormPayload } from "@/components/CostCenterFormDialog";
import { useCostCenterPermissions } from "@/hooks/useCostCenterPermissions";
import { useOrgModules } from "@/hooks/useOrgModules";
import { MODULE_DEFINITIONS } from "@/data/moduleDefinitions";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Power, Wand2, Users, ShoppingBag, Layers, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import AccountTreeView from "@/components/AccountTreeView";
import ChartOfAccountsFormDialog from "@/components/ChartOfAccountsFormDialog";
import CostCenterFormDialog from "@/components/CostCenterFormDialog";
import EntityFormDialog from "@/components/EntityFormDialog";
import ProductFormDialog from "@/components/ProductFormDialog";
import SeedPlanDialog from "@/components/SeedPlanDialog";
import TransferWizard from "@/components/TransferWizard";
import { useChartOfAccounts, ChartAccount } from "@/hooks/useChartOfAccounts";
import { useCostCenters, CostCenter } from "@/hooks/useCostCenters";
import { useEntities, Entity } from "@/hooks/useEntities";
import { useProducts, Product } from "@/hooks/useProducts";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useToast } from "@/hooks/use-toast";
import { useGroupingRules, type GroupingRule, type GroupingRuleInput, MATCH_FIELD_OPTIONS, OPERATOR_OPTIONS } from "@/hooks/useGroupingRules";
import { useGroupingMacrogroups } from "@/hooks/useGroupingMacrogroups";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import GroupingRuleDialog from "@/components/financeiro/GroupingRuleDialog";
import GroupingMacrogroupManager from "@/components/financeiro/GroupingMacrogroupManager";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALL_TABS = [
  { key: "accounts", label: "Plano de Contas" },
  { key: "cost-centers", label: "Centros de Custo" },
  { key: "entities", label: "Fornecedores / Clientes" },
  { key: "products", label: "Produtos / Serviços" },
  { key: "grouping", label: "Aglutinação" },
];

const ACCOUNT_TYPES = [
  { value: "__all__", label: "Todos os tipos" },
  { value: "receita", label: "Receita" },
  { value: "custo", label: "Custo" },
  { value: "despesa", label: "Despesa" },
  { value: "investimento", label: "Investimento" },
  { value: "transferencia", label: "Transferência" },
];

const ENTITY_TYPES = [
  { value: "__all__", label: "Todos" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "cliente", label: "Cliente" },
  { value: "ambos", label: "Ambos" },
];

const PRODUCT_TYPES = [
  { value: "__all__", label: "Todos" },
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
];

export default function Configuracoes() {
  const { getAllowedTabs } = useUserPermissions();
  const allowedTabs = getAllowedTabs("configuracoes", ALL_TABS);

  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  // Fetch org members for responsible selector
  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org_members_for_cc", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members" as any)
        .select("user_id, role, profiles:user_id(full_name, cargo)")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data as any[]).map((m) => ({
        id: m.user_id,
        full_name: m.profiles?.full_name ?? "",
        cargo: m.profiles?.cargo ?? m.role ?? "",
      }));
    },
    enabled: !!orgId,
  });

  // Org modules for CC permissions
  const { isModuleEnabled, enabledModuleKeys } = useOrgModules();
  const filteredOrgModules = useMemo(
    () => MODULE_DEFINITIONS.filter((m) => isModuleEnabled(m.key)),
    [enabledModuleKeys]
  );

  // Plano de Contas
  const { accounts, isLoading: loadingAccounts, create: createAccount, update: updateAccount, toggleActive: toggleAccountActive, deleteAll: deleteAllAccounts, seedDefaultAccounts } = useChartOfAccounts();
  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("__all__");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);

  // Centros de Custo
  const { costCenters, isLoading: loadingCenters, create: createCenter, update: updateCenter, toggleActive: toggleCenterActive, deleteAll: deleteAllCenters, seedDefaultCenters } = useCostCenters();
  const [centerSearch, setCenterSearch] = useState("");
  const [centerUnitFilter, setCenterUnitFilter] = useState("__all__");
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

  // CC permissions for editing
  const { permissions: editingCCPermissions } = useCostCenterPermissions(editingCenter?.id);

  // Entidades (Fornecedores/Clientes)
  const { entities, isLoading: loadingEntities, create: createEntity, update: updateEntity, toggleActive: toggleEntityActive } = useEntities();
  const [entitySearch, setEntitySearch] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("__all__");
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  // Produtos/Serviços
  const { products, isLoading: loadingProducts, create: createProduct, update: updateProduct, toggleActive: toggleProductActive } = useProducts();
  const [productSearch, setProductSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("__all__");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [transferWizardOpen, setTransferWizardOpen] = useState(false);
  const { log } = useAuditLog();
  const { toast } = useToast();

  // Grouping Rules
  const { rules: groupingRules, isLoading: loadingGroupingRules, create: createGroupingRule, update: updateGroupingRule, remove: removeGroupingRule, toggleEnabled: toggleGroupingRule, seedDefaults: seedGroupingDefaults } = useGroupingRules();
  const { groupOptions } = useGroupingMacrogroups();
  const [groupingDialogOpen, setGroupingDialogOpen] = useState(false);
  const [editingGroupingRule, setEditingGroupingRule] = useState<GroupingRule | null>(null);

  // Dynamic options for rule dialog
  const { entries: saidaEntries } = useFinanceiro("saida");
  const { entries: entradaEntries } = useFinanceiro("entrada");

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    [...saidaEntries, ...entradaEntries].forEach((e) => {
      if (e.categoria) cats.add(e.categoria);
    });
    return Array.from(cats).sort().map((c) => ({ value: c, label: c }));
  }, [saidaEntries, entradaEntries]);

  const entityOptions = useMemo(() => {
    return entities.filter((e) => e.active).map((e) => ({ value: e.id, label: e.name }));
  }, [entities]);

  const costCenterOpts = useMemo(() => {
    return costCenters.filter((c) => c.active).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  }, [costCenters]);

  const handleSeedFresh = async () => {
    await deleteAllAccounts();
    await deleteAllCenters();
    await seedDefaultAccounts();
    await seedDefaultCenters();
  };

  const handleReplace = async () => {
    await deleteAllAccounts();
    await deleteAllCenters();
    await seedDefaultAccounts();
    await seedDefaultCenters();
    log({ entity_type: "chart_of_accounts", entity_id: "all", action: "INSERT", new_data: { action: "REPLACE_DEFAULT_PLAN" } });
    toast({ title: "Plano padrão gerado com sucesso" });
  };

  // Filters
  const filteredAccounts = accounts.filter((a) => {
    const matchSearch = !accountSearch || a.name.toLowerCase().includes(accountSearch.toLowerCase()) || a.code.toLowerCase().includes(accountSearch.toLowerCase());
    const matchType = accountTypeFilter === "__all__" || a.type === accountTypeFilter;
    return matchSearch && matchType;
  });

  const businessUnits = [...new Set(costCenters.map((cc) => cc.business_unit).filter(Boolean))] as string[];
  const filteredCenters = costCenters.filter((cc) => {
    const matchSearch = !centerSearch || cc.name.toLowerCase().includes(centerSearch.toLowerCase()) || cc.code.toLowerCase().includes(centerSearch.toLowerCase());
    const matchUnit = centerUnitFilter === "__all__" || cc.business_unit === centerUnitFilter;
    return matchSearch && matchUnit;
  });

  const filteredEntities = entities.filter((e) => {
    const matchSearch = !entitySearch || e.name.toLowerCase().includes(entitySearch.toLowerCase()) || (e.document_number || "").includes(entitySearch);
    const matchType = entityTypeFilter === "__all__" || e.type === entityTypeFilter;
    return matchSearch && matchType;
  });

  const filteredProducts = products.filter((p) => {
    const matchSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase());
    const matchType = productTypeFilter === "__all__" || p.type === productTypeFilter;
    return matchSearch && matchType;
  });

  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title="Configurações" description="Plano de Contas, Centros de Custo, Cadastros e Produtos" showHoldingToggle={false} />
        <Button variant="outline" className="ml-auto" onClick={() => setSeedDialogOpen(true)}>
          <Wand2 size={16} /> Gerar Plano Padrão
        </Button>
      </div>

      <SeedPlanDialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen} accountsCount={accounts.length} costCentersCount={costCenters.length} onSeedFresh={handleSeedFresh} onReplace={handleReplace} onStartTransfer={() => setTransferWizardOpen(true)} />
      <TransferWizard open={transferWizardOpen} onOpenChange={setTransferWizardOpen} onComplete={() => {}} />

      <Tabs defaultValue={allowedTabs[0]?.key || "accounts"} className="space-y-4">
        <TabsList>
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ===== PLANO DE CONTAS ===== */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar por nome ou código..." value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => { setEditingAccount(null); setAccountDialogOpen(true); }}><Plus size={16} /> Nova Conta</Button>
          </div>
          <div className="glass-card p-4">
            {loadingAccounts ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : (
              <AccountTreeView accounts={filteredAccounts} onEdit={(a) => { setEditingAccount(a); setAccountDialogOpen(true); }} onToggleActive={(id, active) => toggleAccountActive.mutate({ id, active })} />
            )}
          </div>
          <ChartOfAccountsFormDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} account={editingAccount} accounts={accounts} onSubmit={(data) => { if (editingAccount) { updateAccount.mutate(data, { onSuccess: () => setAccountDialogOpen(false) }); } else { createAccount.mutate(data, { onSuccess: () => setAccountDialogOpen(false) }); } }} isLoading={createAccount.isPending || updateAccount.isPending} />
        </TabsContent>

        {/* ===== CENTROS DE CUSTO ===== */}
        <TabsContent value="cost-centers" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar por nome ou código..." value={centerSearch} onChange={(e) => setCenterSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={centerUnitFilter} onValueChange={setCenterUnitFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Unidade de negócio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as unidades</SelectItem>
                {businessUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingCenter(null); setCenterDialogOpen(true); }}><Plus size={16} /> Novo Centro</Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingCenters ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : filteredCenters.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum centro de custo cadastrado. Clique em "Novo Centro" para começar.</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Unidade</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredCenters.map((cc) => (
                    <TableRow key={cc.id} className={!cc.active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{cc.code}</TableCell>
                      <TableCell className="font-medium">{cc.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cc.business_unit ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{cc.responsible_name ?? "—"}</TableCell>
                      <TableCell><Badge variant={cc.active ? "default" : "secondary"}>{cc.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCenter(cc); setCenterDialogOpen(true); }}><Edit2 size={13} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleCenterActive.mutate({ id: cc.id, active: !cc.active })}><Power size={13} className={cc.active ? "text-success" : "text-destructive"} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <CostCenterFormDialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen} costCenter={editingCenter} costCenters={costCenters} orgMembers={orgMembers} orgModules={filteredOrgModules} existingPermissions={editingCCPermissions} onSubmit={(data: CostCenterFormPayload) => { if (editingCenter && data.id) { updateCenter.mutate(data as any, { onSuccess: () => setCenterDialogOpen(false) }); } else { const { id, ...rest } = data; createCenter.mutate(rest as any, { onSuccess: () => setCenterDialogOpen(false) }); } }} isLoading={createCenter.isPending || updateCenter.isPending} />
        </TabsContent>

        {/* ===== FORNECEDORES / CLIENTES ===== */}
        <TabsContent value="entities" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar por nome ou documento..." value={entitySearch} onChange={(e) => setEntitySearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => { setEditingEntity(null); setEntityDialogOpen(true); }}><Plus size={16} /> Novo Cadastro</Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingEntities ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : filteredEntities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor ou cliente cadastrado.</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Documento</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredEntities.map((e) => (
                    <TableRow key={e.id} className={!e.active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{e.type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{e.document_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.phone ?? "—"}</TableCell>
                      <TableCell><Badge variant={e.active ? "default" : "secondary"}>{e.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingEntity(e); setEntityDialogOpen(true); }}><Edit2 size={13} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleEntityActive.mutate({ id: e.id, active: !e.active })}><Power size={13} className={e.active ? "text-success" : "text-destructive"} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <EntityFormDialog open={entityDialogOpen} onOpenChange={setEntityDialogOpen} entity={editingEntity} onSubmit={(data) => { if (editingEntity) { updateEntity.mutate(data, { onSuccess: () => setEntityDialogOpen(false) }); } else { createEntity.mutate(data, { onSuccess: () => setEntityDialogOpen(false) }); } }} isLoading={createEntity.isPending || updateEntity.isPending} />
        </TabsContent>

        {/* ===== PRODUTOS / SERVIÇOS ===== */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar por nome ou código..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}><Plus size={16} /> Novo Produto</Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingProducts ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum produto ou serviço cadastrado.</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Unidade</TableHead><TableHead>Valor Unit.</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.type === "servico" ? "Serviço" : "Produto"}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                      <TableCell>{fmt.format(p.unit_price)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell><Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}><Edit2 size={13} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleProductActive.mutate({ id: p.id, active: !p.active })}><Power size={13} className={p.active ? "text-success" : "text-destructive"} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <ProductFormDialog open={productDialogOpen} onOpenChange={setProductDialogOpen} product={editingProduct} products={products} accounts={accounts} onSubmit={(data) => { if (editingProduct) { updateProduct.mutate(data, { onSuccess: () => setProductDialogOpen(false) }); } else { createProduct.mutate(data, { onSuccess: () => setProductDialogOpen(false) }); } }} isLoading={createProduct.isPending || updateProduct.isPending} />
        </TabsContent>

        {/* ===== AGLUTINAÇÃO ===== */}
        <TabsContent value="grouping" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Regras que definem como lançamentos são agrupados no Aging List e no Financeiro.
            </p>
            <div className="flex items-center gap-2">
              {groupingRules.length === 0 && (
                <Button variant="outline" onClick={() => seedGroupingDefaults.mutate()}>
                  <Wand2 size={16} /> Gerar Padrão
                </Button>
              )}
              <Button onClick={() => { setEditingGroupingRule(null); setGroupingDialogOpen(true); }}>
                <Plus size={16} /> Nova Regra
              </Button>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingGroupingRules ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : groupingRules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p>Nenhuma regra configurada. O sistema usará regras padrão.</p>
                <p className="text-xs">Clique em "Gerar Padrão" para criar as regras iniciais.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Sub-agrupamento</TableHead>
                    <TableHead className="text-center">Mín. Itens</TableHead>
                    <TableHead className="text-center">Prioridade</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupingRules.map((r) => (
                    <TableRow key={r.id} className={!r.enabled ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {MATCH_FIELD_OPTIONS.find((o) => o.value === r.match_field)?.label ?? r.match_field}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.match_value}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.sub_group_field
                          ? SUB_GROUP_FIELD_OPTIONS.find((o) => o.value === r.sub_group_field)?.label ?? r.sub_group_field
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">{r.min_items}</TableCell>
                      <TableCell className="text-center">{r.priority}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={r.enabled}
                          onCheckedChange={(checked) => toggleGroupingRule.mutate({ id: r.id, enabled: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingGroupingRule(r); setGroupingDialogOpen(true); }}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeGroupingRule.mutate(r.id)}>
                            <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <GroupingRuleDialog
            open={groupingDialogOpen}
            onOpenChange={setGroupingDialogOpen}
            rule={editingGroupingRule}
            onSubmit={(data) => {
              if (data.id) {
                updateGroupingRule.mutate(data as any, { onSuccess: () => setGroupingDialogOpen(false) });
              } else {
                createGroupingRule.mutate(data, { onSuccess: () => setGroupingDialogOpen(false) });
              }
            }}
            isLoading={createGroupingRule.isPending || updateGroupingRule.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
