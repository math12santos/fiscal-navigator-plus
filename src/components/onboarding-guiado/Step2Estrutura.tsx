import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization, Organization } from "@/contexts/OrganizationContext";
import { useHolding } from "@/contexts/HoldingContext";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Users,
  LayoutGrid,
  Plus,
  Loader2,
  CheckCircle2,
  Crown,
  Info,
} from "lucide-react";

interface Step2EstruturaProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const ROLES = [
  { value: "owner", label: "Admin da Empresa" },
  { value: "admin", label: "CFO / Gestor Financeiro" },
  { value: "member", label: "Analista Financeiro" },
  { value: "viewer", label: "Visualizador" },
];

const AREA_SUGGESTIONS = [
  "Financeiro",
  "Comercial",
  "Operações",
  "RH",
  "TI",
  "Administrativo",
];

export function Step2Estrutura({ data, onChange }: Step2EstruturaProps) {
  const { user } = useAuth();
  const { currentOrg, refetch: refetchOrgs } = useOrganization();
  const { costCenters, isLoading: centersLoading, create: createCenter } = useCostCenters();
  const { toast } = useToast();
  const qc = useQueryClient();

  // === State: Companies ===
  const [subsidiaries, setSubsidiaries] = useState<Organization[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyDocType, setCompanyDocType] = useState("CNPJ");
  const [companyDocNumber, setCompanyDocNumber] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // === State: Users ===
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userCargo, setUserCargo] = useState("");
  const [userRole, setUserRole] = useState("member");
  const [savingUser, setSavingUser] = useState(false);

  // === State: Areas ===
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [savingAreaName, setSavingAreaName] = useState<string | null>(null);

  const orgId = currentOrg?.id;

  // === Fetch subsidiaries ===
  const fetchSubsidiaries = useCallback(async () => {
    if (!orgId) return;
    setLoadingSubs(true);
    try {
      const { data: holdings } = await supabase
        .from("organization_holdings" as any)
        .select("subsidiary_id")
        .eq("holding_id", orgId);

      const subIds = (holdings as any[] || []).map((h: any) => h.subsidiary_id);
      if (subIds.length > 0) {
        const { data: orgs } = await supabase
          .from("organizations" as any)
          .select("*")
          .in("id", subIds)
          .order("name");
        setSubsidiaries((orgs as unknown as Organization[]) || []);
      } else {
        setSubsidiaries([]);
      }
    } catch (err) {
      console.error("Error fetching subsidiaries:", err);
    } finally {
      setLoadingSubs(false);
    }
  }, [orgId]);

  // === Fetch members ===
  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoadingMembers(true);
    try {
      const { data: mems } = await supabase
        .from("organization_members" as any)
        .select("id, user_id, role, profiles:user_id(full_name, email, cargo)")
        .eq("organization_id", orgId);

      setMembers(
        (mems as any[] || []).map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          full_name: m.profiles?.full_name || "",
          email: m.profiles?.email || "",
          cargo: m.profiles?.cargo || "",
        }))
      );
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSubsidiaries();
    fetchMembers();
  }, [fetchSubsidiaries, fetchMembers]);

  // === Sync structure_data on changes ===
  useEffect(() => {
    const newData = {
      companies_count: 1 + subsidiaries.length,
      members_count: members.length,
      areas_count: costCenters.length,
    };
    if (
      newData.companies_count !== data.companies_count ||
      newData.members_count !== data.members_count ||
      newData.areas_count !== data.areas_count
    ) {
      onChange(newData);
    }
  }, [subsidiaries.length, members.length, costCenters.length]);

  // === Handlers: Company ===
  const handleCreateCompany = async () => {
    if (!companyName.trim() || !companyDocNumber.trim() || !user || !orgId) return;
    setSavingCompany(true);
    try {
      const { data: newOrg, error: orgErr } = await supabase
        .from("organizations" as any)
        .insert({
          name: companyName.trim(),
          document_type: companyDocType,
          document_number: companyDocNumber.trim(),
          created_by: user.id,
        } as any)
        .select()
        .single();
      if (orgErr) throw orgErr;
      const org = newOrg as unknown as Organization;

      await supabase.from("organization_members" as any).insert({
        organization_id: org.id,
        user_id: user.id,
        role: "owner",
      } as any);

      await supabase.from("organization_holdings" as any).insert({
        holding_id: orgId,
        subsidiary_id: org.id,
        created_by: user.id,
      } as any);

      toast({ title: "Empresa criada e vinculada ao grupo" });
      setCompanyName("");
      setCompanyDocNumber("");
      setCompanyDocType("CNPJ");
      setShowCompanyForm(false);
      await fetchSubsidiaries();
      refetchOrgs();
    } catch (err: any) {
      toast({ title: "Erro ao criar empresa", description: err.message, variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  // === Handlers: User (auto-generated temp password) ===
  const handleCreateUser = async () => {
    if (!userEmail.trim() || !orgId) return;
    setSavingUser(true);
    try {
      // Generate a temporary password — user will be forced to change on first login
      const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: userEmail.trim(),
          password: tempPassword,
          full_name: userName.trim(),
          cargo: userCargo.trim(),
          organization_ids: [{ id: orgId, role: userRole }],
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: "Usuário convidado com sucesso!",
        description: `${userName.trim() || userEmail.trim()} receberá acesso ao primeiro login.`,
      });
      setUserName("");
      setUserEmail("");
      setUserCargo("");
      setUserRole("member");
      setShowUserForm(false);
      await fetchMembers();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally {
      setSavingUser(false);
    }
  };

  // === Handlers: Area (granular loading per area name) ===
  const handleCreateArea = async (name: string) => {
    if (!name.trim() || !user || !orgId) return;
    setSavingAreaName(name);
    try {
      const areaNums = costCenters
        .map((c) => c.code)
        .filter((c) => c.startsWith("AREA-"))
        .map((c) => parseInt(c.replace("AREA-", ""), 10))
        .filter((n) => !isNaN(n));
      const nextNum = areaNums.length > 0 ? Math.max(...areaNums) + 1 : 1;
      const code = `AREA-${String(nextNum).padStart(2, "0")}`;

      await createCenter.mutateAsync({
        code,
        name: name.trim(),
        active: true,
        parent_id: null,
        business_unit: null,
        responsible: null,
        description: `Área organizacional criada no onboarding`,
      });

      toast({ title: `Área "${name}" criada como Centro de Custo` });
      setAreaName("");
      setShowAreaForm(false);
    } catch (err: any) {
      toast({ title: "Erro ao criar área", description: err.message, variant: "destructive" });
    } finally {
      setSavingAreaName(null);
    }
  };

  const existingAreaNames = costCenters.map((c) => c.name.toLowerCase());
  const availableSuggestions = AREA_SUGGESTIONS.filter(
    (s) => !existingAreaNames.includes(s.toLowerCase())
  );

  const roleLabelMap: Record<string, string> = {};
  ROLES.forEach((r) => (roleLabelMap[r.value] = r.label));

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">Estrutura da Empresa</h2>
        <p className="text-muted-foreground mt-1">
          Configure a estrutura organizacional do grupo: empresas, usuários e áreas.
        </p>
      </div>

      <Accordion type="multiple" defaultValue={["companies", "users", "areas"]} className="space-y-3">
        {/* =================== SECTION 1: COMPANIES =================== */}
        <AccordionItem value="companies" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Building2 size={20} className="text-primary" />
              <span className="font-semibold text-foreground">Empresas do Grupo</span>
              <Badge variant="secondary" className="ml-1">
                {1 + subsidiaries.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Crown size={14} className="text-primary" />
                      {currentOrg?.name}
                    </div>
                  </TableCell>
                  <TableCell>{currentOrg?.document_number}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Holding</Badge>
                  </TableCell>
                </TableRow>
                {loadingSubs ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : (
                  subsidiaries.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.name}</TableCell>
                      <TableCell>{sub.document_number}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Subsidiária</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {showCompanyForm ? (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Nome da Empresa *</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa Filial Ltda" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo Documento</Label>
                    <Select value={companyDocType} onValueChange={setCompanyDocType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="CPF">CPF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número do Documento *</Label>
                    <Input value={companyDocNumber} onChange={(e) => setCompanyDocNumber(e.target.value)} placeholder="00.000.000/0001-00" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowCompanyForm(false)} disabled={savingCompany}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleCreateCompany} disabled={savingCompany || !companyName.trim() || !companyDocNumber.trim()}>
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                    Criar Empresa
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCompanyForm(true)}>
                <Plus size={14} className="mr-1" /> Adicionar Empresa
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* =================== SECTION 2: USERS =================== */}
        <AccordionItem value="users" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-primary" />
              <span className="font-semibold text-foreground">Usuários Principais</span>
              <Badge variant="secondary" className="ml-1">{members.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Papel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMembers ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {m.user_id === user?.id && <Crown size={14} className="text-primary" />}
                          {m.full_name || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.email || "—"}</TableCell>
                      <TableCell>{m.cargo || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{roleLabelMap[m.role] || m.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {showUserForm ? (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome Completo</Label>
                    <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Maria Silva" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cargo</Label>
                    <Input value={userCargo} onChange={(e) => setUserCargo(e.target.value)} placeholder="Controller" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="usuario@empresa.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Papel</Label>
                    <Select value={userRole} onValueChange={setUserRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <Info size={14} className="shrink-0" />
                  <span>O usuário definirá sua própria senha no primeiro acesso ao sistema.</span>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowUserForm(false)} disabled={savingUser}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleCreateUser} disabled={savingUser || !userEmail.trim()}>
                    {savingUser ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                    Convidar Usuário
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowUserForm(true)}>
                <Plus size={14} className="mr-1" /> Convidar Usuário
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* =================== SECTION 3: AREAS =================== */}
        <AccordionItem value="areas" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <LayoutGrid size={20} className="text-primary" />
              <span className="font-semibold text-foreground">Áreas Organizacionais</span>
              <Badge variant="secondary" className="ml-1">{costCenters.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            {centersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : costCenters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {costCenters.map((cc) => (
                  <Badge key={cc.id} variant="secondary" className="text-sm py-1 px-3">
                    <CheckCircle2 size={12} className="mr-1 text-primary" />
                    {cc.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma área cadastrada ainda.</p>
            )}

            {/* Quick suggestions */}
            {availableSuggestions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Sugestões rápidas
                </Label>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={savingAreaName === s}
                      onClick={() => handleCreateArea(s)}
                    >
                      {savingAreaName === s ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Plus size={12} className="mr-1" />
                      )}
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              <Info size={14} className="shrink-0" />
              <span>Cada área organizacional será criada como um Centro de Custo com DRE Gerencial própria.</span>
            </div>

            {showAreaForm ? (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Nome da Área</Label>
                  <Input
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    placeholder="Ex: Logística"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && areaName.trim()) handleCreateArea(areaName);
                    }}
                  />
                </div>
                <Button size="sm" onClick={() => handleCreateArea(areaName)} disabled={!!savingAreaName || !areaName.trim()}>
                  {savingAreaName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAreaForm(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowAreaForm(true)}>
                <Plus size={14} className="mr-1" /> Adicionar Área
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
