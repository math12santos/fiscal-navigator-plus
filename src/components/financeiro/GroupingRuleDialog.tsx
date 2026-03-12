import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MATCH_FIELD_OPTIONS, OPERATOR_OPTIONS, SOURCE_OPTIONS, SUB_GROUP_FIELD_OPTIONS, type GroupingRule, type GroupingRuleInput } from "@/hooks/useGroupingRules";

interface ValueOption {
  value: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: GroupingRule | null;
  onSubmit: (data: GroupingRuleInput & { id?: string }) => void;
  isLoading: boolean;
  categoryOptions?: ValueOption[];
  entityOptions?: ValueOption[];
  costCenterOptions?: ValueOption[];
  groupOptions?: ValueOption[];
}

export default function GroupingRuleDialog({
  open, onOpenChange, rule, onSubmit, isLoading,
  categoryOptions = [], entityOptions = [], costCenterOptions = [], groupOptions = [],
}: Props) {
  const [name, setName] = useState("");
  const [matchField, setMatchField] = useState("categoria");
  const [matchValue, setMatchValue] = useState("");
  const [operator, setOperator] = useState("equals");
  const [matchKeyword, setMatchKeyword] = useState("");
  const [subGroupField, setSubGroupField] = useState<string>("__none__");
  const [groupId, setGroupId] = useState<string>("__none__");
  const [minItems, setMinItems] = useState(2);
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setMatchField(rule.match_field);
      setMatchValue(rule.match_value);
      setOperator(rule.operator || "equals");
      setMatchKeyword(rule.match_keyword ?? "");
      setSubGroupField(rule.sub_group_field ?? "__none__");
      setGroupId(rule.group_id ?? "__none__");
      setMinItems(rule.min_items);
      setPriority(rule.priority);
      setEnabled(rule.enabled);
    } else {
      setName("");
      setMatchField("categoria");
      setMatchValue("");
      setOperator("equals");
      setMatchKeyword("");
      setSubGroupField("__none__");
      setGroupId("__none__");
      setMinItems(2);
      setPriority(0);
      setEnabled(true);
    }
  }, [rule, open]);

  // Clear matchValue when field changes
  const handleFieldChange = (val: string) => {
    setMatchField(val);
    setMatchValue("");
    setMatchKeyword("");
  };

  const handleSubmit = () => {
    onSubmit({
      ...(rule ? { id: rule.id } : {}),
      name,
      match_field: matchField,
      match_value: matchField === "descricao" ? "" : matchValue,
      operator,
      match_keyword: matchField === "descricao" ? matchKeyword : null,
      sub_group_field: subGroupField === "__none__" ? null : subGroupField,
      group_id: groupId === "__none__" ? null : groupId,
      min_items: minItems,
      priority,
      enabled,
    });
  };

  /** Dynamic value options based on matchField */
  const getValueOptions = (): ValueOption[] => {
    switch (matchField) {
      case "source": return SOURCE_OPTIONS;
      case "categoria": return categoryOptions;
      case "entity_id": return entityOptions;
      case "cost_center_id": return costCenterOptions;
      default: return [];
    }
  };

  const valueOptions = getValueOptions();
  const showValueSelect = matchField !== "descricao" && valueOptions.length > 0;
  const showKeywordInput = matchField === "descricao";

  const isValid = name && (showKeywordInput ? matchKeyword : matchValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar Regra" : "Nova Regra de Classificação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Regra</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pessoal, Impostos" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Campo</Label>
              <Select value={matchField} onValueChange={handleFieldChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_FIELD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operador</Label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showValueSelect && (
            <div className="space-y-2">
              <Label>Valor</Label>
              <Select value={matchValue} onValueChange={setMatchValue}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {valueOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showKeywordInput && (
            <div className="space-y-2">
              <Label>Palavra-chave</Label>
              <Input
                value={matchKeyword}
                onChange={(e) => setMatchKeyword(e.target.value)}
                placeholder="Ex: aluguel, energia"
              />
              <p className="text-xs text-muted-foreground">Busca na descrição do lançamento usando o operador selecionado.</p>
            </div>
          )}

          {!showValueSelect && !showKeywordInput && (
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="Valor de comparação" />
            </div>
          )}

          {groupOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Grupo Destino</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Selecione o grupo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (usar nome da regra)</SelectItem>
                  {groupOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {rule ? "Salvar" : "Criar Regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
