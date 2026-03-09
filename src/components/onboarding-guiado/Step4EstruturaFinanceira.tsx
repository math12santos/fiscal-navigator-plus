import { useState, useEffect, useMemo } from "react";
import { useChartOfAccounts, type ChartAccount } from "@/hooks/useChartOfAccounts";
import { useCostCenters, type CostCenter } from "@/hooks/useCostCenters";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, FolderTree, Plus, Sparkles, Loader2, ChevronRight,
} from "lucide-react";
import { StepHeader } from "./StepHeader";
import { toast } from "@/hooks/use-toast";

interface Props {
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
}

/* ── Plano de Contas: tree agrupado ── */
function AccountTree({ accounts }: { accounts: ChartAccount[] }) {
  const grouped = useMemo(() => {
    const l1 = accounts.filter((a) => a.level === 1).sort((a, b) => a.code.localeCompare(b.code));
    return l1.map((parent) => ({
      ...parent,
      children: accounts
        .filter((a) => a.level === 2 && a.parent_id === parent.id)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((l2) => ({
          ...l2,
          children: accounts
            .filter((a) => a.level === 3 && a.parent_id === l2.id)
            .sort((a, b) => a.code.localeCompare(b.code)),
        })),
    }));
  }, [accounts]);

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Nenhuma conta cadastrada.</p>;
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
      {grouped.map((g) => (
        <details key={g.id} className="group">
          <summary className="flex items-center gap-1 cursor-pointer py-1 font-medium text-foreground hover:text-primary">
            <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
            <span className="text-muted-foreground">{g.code}</span> {g.name}
          </summary>
          <div className="ml-5 border-l border-border pl-3">
            {g.children.map((l2) => (
              <details key={l2.id} className="group/l2">
                <summary className="flex items-center gap-1 cursor-pointer py-0.5 hover:text-primary">
                  <ChevronRight size={12} className="transition-transform group-open/l2:rotate-90" />
                  <span className="text-muted-foreground">{l2.code}</span> {l2.name}
                </summary>
                <div className="ml-4 border-l border-border pl-3">
                  {l2.children.map((l3) => (
                    <div key={l3.id} className="py-0.5 text-muted-foreground">
                      <span>{l3.code}</span> — {l3.name}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/* ── Lista de Centros de Custo ── */
function CostCenterList({ centers }: { centers: CostCenter[] }) {
  if (centers.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Nenhum centro de custo cadastrado.</p>;
  }
  const parents = centers.filter((c) => !c.parent_id).sort((a, b) => a.code.localeCompare(b.code));
  return (
    <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
      {parents.map((p) => {
        const children = centers.filter((c) => c.parent_id === p.id).sort((a, b) => a.code.localeCompare(b.code));
        return (
          <details key={p.id} className="group">
            <summary className="flex items-center gap-1 cursor-pointer py-1 font-medium text-foreground hover:text-primary">
              <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
              <span className="text-muted-foreground">{p.code}</span> {p.name}
            </summary>
            {children.length > 0 && (
              <div className="ml-5 border-l border-border pl-3">
                {children.map((c) => (
                  <div key={c.id} className="py-0.5 text-muted-foreground">
                    {c.code} — {c.name}
                  </div>
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export function Step4EstruturaFinanceira({ data, onChange }: Props) {
  const { accounts, isLoading: loadingAccounts, create: createAccount, seedDefaultAccounts } = useChartOfAccounts();
  const { costCenters, isLoading: loadingCenters, create: createCenter, seedDefaultCenters } = useCostCenters();

  const [seeding, setSeeding] = useState<"accounts" | "centers" | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCenterForm, setShowCenterForm] = useState(false);

  // Account form state
  const [accCode, setAccCode] = useState("");
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("despesa");
  const [accParent, setAccParent] = useState<string>("");

  // Center form state
  const [ccCode, setCcCode] = useState("");
  const [ccName, setCcName] = useState("");

  // Sync progress
  useEffect(() => {
    const newData = {
      accounts_count: accounts.length,
      cost_centers_count: costCenters.length,
    };
    if (newData.accounts_count !== data.accounts_count || newData.cost_centers_count !== data.cost_centers_count) {
      onChange(newData);
    }
  }, [accounts.length, costCenters.length]);

  const handleSeedAccounts = async () => {
    setSeeding("accounts");
    try {
      await seedDefaultAccounts();
    } catch (e: any) {
      toast({ title: "Erro ao criar plano padrão", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(null);
    }
  };

  const handleSeedCenters = async () => {
    setSeeding("centers");
    try {
      await seedDefaultCenters();
    } catch (e: any) {
      toast({ title: "Erro ao criar centros padrão", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(null);
    }
  };

  const handleAddAccount = () => {
    if (!accCode || !accName) return;
    const parentAccount = accParent ? accounts.find((a) => a.id === accParent) : null;
    const level = parentAccount ? parentAccount.level + 1 : 1;
    createAccount.mutate({
      code: accCode,
      name: accName,
      type: accType,
      nature: accType === "receita" ? "entrada" : accType === "transferencia" ? "neutro" : "saida",
      accounting_class: accType === "investimento" ? "ativo" : "resultado",
      level,
      parent_id: accParent || null,
      is_synthetic: false,
      is_system_default: false,
      active: true,
      description: null,
      tags: null,
    });
    setAccCode("");
    setAccName("");
    setShowAccountForm(false);
  };

  const handleAddCenter = () => {
    if (!ccCode || !ccName) return;
    createCenter.mutate({
      code: ccCode,
      name: ccName,
      parent_id: null,
      business_unit: null,
      responsible: null,
      description: null,
      active: true,
    });
    setCcCode("");
    setCcName("");
    setShowCenterForm(false);
  };

  const syntheticParents = accounts.filter((a) => a.is_synthetic);

  if (loadingAccounts || loadingCenters) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <StepHeader
          stepNumber={4}
          fallbackTitle="Estrutura Financeira"
          fallbackDescription="Configure o plano de contas e centros de custo da organização"
          fallbackIcon={BookOpen}
        />

        <Accordion type="single" collapsible defaultValue="accounts" className="space-y-2">
          {/* ── Plano de Contas ── */}
          <AccordionItem value="accounts" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-primary" />
                <span className="font-medium">Plano de Contas</span>
                <Badge variant="secondary">{accounts.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <AccountTree accounts={accounts} />

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {accounts.length === 0 && (
                  <Button size="sm" onClick={handleSeedAccounts} disabled={seeding === "accounts"}>
                    {seeding === "accounts" ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />}
                    Criar Plano Padrão
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowAccountForm(!showAccountForm)}>
                  <Plus size={14} className="mr-1" /> Adicionar Conta
                </Button>
              </div>

              {showAccountForm && (
                <div className="grid grid-cols-2 gap-2 mt-3 p-3 border rounded-lg bg-muted/30">
                  <Input placeholder="Código (ex: 3.1.07)" value={accCode} onChange={(e) => setAccCode(e.target.value)} />
                  <Input placeholder="Nome da conta" value={accName} onChange={(e) => setAccName(e.target.value)} />
                  <Select value={accType} onValueChange={setAccType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="custo">Custo</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={accParent} onValueChange={setAccParent}>
                    <SelectTrigger><SelectValue placeholder="Conta pai (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma (nível 1)</SelectItem>
                      {syntheticParents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="col-span-2 flex justify-end">
                    <Button size="sm" onClick={handleAddAccount} disabled={createAccount.isPending}>
                      {createAccount.isPending ? <Loader2 className="animate-spin" size={14} /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── Centros de Custo ── */}
          <AccordionItem value="centers" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <FolderTree size={18} className="text-primary" />
                <span className="font-medium">Centros de Custo</span>
                <Badge variant="secondary">{costCenters.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CostCenterList centers={costCenters} />

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {costCenters.length === 0 && (
                  <Button size="sm" onClick={handleSeedCenters} disabled={seeding === "centers"}>
                    {seeding === "centers" ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />}
                    Criar Centros Padrão
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowCenterForm(!showCenterForm)}>
                  <Plus size={14} className="mr-1" /> Adicionar Centro
                </Button>
              </div>

              {showCenterForm && (
                <div className="grid grid-cols-2 gap-2 mt-3 p-3 border rounded-lg bg-muted/30">
                  <Input placeholder="Código (ex: CC-07)" value={ccCode} onChange={(e) => setCcCode(e.target.value)} />
                  <Input placeholder="Nome do centro" value={ccName} onChange={(e) => setCcName(e.target.value)} />
                  <div className="col-span-2 flex justify-end">
                    <Button size="sm" onClick={handleAddCenter} disabled={createCenter.isPending}>
                      {createCenter.isPending ? <Loader2 className="animate-spin" size={14} /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
