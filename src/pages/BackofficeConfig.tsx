import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Mail,
  Database,
  Webhook,
  ScanText,
  Trash2,
  RefreshCw,
  Save,
  Pencil,
  FileText,
  Heart,
} from "lucide-react";
import {
  usePlatformSettings,
  useUpsertPlatformSetting,
  useEmailTemplates,
  useUpdateEmailTemplate,
  usePurgeAuditLogs,
  type PlatformSetting,
  type EmailTemplate,
} from "@/hooks/usePlatformSettings";
import { useRecomputeAllHealthScores } from "@/hooks/useHealthScore";
import { useToast } from "@/hooks/use-toast";

export default function BackofficeConfig() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Governança da plataforma, templates de comunicação e LGPD.
        </p>
      </div>

      <Tabs defaultValue="governance">
        <TabsList>
          <TabsTrigger value="governance"><Shield size={14} className="mr-1" /> Governança</TabsTrigger>
          <TabsTrigger value="emails"><Mail size={14} className="mr-1" /> E-mails</TabsTrigger>
          <TabsTrigger value="lgpd"><ScanText size={14} className="mr-1" /> LGPD & Manutenção</TabsTrigger>
        </TabsList>

        <TabsContent value="governance" className="mt-4">
          <GovernanceTab />
        </TabsContent>
        <TabsContent value="emails" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="lgpd" className="mt-4">
          <LgpdMaintenanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// GOVERNANCE — platform_settings
// ============================================================

function settingsByPrefix(list: PlatformSetting[], prefix: string) {
  return list.filter((s) => s.key.startsWith(prefix));
}

function GovernanceTab() {
  const { data: settings = [], isLoading } = usePlatformSettings();
  const upsert = useUpsertPlatformSetting();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    const init: Record<string, any> = {};
    settings.forEach((s) => (init[s.key] = s.value));
    setDraft(init);
  }, [settings]);

  const set = (key: string, val: any) => setDraft((d) => ({ ...d, [key]: val }));

  const save = async (key: string) => {
    try {
      const original = settings.find((s) => s.key === key);
      await upsert.mutateAsync({
        key,
        value: draft[key],
        description: original?.description ?? undefined,
      });
      toast({ title: "Configuração salva" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const security = settingsByPrefix(settings, "security.");
  const retention = settingsByPrefix(settings, "retention.");
  const webhooks = settingsByPrefix(settings, "webhooks.");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Segurança */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield size={16} className="text-primary" /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {security.map((s) => (
            <SettingRow key={s.key} setting={s} value={draft[s.key]} onChange={(v) => set(s.key, v)} onSave={() => save(s.key)} />
          ))}
        </CardContent>
      </Card>

      {/* Retenção */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database size={16} className="text-primary" /> Retenção de dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {retention.map((s) => (
            <SettingRow key={s.key} setting={s} value={draft[s.key]} onChange={(v) => set(s.key, v)} onSave={() => save(s.key)} />
          ))}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook size={16} className="text-primary" /> Webhooks da plataforma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhooks.map((s) => (
            <SettingRow key={s.key} setting={s} value={draft[s.key]} onChange={(v) => set(s.key, v)} onSave={() => save(s.key)} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  setting,
  value,
  onChange,
  onSave,
}: {
  setting: PlatformSetting;
  value: any;
  onChange: (v: any) => void;
  onSave: () => void;
}) {
  const isNumber = typeof setting.value === "number";
  const isString = typeof setting.value === "string";
  const isArray = Array.isArray(setting.value);

  return (
    <div className="space-y-1">
      <Label className="text-xs font-mono text-muted-foreground">{setting.key}</Label>
      <div className="flex gap-2">
        {isNumber && (
          <Input
            type="number"
            value={value ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1"
          />
        )}
        {isString && (
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
            placeholder="https://..."
          />
        )}
        {isArray && (
          <Input
            value={Array.isArray(value) ? value.join(",") : ""}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            className="flex-1"
            placeholder="valor1, valor2"
          />
        )}
        <Button size="sm" variant="outline" onClick={onSave}>
          <Save size={12} className="mr-1" /> Salvar
        </Button>
      </div>
      {setting.description && (
        <p className="text-[11px] text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

function EmailTemplatesTab() {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const update = useUpdateEmailTemplate();
  const { toast } = useToast();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const handleSave = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        subject: editing.subject,
        body_html: editing.body_html,
        is_active: editing.is_active,
      });
      toast({ title: "Template salvo" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText size={16} className="text-primary" /> Templates de e-mail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum template.</p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-secondary/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{t.template_key}</Badge>
                  {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                <Pencil size={12} className="mr-1" /> Editar
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Variáveis disponíveis:{" "}
              {(editing?.variables ?? []).map((v) => (
                <code key={v} className="bg-secondary px-1 rounded mr-1">{`{{${v}}}`}</code>
              ))}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Assunto</Label>
                <Input
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Corpo HTML</Label>
                <Textarea
                  value={editing.body_html}
                  onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                  rows={10}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ativo</Label>
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// LGPD & MAINTENANCE
// ============================================================

function LgpdMaintenanceTab() {
  const recompute = useRecomputeAllHealthScores();
  const purge = usePurgeAuditLogs();
  const { toast } = useToast();
  const [purgeDays, setPurgeDays] = useState(365);

  const handleRecompute = async () => {
    try {
      const n = await recompute.mutateAsync();
      toast({ title: `Health score recalculado para ${n} empresas` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handlePurge = async () => {
    if (!confirm(`Excluir permanentemente registros de auditoria com mais de ${purgeDays} dias?`)) return;
    try {
      const n = await purge.mutateAsync(purgeDays);
      toast({ title: `${n} registros de auditoria removidos` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart size={16} className="text-primary" /> Health Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Recalcula o índice de saúde (0-100) de todas as empresas. O cálculo combina pagamento (30 pts),
            uso recente (25 pts), onboarding (20 pts), adoção de módulos (15 pts) e suporte (10 pts).
          </p>
          <Button onClick={handleRecompute} disabled={recompute.isPending}>
            <RefreshCw size={14} className={`mr-1 ${recompute.isPending ? "animate-spin" : ""}`} />
            {recompute.isPending ? "Recalculando..." : "Recalcular tudo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 size={16} className="text-destructive" /> Purga de auditoria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Remove permanentemente registros de `audit_log` mais antigos que o limite configurado.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={30}
              value={purgeDays}
              onChange={(e) => setPurgeDays(Number(e.target.value))}
              className="w-32"
            />
            <Button variant="destructive" onClick={handlePurge} disabled={purge.isPending}>
              <Trash2 size={14} className="mr-1" />
              Purgar &gt; {purgeDays} dias
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanText size={16} className="text-primary" /> LGPD — Direitos do titular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A LGPD garante ao titular: <strong>acesso</strong>, <strong>portabilidade</strong>,{" "}
            <strong>correção</strong>, <strong>anonimização</strong> e <strong>eliminação</strong> dos
            dados pessoais. As ações abaixo já estão disponíveis na plataforma:
          </p>
          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>
                <strong>Exclusão de empresa</strong> — disponível em /backoffice via cascata controlada.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>
                <strong>Logs de auditoria</strong> — registro imutável de operações sensíveis em audit_log.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>
                <strong>Isolamento por organização</strong> — RLS estrita garante que dados de uma empresa nunca vazem para outra.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⏳</span>
              <span>
                <strong>Exportação de dados pessoais por usuário</strong> — em breve via Edge Function `lgpd-export`.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
