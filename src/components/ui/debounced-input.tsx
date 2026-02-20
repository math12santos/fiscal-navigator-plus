import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface DebouncedInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  value: string | number;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export function DebouncedInput({ value: externalValue, onChange, debounceMs = 600, ...props }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(String(externalValue));
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync from external only when not actively editing
  useEffect(() => {
    setLocalValue(String(externalValue));
  }, [externalValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChangeRef.current(val);
    }, debounceMs);
  }, [debounceMs]);

  // Flush on blur
  const handleBlur = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    onChangeRef.current(localValue);
  }, [localValue]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return <Input {...props} value={localValue} onChange={handleChange} onBlur={handleBlur} />;
}
