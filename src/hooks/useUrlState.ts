import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Persist a piece of state in the URL query string.
 * - Reads from `?<key>=...` on mount
 * - Writes via `setValue()`; uses `replace` to avoid spamming history
 * - Empty / null / undefined / equal-to-defaultValue values are removed from the URL
 */
export function useUrlState(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (!next || next === defaultValue) sp.delete(key);
          else sp.set(key, next);
          return sp;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setParams],
  );

  return [value, setValue];
}
