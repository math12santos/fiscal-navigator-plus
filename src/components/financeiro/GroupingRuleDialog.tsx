import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MATCH_FIELD_OPTIONS, SUB_GROUP_FIELD_OPTIONS, type GroupingRule, type GroupingRuleInput } from "@/hooks/useGroupingRules";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: GroupingRule | null;
  onSubmit: (data: GroupingRuleInput & { id?: string }) => void;
  isLoading: boolean;
}

export default function GroupingRuleDialog({ open, onOpenChange, rule, onSubmit, isLoading }: Props) {
  const [name, setName] = useState("");
  const [matchField, setMatchField] = useState("categoria");
  const [matchValue, setMatchValue] = useState("");
  const [subGroupField, setSubGroupField] = useState<string>("__none__");
  const [minItems, setMinItems] = useState(2);
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setMatchField(rule.match_field);
      setMatchValue(rule.match_value);
      setSubGroupField(rule.sub_group_field ?? "__none__");
      setMinItems(rule.min_items);
      setPriority(rule.priority);
      setEnabled(rule.enabled);
    } else {
      setName("");
      setMatchField("categoria");
      setMatchValue("");
      setSubGroupField("__none__");
      setMinItems(2);
      setPriority(0);
      setEnabled(true);
    }
  }, [rule, open]);

  const handleSubmit = () => {
    onSubmit({
      ...(rule ? { id: rule.id } : {}),
      name,
      match_field: matchField,
      match_value: matchValue,
      sub_group_field: subGroupField === "__none__" ? null : subGroupField,
      min_items: minItems,
      priority,
      enabled,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar Regra" : "Nova Regra de Aglutinação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Regra</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pessoal, Impostos" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Campo de Agrupamento</Label>
              <Select value={matchField} onValueChange={setMatchField}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_FIELD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="Ex: dp, Pessoal" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sub-agrupamento (opcional)</Label>
            <Select value={subGroupField} onValueChange={setSubGroupField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {SUB_GROUP_FIELD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mínimo de Itens</Label>
              <Input type="number" min={2} value={minItems} onChange={(e) => setMinItems(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label className="cursor-pointer">Regra ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name || !matchValue || isLoading}>
            {rule ? "Salvar" : "Criar Regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
