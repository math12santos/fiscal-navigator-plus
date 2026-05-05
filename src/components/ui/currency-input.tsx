import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value?: number | null;
  onValueChange: (v: number) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Currency input — padrão contábil BR (R$ 1.234,56). Armazena number. */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, placeholder = "R$ 0,00", ...rest }, ref) => {
    const [text, setText] = React.useState<string>(
      value && value > 0 ? fmt(value) : "",
    );

    React.useEffect(() => {
      const next = value && value > 0 ? fmt(value) : "";
      setText((prev) => {
        // só atualiza se o número mudou (evita loop ao digitar)
        const parsedPrev = parseFloat(prev.replace(/\./g, "").replace(",", ".")) || 0;
        return Math.abs(parsedPrev - (value || 0)) > 0.001 ? next : prev;
      });
    }, [value]);

    const handle = (raw: string) => {
      // mantém apenas dígitos, divide por 100
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        setText("");
        onValueChange(0);
        return;
      }
      const cents = parseInt(digits, 10);
      const num = cents / 100;
      setText(fmt(num));
      onValueChange(num);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          R$
        </span>
        <Input
          ref={ref}
          inputMode="numeric"
          className={cn("pl-9 text-right tabular-nums", className)}
          value={text}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          {...rest}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
