import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect, SearchableOption } from "@/components/ui/searchable-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Shield } from "lucide-react";
import { CostCenter } from "@/hooks/useCostCenters";
import { CostCenterPermission } from "@/hooks/useCostCenterPermissions";
import { ModuleDefinition } from "@/data/moduleDefinitions";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface OrgMember {
  id: string;
  full_name: string;
  cargo: string;
}

interface PermState {
  enabled: boolean;
  tabs: Record<string, { member: boolean; viewer: boolean }>;
}

export interface CostCenterFormPayload {
  id?: string;
  code: string;
  name: string;
  parent_id: string | null;
  business_unit: string | null;
  responsible: string | null;
  description: string | null;
  active: boolean;
  permissions?: { module_key: string; tab_key: string | null; role: string; allowed: boolean }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter: CostCenter | null;
  costCenters: CostCenter[];
  onSubmit: (data: CostCenterFormPayload) => void;
  isLoading?: boolean;
  orgMembers?: OrgMember[];
  orgModules?: ModuleDefinition[];
  existingPermissions?: CostCenterPermission[];
}

const ROLES = [
  { key: "member", label: "Analista" },
  { key: "viewer", label: "Visualizador" },
];

function buildInitialPermState(
  modules: ModuleDefinition[],
  existing: CostCenterPermission[]
): Record<string, PermState> {
  const state: Record<string, PermState> = {};

  for (const mod of modules) {
    const modPerms = existing.filter((p) => p.module_key === mod.key);
    const hasAnyPerm = modPerms.length > 0;

    const tabs: Record<string, { member: boolean; viewer: boolean }> = {};
    if (mod.tabs) {
      for (const tab of mod.tabs) {
        tabs[tab.key] = {
          member: hasAnyPerm
            ? modPerms.some((p) => p.tab_key === tab.key && p.role === "member" && p.allowed)
            : true,
          viewer: hasAnyPerm
            ? modPerms.some((p) => p.tab_key === tab.key && p.role === "viewer" && p.allowed)
            : true,
        };
      }
    }

    state[mod.key] = {
      enabled: hasAnyPerm
        ? modPerms.some((p) => p.allowed)
        : true,
      tabs,
    };
  }

  return state;
}

function permStateToPayload(
  state: Record<string, PermState>,
  modules: ModuleDefinition[]
): { module_key: string; tab_key: string | null; role: string; allowed: boolean }[] {
  const result: { module_key: string; tab_key: string | null; role: string; allowed: boolean }[] = [];

  for (const mod of modules) {
    const s = state[mod.key];
    if (!s) continue;

    if (!mod.tabs || mod.tabs.length === 0) {
      // Module-level permission for each role
      for (const role of ROLES) {
        result.push({ module_key: mod.key, tab_key: null, role: role.key, allowed: s.enabled });
      }
    } else {
      // Tab-level permissions
      for (const tab of mod.tabs) {
        const tabState = s.tabs[tab.key];
        if (!tabState) continue;
        for (const role of ROLES) {
          result.push({
            module_key: mod.key,
            tab_key: tab.key,
            role: role.key,
            allowed: s.enabled && tabState[role.key as "member" | "viewer"],
          });
        }
      }
    }
  }

  return result;
}

