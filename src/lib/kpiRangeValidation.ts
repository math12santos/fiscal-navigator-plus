/**
 * Validações de range de período para o Relatório KPI.
 *
 * Centraliza as regras aplicadas em todos os pontos onde o usuário escolhe
 * ou aplica um intervalo de datas (URL, presets, formulários):
 *  - Datas precisam ser parseáveis (ISO yyyy-MM-dd).
 *  - `to >= from` (não permite range invertido).
 *  - Anos entre MIN_YEAR e MAX_YEAR (alinhado com a regra de entrada de
 *    datas do projeto — `mem://constraints/date-entry-logic`).
 *  - Janela máxima de MAX_YEARS_SPAN anos para evitar drill-downs com
 *    centenas de milhares de linhas (UX e performance).
 *
 * As validações vivem no client; o trigger SQL de `kpi_period_presets`
 * já garante `range_from <= range_to` no servidor (defesa em profundidade).
 */

import { parseISO, isValid, differenceInCalendarDays } from "date-fns";

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;
export const MAX_YEARS_SPAN = 5;

export type RangeValidationReason =
  | "invalid_date"
  | "inverted"
  | "out_of_bounds"
  | "too_wide";

export interface RangeValidationResult {
  ok: boolean;
  reason?: RangeValidationReason;
  message?: string;
}

const isYyyyMmDd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function validateRange(from: string, to: string): RangeValidationResult {
  if (!from || !to || !isYyyyMmDd(from) || !isYyyyMmDd(to)) {
    return {
      ok: false,
      reason: "invalid_date",
      message: "Datas inválidas — informe um período no formato AAAA-MM-DD.",
    };
  }

  const dFrom = parseISO(from);
  const dTo = parseISO(to);
  if (!isValid(dFrom) || !isValid(dTo)) {
    return {
      ok: false,
      reason: "invalid_date",
      message: "Datas inválidas — verifique os valores informados.",
    };
  }

  const yFrom = dFrom.getFullYear();
  const yTo = dTo.getFullYear();
  if (yFrom < MIN_YEAR || yFrom > MAX_YEAR || yTo < MIN_YEAR || yTo > MAX_YEAR) {
    return {
      ok: false,
      reason: "out_of_bounds",
      message: `O período deve estar entre ${MIN_YEAR} e ${MAX_YEAR}.`,
    };
  }

  if (dTo.getTime() < dFrom.getTime()) {
    return {
      ok: false,
      reason: "inverted",
      message: "A data fim não pode ser anterior à data início.",
    };
  }

  // Janela máxima: MAX_YEARS_SPAN anos (em dias, com folga para anos bissextos).
  const maxDays = MAX_YEARS_SPAN * 366 + 1;
  if (differenceInCalendarDays(dTo, dFrom) > maxDays) {
    return {
      ok: false,
      reason: "too_wide",
      message: `Janela muito ampla — limite de ${MAX_YEARS_SPAN} anos para o drill-down.`,
    };
  }

  return { ok: true };
}
