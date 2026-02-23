import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Target,
  Users,
  Building2,
  CheckSquare,
  Plug,
  Brain,
  Settings,
  Search,
  Wrench,
  AlertTriangle,
  Edit2,
  Power,
} from "lucide-react";
import { useSystemModules, useToggleSystemModule, SystemModule } from "@/hooks/useSystemModules";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MODULE_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  "fluxo-caixa": ArrowLeftRight,
  contratos: FileText,
  planejamento: Target,
  dp: Users,
  conciliacao: Building2,
  tarefas: CheckSquare,
  integracoes: Plug,
  "ia-financeira": Brain,
  configuracoes: Settings,
  documentos: FileText,
};

export default function BackofficeSystem() {
  const { data: modules = [], isLoading } = useSystemModules();
  const toggleModule = useToggleSystemModule();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editModule, setEditModule] = useState<SystemModule | null>(null);
  const [editMessage, setEditMessage] = useState("");

  const filtered = modules.filter(
    (m) =>
      !search ||
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.module_key.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = modules.filter((m) => m.enabled).length;
  const disabledCount = modules.filter((m) => !m.enabled).length;

  const handleToggle = (mod: SystemModule, checked: boolean) => {
    toggleModule.mutate(
      { id: mod.id, enabled: checked },
      {
        onSuccess: () => {
          toast({
            title: checked
              ? `Módulo "${mod.label}" ativado`
              : `Módulo "${mod.label}" desativado`,
            description: checked
              ? "O módulo está disponível para todos os usuários."
              : "Os usuários verão uma mensagem de manutenção.",
          });
        },
      }
    );
  };

  const handleSaveMessage = () => {
    if (!editModule) return;
    toggleModule.mutate(
      { id: editModule.id, enabled: editModule.enabled, maintenance_message: editMessage },
      {
        onSuccess: () => {
          toast({ title: "Mensagem de manutenção atualizada" });
          setEditModule(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground animate-pulse">
        Carregando módulos do sistema...
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wrench size={24} className="text-primary" />
          Gerenciamento do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ative ou desative módulos globalmente. Módulos desativados exibirão uma mensagem de manutenção para todos os usuários.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Power size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{modules.length}</p>
              <p className="text-xs text-muted-foreground">Módulos Totais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Power size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{enabledCount}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{disabledCount}</p>
              <p className="text-xs text-muted-foreground">Em Manutenção</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Buscar módulo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Module Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((mod) => {
          const Icon = MODULE_ICONS[mod.module_key] || Settings;
          return (
            <Card
              key={mod.id}
              className={`transition-all duration-200 ${
                !mod.enabled ? "opacity-70 border-destructive/30" : ""
              }`}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        mod.enabled
                          ? "bg-primary/10"
                          : "bg-destructive/10"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={mod.enabled ? "text-primary" : "text-destructive"}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{mod.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{mod.module_key}</p>
                    </div>
                  </div>
                  <Switch
                    checked={mod.enabled}
                    onCheckedChange={(checked) => handleToggle(mod, checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant={mod.enabled ? "default" : "destructive"}>
                    {mod.enabled ? "Ativo" : "Em Manutenção"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditModule(mod);
                      setEditMessage(mod.maintenance_message || "");
                    }}
                  >
                    <Edit2 size={12} className="mr-1" /> Mensagem
                  </Button>
                </div>

                {!mod.enabled && mod.maintenance_message && (
                  <p className="text-xs text-destructive/80 border-t border-border pt-2">
                    {mod.maintenance_message}
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Atualizado em {format(new Date(mod.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Maintenance Message Dialog */}
      <Dialog open={!!editModule} onOpenChange={(open) => !open && setEditModule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensagem de Manutenção — {editModule?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Mensagem exibida aos usuários quando o módulo está desativado</Label>
              <Textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={4}
                placeholder="Este módulo está temporariamente indisponível para manutenção."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModule(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMessage}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
