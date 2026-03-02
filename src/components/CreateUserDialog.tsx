import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBackofficeOrgs } from "@/hooks/useBackoffice";
import { X } from "lucide-react";

interface OrgAssignment {
  id: string;
  name: string;
  role: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrgId?: string;
  currentOrgName?: string;
  onSuccess?: () => void;
}

const ROLES = [
  { value: "owner", label: "Admin da Empresa" },
  { value: "admin", label: "CFO / Gestor Financeiro" },
  { value: "member", label: "Analista Financeiro" },
  { value: "viewer", label: "Visualizador" },
];

export function CreateUserDialog({
  open,
  onOpenChange,
  currentOrgId,
  currentOrgName,
  onSuccess,
}: CreateUserDialogProps) {
  const { toast } = useToast();
  const { data: allOrgs = [] } = useBackofficeOrgs();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cargo, setCargo] = useState("");
  const [loading, setLoading] = useState(false);
  const [orgAssignments, setOrgAssignments] = useState<OrgAssignment[]>(() => {
    if (currentOrgId && currentOrgName) {
      return [{ id: currentOrgId, name: currentOrgName, role: "member" }];
    }
    return [];
  });
  const [selectedOrgToAdd, setSelectedOrgToAdd] = useState("");

  const availableOrgs = useMemo(() => {
    const assignedIds = new Set(orgAssignments.map((a) => a.id));
    return allOrgs.filter((o) => !assignedIds.has(o.id));
  }, [allOrgs, orgAssignments]);

  const handleAddOrg = () => {
    if (!selectedOrgToAdd) return;
    const org = allOrgs.find((o) => o.id === selectedOrgToAdd);
    if (!org) return;
    setOrgAssignments((prev) => [...prev, { id: org.id, name: org.name, role: "member" }]);
    setSelectedOrgToAdd("");
  };

  const handleRemoveOrg = (orgId: string) => {
    setOrgAssignments((prev) => prev.filter((a) => a.id !== orgId));
  };

  const handleChangeRole = (orgId: string, role: string) => {
    setOrgAssignments((prev) =>
      prev.map((a) => (a.id === orgId ? { ...a, role } : a))
    );
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password,
          full_name: fullName,
          cargo,
          organization_ids: orgAssignments.map((a) => ({ id: a.id, role: a.role })),
        },
      });

      if (res.error) {
        throw new Error(res.error.message);
      }

      const result = res.data;
      if (result.error) {
        throw new Error(result.error);
      }

      toast({ title: "Usuário criado com sucesso!" });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setCargo("");
    setOrgAssignments(
      currentOrgId && currentOrgName
        ? [{ id: currentOrgId, name: currentOrgName, role: "member" }]
        : []
    );
    setSelectedOrgToAdd("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Preencha os dados do usuário e associe às empresas desejadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Basic Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome Completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="João Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Analista Financeiro" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>

          {/* Org Assignments */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Empresas Vinculadas</Label>
            
            {orgAssignments.length > 0 && (
              <div className="space-y-2">
                {orgAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-2 p-2 border border-border rounded-lg bg-secondary/30"
                  >
                    <span className="text-sm text-foreground flex-1 truncate">{assignment.name}</span>
                    <Select value={assignment.role} onValueChange={(v) => handleChangeRole(assignment.id, v)}>
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRemoveOrg(assignment.id)}>
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Select value={selectedOrgToAdd} onValueChange={setSelectedOrgToAdd}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Adicionar empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {availableOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleAddOrg} disabled={!selectedOrgToAdd}>
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Criando..." : "Criar Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