export default function CostCenterFormDialog({
  open,
  onOpenChange,
  costCenter,
  costCenters,
  onSubmit,
  isLoading,
  orgMembers = [],
  orgModules = [],
  existingPermissions = [],
}: Props) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    parent_id: null as string | null,
    business_unit: "",
    responsible: "",
    description: "",
    active: true,
  });

  const [permState, setPermState] = useState<Record<string, PermState>>({});
  const [permSectionOpen, setPermSectionOpen] = useState(false);

  useEffect(() => {
    if (costCenter) {
      setForm({
        code: costCenter.code,
        name: costCenter.name,
        parent_id: costCenter.parent_id,
        business_unit: costCenter.business_unit ?? "",
        responsible: costCenter.responsible ?? "",
        description: costCenter.description ?? "",
        active: costCenter.active,
      });
    } else {
      setForm({ code: "", name: "", parent_id: null, business_unit: "", responsible: "", description: "", active: true });
    }
    setPermState(buildInitialPermState(orgModules, existingPermissions));
    setPermSectionOpen(existingPermissions.length > 0);
  }, [costCenter, open, orgModules, existingPermissions]);

  const parentOptions = costCenters.filter((cc) => cc.active && cc.id !== costCenter?.id);

  const memberOptions: SearchableOption[] = orgMembers.map((m) => ({
    value: m.id,
    label: m.full_name || "Sem nome",
    sublabel: m.cargo || undefined,
  }));

  const toggleModule = (moduleKey: string, enabled: boolean) => {
    setPermState((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], enabled },
    }));
  };

  const toggleTab = (moduleKey: string, tabKey: string, role: "member" | "viewer", checked: boolean) => {
    setPermState((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        tabs: {
          ...prev[moduleKey]?.tabs,
          [tabKey]: {
            ...prev[moduleKey]?.tabs?.[tabKey],
            [role]: checked,
          },
        },
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CostCenterFormPayload = {
      code: form.code,
      name: form.name,
      parent_id: form.parent_id || null,
      business_unit: form.business_unit || null,
      responsible: form.responsible || null,
      description: form.description || null,
      active: form.active,
      permissions: permStateToPayload(permState, orgModules),
    };
    if (costCenter) {
      payload.id = costCenter.id;
    }
    onSubmit(payload);
  };

  const hasModules = orgModules.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={hasModules ? "sm:max-w-2xl max-h-[90vh]" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{costCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          <form id="cc-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="CC-001" />
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Centro Pai</Label>
              <Select value={form.parent_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, parent_id: v === "__none__" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (raiz)</SelectItem>
                  {parentOptions.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidade de Negócio</Label>
                <Input value={form.business_unit} onChange={(e) => setForm({ ...form, business_unit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <SearchableSelect
                  options={memberOptions}
                  value={form.responsible}
                  onValueChange={(v) => setForm({ ...form, responsible: v })}
                  placeholder="Selecionar responsável..."
                  searchPlaceholder="Buscar membro..."
                  emptyMessage="Nenhum membro encontrado."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label className="text-sm">Ativo</Label>
            </div>

            {/* Modules & Permissions Section */}
            {hasModules && (
              <Collapsible open={permSectionOpen} onOpenChange={setPermSectionOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" type="button" className="w-full justify-between px-3 py-2 h-auto border border-border/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Shield size={14} className="text-primary" />
                      Módulos e Permissões do Setor
                    </div>
                    <ChevronDown size={14} className={`transition-transform ${permSectionOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Defina quais módulos e abas os membros (Analista) e visualizadores deste setor podem acessar. Owner e Admin têm acesso total.
                  </p>
                  {orgModules.map((mod) => {
                    const s = permState[mod.key];
                    if (!s) return null;
                    const hasTabs = mod.tabs && mod.tabs.length > 0;

                    return (
                      <div key={mod.key} className="border border-border/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">{mod.label}</Label>
                          <Switch
                            checked={s.enabled}
                            onCheckedChange={(v) => toggleModule(mod.key, v)}
                          />
                        </div>

                        {hasTabs && s.enabled && (
                          <div className="mt-2">
                            <div className="grid grid-cols-[1fr,auto,auto] gap-x-4 gap-y-1 text-xs">
                              <div className="text-muted-foreground font-medium">Aba</div>
                              {ROLES.map((r) => (
                                <div key={r.key} className="text-muted-foreground font-medium text-center w-20">
                                  {r.label}
                                </div>
                              ))}
                              {mod.tabs!.map((tab) => {
                                const tabState = s.tabs[tab.key];
                                return (
                                  <div key={tab.key} className="contents">
                                    <div className="py-1 text-foreground">{tab.label}</div>
                                    {ROLES.map((r) => (
                                      <div key={r.key} className="flex justify-center items-center">
                                        <Checkbox
                                          checked={tabState?.[r.key as "member" | "viewer"] ?? false}
                                          onCheckedChange={(v) =>
                                            toggleTab(mod.key, tab.key, r.key as "member" | "viewer", !!v)
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </form>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="cc-form" disabled={isLoading}>{costCenter ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
