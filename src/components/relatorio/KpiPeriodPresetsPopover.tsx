import { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Star, Check, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useKpiPeriodPresets, type KpiPeriodPreset } from "@/hooks/useKpiPeriodPresets";
import { validateRange } from "@/lib/kpiRangeValidation";
import { cn } from "@/lib/utils";

interface Props {
  /** ISO yyyy-MM-dd do "from" atualmente aplicado na URL */
  currentFrom: string;
  /** ISO yyyy-MM-dd do "to" atualmente aplicado na URL */
  currentTo: string;
  /** Aplica o range selecionado (ex.: atualiza searchParams) */
  onApply: (from: string, to: string) => void;
  /** Quando true, o KPI ignora o range (ex.: scopeIsCurrentMonth) */
  disabled?: boolean;
}

const fmtRange = (from: string, to: string) => {
  try {
    return `${format(parseISO(from), "MMM/yyyy", { locale: ptBR })} – ${format(
      parseISO(to),
      "MMM/yyyy",
      { locale: ptBR },
    )}`;
  } catch {
    return `${from} – ${to}`;
  }
};

export function KpiPeriodPresetsPopover({ currentFrom, currentTo, onApply, disabled }: Props) {
  const { presets, isLoading, savePreset, deletePreset, isSaving } = useKpiPeriodPresets();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = !isLoading && presets.length === 0;

  const activePresetId = useMemo(() => {
    return presets.find((p) => p.range_from === currentFrom && p.range_to === currentTo)?.id ?? null;
  }, [presets, currentFrom, currentTo]);

  const handleApply = (p: KpiPeriodPreset) => {
    onApply(p.range_from, p.range_to);
    setOpen(false);
  };

  const rangeValidation = useMemo(
    () => validateRange(currentFrom, currentTo),
    [currentFrom, currentTo],
  );

  const handleSave = async () => {
    if (!rangeValidation.ok) return;
    try {
      await savePreset(name, currentFrom, currentTo);
      setName("");
      setShowForm(false);
    } catch {
      // toast já exibido no hook
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && isEmpty) {
      // estado vazio → foca direto no form de criação
      setShowForm(true);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    } else if (!next) {
      setShowForm(false);
      setConfirmDelete(null);
      setName("");
    }
  };

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={disabled}
      aria-label="Presets de período"
    >
      <Star size={14} className={cn(activePresetId && "fill-primary text-primary")} />
      Presets
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {disabled ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span necessário para tooltip funcionar com botão disabled */}
                <span tabIndex={0}>{trigger}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Este KPI usa o mês corrente — presets não se aplicam</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          trigger
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border/60">
          <p className="text-sm font-semibold text-foreground">Presets de período</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Atalhos para combinações que você usa com frequência.
          </p>
        </div>

        {/* Lista */}
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-xs text-muted-foreground">Carregando…</p>
          ) : isEmpty ? (
            <p className="p-4 text-xs text-muted-foreground">
              Salve combinações de período que você usa com frequência.
            </p>
          ) : (
            <ul className="py-1">
              {presets.map((p) => {
                const isActive = p.id === activePresetId;
                const isConfirming = confirmDelete === p.id;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors",
                      isActive && "bg-primary/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleApply(p)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        {isActive && <Check size={12} className="text-primary shrink-0" />}
                        <span className="text-sm font-medium text-foreground truncate">
                          {p.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">
                        {fmtRange(p.range_from, p.range_to)}
                      </p>
                    </button>
                    {isConfirming ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={async () => {
                            await deletePreset(p.id);
                            setConfirmDelete(null);
                          }}
                        >
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setConfirmDelete(null)}
                          aria-label="Cancelar exclusão"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(p.id)}
                        aria-label={`Excluir preset ${p.name}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Form salvar atual */}
        <div className="p-3 border-t border-border/60 space-y-2">
          {!showForm ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => {
                setShowForm(true);
                setTimeout(() => nameInputRef.current?.focus(), 50);
              }}
            >
              <Plus size={14} /> Salvar período atual como preset
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Salvando: <span className="font-medium text-foreground capitalize">
                  {fmtRange(currentFrom, currentTo)}
                </span>
              </p>
              {!rangeValidation.ok && (
                <p
                  className="text-xs text-destructive"
                  role="alert"
                  aria-live="polite"
                >
                  {rangeValidation.message}
                </p>
              )}
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="Ex.: Operações do 1º semestre"
                className="h-9"
                maxLength={60}
                disabled={!rangeValidation.ok}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && rangeValidation.ok) handleSave();
                  if (e.key === "Escape") {
                    setShowForm(false);
                    setName("");
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{name.length}/60</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setShowForm(false);
                      setName("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleSave}
                    disabled={!name.trim() || isSaving || !rangeValidation.ok}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
