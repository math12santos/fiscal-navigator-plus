import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEmployees } from "@/hooks/useDP";
import { Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

const EQUIP_TYPES = [
  "notebook","desktop","monitor","celular","tablet","impressora","roteador",
  "servidor","nobreak","periferico","eletrico_energia","seguranca_controle","apoio_operacional","outro",
];
const STATUSES = ["disponivel","em_uso","ativo","em_manutencao","extraviado","baixado","vendido","inativo"];
const ACQ_FORMS = ["compra_a_vista","compra_parcelada","leasing","comodato","locacao","outro"];
const CONSERV = ["novo","bom","regular","ruim","sucata"];

const PERIFERICO_SUBTYPES = [
  "teclado","mouse","leitor_codigo_barras","scanner","webcam","mesa_digitalizadora",
  "maquininha_cartao","hd_externo","ssd_externo","pendrive","unidade_backup",
  "roteador","switch","access_point","modem","adaptador_wifi","dock_station","hub_usb",
  "suporte_pes","apoio_mesa",
];
const ELETRICO_SUBTYPES = ["nobreak","filtro_linha","estabilizador"];
const SEGURANCA_SUBTYPES = ["token","leitor_biometrico","smart_card_reader","camera_ip","controle_acesso"];
const APOIO_SUBTYPES = ["suporte_notebook","base_refrigerada","duplicador_tela","cabo_hdmi","kvm_switch"];

const labelize = (s?: string) => (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: any;
  onSave: (v: any) => void;
}

const SUBTYPE_BY_TYPE: Record<string, string[]> = {
  periferico: PERIFERICO_SUBTYPES,
  eletrico_energia: ELETRICO_SUBTYPES,
  seguranca_controle: SEGURANCA_SUBTYPES,
  apoio_operacional: APOIO_SUBTYPES,
};

export function EquipmentFormDialog({ open, onOpenChange, initial, onSave }: Props) {
  const { currentOrg } = useOrganization();
  const { data: employees = [] } = useEmployees();

  const [v, setV] = useState<any>(() => initial ?? defaults());
  const [tab, setTab] = useState("geral");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setV(initial ?? defaults());
      setTab("geral");
    }
  }, [open, initial]);

  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));
  const setSpec = (k: string, val: any) =>
    setV((p: any) => ({ ...p, specs: { ...(p.specs ?? {}), [k]: val } }));

  const subtypes = SUBTYPE_BY_TYPE[v.equipment_type] ?? [];
  const isNew = v.acquisition_mode === "nova";

  const handleTermUpload = async (file: File) => {
    if (!currentOrg) return;
    setUploading(true);
    try {
      const path = `${currentOrg.id}/equipment-terms/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("it-attachments").upload(path, file, { upsert: true });
      if (error) throw error;
      set("responsibility_term_path", path);
      set("responsibility_term_signed", true);
      toast.success("Termo anexado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar termo");
    } finally {
      setUploading(false);
    }
  };

  const canSave = !!v.name && !!v.equipment_type && !!v.acquisition_mode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {v.id ? "Editar equipamento" : "Novo equipamento"}
            {isNew && <Badge variant="secondary">Aquisição nova</Badge>}
            {!isNew && v.acquisition_mode === "existente" && <Badge variant="outline">Existente</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/40 border border-border p-1 h-auto flex-wrap">
            <TabsTrigger value="geral" className="text-xs">1. Geral</TabsTrigger>
            <TabsTrigger value="atribuicao" className="text-xs">2. Atribuição</TabsTrigger>
            <TabsTrigger value="especifico" className="text-xs">3. {labelize(v.equipment_type)}</TabsTrigger>
            <TabsTrigger value="aquisicao" className="text-xs">4. Aquisição</TabsTrigger>
            <TabsTrigger value="planejamento" className="text-xs">5. Planejamento</TabsTrigger>
          </TabsList>

          {/* ============== STEP 1: GERAL ============== */}
          <TabsContent value="geral" className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-semibold">Modo de cadastro</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => set("acquisition_mode", "nova")}
                  className={`text-left p-3 rounded-md border ${isNew ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="font-medium">🆕 Aquisição nova</div>
                  <div className="text-xs text-muted-foreground">Gera despesa imediata e solicitação ao Financeiro</div>
                </button>
                <button
                  type="button"
                  onClick={() => set("acquisition_mode", "existente")}
                  className={`text-left p-3 rounded-md border ${!isNew ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="font-medium">📦 Equipamento existente</div>
                  <div className="text-xs text-muted-foreground">Cadastro retroativo (informe mês/ano estimado)</div>
                </button>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={v.equipment_type} onValueChange={(val) => { set("equipment_type", val); set("equipment_subtype", null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EQUIP_TYPES.map((t) => <SelectItem key={t} value={t}>{labelize(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {subtypes.length > 0 && (
                <div>
                  <Label>Subtipo</Label>
                  <Select value={v.equipment_subtype ?? ""} onValueChange={(val) => set("equipment_subtype", val)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{subtypes.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2"><Label>Nome / Apelido *</Label><Input value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
              <div><Label>Marca</Label><Input value={v.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
              <div><Label>Modelo</Label><Input value={v.model ?? ""} onChange={(e) => set("model", e.target.value)} /></div>
            </div>
          </TabsContent>

          {/* ============== STEP 2: ATRIBUIÇÃO ============== */}
          <TabsContent value="atribuicao" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status / Atribuição *</Label>
                <Select value={v.status} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conservação</Label>
                <Select value={v.conservation_state ?? ""} onValueChange={(val) => set("conservation_state", val || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{CONSERV.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Colaborador atribuído</Label>
                <Select value={v.responsible_employee_id ?? "__none__"} onValueChange={(val) => set("responsible_employee_id", val === "__none__" ? null : val)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Disponível (patrimônio ocioso)</SelectItem>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}{e.cpf ? ` — ${e.cpf}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!v.responsible_employee_id && (
                  <p className="text-xs text-muted-foreground mt-1">Sem colaborador → será registrado em patrimônio ocioso.</p>
                )}
              </div>
              <div><Label>Local / Setor</Label><Input value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="Ex.: Escritório SP — sala 2" /></div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="ho" checked={!!v.home_office} onCheckedChange={(c) => set("home_office", !!c)} />
                <Label htmlFor="ho" className="cursor-pointer">🏠 Home Office</Label>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Termo de Retirada de Equipamento</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {v.responsibility_term_path ? "Substituir PDF assinado" : "Anexar PDF assinado"}
                    <input type="file" accept="application/pdf" className="hidden" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && handleTermUpload(e.target.files[0])} />
                  </label>
                </Button>
                {v.responsibility_term_path && (
                  <Badge variant="default" className="gap-1"><FileText className="h-3 w-3" /> Termo assinado anexado</Badge>
                )}
                {!v.responsibility_term_path && v.responsible_employee_id && (
                  <span className="text-xs text-muted-foreground">Gere o PDF na lista (botão Termo) e anexe assinado.</span>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ============== STEP 3: ESPECÍFICO POR TIPO ============== */}
          <TabsContent value="especifico" className="space-y-3 pt-4">
            <SpecsByType type={v.equipment_type} specs={v.specs ?? {}} setSpec={setSpec} setRoot={set} v={v} />
          </TabsContent>

          {/* ============== STEP 4: AQUISIÇÃO ============== */}
          <TabsContent value="aquisicao" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              {!isNew && (
                <div>
                  <Label>Mês/ano estimado da aquisição</Label>
                  <Input type="month" value={v.acquisition_estimated_month ?? ""} onChange={(e) => set("acquisition_estimated_month", e.target.value || null)} />
                </div>
              )}
              <div>
                <Label>Data de aquisição {isNew ? "(ou estimada)" : ""}</Label>
                <Input type="date" value={v.acquisition_date ?? ""} onChange={(e) => set("acquisition_date", e.target.value || null)} />
              </div>
              <div><Label>Nº NF (opcional)</Label><Input value={v.invoice_number ?? ""} onChange={(e) => set("invoice_number", e.target.value)} /></div>
              <div>
                <Label>Valor de aquisição</Label>
                <CurrencyInput value={v.acquisition_value ?? 0} onValueChange={(n) => set("acquisition_value", n)} />
              </div>
              <div>
                <Label>Forma de aquisição</Label>
                <Select value={v.acquisition_form ?? "compra_a_vista"} onValueChange={(val) => set("acquisition_form", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACQ_FORMS.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(v.acquisition_form === "compra_parcelada" || v.acquisition_form === "leasing") && (
                <>
                  <div><Label>Nº parcelas</Label><Input type="number" value={v.installments_count ?? ""} onChange={(e) => set("installments_count", parseInt(e.target.value) || null)} /></div>
                  <div><Label>Valor parcela</Label><CurrencyInput value={v.installment_value ?? 0} onValueChange={(n) => set("installment_value", n)} /></div>
                  <div><Label>1ª parcela</Label><Input type="date" value={v.first_installment_date ?? ""} onChange={(e) => set("first_installment_date", e.target.value || null)} /></div>
                </>
              )}
            </div>

            {isNew && (
              <div className="p-3 rounded-md border border-primary/30 bg-primary/5 text-sm">
                💡 Ao salvar, será criada uma <strong>solicitação para o Financeiro</strong> com depreciação contábil sugerida (60m), econômica (48m) e flags de planejamento patrimonial pré-marcadas.
              </div>
            )}
          </TabsContent>

          {/* ============== STEP 5: PLANEJAMENTO ============== */}
          <TabsContent value="planejamento" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vida útil contábil (meses)</Label><Input type="number" value={v.useful_life_accounting_months ?? 60} onChange={(e) => set("useful_life_accounting_months", parseInt(e.target.value) || null)} /></div>
              <div><Label>Vida útil econômica (meses)</Label><Input type="number" value={v.useful_life_economic_months ?? 48} onChange={(e) => set("useful_life_economic_months", parseInt(e.target.value) || null)} /></div>
              <div><Label>Valor residual</Label><CurrencyInput value={v.residual_value ?? 0} onValueChange={(n) => set("residual_value", n)} /></div>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!v.enters_patrimonial_planning} onCheckedChange={(c) => set("enters_patrimonial_planning", !!c)} /> Entra no planejamento patrimonial (considera depreciação para EBITDA)</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!v.generates_future_installments} onCheckedChange={(c) => set("generates_future_installments", !!c)} /> Gera parcelas futuras</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!v.generates_recurring_cost} onCheckedChange={(c) => set("generates_recurring_cost", !!c)} /> Gera custo recorrente</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!v.generates_replacement_forecast} onCheckedChange={(c) => set("generates_replacement_forecast", !!c)} /> Prevê substituição futura (cobertura de provisionamento)</label>
            </div>

            {v.generates_replacement_forecast && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div><Label>Data prevista de substituição</Label><Input type="date" value={v.replacement_forecast_date ?? ""} onChange={(e) => set("replacement_forecast_date", e.target.value || null)} /></div>
                <div><Label>Valor estimado</Label><CurrencyInput value={v.replacement_estimated_value ?? 0} onValueChange={(n) => set("replacement_estimated_value", n)} /></div>
                <div className="col-span-2"><Label>Justificativa</Label><Textarea value={v.replacement_justification ?? ""} onChange={(e) => set("replacement_justification", e.target.value)} /></div>
              </div>
            )}

            <div className="text-xs text-muted-foreground p-2 bg-muted/40 rounded">
              ℹ️ Será agendada automaticamente uma tarefa semestral para revisar o <strong>valor de substituição</strong> (similares online).
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(v); onOpenChange(false); }} disabled={!canSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaults() {
  return {
    equipment_type: "notebook",
    status: "disponivel",
    acquisition_form: "compra_a_vista",
    acquisition_mode: "nova",
    home_office: false,
    enters_patrimonial_planning: true,
    generates_replacement_forecast: true,
    useful_life_accounting_months: 60,
    useful_life_economic_months: 48,
    specs: {},
  };
}

/* =================================================================
 * SPECS POR TIPO
 * ================================================================= */
function Field({ label, children }: { label: string; children: any }) {
  return <div><Label>{label}</Label>{children}</div>;
}
function Txt({ value, onChange, ...r }: any) {
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...r} />;
}
function Chk({ checked, onCheckedChange, label }: any) {
  return <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!checked} onCheckedChange={(c) => onCheckedChange(!!c)} /> {label}</label>;
}

