import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Entity } from "@/hooks/useEntities";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entity: Entity | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  defaultType?: "fornecedor" | "cliente" | "ambos";
}

const STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function EntityFormDialog({ open, onOpenChange, entity, onSubmit, isLoading, defaultType }: Props) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      setForm(entity ? { ...entity } : { type: defaultType ?? "fornecedor", document_type: "CNPJ", active: true, credit_limit: 0 });
    }
  }, [open, entity, defaultType]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.name?.trim()) return;
    onSubmit(entity ? { ...form, id: entity.id } : form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entity ? "Editar Cadastro" : "Novo Cadastro"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="address">Endereço</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo <span className="text-destructive">*</span></Label>
                <Select value={form.type || "fornecedor"} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Documento</Label>
                <Select value={form.document_type || "CNPJ"} onValueChange={(v) => set("document_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="CPF">CPF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome / Razão Social <span className="text-destructive">*</span></Label>
              <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº Documento</Label>
                <Input value={form.document_number || ""} onChange={(e) => set("document_number", e.target.value)} placeholder={form.document_type === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"} />
              </div>
              <div>
                <Label>Contato Principal</Label>
                <Input value={form.contact_person || ""} onChange={(e) => set("contact_person", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
          </TabsContent>

          <TabsContent value="address" className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Rua</Label>
                <Input value={form.address_street || ""} onChange={(e) => set("address_street", e.target.value)} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.address_number || ""} onChange={(e) => set("address_number", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Complemento</Label>
                <Input value={form.address_complement || ""} onChange={(e) => set("address_complement", e.target.value)} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.address_neighborhood || ""} onChange={(e) => set("address_neighborhood", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={form.address_city || ""} onChange={(e) => set("address_city", e.target.value)} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.address_state || ""} onValueChange={(v) => set("address_state", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.address_zip || ""} onChange={(e) => set("address_zip", e.target.value)} placeholder="00000-000" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condição de Pagamento</Label>
                <Input value={form.payment_condition || ""} onChange={(e) => set("payment_condition", e.target.value)} placeholder="Ex: 30 dias, 30/60/90" />
              </div>
              <div>
                <Label>Limite de Crédito</Label>
                <Input type="number" value={form.credit_limit ?? 0} onChange={(e) => set("credit_limit", Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Banco</Label>
                <Input value={form.bank_name || ""} onChange={(e) => set("bank_name", e.target.value)} />
              </div>
              <div>
                <Label>Agência</Label>
                <Input value={form.bank_agency || ""} onChange={(e) => set("bank_agency", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conta</Label>
                <Input value={form.bank_account || ""} onChange={(e) => set("bank_account", e.target.value)} />
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input value={form.bank_pix || ""} onChange={(e) => set("bank_pix", e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !form.name?.trim()}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
