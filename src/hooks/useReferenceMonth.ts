import { useCallback, useEffect, useState } from "react";
import { startOfMonth, isSameMonth, isAfter, isBefore } from "date-fns";

const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

const clampToBounds = (d: Date) => {
  const y = d.getFullYear();
  if (y < MIN_YEAR) return new Date(MIN_YEAR, 0, 1);
  if (y > MAX_YEAR) return new Date(MAX_YEAR, 11, 1);
  return startOfMonth(d);
};

const storageKey = (scope: string) => `referenceMonth.${scope}`;

const readFromSession = (scope: string): Date | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return clampToBounds(parsed);
  } catch {
    return null;
  }
};

/**
 * Per-page reference month with sessionStorage persistence.
 * Always returns the first day of the month at 00:00 local time.
 */
export function useReferenceMonth(scope: string) {
  const [referenceMonth, setReferenceMonthState] = useState<Date>(() => {
    const stored = readFromSession(scope);
    return stored ?? startOfMonth(new Date());
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(scope), referenceMonth.toISOString());
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [scope, referenceMonth]);

  const setReferenceMonth = useCallback((d: Date) => {
    setReferenceMonthState(clampToBounds(d));
  }, []);

  const resetToToday = useCallback(() => {
    setReferenceMonthState(startOfMonth(new Date()));
  }, []);

  const today = startOfMonth(new Date());
  const isCurrent = isSameMonth(referenceMonth, today);
  const isFuture = isAfter(referenceMonth, today);
  const isPast = isBefore(referenceMonth, today);

  return {
    referenceMonth,
    setReferenceMonth,
    resetToToday,
    isCurrent,
    isFuture,
    isPast,
    minDate: new Date(MIN_YEAR, 0, 1),
    maxDate: new Date(MAX_YEAR, 11, 1),
  };
}
