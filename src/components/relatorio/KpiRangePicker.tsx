import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validateRange } from "@/lib/kpiRangeValidation";

interface Props {
  /** ISO yyyy-MM-dd atualmente aplicado na URL */
  currentFrom: string;
  currentTo: string;
  /** Callback chamado após debounce com o novo intervalo válido */
  onApply: (from: string, to: string) => void;
  /** Quando true, o KPI ignora o range (ex.: scopeIsCurrentMonth) */
  disabled?: boolean;
  /** Atraso do debounce em ms. Padrão: 500ms — equilíbrio entre responsividade
   *  e evitar requests durante a digitação caractere a caractere. */
  debounceMs?: number;
}

/**
 * Seletor de período (from/to) com auto-aplicação por debounce.
 *
 * Princípios:
 *  - **Sem botão "Aplicar"**: cada alteração válida no from/to dispara
 *    `onApply` após ~500ms de inatividade. Evita requests durante a digitação
 *    (ex.: usuário ainda escrevendo o ano "2025").
 *  - **Validação inline**: usa `validateRange` (mesma regra do preset). Range
 *    inválido NÃO dispara `onApply` — mantém o estado anterior na URL e
 *    mostra mensagem destrutiva embaixo do campo afetado.
 *  - **Sincronização externa**: se a URL muda por outro caminho (ex.: aplicar
 *    um preset), os inputs refletem o novo valor sem disparar callback.
 */
export function KpiRangePicker({
  currentFrom,
  currentTo,
  onApply,
  disabled,
  debounceMs = 500,
}: Props) {
  const [localFrom, setLocalFrom] = useState(currentFrom);
  const [localTo, setLocalTo] = useState(currentTo);
  const timerRef = useRef<number | null>(null);
  // Marca quando a próxima atualização externa veio do próprio onApply,
  // para não disparar um efeito de "echo" e iniciar outro debounce.
  const lastEmittedRef = useRef<string>(`${currentFrom}|${currentTo}`);

  // Sincroniza inputs quando a URL muda externamente (preset aplicado, etc.).
  useEffect(() => {
    const externalKey = `${currentFrom}|${currentTo}`;
    if (externalKey === lastEmittedRef.current) return;
    setLocalFrom(currentFrom);
    setLocalTo(currentTo);
  }, [currentFrom, currentTo]);

  const validation = validateRange(localFrom, localTo);

  // Debounce: agenda a aplicação ~debounceMs após a última alteração.
  // Só dispara se (a) o range é válido e (b) realmente mudou em relação ao
  // que está na URL — evita refetch desnecessário.
  useEffect(() => {
    if (disabled) return;
    if (!validation.ok) return;
    if (localFrom === currentFrom && localTo === currentTo) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      lastEmittedRef.current = `${localFrom}|${localTo}`;
      onApply(localFrom, localTo);
    }, debounceMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // currentFrom/currentTo entram para "cancelar" o debounce caso a URL
    // já tenha sido atualizada externamente para o mesmo valor.
  }, [localFrom, localTo, currentFrom, currentTo, disabled, debounceMs, onApply, validation.ok]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const isInverted = validation.reason === "inverted";
  const isOutOfBounds = validation.reason === "out_of_bounds";
  const isTooWide = validation.reason === "too_wide";
  const isInvalidDate = validation.reason === "invalid_date";

  // Marcamos o "to" como destacado nos casos onde o erro é claramente atribuível a ele
  const toHasError = !validation.ok && (isInverted || isOutOfBounds || isTooWide);
  const fromHasError = !validation.ok && (isInvalidDate || isOutOfBounds);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="kpi-range-from">
            Início
          </label>
          <Input
            id="kpi-range-from"
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            disabled={disabled}
            className={cn("h-8 w-[150px] text-xs", fromHasError && "border-destructive focus-visible:ring-destructive")}
            aria-invalid={fromHasError || undefined}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="kpi-range-to">
            Fim
          </label>
          <Input
            id="kpi-range-to"
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            disabled={disabled}
            className={cn("h-8 w-[150px] text-xs", toHasError && "border-destructive focus-visible:ring-destructive")}
            aria-invalid={toHasError || undefined}
          />
        </div>
      </div>
      {!validation.ok ? (
        <p className="text-[11px] text-destructive" role="alert" aria-live="polite">
          {validation.message}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Atualiza automaticamente após você escolher as datas.
        </p>
      )}
    </div>
  );
}
