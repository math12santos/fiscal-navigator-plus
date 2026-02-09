import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Power, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import AccountTreeView from "@/components/AccountTreeView";
import ChartOfAccountsFormDialog from "@/components/ChartOfAccountsFormDialog";
import CostCenterFormDialog from "@/components/CostCenterFormDialog";
import SeedPlanDialog from "@/components/SeedPlanDialog";
import TransferWizard from "@/components/TransferWizard";
import { useChartOfAccounts, ChartAccount } from "@/hooks/useChartOfAccounts";
import { useCostCenters, CostCenter } from "@/hooks/useCostCenters";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useToast } from "@/hooks/use-toast";

const ACCOUNT_TYPES = [
  { value: "__all__", label: "Todos os tipos" },
  { value: "receita", label: "Receita" },
  { value: "custo", label: "Custo" },
  { value: "despesa", label: "Despesa" },
  { value: "investimento", label: "Investimento" },
  { value: "transferencia", label: "Transferência" },
];

export default function Configuracoes() {
  const { accounts, isLoading: loadingAccounts, create: createAccount, update: updateAccount, toggleActive: toggleAccountActive, deleteAll: deleteAllAccounts, seedDefaultAccounts } = useChartOfAccounts();
  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("__all__");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);

  const { costCenters, isLoading: loadingCenters, create: createCenter, update: updateCenter, toggleActive: toggleCenterActive, deleteAll: deleteAllCenters, seedDefaultCenters } = useCostCenters();
  const [centerSearch, setCenterSearch] = useState("");
  const [centerUnitFilter, setCenterUnitFilter] = useState("__all__");
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);

  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [transferWizardOpen, setTransferWizardOpen] = useState(false);
  const { log } = useAuditLog();
  const { toast } = useToast();

  const handleSeedFresh = async () => {
    if (accounts.length === 0) await seedDefaultAccounts();
    if (costCenters.length === 0) await seedDefaultCenters();
  };

  const handleReplace = async () => {
    await deleteAllAccounts();
    await deleteAllCenters();
    await seedDefaultAccounts();
    await seedDefaultCenters();
    log({ entity_type: "chart_of_accounts", entity_id: "all", action: "INSERT", new_data: { action: "REPLACE_DEFAULT_PLAN" } });
    toast({ title: "Plano padrão gerado com sucesso" });
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((a) => {
    const matchSearch = !accountSearch || a.name.toLowerCase().includes(accountSearch.toLowerCase()) || a.code.toLowerCase().includes(accountSearch.toLowerCase());
    const matchType = accountTypeFilter === "__all__" || a.type === accountTypeFilter;
    return matchSearch && matchType;
  });

  // Filter cost centers
  const businessUnits = [...new Set(costCenters.map((cc) => cc.business_unit).filter(Boolean))] as string[];
  const filteredCenters = costCenters.filter((cc) => {
    const matchSearch = !centerSearch || cc.name.toLowerCase().includes(centerSearch.toLowerCase()) || cc.code.toLowerCase().includes(centerSearch.toLowerCase());
    const matchUnit = centerUnitFilter === "__all__" || cc.business_unit === centerUnitFilter;
    return matchSearch && matchUnit;
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title="Configurações" description="Plano de Contas e Centros de Custo" />
        <Button
          variant="outline"
          className="ml-auto"
          onClick={() => setSeedDialogOpen(true)}
        >
          <Wand2 size={16} /> Gerar Plano Padrão
        </Button>
      </div>

      <SeedPlanDialog
        open={seedDialogOpen}
        onOpenChange={setSeedDialogOpen}
        accountsCount={accounts.length}
        costCentersCount={costCenters.length}
        onSeedFresh={handleSeedFresh}
        onReplace={handleReplace}
        onStartTransfer={() => setTransferWizardOpen(true)}
      />

      <TransferWizard
        open={transferWizardOpen}
        onOpenChange={setTransferWizardOpen}
        onComplete={() => {
          // Future: refresh data after transfer
        }}
      />

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Plano de Contas</TabsTrigger>
          <TabsTrigger value="cost-centers">Centros de Custo</TabsTrigger>
        </TabsList>

        {/* ===== PLANO DE CONTAS ===== */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou código..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingAccount(null); setAccountDialogOpen(true); }}>
              <Plus size={16} /> Nova Conta
            </Button>
          </div>

          <div className="glass-card p-4">
            {loadingAccounts ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <AccountTreeView
                accounts={filteredAccounts}
                onEdit={(a) => { setEditingAccount(a); setAccountDialogOpen(true); }}
                onToggleActive={(id, active) => toggleAccountActive.mutate({ id, active })}
              />
            )}
          </div>

          <ChartOfAccountsFormDialog
            open={accountDialogOpen}
            onOpenChange={setAccountDialogOpen}
            account={editingAccount}
            accounts={accounts}
            onSubmit={(data) => {
              if (editingAccount) {
                updateAccount.mutate(data, { onSuccess: () => setAccountDialogOpen(false) });
              } else {
                createAccount.mutate(data, { onSuccess: () => setAccountDialogOpen(false) });
              }
            }}
            isLoading={createAccount.isPending || updateAccount.isPending}
          />
        </TabsContent>

        {/* ===== CENTROS DE CUSTO ===== */}
        <TabsContent value="cost-centers" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou código..."
                value={centerSearch}
                onChange={(e) => setCenterSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={centerUnitFilter} onValueChange={setCenterUnitFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Unidade de negócio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as unidades</SelectItem>
                {businessUnits.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingCenter(null); setCenterDialogOpen(true); }}>
              <Plus size={16} /> Novo Centro
            </Button>
          </div>

          <div className="glass-card overflow-hidden">
            {loadingCenters ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredCenters.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum centro de custo cadastrado. Clique em "Novo Centro" para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCenters.map((cc) => (
                    <TableRow key={cc.id} className={!cc.active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{cc.code}</TableCell>
                      <TableCell className="font-medium">{cc.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cc.business_unit ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{cc.responsible ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={cc.active ? "default" : "secondary"}>
                          {cc.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingCenter(cc); setCenterDialogOpen(true); }}
                          >
                            <Edit2 size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleCenterActive.mutate({ id: cc.id, active: !cc.active })}
                          >
                            <Power size={13} className={cc.active ? "text-success" : "text-destructive"} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <CostCenterFormDialog
            open={centerDialogOpen}
            onOpenChange={setCenterDialogOpen}
            costCenter={editingCenter}
            costCenters={costCenters}
            onSubmit={(data) => {
              if (editingCenter) {
                updateCenter.mutate(data, { onSuccess: () => setCenterDialogOpen(false) });
              } else {
                createCenter.mutate(data, { onSuccess: () => setCenterDialogOpen(false) });
              }
            }}
            isLoading={createCenter.isPending || updateCenter.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