function SpecsByType({ type, specs, setSpec, setRoot, v }: any) {
  const Common = (
    <div className="text-xs text-muted-foreground p-2 bg-muted/40 rounded mb-3">
      Colaborador: <strong>{v.responsible_employee_id ? "atribuído" : "—"}</strong> · Termo: <strong>{v.responsibility_term_signed ? "assinado" : "pendente"}</strong> · Local: <strong>{v.location || "—"}</strong>
    </div>
  );

  switch (type) {
    case "notebook":
    case "desktop":
      return (
        <div className="space-y-3">
          {Common}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serial"><Txt value={v.serial_number} onChange={(x: string) => setRoot("serial_number", x)} /></Field>
            <Field label="TAG"><Txt value={specs.tag} onChange={(x: string) => setSpec("tag", x)} /></Field>
            <Field label="Processador"><Txt value={specs.cpu} onChange={(x: string) => setSpec("cpu", x)} /></Field>
            <Field label="Memória RAM total"><Txt value={specs.ram_total} onChange={(x: string) => setSpec("ram_total", x)} placeholder="Ex.: 16 GB" /></Field>
            <Field label="Slots de RAM utilizados"><Txt value={specs.ram_slots_used} onChange={(x: string) => setSpec("ram_slots_used", x)} /></Field>
            <div className="flex items-center gap-3 pt-6">
              <Chk label="Slots de RAM funcionando" checked={specs.ram_slots_ok} onCheckedChange={(c: boolean) => setSpec("ram_slots_ok", c)} />
            </div>
            <Field label="Barramento"><Txt value={specs.bus_type} onChange={(x: string) => setSpec("bus_type", x)} /></Field>
            <Field label="SSD"><Txt value={specs.ssd} onChange={(x: string) => setSpec("ssd", x)} placeholder="Ex.: 512 GB NVMe" /></Field>
            <Field label="Armazenamento extra"><Txt value={specs.extra_storage} onChange={(x: string) => setSpec("extra_storage", x)} /></Field>
            <Field label="Sistema Operacional"><Txt value={specs.os} onChange={(x: string) => setSpec("os", x)} /></Field>
            <Field label="GPU"><Txt value={specs.gpu} onChange={(x: string) => setSpec("gpu", x)} /></Field>
            {type === "notebook" && (
              <div className="flex items-center gap-3 pt-6">
                <Chk label="Mouse s/ fio incluso" checked={specs.wireless_mouse} onCheckedChange={(c: boolean) => setSpec("wireless_mouse", c)} />
              </div>
            )}
            {type === "desktop" && (
              <Field label="Faixa de preço de mercado"><Txt value={specs.market_price_range} onChange={(x: string) => setSpec("market_price_range", x)} /></Field>
            )}
            <Field label="Similar para substituição (links)"><Textarea value={specs.replacement_links ?? ""} onChange={(e) => setSpec("replacement_links", e.target.value)} placeholder="Cole URLs, um por linha" /></Field>
            <div className="col-span-2"><Field label="Configurações adicionais"><Textarea value={specs.extra_config ?? ""} onChange={(e) => setSpec("extra_config", e.target.value)} /></Field></div>
          </div>
        </div>
      );

    case "monitor":
      return (
        <div className="space-y-3">
          {Common}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tamanho (polegadas)"><Txt value={specs.size_inch} onChange={(x: string) => setSpec("size_inch", x)} /></Field>
            <Field label="Serial / Service Tag"><Txt value={v.serial_number} onChange={(x: string) => setRoot("serial_number", x)} /></Field>
            <Field label="PPID/SNID/Série"><Txt value={specs.ppid} onChange={(x: string) => setSpec("ppid", x)} /></Field>
            <Field label="Resolução"><Txt value={specs.resolution} onChange={(x: string) => setSpec("resolution", x)} placeholder="Ex.: 2560×1440" /></Field>
            <Field label="Proporção"><Txt value={specs.aspect_ratio} onChange={(x: string) => setSpec("aspect_ratio", x)} placeholder="Ex.: 16:9" /></Field>
            <Field label="Frequência (Hz)"><Txt value={specs.hz} onChange={(x: string) => setSpec("hz", x)} /></Field>
            <Field label="Voltagem"><Txt value={specs.voltage} onChange={(x: string) => setSpec("voltage", x)} /></Field>
            <Field label="Tipo de painel"><Txt value={specs.panel_type} onChange={(x: string) => setSpec("panel_type", x)} placeholder="IPS/VA/OLED" /></Field>
            <Field label="Quantidade de saídas"><Txt value={specs.outputs_count} onChange={(x: string) => setSpec("outputs_count", x)} /></Field>
            <Chk label="Altura ajustável" checked={specs.height_adjustable} onCheckedChange={(c: boolean) => setSpec("height_adjustable", c)} />
            <Chk label="Reclinável" checked={specs.tiltable} onCheckedChange={(c: boolean) => setSpec("tiltable", c)} />
            <Chk label="Todas as saídas funcionando" checked={specs.outputs_ok} onCheckedChange={(c: boolean) => setSpec("outputs_ok", c)} />
          </div>
        </div>
      );

    case "celular":
    case "tablet":
      return (
        <div className="space-y-3">
          {Common}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sistema Operacional"><Txt value={specs.os} onChange={(x: string) => setSpec("os", x)} /></Field>
            <Field label="IMEI 1"><Txt value={specs.imei1} onChange={(x: string) => setSpec("imei1", x)} /></Field>
            <Field label="IMEI 2"><Txt value={specs.imei2} onChange={(x: string) => setSpec("imei2", x)} /></Field>
            <Field label="Número do chip"><Txt value={specs.sim_number} onChange={(x: string) => setSpec("sim_number", x)} /></Field>
            <Field label="Senha máster"><Txt value={specs.master_password} onChange={(x: string) => setSpec("master_password", x)} /></Field>
            <Field label="PIN WhatsApp"><Txt value={specs.whatsapp_pin} onChange={(x: string) => setSpec("whatsapp_pin", x)} /></Field>
            <Field label="Situação do carregador"><Txt value={specs.charger_status} onChange={(x: string) => setSpec("charger_status", x)} /></Field>
            <Field label="Aquisição do último carregador"><Input type="date" value={specs.charger_last_date ?? ""} onChange={(e) => setSpec("charger_last_date", e.target.value)} /></Field>
          </div>
        </div>
      );

    case "impressora":
      return (
        <div className="space-y-3">
          {Common}
          <div className="grid grid-cols-2 gap-3">
            <Field label="IP"><Txt value={specs.ip} onChange={(x: string) => setSpec("ip", x)} /></Field>
            <Field label="Tipo de toner"><Txt value={specs.toner_type} onChange={(x: string) => setSpec("toner_type", x)} /></Field>
          </div>
        </div>
      );

    case "periferico":
    case "eletrico_energia":
    case "seguranca_controle":
    case "apoio_operacional":
      return (
        <div className="space-y-3">
          {Common}
          <p className="text-xs text-muted-foreground">
            Subtipo: <strong>{labelize(v.equipment_subtype) || "—"}</strong>. Não deprecia, mas tem vida útil média acompanhada.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vida útil média estimada (meses)"><Input type="number" value={specs.avg_life_months ?? ""} onChange={(e) => setSpec("avg_life_months", parseInt(e.target.value) || null)} /></Field>
            <Field label="Serial"><Txt value={v.serial_number} onChange={(x: string) => setRoot("serial_number", x)} /></Field>
            <div className="col-span-2"><Field label="Observações"><Textarea value={specs.notes ?? ""} onChange={(e) => setSpec("notes", e.target.value)} /></Field></div>
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          {Common}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serial"><Txt value={v.serial_number} onChange={(x: string) => setRoot("serial_number", x)} /></Field>
            <div className="col-span-2"><Field label="Detalhes"><Textarea value={specs.notes ?? ""} onChange={(e) => setSpec("notes", e.target.value)} /></Field></div>
          </div>
        </div>
      );
  }
}
