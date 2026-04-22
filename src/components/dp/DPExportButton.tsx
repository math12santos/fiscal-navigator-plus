import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

interface DPExportButtonProps {
  onPdf?: () => void;
  onExcel?: () => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Botão padronizado de Exportar (PDF/Excel) usado em todas as abas do DP.
 * Quando apenas uma das opções é fornecida, vira um botão simples ao invés de dropdown.
 */
export function DPExportButton({ onPdf, onExcel, disabled, label = "Exportar" }: DPExportButtonProps) {
  if (onPdf && onExcel) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <Download size={14} className="mr-1.5" /> {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onPdf}>
            <FileText size={14} className="mr-2" /> Exportar PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExcel}>
            <FileSpreadsheet size={14} className="mr-2" /> Exportar Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onPdf || onExcel}>
      {onPdf ? <FileText size={14} className="mr-1.5" /> : <FileSpreadsheet size={14} className="mr-1.5" />}
      {label}
    </Button>
  );
}
